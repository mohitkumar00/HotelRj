import { describe, it, expect, beforeEach } from 'vitest';
// @ts-ignore - CommonJS module
const syncServer = require('../../electron/syncServer.cjs');

describe('syncServer - Waiter Deduplication & Auth Lockout Recovery', () => {
  beforeEach(() => {
    syncServer.activeWaiters.clear();
    syncServer.failedAuth.clear();
  });

  it('deduplicates waiter entries when keystrokes are typed rapidly', () => {
    const ip = '192.168.1.55';
    const clientId = 'device-test-uuid-123';

    // Simulate keystrokes: t -> te -> tes -> test
    syncServer.recordWaiter(ip, 't', 'T-1', 'Android APK', clientId);
    expect(syncServer.getWaitersList()).toHaveLength(1);
    expect(syncServer.getWaitersList()[0].name).toBe('t');

    syncServer.recordWaiter(ip, 'te', 'T-1', 'Android APK', clientId);
    expect(syncServer.getWaitersList()).toHaveLength(1);
    expect(syncServer.getWaitersList()[0].name).toBe('te');

    syncServer.recordWaiter(ip, 'tes', 'T-1', 'Android APK', clientId);
    expect(syncServer.getWaitersList()).toHaveLength(1);
    expect(syncServer.getWaitersList()[0].name).toBe('tes');

    syncServer.recordWaiter(ip, 'test', 'T-1', 'Android APK', clientId);
    const list = syncServer.getWaitersList();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('test');
    expect(list[0].ip).toBe(ip);
  });

  it('deduplicates by IP even if clientId was not initially provided', () => {
    const ip = '192.168.1.66';

    syncServer.recordWaiter(ip, 't', 'T-2', 'Mobile Web');
    syncServer.recordWaiter(ip, 'te', 'T-2', 'Mobile Web');
    syncServer.recordWaiter(ip, 'test', 'T-2', 'Mobile Web');

    const list = syncServer.getWaitersList();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('test');
  });

  it('immediately clears 429 lockout and authorizes when correct token is supplied', () => {
    const ip = '192.168.1.99';
    const serverToken = syncServer.syncToken;

    // Simulate 10 wrong attempts -> IP gets locked out
    for (let i = 0; i < 10; i++) {
      const mockReq = { headers: { 'x-sync-token': 'WRONGCODE' }, method: 'POST' };
      const mockRes = { writeHead: () => {}, end: () => {} };
      syncServer.authorize(mockReq, mockRes, ip, '/api/tables');
    }

    const failureRecord = syncServer.failedAuth.get(ip);
    expect(failureRecord).toBeDefined();
    expect(failureRecord.until).toBeGreaterThan(Date.now());

    // Wrong code still blocked with 429
    let lastStatus = 0;
    const mockBlockedRes = {
      writeHead: (status: number) => { lastStatus = status; },
      end: () => {},
    };
    const denied = syncServer.authorize({ headers: { 'x-sync-token': 'WRONGCODE' }, method: 'POST' }, mockBlockedRes, ip, '/api/tables');
    expect(denied).toBe(false);
    expect(lastStatus).toBe(429);

    // Correct token submitted -> lockout is immediately cleared and request is granted!
    let allowedStatus = 0;
    const mockAllowedRes = {
      writeHead: (status: number) => { allowedStatus = status; },
      end: () => {},
    };
    const allowed = syncServer.authorize({ headers: { 'x-sync-token': serverToken }, method: 'POST' }, mockAllowedRes, ip, '/api/tables');
    expect(allowed).toBe(true);
    expect(syncServer.failedAuth.has(ip)).toBe(false);
  });

  it('authorizes case-insensitively and tolerates whitespace in token', () => {
    const ip = '192.168.1.101';
    const serverToken = syncServer.syncToken;

    const mockRes = { writeHead: () => {}, end: () => {} };
    const allowed = syncServer.authorize(
      { headers: { 'x-sync-token': `  ${serverToken.toLowerCase()}  ` }, method: 'POST' },
      mockRes,
      ip,
      '/api/tables'
    );
    expect(allowed).toBe(true);
  });
});
