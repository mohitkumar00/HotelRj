const http = require('http');
const os = require('os');
const logger = require('./logger.cjs');

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
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip loopback and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
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
              this.tablesState = { ...this.tablesState, ...data.tables };
              if (this.onUpdateCallback) {
                this.onUpdateCallback(this.tablesState);
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
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
    this.tablesState = { ...this.tablesState, ...newTables };
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
