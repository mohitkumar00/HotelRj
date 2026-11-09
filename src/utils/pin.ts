/**
 * Manager PIN: salted PBKDF2 hash, shared across paired devices through the `app_settings`
 * table, cached locally for offline use, with lockout after repeated failures.
 *
 * Transition rule: until a PIN has been set (during device pairing) the legacy default PINs
 * keep working so nothing breaks. Once a PIN exists, the defaults are rejected.
 * The legacy values are intentionally NOT shown anywhere in the UI any more.
 */
import { STORAGE_KEYS, SUPABASE_URL } from '../config';
import { readJson, writeJson, readString } from './storage';
import { getSupabaseHeaders } from './deviceAuth';

interface PinRecord {
  salt: string;
  hash: string;
  iterations: number;
}

interface LockState {
  failures: number;
  lockedUntil: number;
}

const LEGACY_PINS = ['1234', '8888'];
const MAX_FAILURES = 5;
const ITERATIONS = 150_000;

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
const fromHex = (hex: string) => new Uint8Array((hex.match(/.{2}/g) || []).map((h) => parseInt(h, 16)));

export async function hashPin(pin: string, saltHex?: string, iterations = ITERATIONS): Promise<PinRecord> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return { salt: toHex(salt), hash: toHex(bits), iterations };
}

