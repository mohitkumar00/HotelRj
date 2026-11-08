const fs = require('fs');
const path = require('path');
const { DEFAULT_MENU_CATEGORIES, DEFAULT_ROOMS, DEFAULT_TABLES_CONFIG } = require('./defaultHotelData.cjs');

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
      version: 2,
      settledBills: [],
      auditLogs: [],
      expenses: [],
      banquetBookings: [],
      menuCategories: JSON.parse(JSON.stringify(DEFAULT_MENU_CATEGORIES)),
      rooms: JSON.parse(JSON.stringify(DEFAULT_ROOMS)),
      tablesConfig: JSON.parse(JSON.stringify(DEFAULT_TABLES_CONFIG)),
      pendingDeletions: [],
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
            version: parsed.version || 2,
            settledBills: Array.isArray(parsed.settledBills) ? parsed.settledBills : [],
            auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
            expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
            banquetBookings: Array.isArray(parsed.banquetBookings) ? parsed.banquetBookings : [],
            menuCategories: Array.isArray(parsed.menuCategories) && parsed.menuCategories.length > 0 
              ? parsed.menuCategories 
              : JSON.parse(JSON.stringify(DEFAULT_MENU_CATEGORIES)),
            rooms: Array.isArray(parsed.rooms)
              ? parsed.rooms 
              : JSON.parse(JSON.stringify(DEFAULT_ROOMS)),
            tablesConfig: Array.isArray(parsed.tablesConfig)
              ? parsed.tablesConfig 
              : JSON.parse(JSON.stringify(DEFAULT_TABLES_CONFIG)),
            pendingDeletions: Array.isArray(parsed.pendingDeletions) ? parsed.pendingDeletions : [],
          };

          // Backfill department for legacy records
          let modified = false;
          for (const b of this.data.settledBills) {
            if (!b.department) {
              b.department = this.detectDepartment(b.tableId, b.orderType);
              modified = true;
            }
          }

          // Normalize legacy room IDs (e.g. 'room-101' -> 'Room 101')
          for (const r of (this.data.rooms || [])) {
            if (/^room-\d+/i.test(r.id)) {
              const num = r.id.replace(/room-/i, '');
              r.id = `Room ${num}`;
              modified = true;
            }
          }

          if (modified) {
            this.persist();
          }
          return;
        }
      }
    } catch (err) {
      console.error('[Database] Error reading database file, trying backup:', err);
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

    this.persist();
  }

  persist() {
    try {
      this.ensureDirectory();
      const payload = JSON.stringify(this.data, null, 2);
      const tempPath = `${dbFilePath}.tmp`;

      fs.writeFileSync(tempPath, payload, 'utf8');
      fs.copyFileSync(tempPath, dbBackupPath);
      fs.renameSync(tempPath, dbFilePath);
    } catch (err) {
      console.error('[Database] Failed to persist database:', err);
    }
  }

  // -------------------------------------------------------------
  // Pending Deletions Management (Offline Resilience & Anti-Resurrection)
  // -------------------------------------------------------------
  recordPendingDeletion(table, id) {
    if (!table || !id) return;
    if (!this.data.pendingDeletions) this.data.pendingDeletions = [];
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '');
    const targetNorm = norm(id);
    const existing = this.data.pendingDeletions.find(
      (p) => p.table === table && norm(p.id) === targetNorm
    );
    if (!existing) {
      this.data.pendingDeletions.push({
        table,
        id,
        timestamp: Date.now(),
      });
      this.persist();
    }
  }

  getPendingDeletions(table = null) {
    const list = this.data.pendingDeletions || [];
    if (!table) return list;
    return list.filter((p) => p.table === table);
  }

  removePendingDeletion(table, id) {
    if (!this.data.pendingDeletions || !id) return;
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '');
    const targetNorm = norm(id);
    this.data.pendingDeletions = this.data.pendingDeletions.filter(
      (p) => !(p.table === table && norm(p.id) === targetNorm)
    );
    this.persist();
  }

  isPendingDeletion(table, id) {
    if (!this.data.pendingDeletions || !id) return false;
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '');
    const targetNorm = norm(id);
    return this.data.pendingDeletions.some(
      (p) => p.table === table && norm(p.id) === targetNorm
    );
  }

  // Helper: auto-detect department
  detectDepartment(tableId = '', orderType = '', explicitDept = '') {
    if (explicitDept && ['restaurant', 'rooms', 'banquet'].includes(explicitDept.toLowerCase())) {
      return explicitDept.toLowerCase();
    }
    const t = String(tableId || '').toLowerCase();
    const ot = String(orderType || '').toLowerCase();

    if (t.includes('banquet') || t.includes('hall') || t.includes('event') || t.includes('lawn') || ot.includes('banquet')) {
      return 'banquet';
    }
    if (t.startsWith('r-') || t.includes('room') || ot.includes('room')) {
      return 'rooms';
    }
    return 'restaurant';
  }

  // -------------------------------------------------------------
  // Bills & Orders
  // -------------------------------------------------------------
  saveSettledBill(bill) {
    if (!bill || typeof bill !== 'object') return null;

    const timestamp = bill.timestamp || new Date().toISOString();
    const dateStr = timestamp.split('T')[0];
    const department = this.detectDepartment(bill.tableId, bill.orderType, bill.department);

    const record = {
      id: bill.id || `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      billNumber: bill.billNumber || Math.floor(1000 + Math.random() * 9000),
      status: bill.status || 'settled', // 'settled' | 'cancelled'
      cancelReason: bill.cancelReason || null,
      cancelledBy: bill.cancelledBy || null,
      cancelledAt: bill.cancelledAt || null,
      department, // 'restaurant' | 'rooms' | 'banquet'
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

    this.data.settledBills.unshift(record);

    if (this.data.settledBills.length > 25000) {
      this.data.settledBills = this.data.settledBills.slice(0, 25000);
    }

    this.persist();
    return record;
  }

  // -------------------------------------------------------------
  // Cancel / Void Bill (With Anti-Theft Audit Trail)
  // -------------------------------------------------------------
  cancelBill(billId, reason = 'Cancelled by manager', cancelledBy = 'Counter Cashier') {
    if (!billId) return { success: false, error: 'Bill ID is required' };

    const bill = this.data.settledBills.find(
      (b) => b.id === billId || String(b.billNumber) === String(billId)
    );

    if (!bill) {
      return { success: false, error: 'Bill not found in database' };
    }

    if (bill.status === 'cancelled') {
      return { success: false, error: 'Bill is already cancelled' };
    }

    const nowIso = new Date().toISOString();
    bill.status = 'cancelled';
    bill.cancelReason = String(reason || 'No reason provided').trim();
    bill.cancelledBy = String(cancelledBy || 'Counter Cashier').trim();
    bill.cancelledAt = nowIso;

    // Automatically record an anti-theft audit log entry
    this.saveAuditLog({
      type: 'BILL_CANCEL',
      tableId: bill.tableId || 'Table',
      staffName: bill.cancelledBy,
      itemName: `Bill #${bill.billNumber} (₹${bill.total})`,
      itemPrice: Number(bill.total) || 0,
      quantity: 1,
      reason: bill.cancelReason,
      timestamp: nowIso,
    });

    this.persist();
    return { success: true, bill };
  }

  // -------------------------------------------------------------
  // Get Recent Bills
  // -------------------------------------------------------------
  getRecentBills(limit = 60) {
    return (this.data.settledBills || []).slice(0, Number(limit) || 60);
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
      type: entry.type || 'ITEM_VOID',
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
      title: expense.title || expense.category || 'General Expense',
      category: expense.category || 'General',
      amount: Number(expense.amount) || 0,
      paidBy: expense.paidBy || 'Cash Drawer',
      notes: expense.notes || '',
      recordedBy: expense.recordedBy || 'Cashier',
      timestamp,
      dateStr,
      cloudSynced: false,
      updatedAt: Date.now(),
    };

    if (!this.data.expenses) this.data.expenses = [];
    const existingIdx = this.data.expenses.findIndex((e) => e.id === record.id);
    if (existingIdx >= 0) {
      this.data.expenses[existingIdx] = { ...this.data.expenses[existingIdx], ...record };
    } else {
      this.data.expenses.unshift(record);
    }

    this.removePendingDeletion('expenses', record.id);
    this.persist();
    return record;
  }

  deleteExpense(expenseId) {
    if (!expenseId) return false;
    this.data.expenses = (this.data.expenses || []).filter((e) => e.id !== expenseId);
    this.recordPendingDeletion('expenses', expenseId);
    this.persist();
    return true;
  }

  // -------------------------------------------------------------
  // Comprehensive Analytics Engine (Day / Month / Year / Department)
  // -------------------------------------------------------------
  getAnalytics(query = 'today') {
    let options = {};
    if (typeof query === 'string') {
      options = { period: query };
    } else if (typeof query === 'object' && query !== null) {
      options = query;
    }

    const period = options.period || 'today';
    const departmentFilter = options.department || 'all'; // 'all' | 'restaurant' | 'rooms' | 'banquet'

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentYearStr = String(now.getFullYear());
    const currentMonthStr = `${currentYearStr}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    let timeFilteredBills = [];
    let timeFilteredAudits = [];
    let timeFilteredExpenses = [];
    let label = 'Today';

    if (period === 'today') {
      timeFilteredBills = this.data.settledBills.filter((b) => b.dateStr === todayStr);
      timeFilteredAudits = this.data.auditLogs.filter((a) => a.dateStr === todayStr);
      timeFilteredExpenses = this.data.expenses.filter((e) => e.dateStr === todayStr);
      label = `Today (${todayStr})`;
    } else if (period === 'yesterday') {
      timeFilteredBills = this.data.settledBills.filter((b) => b.dateStr === yesterdayStr);
      timeFilteredAudits = this.data.auditLogs.filter((a) => a.dateStr === yesterdayStr);
      timeFilteredExpenses = this.data.expenses.filter((e) => e.dateStr === yesterdayStr);
      label = `Yesterday (${yesterdayStr})`;
    } else if (period === 'this_month') {
      timeFilteredBills = this.data.settledBills.filter((b) => (b.dateStr || '').startsWith(currentMonthStr));
      timeFilteredAudits = this.data.auditLogs.filter((a) => (a.dateStr || '').startsWith(currentMonthStr));
      timeFilteredExpenses = this.data.expenses.filter((e) => (e.dateStr || '').startsWith(currentMonthStr));
      label = `This Month (${currentMonthStr})`;
    } else if (period === 'last_month') {
      timeFilteredBills = this.data.settledBills.filter((b) => (b.dateStr || '').startsWith(lastMonthStr));
      timeFilteredAudits = this.data.auditLogs.filter((a) => (a.dateStr || '').startsWith(lastMonthStr));
      timeFilteredExpenses = this.data.expenses.filter((e) => (e.dateStr || '').startsWith(lastMonthStr));
      label = `Last Month (${lastMonthStr})`;
    } else if (period === 'this_year') {
      timeFilteredBills = this.data.settledBills.filter((b) => (b.dateStr || '').startsWith(currentYearStr));
      timeFilteredAudits = this.data.auditLogs.filter((a) => (a.dateStr || '').startsWith(currentYearStr));
      timeFilteredExpenses = this.data.expenses.filter((e) => (e.dateStr || '').startsWith(currentYearStr));
      label = `Year ${currentYearStr}`;
    } else if (period === 'last7days') {
      timeFilteredBills = this.data.settledBills.filter((b) => b.dateStr >= sevenDaysAgoStr);
      timeFilteredAudits = this.data.auditLogs.filter((a) => a.dateStr >= sevenDaysAgoStr);
      timeFilteredExpenses = this.data.expenses.filter((e) => e.dateStr >= sevenDaysAgoStr);
      label = 'Last 7 Days';
    } else if (period === 'custom_month' && options.month) {
      timeFilteredBills = this.data.settledBills.filter((b) => (b.dateStr || '').startsWith(options.month));
      timeFilteredAudits = this.data.auditLogs.filter((a) => (a.dateStr || '').startsWith(options.month));
      timeFilteredExpenses = this.data.expenses.filter((e) => (e.dateStr || '').startsWith(options.month));
      label = `Month: ${options.month}`;
    } else if (period === 'custom_year' && options.year) {
      timeFilteredBills = this.data.settledBills.filter((b) => (b.dateStr || '').startsWith(String(options.year)));
      timeFilteredAudits = this.data.auditLogs.filter((a) => (a.dateStr || '').startsWith(String(options.year)));
      timeFilteredExpenses = this.data.expenses.filter((e) => (e.dateStr || '').startsWith(String(options.year)));
      label = `Year: ${options.year}`;
    } else {
      timeFilteredBills = this.data.settledBills;
      timeFilteredAudits = this.data.auditLogs;
      timeFilteredExpenses = this.data.expenses;
      label = 'All Time History';
    }

    // Separate active bills from cancelled bills (Anti-Theft exclusion)
    const activeTimeBills = timeFilteredBills.filter((b) => b.status !== 'cancelled');
    const cancelledTimeBills = timeFilteredBills.filter((b) => b.status === 'cancelled');
    const cancelledAmount = cancelledTimeBills.reduce((s, b) => s + (Number(b.total) || 0), 0);

    // Compute Department Breakdown across active bills in this time window
    const departmentBreakdown = {
      restaurant: { revenue: 0, count: 0, customCookingRevenue: 0, customKgEstimate: 0 },
      rooms: { revenue: 0, count: 0 },
      banquet: { revenue: 0, count: 0 },
    };

    for (const b of activeTimeBills) {
      const dept = b.department || this.detectDepartment(b.tableId, b.orderType);
      const target = departmentBreakdown[dept] || departmentBreakdown.restaurant;
      target.revenue += b.total || 0;
      target.count += 1;

      // Calculate custom chicken/meat making in restaurant
      if (dept === 'restaurant' && Array.isArray(b.items)) {
        for (const item of b.items) {
          if (item.isCustom || /making|charge|service/i.test(item.name || '')) {
            const lineTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
            departmentBreakdown.restaurant.customCookingRevenue += lineTotal;
            const kgMatch = ((item.name || '') + ' ' + (item.notes || '')).match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/i);
            departmentBreakdown.restaurant.customKgEstimate += kgMatch ? parseFloat(kgMatch[1]) * (item.quantity || 1) : (item.quantity || 1);
          }
        }
      }
    }

    // Compute Monthly Trends (12 months of current year or selected year)
    const targetYear = options.year || currentYearStr;
    const monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends = monthsNames.map((name, idx) => {
      const monthPrefix = `${targetYear}-${String(idx + 1).padStart(2, '0')}`;
      const mBills = this.data.settledBills.filter(
        (b) => (b.dateStr || '').startsWith(monthPrefix) && b.status !== 'cancelled'
      );

      let mRest = 0;
      let mRooms = 0;
      let mBanquet = 0;
      for (const b of mBills) {
        const d = b.department || this.detectDepartment(b.tableId, b.orderType);
        if (d === 'rooms') mRooms += b.total || 0;
        else if (d === 'banquet') mBanquet += b.total || 0;
        else mRest += b.total || 0;
      }

      return {
        month: monthPrefix,
        monthName: name,
        total: Math.round(mRest + mRooms + mBanquet),
        restaurant: Math.round(mRest),
        rooms: Math.round(mRooms),
        banquet: Math.round(mBanquet),
        billsCount: mBills.length,
      };
    });

    // Compute Daily Trends (if viewing month)
    const targetMonthPrefix = period === 'last_month' ? lastMonthStr : (options.month || currentMonthStr);
    const daysInMonthMap = {};
    for (const b of this.data.settledBills) {
      if ((b.dateStr || '').startsWith(targetMonthPrefix) && b.status !== 'cancelled') {
        if (!daysInMonthMap[b.dateStr]) {
          daysInMonthMap[b.dateStr] = { date: b.dateStr, day: b.dateStr.split('-')[2], restaurant: 0, rooms: 0, banquet: 0, total: 0, billsCount: 0 };
        }
        const d = b.department || this.detectDepartment(b.tableId, b.orderType);
        if (d === 'rooms') daysInMonthMap[b.dateStr].rooms += b.total || 0;
        else if (d === 'banquet') daysInMonthMap[b.dateStr].banquet += b.total || 0;
        else daysInMonthMap[b.dateStr].restaurant += b.total || 0;
        daysInMonthMap[b.dateStr].total += b.total || 0;
        daysInMonthMap[b.dateStr].billsCount += 1;
      }
    }
    const dailyTrends = Object.values(daysInMonthMap).sort((a, b) => a.date.localeCompare(b.date));

    // Now apply department filter for detailed views (top dishes, specific revenue cards)
    let displayBills = timeFilteredBills;
    if (departmentFilter !== 'all') {
      displayBills = timeFilteredBills.filter((b) => (b.department || this.detectDepartment(b.tableId, b.orderType)) === departmentFilter);
    }

    const activeDisplayBills = displayBills.filter((b) => b.status !== 'cancelled');

    let grossRevenue = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let roomFolioTotal = 0;
    const dishSales = {};

    for (const b of activeDisplayBills) {
      grossRevenue += b.total || 0;
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

      if (Array.isArray(b.items)) {
        for (const item of b.items) {
          const name = item.name || 'Dish';
          const qty = Number(item.quantity) || 1;
          const price = Number(item.price) || 0;
          if (!dishSales[name]) {
            dishSales[name] = { name, quantity: 0, revenue: 0, isCustom: !!item.isCustom };
          }
          dishSales[name].quantity += qty;
          dishSales[name].revenue += price * qty;
        }
      }
    }

    const topDishes = Object.values(dishSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const totalExpenses = timeFilteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const voidItems = timeFilteredAudits.filter((a) => a.type === 'ITEM_VOID');
    const voidAmount = voidItems.reduce((sum, a) => sum + (a.itemPrice || 0) * (a.quantity || 1), 0);

    return {
      period,
      department: departmentFilter,
      dateFormatted: label,
      currentYear: currentYearStr,
      currentMonth: currentMonthStr,
      grossRevenue: Math.round(grossRevenue),
      billsCount: activeDisplayBills.length,
      avgBillValue: activeDisplayBills.length > 0 ? Math.round(grossRevenue / activeDisplayBills.length) : 0,
      departments: {
        restaurant: {
          revenue: Math.round(departmentBreakdown.restaurant.revenue),
          count: departmentBreakdown.restaurant.count,
          customCookingRevenue: Math.round(departmentBreakdown.restaurant.customCookingRevenue),
          customKgEstimate: parseFloat(departmentBreakdown.restaurant.customKgEstimate.toFixed(1)),
        },
        rooms: {
          revenue: Math.round(departmentBreakdown.rooms.revenue),
          count: departmentBreakdown.rooms.count,
        },
        banquet: {
          revenue: Math.round(departmentBreakdown.banquet.revenue),
          count: departmentBreakdown.banquet.count,
        },
      },
      monthlyTrends,
      dailyTrends,
      paymentSplit: {
        cash: Math.round(cashTotal),
        upi: Math.round(upiTotal),
        card: Math.round(cardTotal),
        roomFolio: Math.round(roomFolioTotal),
      },
      expenses: {
        total: Math.round(totalExpenses),
        count: timeFilteredExpenses.length,
        list: timeFilteredExpenses.slice(0, 30),
      },
      netProfit: Math.round(grossRevenue - totalExpenses),
      antiTheft: {
        voidsCount: voidItems.length,
        voidAmount: Math.round(voidAmount),
        cancelledBillsCount: cancelledTimeBills.length,
        cancelledBillsAmount: Math.round(cancelledAmount),
        recentAudits: timeFilteredAudits.slice(0, 30),
      },
      topDishes,
      recentBills: displayBills.slice(0, 50),
    };
  }

  // -------------------------------------------------------------
  // Menu & Dishes Management (Kitchen 86 Sold-Out Tracking)
  // -------------------------------------------------------------
  getMenu() {
    return this.data.menuCategories || [];
  }

  updateMenuFromCloud(cloudItems) {
    if (!Array.isArray(cloudItems) || cloudItems.length === 0) return;
    if (!this.data.menuCategories || this.data.menuCategories.length === 0) {
      this.data.menuCategories = JSON.parse(JSON.stringify(DEFAULT_MENU_CATEGORIES));
    }

    const itemMap = new Map();
    const cloudIds = new Set();
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '');

    for (const row of cloudItems) {
      if (this.isPendingDeletion('menu_items', row.id)) continue;
      const normId = norm(row.id);
      itemMap.set(normId, row);
      cloudIds.add(normId);
    }

    for (const cat of this.data.menuCategories) {
      if (Array.isArray(cat.items)) {
        // Prune any dishes that have been deleted from Supabase Cloud on another laptop,
        // but preserve dishes newly created locally that haven't been pushed yet.
        cat.items = cat.items.filter((localItem) => {
          const lNorm = norm(localItem.id);
          if (this.isPendingDeletion('menu_items', localItem.id)) return false;
          if (cloudIds.has(lNorm)) return true;
          // If it was already cloudSynced, it was deleted in cloud on another machine
          if (localItem.cloudSynced === true) return false;
          // Preserve local un-synced dish
          return true;
        });

        for (let i = 0; i < cat.items.length; i++) {
          const localItem = cat.items[i];
          const cloudItem = itemMap.get(norm(localItem.id));
          if (cloudItem) {
            cat.items[i] = {
              ...localItem,
              id: cloudItem.id,
              name: cloudItem.name || localItem.name,
              hindiName: cloudItem.hindi_name !== undefined ? cloudItem.hindi_name : localItem.hindiName,
              price: Number(cloudItem.price) || localItem.price,
              isAvailable: cloudItem.is_available !== false,
              dietary: cloudItem.dietary || localItem.dietary,
              popular: cloudItem.popular !== undefined ? !!cloudItem.popular : localItem.popular,
              description: cloudItem.description !== undefined ? cloudItem.description : localItem.description,
              image: cloudItem.image || localItem.image,
              cloudSynced: true,
            };
            itemMap.delete(norm(localItem.id));
          }
        }
      }
    }

    for (const [normId, row] of itemMap.entries()) {
      const catId = row.category_id || 'chef_specials';
      let targetCat = this.data.menuCategories.find((c) => c.id === catId) || this.data.menuCategories[0];
      if (targetCat) {
        if (!targetCat.items) targetCat.items = [];
        targetCat.items.push({
          id: row.id,
          name: row.name,
          hindiName: row.hindi_name || '',
          price: Number(row.price) || 0,
          category: catId,
          dietary: row.dietary || 'veg',
          image: row.image,
          isAvailable: row.is_available !== false,
          popular: !!row.popular,
          description: row.description || '',
          cloudSynced: true,
        });
      }
    }

    this.persist();
  }

  toggleDishAvailability(dishId, isAvailable) {
    if (!dishId) return { success: false, error: 'Missing dishId' };
    let targetDish = null;
    let targetCategory = null;

    for (const cat of (this.data.menuCategories || [])) {
      if (Array.isArray(cat.items)) {
        const dish = cat.items.find((i) => i.id === dishId);
        if (dish) {
          targetDish = dish;
          targetCategory = cat;
          break;
        }
      }
    }

    if (!targetDish) {
      return { success: false, error: `Dish not found with id ${dishId}` };
    }

    const newStatus = isAvailable !== undefined ? !!isAvailable : !targetDish.isAvailable;
    targetDish.isAvailable = newStatus;
    targetDish.updatedAt = Date.now();
    targetDish.cloudSynced = false;

    // Anti-theft audit log
    this.saveAuditLog({
      type: 'ITEM_VOID',
      tableId: 'Kitchen-86',
      staffName: 'Manager',
      itemName: targetDish.name,
      itemPrice: Number(targetDish.price) || 0,
      quantity: 1,
      reason: newStatus ? 'Dish marked Available (In Stock)' : 'Dish marked Sold Out (Kitchen 86)',
    });

    this.persist();
    return { success: true, dish: targetDish, categoryId: targetCategory?.id };
  }

  saveDish(dishData, originalId = null) {
    if (!dishData || !dishData.name) {
      return { success: false, error: 'Missing dish name or details' };
    }

    if (!this.data.menuCategories || this.data.menuCategories.length === 0) {
      this.data.menuCategories = JSON.parse(JSON.stringify(DEFAULT_MENU_CATEGORIES));
    }

    const catId = dishData.categoryId || dishData.category || 'chef_specials';
    let targetCat = this.data.menuCategories.find((c) => c.id === catId);
    if (!targetCat) {
      targetCat = this.data.menuCategories[0];
    }
    if (!targetCat.items) targetCat.items = [];

    const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '');
    const targetIdNorm = dishData.id ? norm(dishData.id) : null;
    const origIdNorm = originalId ? norm(originalId) : null;

    // Search across ALL categories: if dish already exists (even in another category), remove it to prevent duplicates
    let oldDishRecord = null;
    let removedFromCatId = null;

    for (const cat of this.data.menuCategories) {
      if (Array.isArray(cat.items)) {
        for (let i = 0; i < cat.items.length; i++) {
          const item = cat.items[i];
          const itemNorm = norm(item.id);
          const isMatch = (origIdNorm && itemNorm === origIdNorm) || (targetIdNorm && itemNorm === targetIdNorm);
          if (isMatch) {
            oldDishRecord = item;
            removedFromCatId = cat.id;
            cat.items.splice(i, 1);
            break;
          }
        }
      }
    }

    const newId = dishData.id || (oldDishRecord && oldDishRecord.id) || `dish-${Date.now()}`;
    const savedDish = {
      ...(oldDishRecord || {}),
      ...dishData,
      id: newId,
      name: dishData.name.trim(),
      hindiName: dishData.hindiName || (oldDishRecord && oldDishRecord.hindiName) || '',
      price: Number(dishData.price) >= 0 ? Number(dishData.price) : (oldDishRecord ? Number(oldDishRecord.price) : 0),
      dietary: dishData.dietary || (oldDishRecord && oldDishRecord.dietary) || 'veg',
      category: targetCat.id,
      popular: dishData.popular !== undefined ? !!dishData.popular : (oldDishRecord ? !!oldDishRecord.popular : false),
      isAvailable: dishData.isAvailable !== undefined ? !!dishData.isAvailable : (oldDishRecord ? oldDishRecord.isAvailable !== false : true),
      description: dishData.description !== undefined ? dishData.description : (oldDishRecord ? oldDishRecord.description || '' : ''),
      updatedAt: Date.now(),
      cloudSynced: false,
    };

    targetCat.items.push(savedDish);

    this.removePendingDeletion('menu_items', savedDish.id);
    if (originalId) {
      this.removePendingDeletion('menu_items', originalId);
    }

    this.saveAuditLog({
      type: 'ITEM_VOID',
      tableId: 'Menu-Config',
      staffName: 'Manager',
      itemName: savedDish.name,
      itemPrice: Number(savedDish.price) || 0,
      quantity: 1,
      reason: oldDishRecord ? `Updated dish: ${savedDish.name} (₹${savedDish.price})` : `Added new dish: ${savedDish.name} (₹${savedDish.price})`,
    });

    this.persist();
    return {
      success: true,
      dish: savedDish,
      renamedFrom: originalId && norm(originalId) !== norm(savedDish.id) ? originalId : null,
      movedFromCategory: removedFromCatId && removedFromCatId !== targetCat.id ? removedFromCatId : null,
    };
  }

  deleteDish(dishId) {
    if (!dishId) return { success: false, error: 'Missing dishId' };
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '');
    const targetNorm = norm(dishId);
    let deleted = false;
    let deletedName = '';
    let deletedId = dishId;

    for (const cat of (this.data.menuCategories || [])) {
      if (Array.isArray(cat.items)) {
        const idx = cat.items.findIndex((i) => norm(i.id) === targetNorm);
        if (idx >= 0) {
          deletedName = cat.items[idx].name;
          deletedId = cat.items[idx].id;
          cat.items.splice(idx, 1);
          deleted = true;
          break;
        }
      }
    }

    if (deleted) {
      this.recordPendingDeletion('menu_items', deletedId);
      this.saveAuditLog({
        type: 'ITEM_VOID',
        tableId: 'Menu-Config',
        staffName: 'Manager',
        itemName: deletedName,
        itemPrice: 0,
        quantity: 1,
        reason: `Dish deleted from menu database (${deletedId})`,
      });
      this.persist();
      return { success: true, deletedId };
    }
    return { success: false, error: 'Dish not found' };
  }

  // -------------------------------------------------------------
  // Rooms Management (Tariffs & Housekeeping Status)
  // -------------------------------------------------------------
  getRooms() {
    return this.data.rooms || [];
  }

  updateRoomStatus(roomId, status, guestDetails = {}) {
    if (!roomId) return { success: false, error: 'Missing roomId' };
    const cleanId = String(roomId).trim().toLowerCase().replace(/[\s-_]/g, '');
    const room = (this.data.rooms || []).find((r) => {
      const targetId = String(r.id || '').toLowerCase().replace(/[\s-_]/g, '');
      const targetName = String(r.name || '').toLowerCase().replace(/[\s-_]/g, '');
      return targetId === cleanId || targetName.includes(cleanId);
    });
    if (!room) return { success: false, error: 'Room not found' };

    room.status = status || room.status;
    if (guestDetails.guestName !== undefined) room.guestName = guestDetails.guestName;
    if (guestDetails.checkInDate !== undefined) room.checkInDate = guestDetails.checkInDate;
    if (guestDetails.checkOutDate !== undefined) room.checkOutDate = guestDetails.checkOutDate;
    if (guestDetails.folioAmount !== undefined) room.folioAmount = Number(guestDetails.folioAmount) || 0;
    if (guestDetails.notes !== undefined) room.notes = guestDetails.notes;
    room.updatedAt = Date.now();

    this.saveAuditLog({
      type: 'ITEM_VOID',
      tableId: room.id,
      staffName: 'Manager',
      itemName: room.name,
      itemPrice: Number(room.pricePerNight) || 0,
      quantity: 1,
      reason: `Room status updated to ${String(status).toUpperCase()}`,
    });

    this.persist();
    return { success: true, room };
  }

  saveRoom(roomData, originalId = null) {
    if (!roomData || !roomData.id) return { success: false, error: 'Missing room details' };
    if (!this.data.rooms) this.data.rooms = [];

    const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '');
    const newNorm = norm(roomData.id);
    const origNorm = originalId ? norm(originalId) : null;

    let removedOld = false;
    let oldRoomRecord = null;
    if (origNorm && origNorm !== newNorm) {
      const oldIdx = this.data.rooms.findIndex((r) => norm(r.id) === origNorm);
      if (oldIdx >= 0) {
        oldRoomRecord = this.data.rooms[oldIdx];
        this.data.rooms.splice(oldIdx, 1);
        removedOld = true;
        this.recordPendingDeletion('rooms', oldRoomRecord.id);
      }
    }

    const existingIdx = this.data.rooms.findIndex((r) => norm(r.id) === newNorm);
    let savedRoom;
    if (existingIdx >= 0) {
      savedRoom = {
        ...this.data.rooms[existingIdx],
        ...roomData,
        id: roomData.id.trim(),
        name: roomData.name || roomData.id.trim(),
        updatedAt: Date.now(),
        cloudSynced: false,
      };
      this.data.rooms[existingIdx] = savedRoom;
    } else {
      savedRoom = {
        ...(oldRoomRecord || {}),
        ...roomData,
        id: roomData.id.trim(),
        name: roomData.name || roomData.id.trim(),
        tier: roomData.tier || (oldRoomRecord && oldRoomRecord.tier) || 'deluxe',
        pricePerNight: Number(roomData.pricePerNight) || (oldRoomRecord && oldRoomRecord.pricePerNight) || 1600,
        status: roomData.status || (oldRoomRecord && oldRoomRecord.status) || 'available',
        maxGuests: Number(roomData.maxGuests) || (oldRoomRecord && oldRoomRecord.maxGuests) || 2,
        bedType: roomData.bedType || (oldRoomRecord && oldRoomRecord.bedType) || '1 King Bed',
        updatedAt: Date.now(),
        cloudSynced: false,
      };
      this.data.rooms.push(savedRoom);
    }

    this.removePendingDeletion('rooms', savedRoom.id);
    this.persist();
    return { success: true, room: savedRoom, renamedFrom: removedOld ? (oldRoomRecord?.id || originalId) : null };
  }

  deleteRoom(roomId) {
    if (!roomId) return { success: false, error: 'Missing roomId' };
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '');
    const target = norm(roomId);
    const idx = (this.data.rooms || []).findIndex((r) => norm(r.id) === target);
    if (idx >= 0) {
      const deletedRoom = this.data.rooms[idx];
      this.data.rooms.splice(idx, 1);
      this.recordPendingDeletion('rooms', deletedRoom.id);
      this.persist();
      return { success: true, deletedId: deletedRoom.id };
    }
    return { success: false, error: 'Room not found' };
  }

  // -------------------------------------------------------------
  // Tables & Outlets Configuration Management
  // -------------------------------------------------------------
  getTablesConfig() {
    return this.data.tablesConfig || [];
  }

  saveTableConfig(tableData, originalId = null) {
    if (!tableData || !tableData.id) return { success: false, error: 'Missing table ID' };
    if (!this.data.tablesConfig) this.data.tablesConfig = [];

    const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '');
    const newNorm = norm(tableData.id);
    const origNorm = originalId ? norm(originalId) : null;

    let removedOld = false;
    let oldTableRecord = null;
    if (origNorm && origNorm !== newNorm) {
      const oldIdx = this.data.tablesConfig.findIndex((t) => norm(t.id) === origNorm);
      if (oldIdx >= 0) {
        oldTableRecord = this.data.tablesConfig[oldIdx];
        this.data.tablesConfig.splice(oldIdx, 1);
        removedOld = true;
        this.recordPendingDeletion('tables_config', oldTableRecord.id);
      }
    }

    const existingIdx = this.data.tablesConfig.findIndex((t) => norm(t.id) === newNorm);
    let savedTable;
    if (existingIdx >= 0) {
      savedTable = {
        ...this.data.tablesConfig[existingIdx],
        ...tableData,
        id: tableData.id.trim(),
        name: tableData.name || tableData.id.trim(),
        updatedAt: Date.now(),
        cloudSynced: false,
      };
      this.data.tablesConfig[existingIdx] = savedTable;
    } else {
      savedTable = {
        ...(oldTableRecord || {}),
        ...tableData,
        id: tableData.id.trim(),
        name: tableData.name || tableData.id.trim(),
        section: tableData.section || (oldTableRecord && oldTableRecord.section) || 'dining',
        capacity: Number(tableData.capacity) || (oldTableRecord && oldTableRecord.capacity) || 4,
        isActive: tableData.isActive !== undefined ? !!tableData.isActive : true,
        sortOrder: Number(tableData.sortOrder) || (this.data.tablesConfig.length + 1),
        updatedAt: Date.now(),
        cloudSynced: false,
      };
      this.data.tablesConfig.push(savedTable);
    }

    this.removePendingDeletion('tables_config', savedTable.id);
    this.persist();
    return { success: true, table: savedTable, renamedFrom: removedOld ? (oldTableRecord?.id || originalId) : null };
  }

  deleteTableConfig(tableId) {
    if (!tableId) return { success: false, error: 'Missing tableId' };
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '');
    const target = norm(tableId);
    const idx = (this.data.tablesConfig || []).findIndex((t) => norm(t.id) === target);
    if (idx >= 0) {
      const deletedTable = this.data.tablesConfig[idx];
      this.data.tablesConfig.splice(idx, 1);
      this.recordPendingDeletion('tables_config', deletedTable.id);
      this.persist();
      return { success: true, deletedId: deletedTable.id };
    }
    return { success: false, error: 'Table config not found' };
  }

  // -------------------------------------------------------------
  // Banquet & Event Bookings
  // -------------------------------------------------------------
  getBanquetBookings() {
    return this.data.banquetBookings || [];
  }

  saveBanquetBooking(booking) {
    if (!booking || !booking.id) return { success: false, error: 'Invalid booking data' };
    if (!this.data.banquetBookings) this.data.banquetBookings = [];
    const list = this.data.banquetBookings;
    const idx = list.findIndex((b) => b.id === booking.id);
    let saved;
    if (idx >= 0) {
      saved = {
        ...list[idx],
        ...booking,
        updatedAt: new Date().toISOString(),
        cloudSynced: false,
      };
      list[idx] = saved;
    } else {
      saved = {
        ...booking,
        createdAt: booking.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cloudSynced: false,
      };
      list.push(saved);
    }
    this.removePendingDeletion('banquet_bookings', saved.id);
    this.data.banquetBookings = list;
    this.persist();
    return { success: true, booking: saved };
  }

  deleteBanquetBooking(id) {
    if (!id) return { success: false, error: 'Booking ID required' };
    this.data.banquetBookings = (this.data.banquetBookings || []).filter((b) => b.id !== id);
    this.recordPendingDeletion('banquet_bookings', id);
    this.persist();
    return { success: true, deletedId: id };
  }

  // -------------------------------------------------------------
  // Backup & Export (JSON & Excel CSV)
  // -------------------------------------------------------------
  exportBackup() {
    const bills = this.data.settledBills || [];
    const csvHeaders = [
      'Bill Number',
      'Status',
      'Date',
      'Time',
      'Department',
      'Table or Room',
      'Order Type',
      'Server / Waiter',
      'Payment Method',
      'Customer Phone',
      'Subtotal (Rs)',
      'Tax (Rs)',
      'Total Amount (Rs)',
      'Cancellation Reason',
      'Items Ordered',
    ];

    const csvRows = bills.map((b) => [
      b.billNumber || '',
      (b.status || 'settled').toUpperCase(),
      b.dateStr || '',
      b.timestamp ? new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      (b.department || 'restaurant').toUpperCase(),
      b.tableId || '',
      b.orderType || 'dine-in',
      b.serverName || '',
      (b.paymentMethod || 'cash').toUpperCase(),
      b.customerPhone || '',
      b.subtotal || 0,
      b.tax || 0,
      b.total || 0,
      b.cancelReason || '',
      (b.items || []).map((i) => `${i.quantity}x ${i.name}`).join('; '),
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\r\n');

    return {
      success: true,
      timestamp: new Date().toISOString(),
      billsCount: bills.length,
      jsonData: this.data,
      csvContent,
      backupPath: dbBackupPath,
      filePath: dbFilePath,
    };
  }
}

module.exports = new HotelDatabase();
