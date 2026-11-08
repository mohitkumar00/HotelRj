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
const sessionFilePath = path.join(configDir, 'hotel-rj-cloud-session.bin');

// Prefer the OS keystore (Windows DPAPI) to protect the pairing session at rest.
function encode(text) {
  try {
    const { safeStorage } = require('electron');
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return Buffer.concat([Buffer.from('E1:'), safeStorage.encryptString(text)]);
    }
  } catch (e) { /* fall through */ }
  return Buffer.concat([Buffer.from('P1:'), Buffer.from(text, 'utf8')]);
}

function decode(buf) {
  const tag = buf.slice(0, 3).toString();
  const body = buf.slice(3);
  if (tag === 'E1:') {
    const { safeStorage } = require('electron');
    return safeStorage.decryptString(body);
  }
  return body.toString('utf8');
}

const DEFAULT_SUPABASE_URL = 'https://kupbuusakxvsfprwdpbr.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_lZf74V3b-jAG3sIYxSDeVA_cFIdt74o';

class SupabaseCloudSync {
  constructor() {
    this.config = {
      supabaseUrl: DEFAULT_SUPABASE_URL,
      supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
      lastSyncTime: null,
      autoSyncEnabled: true,
      lastSyncStatus: 'idle', // 'idle' | 'syncing' | 'success' | 'error'
      lastSyncError: null,
    };
    this.timer = null;
    this.isSyncing = false;
    this.session = null; // { accessToken, refreshToken, expiresAt, email }
    this.refreshPromise = null;
    this.onDataUpdatedCallback = null;
    this.loadSession();
    this.loadConfig();
    this.startBackgroundTimer();
  }

  // -------------------------------------------------------------
  // Device pairing session (owner OTP). Main process is the single owner of refresh rotation.
  // -------------------------------------------------------------
  loadSession() {
    try {
      if (fs.existsSync(sessionFilePath)) {
        this.session = JSON.parse(decode(fs.readFileSync(sessionFilePath)));
      }
    } catch (err) {
      logger.error('CloudSync', 'Could not read cloud session', err);
      this.session = null;
    }
  }

  setSession(session) {
    try {
      if (!session || !session.accessToken || !session.refreshToken) {
        return { success: false, error: 'Invalid session' };
      }
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      this.session = session;
      fs.writeFileSync(sessionFilePath, encode(JSON.stringify(session)));
      logger.warn('CloudSync', 'Device paired with owner session');
      return { success: true };
    } catch (err) {
      logger.error('CloudSync', 'Could not store cloud session', err);
      return { success: false, error: err.message };
    }
  }

  clearSession() {
    this.session = null;
    try { if (fs.existsSync(sessionFilePath)) fs.unlinkSync(sessionFilePath); } catch (e) { /* ignore */ }
    return { success: true };
  }