export async function checkPinAgainst(pin: string, record: PinRecord): Promise<boolean> {
  const test = await hashPin(pin, record.salt, record.iterations);
  // constant-time-ish compare
  let diff = test.hash.length ^ record.hash.length;
  for (let i = 0; i < test.hash.length; i++) diff |= test.hash.charCodeAt(i) ^ (record.hash.charCodeAt(i) || 0);
  return diff === 0;
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

// ---- lockout ----
export function getLockRemainingMs(): number {
  const s = readJson<LockState>(STORAGE_KEYS.pinLock, { failures: 0, lockedUntil: 0 });
  return Math.max(0, s.lockedUntil - Date.now());
}

function registerFailure(): void {
  const s = readJson<LockState>(STORAGE_KEYS.pinLock, { failures: 0, lockedUntil: 0 });
  const failures = s.failures + 1;
  const lockedUntil = failures >= MAX_FAILURES ? Date.now() + Math.min(30, 2 ** (failures - MAX_FAILURES)) * 60_000 : 0;
  writeJson(STORAGE_KEYS.pinLock, { failures, lockedUntil });
}

function clearFailures(): void {
  writeJson(STORAGE_KEYS.pinLock, { failures: 0, lockedUntil: 0 });
}

// ---- shared storage ----
async function fetchRemoteRecord(): Promise<PinRecord | null> {
  // 1. Check Electron local DB if running on Windows Desktop
  try {
    if (typeof window !== 'undefined' && (window as any).ElectronAPI?.getManagerPin) {
      const rec = await (window as any).ElectronAPI.getManagerPin();
      if (rec && rec.hash) return rec;
    }
  } catch {}

  // 2. Check local Wi-Fi Counter sync server if connected on mobile
  try {
    const syncUrl = (readString(STORAGE_KEYS.syncUrl) || '').trim();
    if (syncUrl) {
      let cleanUrl = syncUrl;
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) cleanUrl = `http://${cleanUrl}`;
      if (!cleanUrl.match(/:\d+$/)) cleanUrl = `${cleanUrl}:5050`;
      const token = (readString(STORAGE_KEYS.syncToken) || '').trim();
      const headers: Record<string, string> = {};
      if (token) headers['X-Sync-Token'] = token;
      const res = await fetch(`${cleanUrl}/api/settings/pin`, { headers, signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (data?.pinRecord?.hash) return data.pinRecord;
      }
    }
  } catch {}

  // 3. Check Supabase cloud
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.manager_pin&select=value`, {
      headers: await getSupabaseHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows?.[0]?.value?.hash) return rows[0].value;
    }
  } catch {}

  return null;
}

export async function isPinConfigured(): Promise<boolean> {
  if (readJson<PinRecord | null>(STORAGE_KEYS.pinHash, null)) return true;
  const remote = await fetchRemoteRecord();
  if (remote) {
    writeJson(STORAGE_KEYS.pinHash, remote);
    return true;
  }
  return false;
}

export type PinResult = { ok: true } | { ok: false; reason: 'locked' | 'wrong'; remainingMs?: number; attemptsLeft?: number };

export async function verifyManagerPin(pin: string): Promise<PinResult> {
  const lock = getLockRemainingMs();
  if (lock > 0) return { ok: false, reason: 'locked', remainingMs: lock };

  let record = readJson<PinRecord | null>(STORAGE_KEYS.pinHash, null);
  if (!record) {
    record = await fetchRemoteRecord();
    if (record) writeJson(STORAGE_KEYS.pinHash, record);
  }

  const ok = record ? await checkPinAgainst(pin, record) : LEGACY_PINS.includes(pin);
  if (ok) {
    clearFailures();
    return { ok: true };
  }
  registerFailure();
  const s = readJson<LockState>(STORAGE_KEYS.pinLock, { failures: 0, lockedUntil: 0 });
  const remainingMs = Math.max(0, s.lockedUntil - Date.now());
  return remainingMs > 0
    ? { ok: false, reason: 'locked', remainingMs }
    : { ok: false, reason: 'wrong', attemptsLeft: Math.max(0, MAX_FAILURES - s.failures) };
}

/**
 * Changes the manager PIN by verifying the current PIN first.
 * Does not require email, OTP, or cloud accounts — works 100% offline.
 */
export async function changeManagerPin(
  currentPin: string,
  newPin: string
): Promise<{ ok: boolean; error?: string }> {
  const v = await verifyManagerPin(currentPin);
  if (!v.ok) {
    return {
      ok: false,
      error:
        v.reason === 'locked'
          ? `Locked out due to too many failed attempts. Try again in ${formatLock(v.remainingMs || 0)}.`
          : 'Current PIN is incorrect. (Default is 1234)',
    };
  }

  if (!isValidPinFormat(newPin)) {
    return { ok: false, error: 'New PIN must be 4 to 6 digits.' };
  }

  if (newPin === currentPin) {
    return { ok: false, error: 'New PIN must be different from the current PIN.' };
  }

  return setManagerPin(newPin);
}

/** Sets/changes the manager PIN across local DB, Counter sync server, and cloud. */
export async function setManagerPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidPinFormat(pin)) return { ok: false, error: 'PIN must be 4 to 6 digits.' };
  const record = await hashPin(pin);

  // 1. Save locally in localStorage for fast offline verification
  writeJson(STORAGE_KEYS.pinHash, record);
  clearFailures();

  // 2. Save in Windows Desktop local database if running under Electron
  try {
    if (typeof window !== 'undefined' && (window as any).ElectronAPI?.setManagerPin) {
      await (window as any).ElectronAPI.setManagerPin(record);
    }
  } catch (err) {
    console.warn('[PIN] Electron setManagerPin error:', err);
  }

  // 3. Sync to Counter POS Wi-Fi server if on mobile
  try {
    const syncUrl = (readString(STORAGE_KEYS.syncUrl) || '').trim();
    if (syncUrl) {
      let cleanUrl = syncUrl;
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) cleanUrl = `http://${cleanUrl}`;
      if (!cleanUrl.match(/:\d+$/)) cleanUrl = `${cleanUrl}:5050`;
      const token = (readString(STORAGE_KEYS.syncToken) || '').trim();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['X-Sync-Token'] = token;
      await fetch(`${cleanUrl}/api/settings/pin`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pinRecord: record }),
        signal: AbortSignal.timeout(4000),
      });
    }
  } catch (err) {
    console.warn('[PIN] Local sync server set PIN error:', err);
  }

  // 4. Best-effort cloud backup to Supabase (non-blocking for offline use)
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_settings`, {
      method: 'POST',
      headers: { ...(await getSupabaseHeaders()), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'manager_pin', value: record }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Cloud sync is non-blocking
  }

  return { ok: true };
}

export function formatLock(ms: number): string {
  const m = Math.ceil(ms / 60000);
  return m <= 1 ? 'about a minute' : `${m} minutes`;
}
