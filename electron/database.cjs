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
      version: 2,
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
            version: parsed.version || 2,
            settledBills: Array.isArray(parsed.settledBills) ? parsed.settledBills : [],
            auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
            expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
          };

          // Backfill department for legacy records
          let modified = false;
          for (const b of this.data.settledBills) {
            if (!b.department) {
              b.department = this.detectDepartment(b.tableId, b.orderType);
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

    // Compute Department Breakdown across all bills in this time window
    const departmentBreakdown = {
      restaurant: { revenue: 0, count: 0, customCookingRevenue: 0, customKgEstimate: 0 },
      rooms: { revenue: 0, count: 0 },
      banquet: { revenue: 0, count: 0 },
    };

    for (const b of timeFilteredBills) {
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
      const mBills = this.data.settledBills.filter((b) => (b.dateStr || '').startsWith(monthPrefix));

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
      if ((b.dateStr || '').startsWith(targetMonthPrefix)) {
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

    let grossRevenue = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let roomFolioTotal = 0;
    const dishSales = {};

    for (const b of displayBills) {
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
      billsCount: displayBills.length,
      avgBillValue: displayBills.length > 0 ? Math.round(grossRevenue / displayBills.length) : 0,
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
        recentAudits: timeFilteredAudits.slice(0, 30),
      },
      topDishes,
      recentBills: displayBills.slice(0, 35),
    };
  }

  // -------------------------------------------------------------
  // Backup & Export (JSON & Excel CSV)
  // -------------------------------------------------------------
  exportBackup() {
    const bills = this.data.settledBills || [];
    const csvHeaders = [
      'Bill Number',
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
      'Items Ordered',
    ];

    const csvRows = bills.map((b) => [
      b.billNumber || '',
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
