// Client-side Analytics & Database API bridge
import { DEFAULT_SUPABASE_URL } from './hotelDataApi';
import { getSupabaseHeaders } from './deviceAuth';
import { SUPABASE_ANON_KEY } from '../config';

export interface SettleBillPayload {
  id?: string;
  billNumber?: number;
  department?: 'restaurant' | 'rooms' | 'banquet';
  tableId: string;
  orderType?: 'dine-in' | 'takeaway' | 'room-service' | 'banquet';
  roomNumber?: string;
  serverName?: string;
  settledBy?: string;
  customerPhone?: string;
  customerName?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    notes?: string;
    isCustom?: boolean;
    dietary?: string;
  }>;
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  paymentMethod: 'cash' | 'upi' | 'card' | 'room-folio' | 'split';
  paymentDetails?: {
    cashAmount?: number;
    upiAmount?: number;
    cardAmount?: number;
    referenceId?: string;
  };
}

export interface AuditLogPayload {
  type: 'ITEM_VOID' | 'KOT_CANCEL' | 'BILL_REPRINT' | 'MANUAL_DISCOUNT' | 'TABLE_RESET';
  tableId: string;
  staffName: string;
  itemName?: string;
  itemPrice?: number;
  quantity?: number;
  reason: string;
}

export interface ExpensePayload {
  category: string;
  amount: number;
  paidBy: 'Cash Drawer' | 'UPI';
  notes?: string;
  recordedBy?: string;
}

export interface AnalyticsQueryOptions {
  period?: 'today' | 'yesterday' | 'this_month' | 'last_month' | 'this_year' | 'last7days' | 'custom_month' | 'custom_year' | 'all';
  department?: 'all' | 'restaurant' | 'rooms' | 'banquet';
  year?: string;
  month?: string;
}

export interface MonthlyTrendItem {
  month: string;
  monthName: string;
  total: number;
  restaurant: number;
  rooms: number;
  banquet: number;
  billsCount: number;
}

export interface DailyTrendItem {
  date: string;
  day: string;
  restaurant: number;
  rooms: number;
  banquet: number;
  total: number;
  billsCount: number;
}

export interface AnalyticsSummary {
  period: string;
  department: string;
  dateFormatted: string;
  currentYear: string;
  currentMonth: string;
  grossRevenue: number;
  billsCount: number;
  avgBillValue: number;
  departments: {
    restaurant: {
      revenue: number;
      count: number;
      customCookingRevenue: number;
      customKgEstimate: number;
    };
    rooms: {
      revenue: number;
      count: number;
    };
    banquet: {
      revenue: number;
      count: number;
    };
  };
  monthlyTrends: MonthlyTrendItem[];
  dailyTrends: DailyTrendItem[];
  paymentSplit: {
    cash: number;
    upi: number;
    card: number;
    roomFolio: number;
  };
  expenses: {
    total: number;
    count: number;
    list: Array<{
      id: string;
      category: string;
      amount: number;
      paidBy: string;
      notes: string;
      recordedBy: string;
      timestamp: string;
    }>;
  };
  netProfit: number;
  antiTheft: {
    voidsCount: number;
    voidAmount: number;
    cancelledBillsCount?: number;
    cancelledBillsAmount?: number;
    recentAudits: Array<{
      id: string;
      type: string;
      tableId: string;
      staffName: string;
      itemName?: string;
      itemPrice?: number;
      quantity?: number;
      reason: string;
      timestamp: string;
    }>;
  };
  topDishes: Array<{
    name: string;
    quantity: number;
    revenue: number;
    isCustom?: boolean;
  }>;
  recentBills: Array<{
    id: string;
    billNumber: number;
    status?: 'settled' | 'cancelled';
    cancelReason?: string;
    cancelledBy?: string;
    cancelledAt?: string;
    department?: string;
    tableId: string;
    total: number;
    subtotal?: number;
    tax?: number;
    paymentMethod: string;
    serverName: string;
    customerPhone?: string;
    customerName?: string;
    timestamp: string;
    items: Array<{ name: string; quantity: number; price: number; notes?: string; isCustom?: boolean }>;
  }>;
}