  async getAccessToken() {
    const s = this.session;
    if (!s) return null;
    if (s.expiresAt - 60 > Math.floor(Date.now() / 1000)) return s.accessToken;
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${this.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: this.config.supabaseAnonKey },
          body: JSON.stringify({ refresh_token: s.refreshToken }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.access_token) {
          this.setSession({
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
            expiresAt: json.expires_at || Math.floor(Date.now() / 1000) + (json.expires_in || 3600),
            email: s.email,
          });
          return this.session.accessToken;
        }
        if ([400, 401, 403].includes(res.status)) {
          logger.warn('CloudSync', 'Pairing session rejected (device revoked?). Pair the device again.');
          this.clearSession();
          return null;
        }
      } catch (e) {
        // offline: reuse the old token; requests will fail and retry later
      } finally {
        this.refreshPromise = null;
      }
      return s.accessToken;
    })();
    return this.refreshPromise;
  }

  async authHeaders() {
    const key = this.config.supabaseAnonKey;
    const token = await this.getAccessToken();
    return { apikey: key, Authorization: `Bearer ${token || key}` };
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
      // Ensure defaults if empty
      if (!this.config.supabaseUrl) {
        this.config.supabaseUrl = DEFAULT_SUPABASE_URL;
      }
      if (!this.config.supabaseAnonKey) {
        this.config.supabaseAnonKey = DEFAULT_SUPABASE_ANON_KEY;
      }
      // Persist defaults if not present
      if (!fs.existsSync(configFilePath)) {
        fs.writeFileSync(configFilePath, JSON.stringify(this.config, null, 2), 'utf8');
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
      isPaired: !!this.session,
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
  // Delete a record from Supabase Cloud
  // -------------------------------------------------------------
  async deleteFromCloud(tableName, idColumn, idValue) {
    if (!this.isConfigured()) return { success: false, reason: 'not_configured' };
    try {
      const url = this.config.supabaseUrl;
      const headers = await this.authHeaders();
      const endpoint = `${url}/rest/v1/${tableName}?${idColumn}=eq.${encodeURIComponent(idValue)}`;
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        logger.warn('CloudSync', `Deleted ${idValue} from ${tableName} in Supabase Cloud`);
        return { success: true };
      } else {
        const text = await res.text().catch(() => '');
        logger.warn('CloudSync', `Delete ${idValue} from ${tableName} returned HTTP ${res.status}: ${text}`);
        return { success: false, error: `HTTP ${res.status}` };
      }
    } catch (err) {
      logger.error('CloudSync', `Error deleting ${idValue} from ${tableName}`, err);
      return { success: false, error: err.message };
    }
  }

  // -------------------------------------------------------------
  // Pull Latest Records from Supabase Cloud (2-Way Sync)
  // -------------------------------------------------------------
  async pullFromCloud() {
    if (!this.isConfigured()) return { success: false, reason: 'not_configured' };
    try {
      const url = this.config.supabaseUrl;
      const headers = await this.authHeaders();

      // 1. Pull Tables Configuration
      try {
        const res = await fetch(`${url}/rest/v1/tables_config?select=*&order=sort_order`, { headers });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            db.data.tablesConfig = rows.map((r) => ({
              id: r.id,
              name: r.name,
              section: r.section || 'dining',
              capacity: Number(r.capacity) || 4,
              isActive: r.is_active !== false,
              sortOrder: Number(r.sort_order) || 1,
            }));
            logger.warn('CloudSync', `Pulled ${rows.length} tables from Supabase Cloud`);
          }
        }
      } catch (tErr) {
        logger.warn('CloudSync', `Error pulling tables from Cloud: ${tErr.message}`);
      }

      // 2. Pull Rooms Configuration & Live Status
      try {
        const res = await fetch(`${url}/rest/v1/rooms?select=*`, { headers });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            db.data.rooms = rows.map((r) => ({
              id: r.id,
              name: r.name,
              tier: r.tier || 'deluxe',
              pricePerNight: Number(r.price_per_night) || 1600,
              status: r.status || 'available',
              maxGuests: Number(r.max_guests) || 2,
              bedType: r.bed_type || '1 King Bed',
              guestName: r.guest_name || undefined,
              checkInDate: r.check_in_date || undefined,
              checkOutDate: r.check_out_date || undefined,
              folioAmount: Number(r.folio_amount) || 0,
              notes: r.notes || undefined,
            }));
            logger.warn('CloudSync', `Pulled ${rows.length} rooms from Supabase Cloud`);
          }
        }
      } catch (rErr) {
        logger.warn('CloudSync', `Error pulling rooms from Cloud: ${rErr.message}`);
      }

      // 3. Pull Live Menu Items, Prices & 86 Sold-Out Status
      try {
        const res = await fetch(`${url}/rest/v1/menu_items?select=*&order=category_id,name`, { headers });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            db.updateMenuFromCloud(rows);
            logger.warn('CloudSync', `Pulled ${rows.length} menu items from Supabase Cloud`);
          }
        }
      } catch (mErr) {
        logger.warn('CloudSync', `Error pulling menu items from Cloud: ${mErr.message}`);
      }

      // 4. Pull Banquet Bookings
      try {
        const res = await fetch(`${url}/rest/v1/banquet_bookings?select=*&order=event_date.asc`, { headers });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            db.data.banquetBookings = rows.map((b) => ({
              id: b.id,
              eventDate: b.event_date,
              slot: b.slot,
              customStartTime: b.custom_start_time || undefined,
              customEndTime: b.custom_end_time || undefined,
              venue: b.venue,
              eventType: b.event_type,
              noOfGuests: Number(b.no_of_guests) || 0,
              customerName: b.customer_name || 'Guest',
              customerPhone: b.customer_phone || '',
              totalAmount: Number(b.total_amount) || 0,
              advancePaid: Number(b.advance_paid) || 0,
              balanceDue: Number(b.balance_due) || 0,
              advancePaymentMode: b.advance_payment_mode || 'Cash',
              specialNotes: b.special_notes || undefined,
              status: b.status || 'confirmed',
              createdBy: b.created_by || 'Staff',
              updatedAt: b.updated_at,
            }));
            logger.warn('CloudSync', `Pulled ${rows.length} banquet bookings from Supabase Cloud`);
          }
        }
      } catch (bErr) {
        logger.warn('CloudSync', `Error pulling banquet bookings from Cloud: ${bErr.message}`);
      }

      // 5. Pull Expenses
      try {
        const res = await fetch(`${url}/rest/v1/expenses?select=*&order=created_at.desc&limit=200`, { headers });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            db.data.expenses = rows.map((e) => ({
              id: e.id,
              title: e.title,
              category: e.category,
              amount: Number(e.amount) || 0,
              paidBy: e.paid_by || 'Cash Drawer',
              notes: e.notes || undefined,
              recordedBy: e.recorded_by || 'Manager',
              dateStr: e.date_str,
              createdAt: e.created_at,
            }));
            logger.warn('CloudSync', `Pulled ${rows.length} expenses from Supabase Cloud`);
          }
        }
      } catch (eErr) {
        logger.warn('CloudSync', `Error pulling expenses from Cloud: ${eErr.message}`);
      }

      // Persist local database with pulled data
      db.persist();

      return { success: true };
    } catch (err) {
      logger.error('CloudSync', 'Error in pullFromCloud', err);
      return { success: false, error: err.message };
    }
  }

  // -------------------------------------------------------------
  // Push Local Records to Supabase Cloud
  // -------------------------------------------------------------
  async pushToCloud() {
    const url = this.config.supabaseUrl;
    const headers = {
      ...(await this.authHeaders()),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    };

    // 1. Sync Settled Bills
    const bills = db.data.settledBills || [];
    let syncedBillsCount = 0;

    if (bills.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < bills.length; i += batchSize) {
        const batch = bills.slice(i, i + batchSize).map((b) => ({
          id: b.id,
          bill_number: b.billNumber || 0,
          status: b.status || 'settled',
          cancel_reason: b.cancelReason || null,
          cancelled_by: b.cancelledBy || null,
          cancelled_at: b.cancelledAt || null,
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
          payment_details: b.paymentDetails || {},
          items: b.items || [],
          date_str: b.dateStr || new Date().toISOString().split('T')[0],
          timestamp: b.timestamp ? new Date(b.timestamp).toISOString() : new Date().toISOString(),
        }));

        const res = await fetch(`${url}/rest/v1/bills`, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch),
        });

        if (res.ok) {
          syncedBillsCount += batch.length;
        } else {
          console.warn('[CloudSync] Bills sync batch warning:', res.statusText);
        }
      }
    }

    // 2. Sync Audit Logs
    const auditLogs = db.data.auditLogs || [];
    if (auditLogs.length > 0) {
      const recentLogs = auditLogs.slice(0, 100).map((l) => ({
        id: l.id,
        type: l.type,
        table_id: l.tableId,
        staff_name: l.staffName || 'Staff',
        item_name: l.itemName || null,
        item_price: Number(l.itemPrice) || 0,
        quantity: Number(l.quantity) || 1,
        reason: l.reason,
        timestamp: l.timestamp ? new Date(l.timestamp).toISOString() : new Date().toISOString(),
      }));

      const res = await fetch(`${url}/rest/v1/audit_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(recentLogs),
      });
      if (!res.ok) {
        console.warn('[CloudSync] Audit log sync warning:', res.statusText);
      }
    }

    // 3. Sync Daily Expenses
    const expenses = db.data.expenses || [];
    if (expenses.length > 0) {
      const batch = expenses.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: Number(e.amount) || 0,
        paid_by: e.paidBy || 'Cash Drawer',
        notes: e.notes || null,
        recorded_by: e.recordedBy || 'Manager',
        date_str: e.dateStr,
        created_at: e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString(),
      }));

      const res = await fetch(`${url}/rest/v1/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.warn('[CloudSync] Expenses sync warning:', res.statusText);
      }
    }

    // 4. Sync Menu Items
    const menuCategories = db.data.menuCategories || [];
    const allDishes = [];
    for (const cat of menuCategories) {
      if (Array.isArray(cat.items)) {
        for (const item of cat.items) {
          allDishes.push({
            id: item.id,
            category_id: cat.id,
            category_title: cat.name,
            name: item.name,
            hindi_name: item.hindiName || null,
            price: Number(item.price) || 0,
            dietary: item.dietary || 'veg',
            image: item.image || null,
            is_available: item.isAvailable !== false,
            popular: !!item.popular,
            description: item.description || null,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (allDishes.length > 0) {
      const res = await fetch(`${url}/rest/v1/menu_items`, {
        method: 'POST',
        headers,
        body: JSON.stringify(allDishes),
      });
      if (!res.ok) {
        console.warn('[CloudSync] Menu items sync warning:', res.statusText);
      }
    }

    // 5. Sync Rooms
    const rooms = db.data.rooms || [];
    if (rooms.length > 0) {
      const batch = rooms.map((r) => ({
        id: r.id,
        name: r.name,
        tier: r.tier || 'deluxe',
        price_per_night: Number(r.pricePerNight) || 1600,
        status: r.status || 'available',
        max_guests: Number(r.maxGuests) || 2,
        bed_type: r.bedType || null,
        guest_name: r.guestName || null,
        check_in_date: r.checkInDate || null,
        check_out_date: r.checkOutDate || null,
        folio_amount: Number(r.folioAmount) || 0,
        notes: r.notes || null,
        updated_at: new Date().toISOString(),
      }));

      const res = await fetch(`${url}/rest/v1/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.warn('[CloudSync] Rooms sync warning:', res.statusText);
      }
    }

    // 6. Sync Tables & Outlets Configuration
    const tablesConfig = db.data.tablesConfig || [];
    if (tablesConfig.length > 0) {
      const batch = tablesConfig.map((t) => ({
        id: t.id,
        name: t.name,
        section: t.section || 'dining',
        capacity: Number(t.capacity) || 4,
        is_active: t.isActive !== false,
        sort_order: Number(t.sortOrder) || 1,
        updated_at: new Date().toISOString(),
      }));

      const res = await fetch(`${url}/rest/v1/tables_config`, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.warn('[CloudSync] Tables config sync warning:', res.statusText);
      }
    }

    // 7. Sync Banquet & Event Bookings
    const banquetBookings = db.data.banquetBookings || [];
    if (banquetBookings.length > 0) {
      const batch = banquetBookings.map((b) => ({
        id: b.id,
        event_date: b.eventDate,
        slot: b.slot,
        custom_start_time: b.customStartTime || null,
        custom_end_time: b.customEndTime || null,
        venue: b.venue,
        event_type: b.eventType,
        no_of_guests: Number(b.noOfGuests) || 0,
        customer_name: b.customerName || 'Guest',
        customer_phone: b.customerPhone || '',
        total_amount: Number(b.totalAmount) || 0,
        advance_paid: Number(b.advancePaid) || 0,
        balance_due: Number(b.balanceDue) || 0,
        advance_payment_mode: b.advancePaymentMode || 'Cash',
        special_notes: b.specialNotes || null,
        status: b.status || 'confirmed',
        created_by: b.createdBy || 'Staff',
        updated_at: b.updatedAt || new Date().toISOString(),
      }));

      const res = await fetch(`${url}/rest/v1/banquet_bookings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.warn('[CloudSync] Banquet bookings sync warning:', res.statusText);
      }
    }

    return {
      syncedBills: syncedBillsCount,
    };
  }

  // -------------------------------------------------------------
  // Primary 2-Way Sync Worker (Pull from Cloud -> Push Local)
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
      // Step 1: Pull latest data from Supabase Cloud
      await this.pullFromCloud();

      // Step 2: Push local data to Supabase Cloud
      const pushResult = await this.pushToCloud();

      this.config.lastSyncTime = new Date().toISOString();
      this.config.lastSyncStatus = 'success';
      this.config.lastSyncError = null;

      logger.warn('CloudSync', `Synced ${pushResult.syncedBills} bills and 2-way merged data with Supabase Cloud`);

      // Persist last sync time to config
      fs.writeFileSync(configFilePath, JSON.stringify(this.config, null, 2), 'utf8');

      // Notify UI of updated ops data
      if (this.onDataUpdatedCallback) {
        try {
          this.onDataUpdatedCallback({ type: 'cloud-sync-complete' });
        } catch {}
      }

      return {
        success: true,
        syncedBills: pushResult.syncedBills,
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
