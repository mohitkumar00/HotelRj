// Client-side Analytics & Database API bridge

export interface SettleBillPayload {
  id?: string;
  billNumber?: number;
  tableId: string;
  orderType?: 'dine-in' | 'takeaway' | 'room-service';
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

export interface AnalyticsSummary {
  period: string;
  dateFormatted: string;
  grossRevenue: number;
  billsCount: number;
  avgBillValue: number;
  paymentSplit: {
    cash: number;
    upi: number;
    card: number;
    roomFolio: number;
  };
  customCooking: {
    revenue: number;
    count: number;
    kgEstimate: number;
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
  // Check if sync server address is saved in localStorage (from WaiterPOS pairing)
  const savedSyncUrl = localStorage.getItem('hotel_rj_sync_server_url');
  if (savedSyncUrl) {
    return savedSyncUrl.replace(/\/+$/, '');
  }
  // If running in browser served from port 5050
  if (window.location.port === '5050') {
    return '';
  }
  return 'http://127.0.0.1:5050';
}

export async function fetchAnalytics(period: 'today' | 'yesterday' | 'last7days' | 'all' = 'today'): Promise<AnalyticsSummary | null> {
  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.getAnalytics) {
    try {
      const data = await (window as any).ElectronAPI.getAnalytics(period);
      if (data) return data;
    } catch (e) {
      console.warn('[Analytics] Electron getAnalytics failed:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/analytics?period=${period}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.analytics) return json.analytics;
    }
  } catch (err) {
    console.warn('[Analytics] HTTP fetchAnalytics failed:', err);
  }

  // 3. Fallback: Mock / LocalStorage estimate if offline in standalone web
  return {
    period,
    dateFormatted: new Date().toISOString().split('T')[0],
    grossRevenue: 0,
    billsCount: 0,
    avgBillValue: 0,
    paymentSplit: { cash: 0, upi: 0, card: 0, roomFolio: 0 },
    customCooking: { revenue: 0, count: 0, kgEstimate: 0 },
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

  return false;
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

  return false;
}
