/**
 * Hotel RJ — Staff Directory, Attendance, Advances & Payroll API
 * Layered persistence: Electron IPC -> Counter LAN HTTP (:5050) -> Supabase REST -> localStorage
 */
import { SUPABASE_URL } from '../config';
import {
  StaffAdvanceRecord,
  StaffAttendanceRecord,
  StaffMember,
  StaffPayrollRecord,
} from '../types/staff';
import { getSupabaseHeaders } from './deviceAuth';
import { getApiBaseUrl } from './syncBase';
import { readJson, writeJson } from './storage';
import { localDateString } from './dates';

const STORAGE = {
  staff: 'hotel_rj_staff_members',
  attendance: 'hotel_rj_staff_attendance',
  advances: 'hotel_rj_staff_advances',
  payroll: 'hotel_rj_staff_payroll',
} as const;

type ElectronStaffApi = {
  getStaff?: () => Promise<StaffMember[]>;
  saveStaff?: (member: Partial<StaffMember>) => Promise<{ success: boolean; staff?: StaffMember; error?: string }>;
  deleteStaff?: (id: string) => Promise<{ success: boolean; error?: string }>;
  getStaffAttendance?: (q: { monthStr?: string; dateStr?: string; staffId?: string }) => Promise<StaffAttendanceRecord[]>;
  saveStaffAttendance?: (payload: StaffAttendanceRecord | StaffAttendanceRecord[]) => Promise<{ success: boolean; error?: string }>;
  getStaffAdvances?: (q: { monthStr?: string; staffId?: string }) => Promise<StaffAdvanceRecord[]>;
  saveStaffAdvance?: (entry: Partial<StaffAdvanceRecord>, options?: { recordInExpenses?: boolean }) => Promise<{ success: boolean; advance?: StaffAdvanceRecord; error?: string }>;
  deleteStaffAdvance?: (id: string, options?: { deleteLinkedExpense?: boolean; deletedBy?: string; reason?: string }) => Promise<{ success: boolean; error?: string }>;
  getStaffPayroll?: (q: { monthStr?: string; staffId?: string }) => Promise<StaffPayrollRecord[]>;
  settleStaffPayroll?: (record: StaffPayrollRecord, options?: { recordInExpenses?: boolean; paidDateStr?: string }) => Promise<{ success: boolean; payroll?: StaffPayrollRecord; error?: string }>;
  unlockStaffPayroll?: (id: string, options?: { reason?: string; unlockedBy?: string; deleteLinkedExpense?: boolean }) => Promise<{ success: boolean; payroll?: StaffPayrollRecord; error?: string }>;
};

function getElectron(): ElectronStaffApi | undefined {
  return typeof window !== 'undefined' ? (window as Window & { ElectronAPI?: ElectronStaffApi }).ElectronAPI : undefined;
}

