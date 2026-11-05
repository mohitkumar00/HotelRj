const fs = require('fs');
const path = require('path');

// Determine storage directory in %APPDATA%/hotel-rj (or fallback)
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

const dbDir = path.join(userDataDir, 'database');
const dbFilePath = path.join(dbDir, 'hotel-rj-data.json');
const dbBackupPath = path.join(dbDir, 'hotel-rj-data.backup.json');

class HotelDatabase {
  constructor() {
    this.data = {
      version: 1,
      settledBills: [],
      auditLogs: [],
      expenses: [],
    };
    this.ensureDirectory();
    this.load();
  }

  ensureDirectory() {
    try {
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    } catch (err) {
      console.error('[Database] Failed to create database directory:', err);
    }
  }

  load() {
    try {
      if (fs.existsSync(dbFilePath)) {
        const raw = fs.readFileSync(dbFilePath, 'utf8');
        if (raw && raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          this.data = {
            version: parsed.version || 1,
            settledBills: Array.isArray(parsed.settledBills) ? parsed.settledBills : [],
            auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
            expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
          };
          return;
        }
      }
    } catch (err) {
      console.error('[Database] Error reading database file, trying backup:', err);
      // Attempt recovery from backup
      try {
        if (fs.existsSync(dbBackupPath)) {
          const backupRaw = fs.readFileSync(dbBackupPath, 'utf8');
          this.data = JSON.parse(backupRaw);
          return;
        }
      } catch (bErr) {
        console.error('[Database] Backup recovery also failed:', bErr);
      }
    }

    // Default initialization
    this.persist();
  }

  persist() {
    try {
      this.ensureDirectory();
      const payload = JSON.stringify(this.data, null, 2);
      const tempPath = `${dbFilePath}.tmp`;

      // Atomic write pattern: write to tmp, then replace
      fs.writeFileSync(tempPath, payload, 'utf8');
      fs.copyFileSync(tempPath, dbBackupPath);
      fs.renameSync(tempPath, dbFilePath);
    } catch (err) {
      console.error('[Database] Failed to persist database:', err);
    }
  }

  // -------------------------------------------------------------
  // Bills & Orders
  // -------------------------------------------------------------
  saveSettledBill(bill) {
    if (!bill || typeof bill !== 'object') return null;

    const timestamp = bill.timestamp || new Date().toISOString();
    const dateStr = timestamp.split('T')[0];

    const record = {
      id: bill.id || `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      billNumber: bill.billNumber || Math.floor(1000 + Math.random() * 9000),
      tableId: bill.tableId || 'Table',
      orderType: bill.orderType || 'dine-in',
      roomNumber: bill.roomNumber || null,
      serverName: bill.serverName || 'Staff',
      settledBy: bill.settledBy || 'Cashier',
      customerPhone: bill.customerPhone || null,
      customerName: bill.customerName || null,
      items: Array.isArray(bill.items) ? bill.items : [],
      subtotal: Number(bill.subtotal) || 0,
      tax: Number(bill.tax) || 0,
      discount: Number(bill.discount) || 0,
      total: Number(bill.total) || 0,
      paymentMethod: bill.paymentMethod || 'cash',
      paymentDetails: bill.paymentDetails || {},
      timestamp,
      dateStr,
    };

    // Prepend to array (newest first)
    this.data.settledBills.unshift(record);

    // Keep database performant (e.g., store up to last 15,000 bills)
    if (this.data.settledBills.length > 15000) {
      this.data.settledBills = this.data.settledBills.slice(0, 15000);
    }

    this.persist();
    return record;
  }

  // -------------------------------------------------------------
  // Anti-Theft Audit Logs
  // -------------------------------------------------------------
  saveAuditLog(entry) {
    if (!entry) return null;

    const timestamp = entry.timestamp || new Date().toISOString();
    const dateStr = timestamp.split('T')[0];

    const record = {
      id: entry.id || `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: entry.type || 'ITEM_VOID', // 'ITEM_VOID' | 'KOT_CANCEL' | 'BILL_REPRINT' | 'MANUAL_DISCOUNT' | 'TABLE_RESET'
      tableId: entry.tableId || 'Table',
      staffName: entry.staffName || 'Staff',
      itemName: entry.itemName || null,
      itemPrice: Number(entry.itemPrice) || 0,
      quantity: Number(entry.quantity) || 1,
      reason: entry.reason || 'Not specified',
      timestamp,
      dateStr,
    };

    this.data.auditLogs.unshift(record);

    if (this.data.auditLogs.length > 5000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 5000);
    }

