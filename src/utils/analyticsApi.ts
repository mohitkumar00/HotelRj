// Client-side Analytics & Database API bridge

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
    department?: string;
    tableId: string;
    total: number;
    paymentMethod: string;
    serverName: string;
    timestamp: string;
    items: Array<{ name: string; quantity: number; price: number; isCustom?: boolean }>;
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

  // 3. Fallback blank response
  const now = new Date();
  const yearStr = String(now.getFullYear());
  const monthStr = `${yearStr}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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

  return false;
}

export async function recordAuditLog(payload: AuditLogPayload): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.saveAuditLog) {
    try {
      const res = await (window as any).ElectronAPI.saveAuditLog(payload);
      if (res && res.success) return true;
    } catch (e) {
      console.warn('[Analytics] Electron saveAuditLog failed:', e);
    }
  }

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

  return false;
}

export async function addExpense(payload: ExpensePayload): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.saveExpense) {
    try {
      const res = await (window as any).ElectronAPI.saveExpense(payload);
      if (res && res.success) return true;
    } catch (e) {
      console.warn('[Analytics] Electron saveExpense failed:', e);
    }
  }

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

  return false;
}

export async function removeExpense(id: string): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.deleteExpense) {
    try {
      const res = await (window as any).ElectronAPI.deleteExpense(id);
      if (res && res.success) return true;
    } catch (e) {
      console.warn('[Analytics] Electron deleteExpense failed:', e);
    }
  }

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

  return null;
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
    return { success: false, error: err.message };
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
