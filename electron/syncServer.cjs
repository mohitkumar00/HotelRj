const http = require('http');
const os = require('os');
const logger = require('./logger.cjs');

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

    if (rTime > lTime) {
      const items = { ...remoteTable.items };
      for (const itemId of Object.keys(localTable.items || {})) {
        const localItem = localTable.items[itemId];
        if (!items[itemId] && localItem.quantity > (localItem.firedCount || 0)) {
          items[itemId] = localItem;
        }
      }
      merged[tableId] = {
        ...remoteTable,
        items,
      };
    } else if (lTime > rTime) {
      continue;
    } else {
      const mergedItems = { ...localTable.items };
      for (const itemId of Object.keys(remoteTable.items || {})) {
        const rItem = remoteTable.items[itemId];
        const lItem = mergedItems[itemId];
        if (!lItem) {
          mergedItems[itemId] = rItem;
        } else {
          mergedItems[itemId] = {
            ...lItem,
            quantity: Math.max(lItem.quantity, rItem.quantity),
            firedCount: Math.max(lItem.firedCount, rItem.firedCount),
            notes: rItem.notes || lItem.notes,
          };
        }
      }
      merged[tableId] = {
        ...localTable,
        status: remoteTable.status !== 'vacant' ? remoteTable.status : localTable.status,
        kotNumber: Math.max(localTable.kotNumber || 1, remoteTable.kotNumber || 1),
        openedAt: localTable.openedAt || remoteTable.openedAt,
        items: mergedItems,
      };
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

  start(onTableUpdate) {
    this.onUpdateCallback = onTableUpdate;

    this.server = http.createServer((req, res) => {
      // Enable CORS for Android waiter app and web requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);

      if (req.method === 'GET' && url.pathname === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'online',
            service: 'Hotel RJ Counter POS Sync',
            ip: this.localIp,
            port: this.port,
            time: new Date().toISOString(),
          })
        );
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/tables') {
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
              this.tablesState = mergeTables(this.tablesState, data.tables);
              if (this.onUpdateCallback) {
                this.onUpdateCallback(this.tablesState, data.tables);
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, tables: this.tablesState }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing tables payload' }));
            }
          } catch (err) {
            logger.warn('SyncServer', 'Malformed JSON payload received from client', err.message);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
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
    };
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = new LocalSyncServer();