async function fetchHttp(endpoint: string, init?: RequestInit): Promise<Response | null> {
  const base = getApiBaseUrl();
  if (!base) return null;
  try {
    return await fetch(`${base}${endpoint}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null;
  }
}

async function supabaseRequest<T = unknown>(path: string, init?: RequestInit): Promise<{ ok: boolean; data: T | null }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: { ...(await getSupabaseHeaders()), ...(init?.headers || {}) },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, data: null };
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return { ok: true, data: null };
    }
    const text = await res.text();
    return { ok: true, data: text ? (JSON.parse(text) as T) : null };
  } catch {
    return { ok: false, data: null };
  }
}

function upsertLocal<T extends { id: string }>(key: string, record: T): T[] {
  const list = readJson<T[]>(key, []);
  const idx = list.findIndex((item) => item.id === record.id);
  const next = idx >= 0 ? list.map((item, i) => (i === idx ? record : item)) : [record, ...list];
  writeJson(key, next);
  return next;
}

// -------------------------------------------------------------
// Row Mappers (Supabase snake_case <-> TS camelCase)
// -------------------------------------------------------------
interface StaffRow {
  id: string;
  name: string;
  phone?: string;
  emergency_contact?: string;
  role?: string;
  department?: StaffMember['department'];
  shift?: StaffMember['shift'];
  pay_type?: StaffMember['payType'];
  base_salary?: number | string;
  overtime_rate?: number | string;
  join_date?: string;
  id_proof_note?: string;
  show_in_pos?: boolean;
  status?: StaffMember['status'];
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

const mapStaffRow = (r: StaffRow): StaffMember => ({
  id: r.id,
  name: r.name,
  phone: r.phone || '',
  emergencyContact: r.emergency_contact || '',
  role: r.role || 'Waiter',
  department: r.department || 'restaurant',
  shift: r.shift || 'full_day',
  payType: r.pay_type === 'daily' ? 'daily' : 'monthly',
  baseSalary: Number(r.base_salary) || 0,
  overtimeRate: Number(r.overtime_rate) || 0,
  joinDate: r.join_date || localDateString(),
  idProofNote: r.id_proof_note || '',
  showInPos: r.show_in_pos !== false,
  status: r.status || 'active',
  notes: r.notes || '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toStaffRow = (s: StaffMember) => ({
  id: s.id,
  name: s.name,
  phone: s.phone || '',
  emergency_contact: s.emergencyContact || null,
  role: s.role || 'Waiter',
  department: s.department || 'restaurant',
  shift: s.shift || 'full_day',
  pay_type: s.payType === 'daily' ? 'daily' : 'monthly',
  base_salary: Number(s.baseSalary) || 0,
  overtime_rate: Number(s.overtimeRate) || 0,
  join_date: s.joinDate || localDateString(),
  id_proof_note: s.idProofNote || null,
  show_in_pos: s.showInPos !== false,
  status: s.status || 'active',
  notes: s.notes || null,
  updated_at: new Date().toISOString(),
});

interface AttendanceRow {
  id: string;
  staff_id: string;
  date_str: string;
  status: StaffAttendanceRecord['status'];
  check_in?: string;
  check_out?: string;
  overtime_hours?: number | string;
  notes?: string;
  marked_by?: string;
  updated_at?: string;
}

const mapAttendanceRow = (r: AttendanceRow): StaffAttendanceRecord => ({
  id: r.id,
  staffId: r.staff_id,
  dateStr: r.date_str,
  status: r.status || 'present',
  checkIn: r.check_in || '',
  checkOut: r.check_out || '',
  overtimeHours: Number(r.overtime_hours) || 0,
  notes: r.notes || '',
  markedBy: r.marked_by || 'Manager',
  updatedAt: r.updated_at,
});

interface AdvanceRow {
  id: string;
  staff_id: string;
  date_str: string;
  entry_type: StaffAdvanceRecord['entryType'];
  amount: number | string;
  payment_mode: StaffAdvanceRecord['paymentMode'];
  notes?: string;
  linked_expense_id?: string;
  recorded_by?: string;
  created_at?: string;
  updated_at?: string;
}

const mapAdvanceRow = (r: AdvanceRow): StaffAdvanceRecord => ({
  id: r.id,
  staffId: r.staff_id,
  dateStr: r.date_str,
  entryType: r.entry_type || 'advance',
  amount: Number(r.amount) || 0,
  paymentMode: r.payment_mode || 'Cash',
  notes: r.notes || '',
  linkedExpenseId: r.linked_expense_id || undefined,
  recordedBy: r.recorded_by || 'Manager',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

interface PayrollRow {
  id: string;
  staff_id: string;
  month_str: string;
  pay_type: StaffPayrollRecord['payType'];
  base_salary: number | string;
  days_in_month: number;
  present_days: number | string;
  half_days: number | string;
  paid_leaves_and_offs: number | string;
  absent_days: number | string;
  overtime_hours: number | string;
  earned_base_pay: number | string;
  overtime_pay: number | string;
  bonuses: number | string;
  advances_deducted: number | string;
  other_deductions: number | string;
  net_payable: number | string;
  status: StaffPayrollRecord['status'];
  payment_mode?: StaffPayrollRecord['paymentMode'];
  paid_at?: string;
  paid_by?: string;
  linked_expense_id?: string;
  notes?: string;
  updated_at?: string;
}

const mapPayrollRow = (r: PayrollRow): StaffPayrollRecord => ({
  id: r.id,
  staffId: r.staff_id,
  monthStr: r.month_str,
  payType: r.pay_type === 'daily' ? 'daily' : 'monthly',
  baseSalary: Number(r.base_salary) || 0,
  daysInMonth: Number(r.days_in_month) || 30,
  presentDays: Number(r.present_days) || 0,
  halfDays: Number(r.half_days) || 0,
  paidLeavesAndOffs: Number(r.paid_leaves_and_offs) || 0,
  absentDays: Number(r.absent_days) || 0,
  overtimeHours: Number(r.overtime_hours) || 0,
  earnedBasePay: Number(r.earned_base_pay) || 0,
  overtimePay: Number(r.overtime_pay) || 0,
  bonuses: Number(r.bonuses) || 0,
  advancesDeducted: Number(r.advances_deducted) || 0,
  otherDeductions: Number(r.other_deductions) || 0,
  netPayable: Number(r.net_payable) || 0,
  status: r.status || 'draft',
  paymentMode: r.payment_mode,
  paidAt: r.paid_at,
  paidBy: r.paid_by,
  linkedExpenseId: r.linked_expense_id || undefined,
  notes: r.notes || '',
  updatedAt: r.updated_at,
});

// -------------------------------------------------------------
// 1. Staff Directory API
// -------------------------------------------------------------
export async function fetchStaffApi(): Promise<StaffMember[]> {
  const el = getElectron();
  if (el?.getStaff) {
    try {
      const list = await el.getStaff();
      if (Array.isArray(list)) {
        writeJson(STORAGE.staff, list);
        return list;
      }
    } catch { /* fall through */ }
  }

  const httpRes = await fetchHttp('/api/staff');
  if (httpRes?.ok) {
    const json = await httpRes.json().catch(() => null);
    if (Array.isArray(json?.staff)) {
      writeJson(STORAGE.staff, json.staff);
      return json.staff;
    }
  }

  const cloud = await supabaseRequest<StaffRow[]>('staff_members?select=*&order=name.asc');
  if (cloud.ok && Array.isArray(cloud.data)) {
    const mapped = cloud.data.map(mapStaffRow);
    writeJson(STORAGE.staff, mapped);
    return mapped;
  }

  return readJson<StaffMember[]>(STORAGE.staff, []);
}

export async function saveStaffApi(
  member: Partial<StaffMember>
): Promise<{ success: boolean; staff?: StaffMember; error?: string }> {
  const id = member.id || `STAFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const normalized: StaffMember = {
    id,
    name: String(member.name || '').trim(),
    phone: String(member.phone || '').trim(),
    emergencyContact: member.emergencyContact?.trim() || '',
    role: member.role || 'Waiter',
    department: member.department || 'restaurant',
    shift: member.shift || 'full_day',
    payType: member.payType === 'daily' ? 'daily' : 'monthly',
    baseSalary: Number(member.baseSalary) || 0,
    overtimeRate: Number(member.overtimeRate) || 0,
    joinDate: member.joinDate || localDateString(),
    idProofNote: member.idProofNote?.trim() || '',
    showInPos: member.showInPos !== false,
    status: member.status || 'active',
    notes: member.notes?.trim() || '',
    updatedAt: new Date().toISOString(),
  };

  if (!normalized.name) return { success: false, error: 'Staff name is required.' };
  upsertLocal(STORAGE.staff, normalized);

  const el = getElectron();
  if (el?.saveStaff) {
    return el.saveStaff(normalized);
  }

  const httpRes = await fetchHttp('/api/staff', {
    method: 'POST',
    body: JSON.stringify({ staff: normalized }),
  });
  if (httpRes?.ok) return httpRes.json();

  const cloud = await supabaseRequest('staff_members', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(toStaffRow(normalized)),
  });
  return cloud.ok ? { success: true, staff: normalized } : { success: false, error: 'Could not save staff record.' };
}

export async function deleteStaffApi(id: string): Promise<{ success: boolean; error?: string }> {
  writeJson(
    STORAGE.staff,
    readJson<StaffMember[]>(STORAGE.staff, []).filter((s) => s.id !== id)
  );

  const el = getElectron();
  if (el?.deleteStaff) return el.deleteStaff(id);

  const httpRes = await fetchHttp('/api/staff/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  if (httpRes?.ok) return httpRes.json();

  const cloud = await supabaseRequest(`staff_members?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return { success: cloud.ok };
}

// -------------------------------------------------------------
// 2. Attendance API
// -------------------------------------------------------------
export async function fetchAttendanceApi(query: { monthStr?: string; dateStr?: string } = {}): Promise<StaffAttendanceRecord[]> {
  const el = getElectron();
  if (el?.getStaffAttendance) {
    try {
      const list = await el.getStaffAttendance(query);
      if (Array.isArray(list)) return list;
    } catch { /* fall through */ }
  }

  const params = new URLSearchParams();
  if (query.monthStr) params.set('month', query.monthStr);
  if (query.dateStr) params.set('date', query.dateStr);
  const httpRes = await fetchHttp(`/api/staff/attendance?${params.toString()}`);
  if (httpRes?.ok) {
    const json = await httpRes.json().catch(() => null);
    if (Array.isArray(json?.attendance)) return json.attendance;
  }

  let filter = 'select=*';
  if (query.dateStr) filter += `&date_str=eq.${encodeURIComponent(query.dateStr)}`;
  else if (query.monthStr) filter += `&date_str=like.${encodeURIComponent(query.monthStr)}*`;
  const cloud = await supabaseRequest<AttendanceRow[]>(`staff_attendance?${filter}`);
  if (cloud.ok && Array.isArray(cloud.data)) {
    const mapped = cloud.data.map(mapAttendanceRow);
    const existing = readJson<StaffAttendanceRecord[]>(STORAGE.attendance, []);
    const byId = new Map(existing.map((r) => [r.id, r]));
    for (const r of mapped) byId.set(r.id, r);
    writeJson(STORAGE.attendance, Array.from(byId.values()));
    return mapped;
  }

  const cached = readJson<StaffAttendanceRecord[]>(STORAGE.attendance, []);
  return cached.filter((r) => {
    if (query.dateStr) return r.dateStr === query.dateStr;
    if (query.monthStr) return r.dateStr.startsWith(query.monthStr);
    return true;
  });
}

export async function saveAttendanceApi(
  payload: StaffAttendanceRecord | StaffAttendanceRecord[]
): Promise<{ success: boolean; error?: string }> {
  const list = Array.isArray(payload) ? payload : [payload];
  const normalized = list.map((r) => ({
    ...r,
    id: r.id || `${r.staffId}_${r.dateStr}`,
    overtimeHours: Number(r.overtimeHours) || 0,
    updatedAt: new Date().toISOString(),
  }));

  const el = getElectron();
  if (el?.saveStaffAttendance) {
    const res = await el.saveStaffAttendance(normalized);
    if (res.success) {
      for (const rec of normalized) upsertLocal(STORAGE.attendance, rec);
    }
    return res;
  }

  const httpRes = await fetchHttp('/api/staff/attendance', {
    method: 'POST',
    body: JSON.stringify({ records: normalized }),
  });
  if (httpRes) {
    const json = await httpRes.json().catch(() => ({ success: false }));
    if (httpRes.ok && json.success) {
      for (const rec of normalized) upsertLocal(STORAGE.attendance, rec);
      return json;
    }
    return { success: false, error: json?.error || 'Could not save attendance.' };
  }

  const rows = normalized.map((r) => ({
    id: r.id,
    staff_id: r.staffId,
    date_str: r.dateStr,
    status: r.status,
    check_in: r.checkIn || null,
    check_out: r.checkOut || null,
    overtime_hours: r.overtimeHours,
    notes: r.notes || null,
    marked_by: r.markedBy || 'Manager',
    updated_at: r.updatedAt,
  }));
  const cloud = await supabaseRequest('staff_attendance', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (cloud.ok) {
    for (const rec of normalized) upsertLocal(STORAGE.attendance, rec);
    return { success: true };
  }
  return { success: false, error: 'Failed to save attendance to cloud.' };
}

// -------------------------------------------------------------
// 3. Advances, Deductions & Bonuses API
// -------------------------------------------------------------
export async function fetchAdvancesApi(query: { monthStr?: string; staffId?: string } = {}): Promise<StaffAdvanceRecord[]> {
  const el = getElectron();
  if (el?.getStaffAdvances) {
    try {
      const list = await el.getStaffAdvances(query);
      if (Array.isArray(list)) return list;
    } catch { /* fall through */ }
  }

  const params = new URLSearchParams();
  if (query.monthStr) params.set('month', query.monthStr);
  if (query.staffId) params.set('staffId', query.staffId);
  const httpRes = await fetchHttp(`/api/staff/advances?${params.toString()}`);
  if (httpRes?.ok) {
    const json = await httpRes.json().catch(() => null);
    if (Array.isArray(json?.advances)) return json.advances;
  }

  let filter = 'select=*&order=date_str.desc';
  if (query.staffId) filter += `&staff_id=eq.${encodeURIComponent(query.staffId)}`;
  if (query.monthStr) filter += `&date_str=like.${encodeURIComponent(query.monthStr)}*`;
  const cloud = await supabaseRequest<AdvanceRow[]>(`staff_advances?${filter}`);
  if (cloud.ok && Array.isArray(cloud.data)) {
    const mapped = cloud.data.map(mapAdvanceRow);
    writeJson(STORAGE.advances, mapped);
    return mapped;
  }

  return readJson<StaffAdvanceRecord[]>(STORAGE.advances, []).filter((a) => {
    if (query.staffId && a.staffId !== query.staffId) return false;
    if (query.monthStr && !a.dateStr.startsWith(query.monthStr)) return false;
    return true;
  });
}

export async function saveAdvanceApi(
  entry: Partial<StaffAdvanceRecord>,
  options: { recordInExpenses?: boolean; staffName?: string } = {}
): Promise<{ success: boolean; advance?: StaffAdvanceRecord; error?: string }> {
  const id = entry.id || `SADV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const dateStr = entry.dateStr || localDateString();
  const normalized: StaffAdvanceRecord = {
    id,
    staffId: entry.staffId || '',
    dateStr,
    entryType: entry.entryType || 'advance',
    amount: Number(entry.amount) || 0,
    paymentMode: entry.paymentMode || 'Cash',
    notes: entry.notes?.trim() || '',
    linkedExpenseId: entry.linkedExpenseId,
    recordedBy: entry.recordedBy || 'Manager',
    updatedAt: new Date().toISOString(),
  };

  const el = getElectron();
  if (el?.saveStaffAdvance) {
    return el.saveStaffAdvance(normalized, options);
  }

  const httpRes = await fetchHttp('/api/staff/advances', {
    method: 'POST',
    body: JSON.stringify({ advance: normalized, recordInExpenses: options.recordInExpenses }),
  });
  if (httpRes?.ok) return httpRes.json();

  // Supabase cloud direct fallback (including linked expense if requested)
  let linkedExpenseId = normalized.linkedExpenseId;
  if (
    options.recordInExpenses &&
    (normalized.entryType === 'advance' || normalized.entryType === 'bonus') &&
    normalized.paymentMode !== 'Adjustment'
  ) {
    linkedExpenseId = linkedExpenseId || `EXP-${id}`;
    const label = normalized.entryType === 'bonus' ? 'Bonus' : 'Advance (Kharchi)';
    await supabaseRequest('expenses', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        id: linkedExpenseId,
        title: `${options.staffName || normalized.staffId} - ${label}`,
        category: normalized.entryType === 'bonus' ? 'Staff Bonus' : 'Staff Advance',
        amount: normalized.amount,
        paid_by: normalized.paymentMode === 'UPI' ? 'UPI' : normalized.paymentMode === 'Bank Transfer' ? 'Bank Transfer' : 'Cash Drawer',
        notes: normalized.notes || `Staff ${label} recorded on ${dateStr}`,
        recorded_by: normalized.recordedBy,
        date_str: dateStr,
        timestamp: `${dateStr}T12:00:00`,
      }),
    });
  }

  const saved = { ...normalized, linkedExpenseId };
  const cloud = await supabaseRequest('staff_advances', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: saved.id,
      staff_id: saved.staffId,
      date_str: saved.dateStr,
      entry_type: saved.entryType,
      amount: saved.amount,
      payment_mode: saved.paymentMode,
      notes: saved.notes || null,
      linked_expense_id: saved.linkedExpenseId || null,
      recorded_by: saved.recordedBy,
      updated_at: saved.updatedAt,
    }),
  });
  if (cloud.ok) {
    upsertLocal(STORAGE.advances, saved);
    return { success: true, advance: saved };
  }
  return { success: false, error: 'Failed to save staff advance.' };
}

