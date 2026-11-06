import { STORAGE_KEYS, SYNC_SERVER_PORT } from '../config';
import { readString } from './storage';

/**
 * Adds the Counter PC pairing code (X-Sync-Token) to every request that targets the
 * local Wi-Fi sync server. Installed once in main.tsx so no call site has to change.
 */
export function installSyncAuth(): void {
  if (typeof window === 'undefined' || (window as any).__syncAuthInstalled) return;
  (window as any).__syncAuthInstalled = true;
  const originalFetch = window.fetch.bind(window);

  const isSyncTarget = (url: string): boolean => {
    const saved = (readString(STORAGE_KEYS.syncUrl) || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (saved && url.includes(saved)) return true;
    return url.includes(`:${SYNC_SERVER_PORT}/api/`) || url.startsWith('/api/');
  };

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const token = readString(STORAGE_KEYS.syncToken);
      if (token && isSyncTarget(url)) {
        const headers = new Headers(init?.headers || (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined));
        if (!headers.has('X-Sync-Token')) headers.set('X-Sync-Token', token.trim());
        return originalFetch(input, { ...init, headers });
      }
    } catch {
      /* fall through to the untouched request */
    }
    return originalFetch(input, init);
  };
}
