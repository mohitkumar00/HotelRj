/**
 * Manager PIN: salted PBKDF2 hash, shared across paired devices through the `app_settings`
 * table, cached locally for offline use, with lockout after repeated failures.
 *
 * Transition rule: until a PIN has been set (during device pairing) the legacy default PINs
 * keep working so nothing breaks. Once a PIN exists, the defaults are rejected.
 * The legacy values are intentionally NOT shown anywhere in the UI any more.
 */
import { STORAGE_KEYS, SUPABASE_URL } from '../config';
import { readJson, writeJson } from './storage';
import { getAccessToken, getSupabaseHeaders } from './deviceAuth';

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
  if (!(await getAccessToken())) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.manager_pin&select=value`, {
      headers: await getSupabaseHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.value || null;
  } catch {
    return null;
  }
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

/** Sets/changes the shared manager PIN. Requires a paired device. */
export async function setManagerPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidPinFormat(pin)) return { ok: false, error: 'PIN must be 4 to 6 digits.' };
  if (!(await getAccessToken())) return { ok: false, error: 'Pair this device first.' };
  const record = await hashPin(pin);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings`, {
      method: 'POST',
      headers: { ...(await getSupabaseHeaders()), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'manager_pin', value: record }),
    });
    if (!res.ok) return { ok: false, error: `Could not save PIN (HTTP ${res.status}). Apply the RLS migration first.` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
  writeJson(STORAGE_KEYS.pinHash, record);
  clearFailures();
  return { ok: true };
}

export function formatLock(ms: number): string {
  const m = Math.ceil(ms / 60000);
  return m <= 1 ? 'about a minute' : `${m} minutes`;
}
