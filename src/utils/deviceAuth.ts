/**
 * Device pairing (staff never log in).
 *
 * The owner verifies ONE OTP (sent to the owner's mobile) on each device. Supabase then issues a
 * long-lived session that this device keeps. Database writes use that session; the public website
 * keeps using the anon key, which RLS limits to read-only public tables.
 *
 * Until a device is paired, requests fall back to the anon key, so behaviour is unchanged until the
 * RLS migration (supabase/migrations) is applied.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL, STORAGE_KEYS } from '../config';
import { readJson, removeKey, writeJson } from './storage';

export interface CloudSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds. */
  expiresAt: number;
  email?: string;
}

const AUTH = `${SUPABASE_URL}/auth/v1`;
const baseHeaders = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };

function electron(): any {
  return typeof window !== 'undefined' ? (window as any).ElectronAPI : undefined;
}

/** Trims and lower-cases an email address. Returns null if it is not a plausible address. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

function toSession(json: any, email?: string): CloudSession {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at || Math.floor(Date.now() / 1000) + (json.expires_in || 3600),
    email,
  };
}

function authError(json: any, fallback: string): string {
  return json?.msg || json?.error_description || json?.message || json?.error || fallback;
}

export function decodeSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).session_id || null;
  } catch {
    return null;
  }
}

/** Step 1: email a 6-digit OTP to the owner. Only pre-created users can receive one. */
export async function requestPairingOtp(emailInput: string): Promise<{ ok: boolean; email?: string; error?: string }> {
  const email = normalizeEmail(emailInput);
  if (!email) return { ok: false, error: 'Enter a valid email address.' };
  try {
    const res = await fetch(`${AUTH}/otp`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ email, create_user: false }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false, error: authError(json, `OTP request failed (HTTP ${res.status}).`) };
    }
    return { ok: true, email };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error while sending OTP.' };
  }
}

/** Step 2: verify the OTP, store the session on this device. */
export async function verifyPairingOtp(email: string, token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${AUTH}/verify`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ type: 'email', email, token: token.trim() }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) return { ok: false, error: authError(json, 'Incorrect or expired OTP.') };
    await saveSession(toSession(json, email));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error while verifying OTP.' };
  }
}

/**
 * Pair with the owner-defined pairing code (the password of the single Supabase "device" user).
 * No email needed. The code can be rotated by the owner later (see docs/SECURITY_SETUP.md).
 */
export async function pairWithCode(emailInput: string, code: string): Promise<{ ok: boolean; email?: string; error?: string }> {
  const email = normalizeEmail(emailInput);
  if (!email) return { ok: false, error: 'Enter the pairing account email.' };
  if (!code.trim()) return { ok: false, error: 'Enter the pairing code.' };
  try {
    const res = await fetch(`${AUTH}/token?grant_type=password`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ email, password: code }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) {
      const wrong = res.status === 400 || json?.error_code === 'invalid_credentials';
      return { ok: false, error: wrong ? 'Wrong pairing email or code.' : authError(json, `Pairing failed (HTTP ${res.status}).`) };
    }
    await saveSession(toSession(json, email));
    return { ok: true, email };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error while pairing.' };
  }
}

async function saveSession(session: CloudSession): Promise<void> {
  const el = electron();
  if (el?.setCloudSession) {
    // Electron main process owns refresh-token rotation (single owner avoids reuse errors).
    await el.setCloudSession(session);
    return;
  }
  writeJson(STORAGE_KEYS.session, session);
}

export function loadSession(): CloudSession | null {
  return readJson<CloudSession | null>(STORAGE_KEYS.session, null);
}

let refreshing: Promise<CloudSession | null> | null = null;

async function refresh(session: CloudSession): Promise<CloudSession | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch(`${AUTH}/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ refresh_token: session.refreshToken }),
        signal: AbortSignal.timeout(10000),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.access_token) {
        const next = toSession(json, session.email);
        writeJson(STORAGE_KEYS.session, next);
        return next;
      }
      // Refresh token rejected: device was revoked or signed out everywhere.
      if (res.status === 400 || res.status === 401 || res.status === 403) removeKey(STORAGE_KEYS.session);
    } catch {
      /* offline: keep the old session, caller falls back */
    } finally {
      refreshing = null;
    }
    return null;
  })();
  return refreshing;
}

/** Returns a valid access token for a paired device, or null if this device is not paired. */
export async function getAccessToken(): Promise<string | null> {
  const el = electron();
  if (el?.getCloudAccessToken) {
    try {
      return (await el.getCloudAccessToken()) || null;
    } catch {
      return null;
    }
  }
  const session = loadSession();
  if (!session) return null;
  if (session.expiresAt - 60 > Math.floor(Date.now() / 1000)) return session.accessToken;
  const next = await refresh(session);
  return next ? next.accessToken : session.accessToken;
}

export async function isDevicePaired(): Promise<boolean> {
  return !!(await getAccessToken());
}

/** Headers for Supabase REST calls: paired device -> its session, otherwise the public anon key. */
export async function getSupabaseHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
  };
}

export async function unpairThisDevice(): Promise<void> {
  const el = electron();
  const token = await getAccessToken();
  const sid = token ? decodeSessionId(token) : null;
  if (sid) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/paired_devices?session_id=eq.${sid}`, {
        method: 'PATCH',
        headers: { ...(await getSupabaseHeaders()), Prefer: 'return=minimal' },
        body: JSON.stringify({ revoked: true }),
      });
    } catch {
      /* best effort */
    }
  }
  if (el?.clearCloudSession) await el.clearCloudSession();
  removeKey(STORAGE_KEYS.session);
}

// -------------------------------------------------------------
// Paired device registry (owner can revoke a lost phone)
// -------------------------------------------------------------
export interface PairedDevice {
  session_id: string;
  label: string;
  paired_at: string;
  revoked: boolean;
}

export async function registerThisDevice(label: string): Promise<{ ok: boolean; error?: string }> {
  const token = await getAccessToken();
  const sid = token ? decodeSessionId(token) : null;
  if (!sid) return { ok: false, error: 'No active session to register.' };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/paired_devices`, {
      method: 'POST',
      headers: { ...(await getSupabaseHeaders()), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ session_id: sid, label: label.trim() || 'Device', revoked: false }),
    });
    if (!res.ok) return { ok: false, error: `Could not register device (HTTP ${res.status}). Has the RLS migration been applied?` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function listPairedDevices(): Promise<PairedDevice[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/paired_devices?select=*&order=paired_at.desc`, {
      headers: await getSupabaseHeaders(),
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function revokeDevice(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/paired_devices?session_id=eq.${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      headers: { ...(await getSupabaseHeaders()), Prefer: 'return=minimal' },
      body: JSON.stringify({ revoked: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