// Determine API Base URL
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const savedSyncUrl = localStorage.getItem('hotel_rj_sync_server_url');
  if (savedSyncUrl) {
    return savedSyncUrl.replace(/\/+$/, '');
  }
  if (window.location.port === '5050') {
    return '';
  }
  return 'http://127.0.0.1:5050';
}

export async function fetchAnalytics(
  query: AnalyticsQueryOptions | string = 'today'
): Promise<AnalyticsSummary | null> {
  const options: AnalyticsQueryOptions =
    typeof query === 'string' ? { period: query as any } : query;

  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.getAnalytics) {
    try {
      const data = await (window as any).ElectronAPI.getAnalytics(options);
      if (data) return data;
    } catch (e) {
      console.warn('[Analytics] Electron getAnalytics failed:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const params = new URLSearchParams();
    if (options.period) params.set('period', options.period);
    if (options.department) params.set('department', options.department);
    if (options.year) params.set('year', options.year);
    if (options.month) params.set('month', options.month);

    const res = await fetch(`${base}/api/analytics?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.analytics) return json.analytics;
    }
  } catch (err) {
    console.warn('[Analytics] HTTP fetchAnalytics failed:', err);
  }

  // 3. Supabase Cloud Direct Analytics Fallback (e.g. Owner remotely on 4G/5G)
  const now = new Date();
  const yearStr = String(now.getFullYear());
  const monthStr = `${yearStr}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    const [billsRes, expRes, auditsRes] = await Promise.all([
      fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/bills?select=*&order=timestamp.desc&limit=1000`, {
        headers: await getSupabaseHeaders(),
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/expenses?select=*&order=timestamp.desc&limit=500`, {
        headers: await getSupabaseHeaders(),
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/audit_logs?select=*&order=timestamp.desc&limit=500`, {
        headers: await getSupabaseHeaders(),
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (billsRes.ok) {
      const allBills: any[] = await billsRes.json();
      const allExpenses: any[] = expRes.ok ? await expRes.json() : [];
      const allAudits: any[] = auditsRes.ok ? await auditsRes.json() : [];

      const todayStr = now.toISOString().split('T')[0];
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

      const filterByPeriod = (itemDate: string = '') => {
        if (!itemDate) return false;
        const p = options.period || 'today';
        if (p === 'today') return itemDate === todayStr;
        if (p === 'yesterday') return itemDate === yesterdayStr;
        if (p === 'last7days') return itemDate >= sevenDaysAgoStr && itemDate <= todayStr;
        if (p === 'this_month') return itemDate.startsWith(monthStr);
        if (p === 'last_month') return itemDate.startsWith(lastMonthStr);
        if (p === 'this_year') return itemDate.startsWith(yearStr);
        if (p === 'custom_month' && options.month) return itemDate.startsWith(options.month);
        if (p === 'custom_year' && options.year) return itemDate.startsWith(options.year);
        return true;
      };

      const validBills = allBills.filter((b) => (b.status || 'settled') !== 'cancelled');
      const filteredBills = validBills.filter((b) => {
        const dStr = b.date_str || (b.timestamp ? b.timestamp.split('T')[0] : '');
        if (!filterByPeriod(dStr)) return false;
        if (options.department && options.department !== 'all') {
          return b.department === options.department;
        }
        return true;
      });

      const filteredExpenses = allExpenses.filter((e) => {
        const dStr = e.date_str || (e.timestamp ? e.timestamp.split('T')[0] : '');
        return filterByPeriod(dStr);
      });

      const filteredAudits = allAudits.filter((a) => {
        const dStr = a.date_str || (a.timestamp ? a.timestamp.split('T')[0] : '');
        return filterByPeriod(dStr);
      });

      let grossRevenue = 0;
      const deptRevenue = {
        restaurant: { revenue: 0, count: 0, customCookingRevenue: 0, customKgEstimate: 0 },
        rooms: { revenue: 0, count: 0 },
        banquet: { revenue: 0, count: 0 },
      };
      const paymentSplit = { cash: 0, upi: 0, card: 0, roomFolio: 0 };
      const dishCountMap = new Map<string, { name: string; quantity: number; revenue: number }>();

      for (const b of filteredBills) {
        const total = Number(b.total) || 0;
        grossRevenue += total;

        const dept = (b.department || 'restaurant') as 'restaurant' | 'rooms' | 'banquet';
        if (deptRevenue[dept]) {
          deptRevenue[dept].revenue += total;
          deptRevenue[dept].count += 1;
        }

        const pm = (b.payment_method || 'cash').toLowerCase();
        if (pm.includes('upi')) paymentSplit.upi += total;
        else if (pm.includes('card')) paymentSplit.card += total;
        else if (pm.includes('room')) paymentSplit.roomFolio += total;
        else paymentSplit.cash += total;

        const items = Array.isArray(b.items) ? b.items : [];
        for (const item of items) {
          if (!item || !item.name) continue;
          const q = Number(item.quantity) || 1;
          const p = Number(item.price) || 0;
          const key = item.name.trim();
          const prev = dishCountMap.get(key) || { name: key, quantity: 0, revenue: 0 };
          prev.quantity += q;
          prev.revenue += (p * q);
          dishCountMap.set(key, prev);

          if (item.isCustom) {
            deptRevenue.restaurant.customCookingRevenue += (p * q);
            deptRevenue.restaurant.customKgEstimate += q;
          }
        }
      }

      const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const topDishes = Array.from(dishCountMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      const recentAudits = filteredAudits.slice(0, 20).map((a) => ({
        id: a.id,
        type: a.type,
        tableId: a.table_id,
        staffName: a.staff_name,
        itemName: a.item_name,
        itemPrice: Number(a.item_price) || 0,
        quantity: Number(a.quantity) || 1,
        reason: a.reason,
        timestamp: a.timestamp,
        dateStr: a.date_str,
      }));

      const voidAudits = filteredAudits.filter((a) => a.type === 'ITEM_VOID' || a.type === 'KOT_CANCEL');
      const voidAmount = voidAudits.reduce((sum, a) => sum + ((Number(a.item_price) || 0) * (Number(a.quantity) || 1)), 0);

      const recentBills = filteredBills.slice(0, 30).map((b) => ({
        id: b.id,
        billNumber: Number(b.bill_number) || 0,
        status: b.status || 'settled',
        cancelReason: b.cancel_reason,
        cancelledBy: b.cancelled_by,
        cancelledAt: b.cancelled_at,
        department: b.department,
        tableId: b.table_id,
        orderType: b.order_type,
        roomNumber: b.room_number,
        serverName: b.server_name,
        settledBy: b.settled_by,
        customerPhone: b.customer_phone,
        customerName: b.customer_name,
        subtotal: Number(b.subtotal) || 0,
        tax: Number(b.tax) || 0,
        discount: Number(b.discount) || 0,
        total: Number(b.total) || 0,
        paymentMethod: b.payment_method,
        items: Array.isArray(b.items) ? b.items : [],
        timestamp: b.timestamp,
        dateStr: b.date_str || (b.timestamp ? b.timestamp.split('T')[0] : ''),
      }));

      return {
        period: options.period || 'today',
        department: options.department || 'all',
        dateFormatted: todayStr,
        currentYear: yearStr,
        currentMonth: monthStr,
        grossRevenue,
        billsCount: filteredBills.length,
        avgBillValue: filteredBills.length > 0 ? Math.round(grossRevenue / filteredBills.length) : 0,
        departments: deptRevenue,
        monthlyTrends: [],
        dailyTrends: [],
        paymentSplit,
        expenses: {
          total: totalExpenses,
          count: filteredExpenses.length,
          list: filteredExpenses.map((e) => ({
            id: e.id,
            category: e.category,
            amount: Number(e.amount) || 0,
            paidBy: e.paid_by,
            notes: e.notes || '',
            recordedBy: e.recorded_by,
            timestamp: e.timestamp,
            dateStr: e.date_str,
          })),
        },
        netProfit: grossRevenue - totalExpenses,
        antiTheft: {
          voidsCount: voidAudits.length,
          voidAmount,
          recentAudits,
        },
        topDishes,
        recentBills,
      };
    }
  } catch (err) {
    console.warn('[Analytics] Supabase direct analytics query error:', err);
  }

  // 4. Fallback blank response
  return {
    period: options.period || 'today',
    department: options.department || 'all',
    dateFormatted: now.toISOString().split('T')[0],
    currentYear: yearStr,
    currentMonth: monthStr,
    grossRevenue: 0,
    billsCount: 0,
    avgBillValue: 0,
    departments: {
      restaurant: { revenue: 0, count: 0, customCookingRevenue: 0, customKgEstimate: 0 },
      rooms: { revenue: 0, count: 0 },
      banquet: { revenue: 0, count: 0 },
    },
    monthlyTrends: [],
    dailyTrends: [],
    paymentSplit: { cash: 0, upi: 0, card: 0, roomFolio: 0 },
    expenses: { total: 0, count: 0, list: [] },
    netProfit: 0,
    antiTheft: { voidsCount: 0, voidAmount: 0, recentAudits: [] },
    topDishes: [],
    recentBills: [],
  };
}

export async function settleBill(payload: SettleBillPayload): Promise<boolean> {
  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.settleBill) {
    try {
      const res = await (window as any).ElectronAPI.settleBill(payload);
      if (res && res.success) return true;
    } catch (e) {
      console.warn('[Analytics] Electron settleBill failed:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/settle-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bill: payload }),
    });
    if (res.ok) {
      const json = await res.json();
      return !!json.success;
    }
  } catch (err) {
    console.warn('[Analytics] HTTP settleBill failed:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const timestamp = new Date().toISOString();
    const dateStr = timestamp.split('T')[0];
    const billId = payload.id || `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const row = {
      id: billId,
      bill_number: payload.billNumber || Math.floor(1000 + Math.random() * 9000),
      status: 'settled',
      department: payload.department || 'restaurant',
      table_id: payload.tableId || 'Table',
      order_type: payload.orderType || 'dine-in',
      room_number: payload.roomNumber || null,
      server_name: payload.serverName || 'Staff',
      settled_by: payload.settledBy || 'Cashier',
      customer_phone: payload.customerPhone || null,
      customer_name: payload.customerName || null,
      subtotal: payload.subtotal || 0,
      tax: payload.tax || 0,
      discount: payload.discount || 0,
      total: payload.total || 0,
      payment_method: payload.paymentMethod || 'cash',
      items: payload.items || [],
      date_str: dateStr,
      timestamp,
    };
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/bills`, {
      method: 'POST',
      headers: { ...(await getSupabaseHeaders()), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return true;
  } catch (err) {
    console.warn('[Analytics] Supabase settleBill failed:', err);
  }

  return false;
}

export async function recordAuditLog(payload: AuditLogPayload): Promise<boolean> {
  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.saveAuditLog) {
    try {
      const res = await (window as any).ElectronAPI.saveAuditLog(payload);
      if (res && res.success) return true;
    } catch (e) {
      console.warn('[Analytics] Electron saveAuditLog failed:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/audit-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log: payload }),
    });
    if (res.ok) {
      const json = await res.json();
      return !!json.success;
    }
  } catch (err) {
    console.warn('[Analytics] HTTP recordAuditLog failed:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const timestamp = new Date().toISOString();
    const dateStr = timestamp.split('T')[0];
    const row = {
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: payload.type,
      table_id: payload.tableId,
      staff_name: payload.staffName,
      item_name: payload.itemName || null,
      item_price: payload.itemPrice || 0,
      quantity: payload.quantity || 1,
      reason: payload.reason || '',
      date_str: dateStr,
      timestamp,
    };
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/audit_logs`, {
      method: 'POST',
      headers: { ...(await getSupabaseHeaders()), Prefer: 'return=minimal' },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return true;
  } catch (err) {
    console.warn('[Analytics] Supabase recordAuditLog failed:', err);
  }

  return false;
}

export async function cancelBillApi(payload: {
  billId: string;
  reason: string;
  cancelledBy?: string;
}): Promise<{ success: boolean; error?: string; bill?: any }> {
  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.cancelBill) {
    try {
      return await (window as any).ElectronAPI.cancelBill(payload);
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to cancel bill in Electron' };
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/cancel-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    console.warn('[Analytics] HTTP cancelBill failed:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const patchBody = {
      status: 'cancelled',
      cancel_reason: payload.reason,
      cancelled_by: payload.cancelledBy || 'Counter Cashier',
      cancelled_at: new Date().toISOString(),
    };
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/bills?id=eq.${encodeURIComponent(payload.billId)}`, {
      method: 'PATCH',
      headers: { ...(await getSupabaseHeaders()), Prefer: 'return=representation' },
      body: JSON.stringify(patchBody),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const updated = await res.json();
      return { success: true, bill: Array.isArray(updated) && updated.length > 0 ? updated[0] : undefined };
    }
  } catch (err: any) {
    console.warn('[Analytics] Supabase cancelBill failed:', err);
  }

  return { success: false, error: 'Failed to cancel bill' };
}

export async function fetchRecentBills(limit: number = 60): Promise<Array<any>> {
  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.getRecentBills) {
    try {
      const bills = await (window as any).ElectronAPI.getRecentBills({ limit });
      if (Array.isArray(bills)) return bills;
    } catch (e) {
      console.warn('[Analytics] Electron getRecentBills failed:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/recent-bills?limit=${limit}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.bills) return data.bills;
    }
  } catch (err) {
    console.warn('[Analytics] HTTP fetchRecentBills failed:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/bills?select=*&order=timestamp.desc&limit=${limit}`, {
      headers: await getSupabaseHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const rows: any[] = await res.json();
      if (Array.isArray(rows)) {
        return rows.map((b) => ({
          id: b.id,
          billNumber: Number(b.bill_number) || 0,
          status: b.status || 'settled',
          cancelReason: b.cancel_reason,
          cancelledBy: b.cancelled_by,
          cancelledAt: b.cancelled_at,
          department: b.department,
          tableId: b.table_id,
          orderType: b.order_type,
          roomNumber: b.room_number,
          serverName: b.server_name,
          settledBy: b.settled_by,
          customerPhone: b.customer_phone,
          customerName: b.customer_name,
          subtotal: Number(b.subtotal) || 0,
          tax: Number(b.tax) || 0,
          discount: Number(b.discount) || 0,
          total: Number(b.total) || 0,
          paymentMethod: b.payment_method,
          items: Array.isArray(b.items) ? b.items : [],
          timestamp: b.timestamp,
          dateStr: b.date_str || (b.timestamp ? b.timestamp.split('T')[0] : ''),
        }));
      }
    }
  } catch (err) {
    console.warn('[Analytics] Supabase fetchRecentBills failed:', err);
  }

  return [];
}

export async function addExpense(payload: ExpensePayload): Promise<boolean> {
  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.saveExpense) {
    try {
      const res = await (window as any).ElectronAPI.saveExpense(payload);
      if (res && res.success) return true;
    } catch (e) {
      console.warn('[Analytics] Electron saveExpense failed:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expense: payload }),
    });
    if (res.ok) {
      const json = await res.json();
      return !!json.success;
    }
  } catch (err) {
    console.warn('[Analytics] HTTP addExpense failed:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const timestamp = new Date().toISOString();
    const dateStr = timestamp.split('T')[0];
    const row = {
      id: `EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      category: payload.category,
      amount: payload.amount,
      paid_by: payload.paidBy,
      notes: payload.notes || '',
      recorded_by: payload.recordedBy || 'Cashier',
      date_str: dateStr,
      timestamp,
    };
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/expenses`, {
      method: 'POST',
      headers: { ...(await getSupabaseHeaders()), Prefer: 'return=minimal' },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return true;
  } catch (err) {
    console.warn('[Analytics] Supabase addExpense failed:', err);
  }

  return false;
}

export async function removeExpense(id: string): Promise<boolean> {
  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.deleteExpense) {
    try {
      const res = await (window as any).ElectronAPI.deleteExpense(id);
      if (res && res.success) return true;
    } catch (e) {
      console.warn('[Analytics] Electron deleteExpense failed:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/expense/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      const json = await res.json();
      return !!json.success;
    }
  } catch (err) {
    console.warn('[Analytics] HTTP deleteExpense failed:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/expenses?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await getSupabaseHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return true;
  } catch (err) {
    console.warn('[Analytics] Supabase removeExpense failed:', err);
  }

  return false;
}

// -------------------------------------------------------------
// Backup Export (Excel CSV and JSON download)
// -------------------------------------------------------------
export async function exportDatabaseBackup(): Promise<{ success: boolean; csvContent?: string; jsonData?: any }> {
  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.exportBackup) {
    try {
      const data = await (window as any).ElectronAPI.exportBackup();
      if (data && data.success) return data;
    } catch (e) {
      console.warn('[Analytics] Electron exportBackup failed:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/export-backup`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[Analytics] HTTP exportBackup failed:', err);
  }

  return { success: false };
}

// -------------------------------------------------------------
// Supabase Cloud Sync API Helpers
// -------------------------------------------------------------
export interface CloudSyncPublicConfig {
  isConfigured: boolean;
  supabaseUrl: string;
  hasAnonKey: boolean;
  anonKeyMasked: string;
  lastSyncTime: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncError: string | null;
  autoSyncEnabled: boolean;
  connected?: boolean;
  pendingBills?: number;
}

export async function getCloudSyncConfig(): Promise<CloudSyncPublicConfig | null> {
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.getCloudConfig) {
    try {
      return await (window as any).ElectronAPI.getCloudConfig();
    } catch (e) {
      console.warn('[CloudSync] Electron getCloudConfig failed:', e);
    }
  }

  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/cloud-sync/status`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.config) return json.config;
    }
  } catch (err) {
    console.warn('[CloudSync] HTTP getCloudConfig failed:', err);
  }

  // Pre-configured default
  return {
    isConfigured: true,
    supabaseUrl: DEFAULT_SUPABASE_URL,
    hasAnonKey: true,
    anonKeyMasked: `${SUPABASE_ANON_KEY.slice(0, 10)}...${SUPABASE_ANON_KEY.slice(-6)}`,
    lastSyncTime: new Date().toISOString(),
    lastSyncStatus: 'success',
    lastSyncError: null,
    autoSyncEnabled: true,
    connected: true,
    pendingBills: 0,
  };
}

export async function saveCloudSyncConfig(config: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  autoSyncEnabled?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.saveCloudConfig) {
    try {
      return await (window as any).ElectronAPI.saveCloudConfig(config);
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to save in Electron' };
    }
  }

  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/cloud-sync/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function testCloudSyncConnection(
  url: string,
  key: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.testCloudConnection) {
    try {
      return await (window as any).ElectronAPI.testCloudConnection(url, key);
    } catch (e: any) {
      return { success: false, error: e?.message || 'Test failed' };
    }
  }

  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/cloud-sync/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key }),
    });
    return await res.json();
  } catch (err: any) {
    console.warn('[CloudSync] HTTP testCloudConnection failed, testing directly:', err);
  }

  // 3. Direct Supabase Test Fallback
  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = key.trim();
    const res = await fetch(`${cleanUrl}/rest/v1/bills?select=id&limit=1`, {
      headers: {
        apikey: cleanKey,
        Authorization: `Bearer ${cleanKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return { success: true, message: 'Connected directly to Supabase cloud database!' };
    } else {
      const errText = await res.text();
      return { success: false, error: `Supabase returned HTTP ${res.status}: ${errText}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Direct connection to Supabase failed' };
  }
}

export async function triggerCloudSyncNow(): Promise<{
  success: boolean;
  syncedBills?: number;
  error?: string;
}> {
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.syncCloudNow) {
    try {
      return await (window as any).ElectronAPI.syncCloudNow();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Sync trigger failed' };
    }
  }

  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/cloud-sync/sync`, { method: 'POST' });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
