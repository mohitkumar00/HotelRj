const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const logger = require('./logger.cjs');
const db = require('./database.cjs');
const cloudSync = require('./cloudSync.cjs');
const crypto = require('crypto');

// -------------------------------------------------------------
// Pairing code (X-Sync-Token): protects the Wi-Fi sync API from other devices on the LAN.
// -------------------------------------------------------------
function resolveTokenPath() {
  let dir;
  try {
    const { app } = require('electron');
    dir = app && app.getPath ? app.getPath('userData') : null;
  } catch (e) {
    dir = null;
  }
  if (!dir) dir = path.join(process.env.APPDATA || process.env.HOME || '.', 'hotel-rj');
  return path.join(dir, 'database', 'hotel-rj-sync-token.txt');
}

function loadOrCreateToken() {
  const file = resolveTokenPath();
  try {
    if (fs.existsSync(file)) {
      const existing = fs.readFileSync(file, 'utf8').trim();
      if (existing.length >= 8) return existing;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alike characters
    const bytes = crypto.randomBytes(8);
    const token = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    fs.writeFileSync(file, token, 'utf8');
    return token;
  } catch (e) {
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '').trim().toUpperCase());
  const y = Buffer.from(String(b || '').trim().toUpperCase());
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

function mergeTables(local, remote) {
  if (!remote || typeof remote !== 'object') return local;
  const merged = { ...local };

  for (const tableId of Object.keys(remote)) {
    const remoteTable = remote[tableId];
    const localTable = merged[tableId];

    if (!localTable) {
      merged[tableId] = remoteTable;
      continue;
    }

    const rTime = remoteTable.updatedAt || 0;
    const lTime = localTable.updatedAt || 0;

    // Rule 1: Remote is explicitly vacant and rTime >= lTime -> table is VACANT
    if (remoteTable.status === 'vacant' && rTime >= lTime) {
      merged[tableId] = {
        ...remoteTable,
        items: {},
      };
      continue;
    }

    // Rule 2: Local is vacant and strictly newer than remote -> local remains VACANT
    if (localTable.status === 'vacant' && lTime > rTime) {
      merged[tableId] = {
        ...localTable,
        items: {},
      };
      continue;
    }

    // Rule 3: Remote is strictly newer -> remote is authoritative
    if (rTime > lTime) {
      merged[tableId] = remoteTable;
      continue;
    }

    // Rule 4: Local is strictly newer -> local is authoritative
    if (lTime > rTime) {
      continue;
    }

    // Rule 5: Timestamps are equal -> vacant wins, or adopt remote
    if (remoteTable.status === 'vacant' || localTable.status === 'vacant') {
      const vacantTbl = remoteTable.status === 'vacant' ? remoteTable : localTable;
      merged[tableId] = {
        ...vacantTbl,
        status: 'vacant',
        items: {},
      };
    } else {
      merged[tableId] = remoteTable;
    }
  }
  return merged;
}

class LocalSyncServer {
  constructor() {
    this.server = null;
    this.port = 5050;
    this.localIp = this.detectLocalIp();
    this.tablesState = {};
    this.onUpdateCallback = null;
    this.onWaitersUpdateCallback = null;
    this.activeWaiters = new Map();
    this.syncToken = loadOrCreateToken();
    this.failedAuth = new Map(); // ip -> { count, until }
  }

  /** Returns true if the request may proceed. Writes the error response itself when it may not. */
  authorize(req, res, clientIp, pathname) {
    // Connection test endpoint stays open (leaks only app name + LAN IP).
    if (pathname === '/api/status') return true;

    // Same-machine requests from the Counter app itself (no web Origin) are trusted.
    const origin = req.headers.origin;
    const isLoopback = ['127.0.0.1', '::1', 'localhost'].includes(clientIp) || clientIp === '1';
    if (isLoopback && (!origin || origin === 'null' || origin.startsWith('file:'))) return true;

    const tokenHeader = req.headers['x-sync-token'];

    // 1. Proving possession of the correct secret immediately authorizes and clears any lockout!
    if (safeEqual(tokenHeader, this.syncToken)) {
      this.failedAuth.delete(clientIp);
      return true;
    }

    // 2. Client is not authenticated with valid token. Check rate-limit lockout.
    const now = Date.now();
    const f = this.failedAuth.get(clientIp);
    if (f && f.until > now) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many attempts. Try again later.' }));
      return false;
    }

    // 3. Track failed attempts.
    // Increment only if an actual (incorrect) token was submitted (i.e. guessing wrong code),
    // or if a client without any token is making mutating POST requests.
    // Unauthenticated GET requests on initial page load won't lock out legitimate devices.
    const hasAttemptedToken = tokenHeader !== undefined && tokenHeader !== null && String(tokenHeader).trim() !== '';
    if (hasAttemptedToken || req.method === 'POST') {
      const count = (f ? f.count : 0) + 1;
      this.failedAuth.set(clientIp, { count, until: count >= 10 ? now + 5 * 60_000 : 0 });
    }

    logger.warn('SyncServer', `Rejected request without valid pairing code from ${clientIp}: ${pathname}`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Pairing code required', code: 'SYNC_TOKEN_REQUIRED' }));
    return false;
  }

  recordWaiter(clientIp, serverName, activeTable = '', deviceInfo = '', clientId = '') {
    const cleanIp = String(clientIp || '').replace(/^.*:/, '') || '127.0.0.1';
    const name = String(serverName || '').trim() || 'Waiter';
    const cleanClientId = String(clientId || '').trim();
    // Unique device identifier: prefer explicit clientId, fallback to IP
    const id = cleanClientId ? `client_${cleanClientId}` : `ip_${cleanIp}`;
    const now = Date.now();

    // Deduplicate: If any existing waiter shares this IP or clientId under an older ID/name, remove it
    for (const [existingId, w] of this.activeWaiters.entries()) {
      if (existingId !== id) {
        if (w.ip === cleanIp || (cleanClientId && w.clientId === cleanClientId)) {
          this.activeWaiters.delete(existingId);
        }
      }
    }

    this.activeWaiters.set(id, {
      id,
      clientId: cleanClientId,
      name,
      ip: cleanIp,
      activeTable: activeTable || '-',
      device: deviceInfo || 'Mobile Phone',
      lastSeen: now,
      lastSeenTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status: 'online',
    });

    this.pruneWaiters();
    this.notifyWaitersUpdated();
    logger.warn('SyncServer', `Waiter activity: "${name}" (${cleanIp}${cleanClientId ? ` / ${cleanClientId.slice(0, 8)}` : ''}) on table "${activeTable || '-'}"`);
  }

  pruneWaiters() {
    const now = Date.now();
    for (const [id, w] of this.activeWaiters.entries()) {
      if (now - w.lastSeen > 35000) {
        if (now - w.lastSeen > 90000) {
          this.activeWaiters.delete(id);
        } else {
          w.status = 'idle';
        }
      }
    }
  }

  getWaitersList() {
    this.pruneWaiters();
    return Array.from(this.activeWaiters.values());
  }

  notifyWaitersUpdated() {
    if (this.onWaitersUpdateCallback) {
      this.onWaitersUpdateCallback(this.getWaitersList());
    }
  }

  detectLocalIp() {
    const interfaces = os.networkInterfaces();
    const candidates = [];
    for (const name of Object.keys(interfaces)) {
      // Strictly ignore virtual adapters, WSL, Hyper-V, VMware, Docker, etc.
      if (/vethernet|wsl|virtual|vmware|hyper-v|docker|tailscale|loopback/i.test(name)) {
        continue;
      }
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          // If interface name has Wi-Fi / WLAN, return directly
          if (/wi-fi|wlan/i.test(name)) {
            return iface.address;
          }
          candidates.push(iface.address);
        }
      }
    }
    // Prefer typical LAN subnets (192.168.x.x, 10.x.x.x)
    const lan = candidates.find((ip) => ip.startsWith('192.168.') || ip.startsWith('10.'));
    if (lan) return lan;
    return candidates[0] || '127.0.0.1';
  }

  start(onTableUpdate, onWaitersUpdate) {
    this.onUpdateCallback = onTableUpdate;
    this.onWaitersUpdateCallback = onWaitersUpdate;

    this.server = http.createServer((req, res) => {
      // Enable CORS for Android waiter app and web requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Token');

      const clientIp = req.socket.remoteAddress ? req.socket.remoteAddress.replace(/^.*:/, '') : '127.0.0.1';

      // Attach client socket error listeners to prevent uncaught exceptions on socket hangup
      req.on('error', (err) => {
        logger.warn('SyncServer', `Socket request error from ${clientIp}: ${err.message}`);
      });
      res.on('error', (err) => {
        logger.warn('SyncServer', `Socket response error to ${clientIp}: ${err.message}`);
      });

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      let url;
      try {
        url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      } catch (uErr) {
        logger.warn('SyncServer', `Malformed URL from ${clientIp}: ${req.url}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed URL' }));
        return;
      }

      try {
        if (!this.authorize(req, res, clientIp, url.pathname)) return;

      if (req.method === 'GET' && url.pathname === '/api/status') {
        logger.warn('SyncServer', `Ping /api/status from ${clientIp}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'online',
            service: 'Hotel RJ Counter POS Sync',
            ip: this.localIp,
            port: this.port,
            connectedWaitersCount: this.getWaitersList().length,
            time: new Date().toISOString(),
          })
        );
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/waiters') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, waiters: this.getWaitersList() }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/waiter/heartbeat') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            this.recordWaiter(clientIp, data.serverName, data.activeTable, data.deviceInfo, data.clientId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, connectedWaiters: this.getWaitersList().length }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/tables') {
        logger.warn('SyncServer', `GET /api/tables from ${clientIp}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tables: this.tablesState }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/tables') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 5 * 1024 * 1024) {
            // Protect against excessively large payload
            req.connection.destroy();
          }
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data && data.tables) {
              if (data.serverName) {
                this.recordWaiter(clientIp, data.serverName, data.activeTable, data.deviceInfo, data.clientId);
              }
              if (data.activeTable && data.tables[data.activeTable]) {
                data.tables[data.activeTable].updatedAt = Math.max(
                  data.tables[data.activeTable].updatedAt || 0,
                  Date.now()
                );
              }
              this.tablesState = mergeTables(this.tablesState, data.tables);
              if (this.onUpdateCallback) {
                this.onUpdateCallback(this.tablesState, data.tables);
              }
              logger.warn('SyncServer', `POST /api/tables synced from ${clientIp} (${data.serverName || 'Waiter'})`);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, tables: this.tablesState }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing tables payload' }));
            }
          } catch (err) {
            logger.warn('SyncServer', `Malformed JSON payload from ${clientIp}: ${err.message}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      // GET /api/analytics (Owner Insights)
      if (req.method === 'GET' && url.pathname === '/api/analytics') {
        const period = url.searchParams.get('period') || 'today';
        const department = url.searchParams.get('department') || 'all';
        const year = url.searchParams.get('year') || undefined;
        const month = url.searchParams.get('month') || undefined;
        try {
          const stats = db.getAnalytics({ period, department, year, month });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, analytics: stats }));
        } catch (err) {
          logger.error('SyncServer', 'Error generating analytics', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // GET /api/export-backup (Excel CSV & JSON Backup)
      if (req.method === 'GET' && url.pathname === '/api/export-backup') {
        try {
          const backup = db.exportBackup();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(backup));
        } catch (err) {
          logger.error('SyncServer', 'Error exporting backup', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // GET /api/cloud-sync/status
      if (req.method === 'GET' && url.pathname === '/api/cloud-sync/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: cloudSync.getPublicConfig() }));
        return;
      }

      // POST /api/cloud-sync/config
      if (req.method === 'POST' && url.pathname === '/api/cloud-sync/config') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const result = cloudSync.saveConfig(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // POST /api/cloud-sync/test
      if (req.method === 'POST' && url.pathname === '/api/cloud-sync/test') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const result = await cloudSync.testConnection(data.url, data.key);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // POST /api/cloud-sync/sync
      if (req.method === 'POST' && url.pathname === '/api/cloud-sync/sync') {
        cloudSync
          .syncAll()
          .then((result) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          })
          .catch((err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });
        return;
      }

      // POST /api/settle-bill (Save completed bill and mark table vacant)
      if (req.method === 'POST' && url.pathname === '/api/settle-bill') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const bill = data.bill;
            if (!bill) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing bill object' }));
              return;
            }

            const record = db.saveSettledBill(bill);

            // Vacate table if tableId provided
            if (bill.tableId) {
              const currentTable = this.tablesState[bill.tableId];
              this.tablesState[bill.tableId] = {
                tableId: bill.tableId,
                serverName: bill.serverName || 'Staff',
                openedAt: '',
                status: 'vacant',
                kotNumber: currentTable ? (currentTable.kotNumber || 1) + 1 : 1,
                items: {},
                generalNote: '',
                updatedAt: Date.now(),
              };

              if (this.onUpdateCallback) {
                this.onUpdateCallback(this.tablesState, { [bill.tableId]: this.tablesState[bill.tableId] });
              }
            }

            logger.warn('SyncServer', `Bill settled for ${bill.tableId} (₹${bill.total}, ${bill.paymentMethod}) by ${bill.settledBy || clientIp}`);
            
            // Background cloud push to Supabase if configured
            if (cloudSync.isConfigured()) {
              setTimeout(() => cloudSync.syncAll(), 150);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, bill: record }));
          } catch (err) {
            logger.error('SyncServer', 'Failed to settle bill', err);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // POST /api/cancel-bill (Void settled bill with reason & staff identity)
      if (req.method === 'POST' && url.pathname === '/api/cancel-bill') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const { billId, reason, cancelledBy } = data;
            const result = db.cancelBill(billId, reason, cancelledBy || clientIp);
            if (result.success && cloudSync.isConfigured()) {
              setTimeout(() => cloudSync.syncAll(), 150);
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            logger.error('SyncServer', 'Failed to cancel bill', err);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // GET /api/recent-bills
      if (req.method === 'GET' && url.pathname === '/api/recent-bills') {
        const limit = Number(url.searchParams.get('limit')) || 60;
        try {
          const bills = db.getRecentBills(limit);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, bills }));
        } catch (err) {
          logger.error('SyncServer', 'Failed to get recent bills', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // POST /api/audit-log (Anti-theft void / cancellation / discount tracking)
      if (req.method === 'POST' && url.pathname === '/api/audit-log') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const logEntry = data.log;
            if (!logEntry) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing log object' }));
              return;
            }

            const record = db.saveAuditLog(logEntry);
            logger.warn('SyncServer', `Audit Event [${logEntry.type}] on ${logEntry.tableId} by ${logEntry.staffName}: "${logEntry.reason}"`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, log: record }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // POST /api/expense (Petty Cash Expense logging)
      if (req.method === 'POST' && url.pathname === '/api/expense') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const expense = data.expense;
            if (!expense) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing expense object' }));
              return;
            }

            const record = db.saveExpense(expense);
            logger.warn('SyncServer', `Expense recorded: ${expense.category} (₹${expense.amount}) - "${expense.notes}"`);
            if (cloudSync.isConfigured()) {
              await cloudSync.pushToCloud().catch((e) => logger.warn('SyncServer', 'Error pushing expense: ' + e.message));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, expense: record }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // DELETE /api/expense
      if ((req.method === 'DELETE' || req.method === 'POST') && url.pathname === '/api/expense/delete') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const id = data.id || url.searchParams.get('id');
            if (id) {
              db.deleteExpense(id);
              if (cloudSync && cloudSync.isConfigured()) {
                const dRes = await cloudSync.deleteFromCloud('expenses', 'id', id).catch((e) => logger.warn('SyncServer', 'Error deleting expense from cloud: ' + e.message));
                if (dRes && dRes.success) {
                  db.removePendingDeletion('expenses', id);
                }
              }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // GET /api/bills (Recent settled bills list)
      if (req.method === 'GET' && url.pathname === '/api/bills') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, bills: db.data.settledBills.slice(0, 50) }));
        return;
      }

      // -------------------------------------------------------------
      // Hotel Operations REST API (Dishes, Rooms & Tables Config)
      // -------------------------------------------------------------

      // GET /api/menu
      if (req.method === 'GET' && url.pathname === '/api/menu') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, menu: db.getMenu() }));
        return;
      }

      // POST /api/menu/toggle-availability
      if (req.method === 'POST' && url.pathname === '/api/menu/toggle-availability') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const result = db.toggleDishAvailability(data.dishId, data.isAvailable);
            if (result.success && cloudSync.isConfigured()) {
              setTimeout(() => cloudSync.syncAll(), 150);
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // POST /api/menu/dish (Add or Edit Dish)
      if (req.method === 'POST' && url.pathname === '/api/menu/dish') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const dishData = data.dish || data;
            const result = db.saveDish(dishData, dishData.originalId);
            if (result.success && cloudSync.isConfigured()) {
              if (result.renamedFrom) {
                await cloudSync.deleteFromCloud('menu_items', 'id', result.renamedFrom).catch(() => {});
              }
              await cloudSync.pushToCloud().catch((e) => logger.warn('SyncServer', 'Error syncing saved dish: ' + e.message));
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // DELETE or POST /api/menu/dish/delete
      if ((req.method === 'DELETE' || req.method === 'POST') && (url.pathname === '/api/menu/dish/delete' || url.pathname === '/api/menu/dish')) {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const dishId = data.dishId || data.id || url.searchParams.get('id');
            const result = db.deleteDish(dishId);
            if (result.success && cloudSync.isConfigured()) {
              const targetId = result.deletedId || dishId;
              const dRes = await cloudSync.deleteFromCloud('menu_items', 'id', targetId).catch((e) => logger.warn('SyncServer', 'Error deleting dish from cloud: ' + e.message));
              if (dRes && dRes.success) {
                db.removePendingDeletion('menu_items', targetId);
              }
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // GET /api/rooms
      if (req.method === 'GET' && url.pathname === '/api/rooms') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, rooms: db.getRooms() }));
        return;
      }

      // POST /api/rooms/status
      if (req.method === 'POST' && url.pathname === '/api/rooms/status') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const result = db.updateRoomStatus(data.roomId, data.status, data.guestDetails);
            if (result.success && cloudSync.isConfigured()) {
              setTimeout(() => cloudSync.syncAll(), 150);
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // POST /api/rooms (Save or update room)
      if (req.method === 'POST' && url.pathname === '/api/rooms') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const roomData = data.room || data;
            const result = db.saveRoom(roomData, roomData.originalId);
            if (result.success && cloudSync.isConfigured()) {
              if (result.renamedFrom) {
                await cloudSync.deleteFromCloud('rooms', 'id', result.renamedFrom).catch(() => {});
              }
              cloudSync.pushToCloud().catch(() => {});
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // DELETE or POST /api/rooms/delete
      if ((req.method === 'DELETE' || req.method === 'POST') && (url.pathname === '/api/rooms/delete')) {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const roomId = data.roomId || data.id || url.searchParams.get('id');
            const result = db.deleteRoom(roomId);
            if (result.success && cloudSync.isConfigured()) {
              const targetId = result.deletedId || roomId;
              const dRes = await cloudSync.deleteFromCloud('rooms', 'id', targetId).catch((e) => logger.warn('SyncServer', 'Error deleting room from cloud: ' + e.message));
              if (dRes && dRes.success) {
                db.removePendingDeletion('rooms', targetId);
              }
              if (targetId !== roomId) {
                await cloudSync.deleteFromCloud('rooms', 'id', roomId).catch(() => {});
              }
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // GET /api/tables-config
      if (req.method === 'GET' && url.pathname === '/api/tables-config') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tablesConfig: db.getTablesConfig() }));
        return;
      }

      // POST /api/tables-config
      if (req.method === 'POST' && url.pathname === '/api/tables-config') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const tableData = data.table || data;
            const result = db.saveTableConfig(tableData, tableData.originalId);
            if (result.success && cloudSync && cloudSync.isConfigured()) {
              if (result.renamedFrom) {
                await cloudSync.deleteFromCloud('tables_config', 'id', result.renamedFrom).catch(() => {});
              }
              await cloudSync.pushToCloud().catch(() => {});
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // DELETE /api/tables-config/delete
      if ((req.method === 'DELETE' || req.method === 'POST') && url.pathname === '/api/tables-config/delete') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const tableId = data.tableId || data.id || url.searchParams.get('id');
            const result = db.deleteTableConfig(tableId);
            if (result.success && cloudSync.isConfigured()) {
              const targetId = result.deletedId || tableId;
              const dRes = await cloudSync.deleteFromCloud('tables_config', 'id', targetId).catch((e) => logger.warn('SyncServer', 'Error deleting table config from cloud: ' + e.message));
              if (dRes && dRes.success) {
                db.removePendingDeletion('tables_config', targetId);
              }
              if (targetId !== tableId) {
                await cloudSync.deleteFromCloud('tables_config', 'id', tableId).catch(() => {});
              }
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // GET /api/banquet-bookings
      if (req.method === 'GET' && url.pathname === '/api/banquet-bookings') {
        const bookings = db.getBanquetBookings();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(bookings));
        return;
      }

      // POST /api/banquet-bookings
      if (req.method === 'POST' && url.pathname === '/api/banquet-bookings') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const result = db.saveBanquetBooking(data.booking || data);
            if (result.success && cloudSync.isConfigured()) {
              await cloudSync.pushToCloud().catch((e) => logger.warn('SyncServer', 'Error pushing banquet booking: ' + e.message));
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // DELETE /api/banquet-bookings/delete
      if ((req.method === 'DELETE' || req.method === 'POST') && url.pathname === '/api/banquet-bookings/delete') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const bookingId = data.bookingId || data.id || url.searchParams.get('id');
            const result = db.deleteBanquetBooking(bookingId);
            if (result.success && cloudSync.isConfigured()) {
              const dRes = await cloudSync.deleteFromCloud('banquet_bookings', 'id', bookingId).catch((e) => logger.warn('SyncServer', 'Error deleting banquet booking from cloud: ' + e.message));
              if (dRes && dRes.success) {
                db.removePendingDeletion('banquet_bookings', bookingId);
              }
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // Serve static Waiter POS web app files for mobile phone browsers (Zero APK install)
      if (req.method === 'GET' && !url.pathname.startsWith('/api')) {
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.woff2': 'font/woff2',
        };

        const distDir = path.join(__dirname, '../dist');
        const safeSuffix = path.normalize(url.pathname).replace(/^(\.\.[\/\\])+/, '');
        let targetPath = path.join(distDir, safeSuffix === '\\' || safeSuffix === '/' ? 'index.html' : safeSuffix);

        if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
          targetPath = path.join(distDir, 'index.html');
        }

        if (fs.existsSync(targetPath)) {
          const ext = path.extname(targetPath).toLowerCase();
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
          const stream = fs.createReadStream(targetPath);
          stream.on('error', (sErr) => {
            logger.warn('SyncServer', `File stream error for ${targetPath}: ${sErr.message}`);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('File read error');
            }
          });
          stream.pipe(res);
          return;
        }
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      } catch (err) {
        logger.error('SyncServer', `Unhandled error in route handler [${req.method} ${req.url}]: ${err.message}`, err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error', message: err.message }));
        }
      }
    });

    this.server.on('error', (err) => {
      logger.error('SyncServer', `Sync Server error on port ${this.port}`, err);
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`Hotel RJ Counter Sync Server running at http://${this.localIp}:${this.port}`);
    });
  }

  updateState(newTables) {
    this.tablesState = mergeTables(this.tablesState, newTables);
  }

  getServerInfo() {
    return {
      ip: this.localIp,
      port: this.port,
      url: `http://${this.localIp}:${this.port}`,
      token: this.syncToken,
    };
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = new LocalSyncServer();
