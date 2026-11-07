import { STORAGE_KEYS, SYNC_SERVER_PORT } from '../config';
import { readString } from './storage';

/**
 * Base URL of the Counter PC Wi-Fi sync server (no trailing slash), or '' when no local server can
 * be reached from here (public HTTPS site with no manually configured counter address).
 *
 * Order: saved counter address -> same origin when served by the sync server -> loopback (desktop/dev).
 */
export function getApiBaseUrl(): string {
  const saved = (readString(STORAGE_KEYS.syncUrl) || readString(STORAGE_KEYS.legacySyncUrl) || '').trim();
  if (saved) {
    const withScheme = /^https?:\/\//i.test(saved) ? saved : `http://${saved}`;
    return withScheme.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    if (window.location.origin.includes(`:${SYNC_SERVER_PORT}`)) return window.location.origin;
    // Public HTTPS pages (Vercel / GitHub Pages) cannot call http://127.0.0.1 (mixed content).
    if (window.location.protocol === 'https:') return '';
  }
  return `http://127.0.0.1:${SYNC_SERVER_PORT}`;
}