    this.persist();
    return record;
  }

  // -------------------------------------------------------------
  // Petty Cash Expenses
  // -------------------------------------------------------------
  saveExpense(expense) {
    if (!expense) return null;

    const timestamp = expense.timestamp || new Date().toISOString();
    const dateStr = timestamp.split('T')[0];

    const record = {
      id: expense.id || `EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      category: expense.category || 'General',
      amount: Number(expense.amount) || 0,
      paidBy: expense.paidBy || 'Cash Drawer',
      notes: expense.notes || '',
      recordedBy: expense.recordedBy || 'Cashier',
      timestamp,
      dateStr,
    };

    this.data.expenses.unshift(record);
    this.persist();
    return record;
  }

  deleteExpense(expenseId) {
    this.data.expenses = this.data.expenses.filter((e) => e.id !== expenseId);
    this.persist();
    return true;
  }

  // -------------------------------------------------------------
  // Analytics Aggregation Engine
  // -------------------------------------------------------------
  getAnalytics(dateFilter = 'today') {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    let filteredBills = [];
    let filteredAudits = [];
    let filteredExpenses = [];

    if (dateFilter === 'today') {
      filteredBills = this.data.settledBills.filter((b) => b.dateStr === todayStr);
      filteredAudits = this.data.auditLogs.filter((a) => a.dateStr === todayStr);
      filteredExpenses = this.data.expenses.filter((e) => e.dateStr === todayStr);
    } else if (dateFilter === 'yesterday') {
      filteredBills = this.data.settledBills.filter((b) => b.dateStr === yesterdayStr);
      filteredAudits = this.data.auditLogs.filter((a) => a.dateStr === yesterdayStr);
      filteredExpenses = this.data.expenses.filter((e) => e.dateStr === yesterdayStr);
    } else if (dateFilter === 'last7days') {
      filteredBills = this.data.settledBills.filter((b) => b.dateStr >= sevenDaysAgoStr);
      filteredAudits = this.data.auditLogs.filter((a) => a.dateStr >= sevenDaysAgoStr);
      filteredExpenses = this.data.expenses.filter((e) => e.dateStr >= sevenDaysAgoStr);
    } else {
      // all
      filteredBills = this.data.settledBills;
      filteredAudits = this.data.auditLogs;
      filteredExpenses = this.data.expenses;
    }

    // Revenue calculations
    let grossRevenue = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let roomFolioTotal = 0;
    let totalDiscount = 0;

    // Custom cooking calculations
    let customCookingRevenue = 0;
    let customCookingItemsCount = 0;
    let customKgEstimate = 0;

    // Item sales tracking for top dishes
    const dishSales = {};

    for (const b of filteredBills) {
      grossRevenue += b.total || 0;
      totalDiscount += b.discount || 0;

      const method = (b.paymentMethod || 'cash').toLowerCase();
      if (method === 'cash') cashTotal += b.total || 0;
      else if (method === 'upi') upiTotal += b.total || 0;
      else if (method === 'card') cardTotal += b.total || 0;
      else if (method === 'room-folio') roomFolioTotal += b.total || 0;
      else if (method === 'split') {
        const details = b.paymentDetails || {};
        cashTotal += Number(details.cashAmount) || 0;
        upiTotal += Number(details.upiAmount) || 0;
        cardTotal += Number(details.cardAmount) || 0;
      }

      // Parse items
      if (Array.isArray(b.items)) {
        for (const item of b.items) {
          const name = item.name || 'Dish';
          const qty = Number(item.quantity) || 1;
          const price = Number(item.price) || 0;
          const lineTotal = price * qty;

          if (!dishSales[name]) {
            dishSales[name] = { name, quantity: 0, revenue: 0, isCustom: !!item.isCustom };
          }
          dishSales[name].quantity += qty;
          dishSales[name].revenue += lineTotal;

          // Track custom services (e.g. Chicken Making Charge)
          if (item.isCustom || /making|charge|service/i.test(name)) {
            customCookingRevenue += lineTotal;
            customCookingItemsCount += qty;

            // Extract kg from name or notes if present (e.g. "2.5 kg" or "1 kg")
            const kgMatch = (name + ' ' + (item.notes || '')).match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/i);
            if (kgMatch) {
              customKgEstimate += parseFloat(kgMatch[1]) * qty;
            } else {
              // Standard 1kg per item count assumption
              customKgEstimate += qty;
            }
          }
        }
      }
    }

    // Top 10 dishes sorted by quantity
    const topDishes = Object.values(dishSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Expenses calculation
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = grossRevenue - totalExpenses;

    // Void / Audit summary
    const voidItems = filteredAudits.filter((a) => a.type === 'ITEM_VOID');
    const voidAmount = voidItems.reduce((sum, a) => sum + (a.itemPrice || 0) * (a.quantity || 1), 0);

    return {
      period: dateFilter,
      dateFormatted: dateFilter === 'today' ? todayStr : dateFilter === 'yesterday' ? yesterdayStr : 'Last 7 Days',
      grossRevenue: Math.round(grossRevenue),
      billsCount: filteredBills.length,
      avgBillValue: filteredBills.length > 0 ? Math.round(grossRevenue / filteredBills.length) : 0,
      paymentSplit: {
        cash: Math.round(cashTotal),
        upi: Math.round(upiTotal),
        card: Math.round(cardTotal),
        roomFolio: Math.round(roomFolioTotal),
      },
      customCooking: {
        revenue: Math.round(customCookingRevenue),
        count: customCookingItemsCount,
        kgEstimate: parseFloat(customKgEstimate.toFixed(1)),
      },
      expenses: {
        total: Math.round(totalExpenses),
        count: filteredExpenses.length,
        list: filteredExpenses.slice(0, 30),
      },
      netProfit: Math.round(netProfit),
      antiTheft: {
        voidsCount: voidItems.length,
        voidAmount: Math.round(voidAmount),
        recentAudits: filteredAudits.slice(0, 30),
      },
      topDishes,
      recentBills: filteredBills.slice(0, 25),
    };
  }
}

module.exports = new HotelDatabase();
