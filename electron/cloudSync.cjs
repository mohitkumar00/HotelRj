const fs = require('fs');
const path = require('path');
const logger = require('./logger.cjs');
const db = require('./database.cjs');

// Locate cloud config file
let userDataDir;
try {
  const { app } = require('electron');
  userDataDir = app && app.getPath ? app.getPath('userData') : null;
} catch (e) {
  userDataDir = null;
}

if (!userDataDir) {
  userDataDir = path.join(process.env.APPDATA || process.env.HOME || '.', 'hotel-rj');
}

const configDir = path.join(userDataDir, 'database');
const configFilePath = path.join(configDir, 'hotel-rj-cloud-config.json');

class SupabaseCloudSync {
  constructor() {
    this.config = {
      supabaseUrl: '',
      supabaseAnonKey: '',
      lastSyncTime: null,
      autoSyncEnabled: true,
      lastSyncStatus: 'idle', // 'idle' | 'syncing' | 'success' | 'error'
      lastSyncError: null,
    };
    this.timer = null;
    this.isSyncing = false;
    this.loadConfig();
    this.startBackgroundTimer();
  }

  loadConfig() {
    try {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      if (fs.existsSync(configFilePath)) {
        const raw = fs.readFileSync(configFilePath, 'utf8');
        if (raw && raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          this.config = {
            ...this.config,
            ...parsed,
          };
        }
      }
    } catch (err) {
      console.error('[CloudSync] Failed to load cloud config:', err);
    }
  }

  saveConfig(newConfig = {}) {
    try {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const cleanUrl = String(newConfig.supabaseUrl || '').trim().replace(/\/+$/, '');
      const cleanKey = String(newConfig.supabaseAnonKey || '').trim();

      this.config = {
        ...this.config,
        supabaseUrl: cleanUrl,
        supabaseAnonKey: cleanKey,
        autoSyncEnabled: newConfig.autoSyncEnabled !== undefined ? !!newConfig.autoSyncEnabled : this.config.autoSyncEnabled,
      };

      fs.writeFileSync(configFilePath, JSON.stringify(this.config, null, 2), 'utf8');
      logger.warn('CloudSync', `Cloud config updated (Supabase URL: ${this.config.supabaseUrl || 'None'})`);

      // Trigger immediate sync if credentials provided
      if (this.isConfigured()) {
        this.syncAll();
      }

      return { success: true, config: this.getPublicConfig() };
    } catch (err) {
      logger.error('CloudSync', 'Failed to save cloud config', err);
      return { success: false, error: err.message };
    }
  }

  getPublicConfig() {
    return {
      isConfigured: this.isConfigured(),
      supabaseUrl: this.config.supabaseUrl,
      hasAnonKey: !!this.config.supabaseAnonKey,
      anonKeyMasked: this.config.supabaseAnonKey ? `${this.config.supabaseAnonKey.slice(0, 10)}...${this.config.supabaseAnonKey.slice(-6)}` : '',
      lastSyncTime: this.config.lastSyncTime,
      lastSyncStatus: this.config.lastSyncStatus,
      lastSyncError: this.config.lastSyncError,
      autoSyncEnabled: this.config.autoSyncEnabled,
      connected: this.isConfigured() && this.config.lastSyncStatus === 'success',
      pendingBills: this.config.lastSyncTime ? 0 : (db.data?.settledBills ? db.data.settledBills.length : 0),
    };
  }

  isConfigured() {
    return !!(this.config.supabaseUrl && this.config.supabaseAnonKey);
  }

  startBackgroundTimer() {
    if (this.timer) clearInterval(this.timer);
    // Attempt sync every 60 seconds
    this.timer = setInterval(() => {
      if (this.isConfigured() && this.config.autoSyncEnabled && !this.isSyncing) {
        this.syncAll();
      }
    }, 60000);
  }

  // -------------------------------------------------------------
  // Test Connection
  // -------------------------------------------------------------
  async testConnection(testUrl = this.config.supabaseUrl, testKey = this.config.supabaseAnonKey) {
    const url = String(testUrl || '').trim().replace(/\/+$/, '');
    const key = String(testKey || '').trim();

    if (!url || !key) {
      return { success: false, error: 'Supabase URL and Anon Key are required.' };
    }

    try {
      // Query bills table with limit=1 to test API key and table existence
      const endpoint = `${url}/rest/v1/bills?select=id&limit=1`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });

      if (res.ok) {
        return { success: true, message: 'Connection to Supabase established successfully!' };
      } else {
        const text = await res.text();
        return {
          success: false,
          error: `Supabase responded with HTTP ${res.status}: ${text || res.statusText}`,
        };
      }
    } catch (err) {
      return {
        success: false,
        error: `Could not reach Supabase: ${err.message}`,
      };
    }
  }

  // -------------------------------------------------------------
  // Primary Sync Worker
  // -------------------------------------------------------------
  async syncAll() {
    if (!this.isConfigured()) {
      return { success: false, reason: 'not_configured' };
    }

    if (this.isSyncing) {
      return { success: false, reason: 'already_syncing' };
    }

    this.isSyncing = true;
    this.config.lastSyncStatus = 'syncing';
    this.config.lastSyncError = null;

    try {
      const url = this.config.supabaseUrl;
      const key = this.config.supabaseAnonKey;
      const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates', // Upsert logic
      };

      // 1. Sync Settled Bills
      const bills = db.data.settledBills || [];
      let syncedBillsCount = 0;

      if (bills.length > 0) {
        // Send in batches of 50
        const batchSize = 50;
        for (let i = 0; i < bills.length; i += batchSize) {
          const batch = bills.slice(i, i + batchSize).map((b) => ({
            id: b.id,
            bill_number: b.billNumber || 0,
            department: b.department || 'restaurant',
            table_id: b.tableId || 'Table',
            order_type: b.orderType || 'dine-in',
            room_number: b.roomNumber || null,
            server_name: b.serverName || 'Staff',
            settled_by: b.settledBy || 'Cashier',
            customer_phone: b.customerPhone || null,
            customer_name: b.customerName || null,
            subtotal: Number(b.subtotal) || 0,
            tax: Number(b.tax) || 0,
            discount: Number(b.discount) || 0,
            total: Number(b.total) || 0,
            payment_method: b.paymentMethod || 'cash',
            items: b.items || [],
            date_str: b.dateStr || '',
            timestamp: b.timestamp || new Date().toISOString(),
          }));

          const res = await fetch(`${url}/rest/v1/bills`, {
            method: 'POST',
            headers,
            body: JSON.stringify(batch),
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to sync bills batch: ${res.status} ${errText}`);
          }
          syncedBillsCount += batch.length;
        }
      }

      // 2. Sync Anti-Theft Audit Logs
      const auditLogs = db.data.auditLogs || [];
      if (auditLogs.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < auditLogs.length; i += batchSize) {
          const batch = auditLogs.slice(i, i + batchSize).map((a) => ({
            id: a.id,
            type: a.type || 'ITEM_VOID',
            table_id: a.tableId || 'Table',
            staff_name: a.staffName || 'Staff',
            item_name: a.itemName || null,
            item_price: Number(a.itemPrice) || 0,
            quantity: Number(a.quantity) || 1,
            reason: a.reason || 'None',
            date_str: a.dateStr || '',
            timestamp: a.timestamp || new Date().toISOString(),
          }));

          const res = await fetch(`${url}/rest/v1/audit_logs`, {
            method: 'POST',
            headers,
            body: JSON.stringify(batch),
          });

          if (!res.ok) {
            console.warn('[CloudSync] Audit log sync warning:', res.statusText);
          }
        }
      }

      // 3. Sync Petty Cash Expenses
      const expenses = db.data.expenses || [];
      if (expenses.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < expenses.length; i += batchSize) {
          const batch = expenses.slice(i, i + batchSize).map((e) => ({
            id: e.id,
            category: e.category || 'General',
            amount: Number(e.amount) || 0,
            paid_by: e.paidBy || 'Cash Drawer',
            notes: e.notes || '',
            recorded_by: e.recordedBy || 'Cashier',
            date_str: e.dateStr || '',
            timestamp: e.timestamp || new Date().toISOString(),
          }));

          const res = await fetch(`${url}/rest/v1/expenses`, {
            method: 'POST',
            headers,
            body: JSON.stringify(batch),
          });

          if (!res.ok) {
            console.warn('[CloudSync] Expense sync warning:', res.statusText);
          }
        }
      }

      this.config.lastSyncTime = new Date().toISOString();
      this.config.lastSyncStatus = 'success';
      this.config.lastSyncError = null;

      logger.warn('CloudSync', `Synced ${syncedBillsCount} bills and records to Supabase`);

      // Persist last sync time to config
      fs.writeFileSync(configFilePath, JSON.stringify(this.config, null, 2), 'utf8');

      return {
        success: true,
        syncedBills: syncedBillsCount,
        lastSyncTime: this.config.lastSyncTime,
      };
    } catch (err) {
      this.config.lastSyncStatus = 'error';
      this.config.lastSyncError = err.message;
      logger.warn('CloudSync', `Sync failed (will retry): ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  }
}

module.exports = new SupabaseCloudSync();