export async function deleteAdvanceApi(
  advance: StaffAdvanceRecord,
  options: { deleteLinkedExpense?: boolean; deletedBy?: string; reason?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  const el = getElectron();
  if (el?.deleteStaffAdvance) {
    return el.deleteStaffAdvance(advance.id, options);
  }

  const httpRes = await fetchHttp('/api/staff/advances/delete', {
    method: 'POST',
    body: JSON.stringify({ id: advance.id, ...options }),
  });
  if (httpRes?.ok) return httpRes.json();

  if (options.deleteLinkedExpense !== false && advance.linkedExpenseId) {
    await supabaseRequest(`expenses?id=eq.${encodeURIComponent(advance.linkedExpenseId)}`, { method: 'DELETE' });
  }
  const cloud = await supabaseRequest(`staff_advances?id=eq.${encodeURIComponent(advance.id)}`, { method: 'DELETE' });
  if (cloud.ok) {
    writeJson(
      STORAGE.advances,
      readJson<StaffAdvanceRecord[]>(STORAGE.advances, []).filter((a) => a.id !== advance.id)
    );
  }
  return { success: cloud.ok };
}

// -------------------------------------------------------------
// 4. Monthly Payroll API
// -------------------------------------------------------------
export async function fetchPayrollApi(monthStr: string): Promise<StaffPayrollRecord[]> {
  const el = getElectron();
  if (el?.getStaffPayroll) {
    try {
      const list = await el.getStaffPayroll({ monthStr });
      if (Array.isArray(list)) return list;
    } catch { /* fall through */ }
  }

  const httpRes = await fetchHttp(`/api/staff/payroll?month=${encodeURIComponent(monthStr)}`);
  if (httpRes?.ok) {
    const json = await httpRes.json().catch(() => null);
    if (Array.isArray(json?.payroll)) return json.payroll;
  }

  const cloud = await supabaseRequest<PayrollRow[]>(`staff_payroll?month_str=eq.${encodeURIComponent(monthStr)}&select=*`);
  if (cloud.ok && Array.isArray(cloud.data)) {
    const mapped = cloud.data.map(mapPayrollRow);
    writeJson(STORAGE.payroll, mapped);
    return mapped;
  }

  return readJson<StaffPayrollRecord[]>(STORAGE.payroll, []).filter((p) => p.monthStr === monthStr);
}

export async function settlePayrollApi(
  record: StaffPayrollRecord,
  options: { recordInExpenses?: boolean; paidDateStr?: string; staffName?: string } = {}
): Promise<{ success: boolean; payroll?: StaffPayrollRecord; error?: string }> {
  const el = getElectron();
  if (el?.settleStaffPayroll) {
    return el.settleStaffPayroll(record, options);
  }

  const httpRes = await fetchHttp('/api/staff/payroll/settle', {
    method: 'POST',
    body: JSON.stringify({ payroll: record, recordInExpenses: options.recordInExpenses, paidDateStr: options.paidDateStr }),
  });
  if (httpRes?.ok) return httpRes.json();

  let linkedExpenseId = record.linkedExpenseId;
  const paidDateStr = options.paidDateStr || localDateString();
  const paymentMode = record.paymentMode || 'Cash';
  if (options.recordInExpenses && record.netPayable > 0 && paymentMode !== 'Adjustment') {
    linkedExpenseId = linkedExpenseId || `EXP-PAY-${record.id}`;
    await supabaseRequest('expenses', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        id: linkedExpenseId,
        title: `${options.staffName || record.staffId} - Salary (${record.monthStr})`,
        category: 'Staff Salary',
        amount: record.netPayable,
        paid_by: paymentMode === 'UPI' ? 'UPI' : paymentMode === 'Bank Transfer' ? 'Bank Transfer' : 'Cash Drawer',
        notes: record.notes || `Monthly salary settlement for ${record.monthStr}`,
        recorded_by: record.paidBy || 'Manager',
        date_str: paidDateStr,
        timestamp: `${paidDateStr}T12:00:00`,
      }),
    });
  }

  const paidRecord: StaffPayrollRecord = {
    ...record,
    status: 'paid',
    paymentMode,
    paidAt: new Date().toISOString(),
    paidBy: record.paidBy || 'Manager',
    linkedExpenseId,
    updatedAt: new Date().toISOString(),
  };

  const cloud = await supabaseRequest('staff_payroll', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: paidRecord.id,
      staff_id: paidRecord.staffId,
      month_str: paidRecord.monthStr,
      pay_type: paidRecord.payType,
      base_salary: paidRecord.baseSalary,
      days_in_month: paidRecord.daysInMonth,
      present_days: paidRecord.presentDays,
      half_days: paidRecord.halfDays,
      paid_leaves_and_offs: paidRecord.paidLeavesAndOffs,
      absent_days: paidRecord.absentDays,
      overtime_hours: paidRecord.overtimeHours,
      earned_base_pay: paidRecord.earnedBasePay,
      overtime_pay: paidRecord.overtimePay,
      bonuses: paidRecord.bonuses,
      advances_deducted: paidRecord.advancesDeducted,
      other_deductions: paidRecord.otherDeductions,
      net_payable: paidRecord.netPayable,
      status: 'paid',
      payment_mode: paidRecord.paymentMode,
      paid_at: paidRecord.paidAt,
      paid_by: paidRecord.paidBy,
      linked_expense_id: paidRecord.linkedExpenseId || null,
      notes: paidRecord.notes || null,
      updated_at: paidRecord.updatedAt,
    }),
  });
  if (cloud.ok) {
    upsertLocal(STORAGE.payroll, paidRecord);
    return { success: true, payroll: paidRecord };
  }
  return { success: false, error: 'Failed to settle payroll.' };
}

export async function unlockPayrollApi(
  payroll: StaffPayrollRecord,
  options: { reason?: string; unlockedBy?: string; deleteLinkedExpense?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  const el = getElectron();
  if (el?.unlockStaffPayroll) {
    return el.unlockStaffPayroll(payroll.id, options);
  }

  const httpRes = await fetchHttp('/api/staff/payroll/unlock', {
    method: 'POST',
    body: JSON.stringify({ id: payroll.id, ...options }),
  });
  if (httpRes?.ok) return httpRes.json();

  if (options.deleteLinkedExpense && payroll.linkedExpenseId) {
    await supabaseRequest(`expenses?id=eq.${encodeURIComponent(payroll.linkedExpenseId)}`, { method: 'DELETE' });
  }
  const cloud = await supabaseRequest(`staff_payroll?id=eq.${encodeURIComponent(payroll.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'draft',
      linked_expense_id: options.deleteLinkedExpense ? null : payroll.linkedExpenseId || null,
      updated_at: new Date().toISOString(),
    }),
  });
  return { success: cloud.ok };
}
