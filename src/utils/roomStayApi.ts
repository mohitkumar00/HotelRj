/**
 * Hotel RJ — Room Stays & Checkout Billing API
 * Layered persistence: Electron IPC -> Counter LAN HTTP (:5050) -> Supabase REST -> localStorage
 */
import { SUPABASE_URL } from '../config';
import { RoomExtraCharge, RoomStayRecord } from '../types/roomStay';
import { getSupabaseHeaders } from './deviceAuth';
import { getApiBaseUrl } from './syncBase';
import { readJson, writeJson } from './storage';
import { localDateString } from './dates';
import { calculateRoomStayTotals } from './roomBilling';

const STORAGE_KEY = 'hotel_rj_room_stays';

type ElectronRoomStayApi = {
  getRoomStays?: (q?: { status?: string; roomId?: string }) => Promise<RoomStayRecord[]>;
  checkInRoomStay?: (stay: Partial<RoomStayRecord>) => Promise<{ success: boolean; stay?: RoomStayRecord; error?: string }>;
  saveRoomStay?: (stay: Partial<RoomStayRecord>) => Promise<{ success: boolean; stay?: RoomStayRecord; error?: string }>;
  checkoutRoomStay?: (payload: CheckoutStayPayload) => Promise<{ success: boolean; stay?: RoomStayRecord; bill?: { id: string; billNumber: number }; error?: string }>;
  cancelRoomStay?: (stayId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
};

export interface CheckoutStayPayload {
  stayId: string;
  stayType: 'nightly' | 'short_stay';
  nightlyRate: number;
  nights: number;
  customStayPrice: number;
  extraCharges: RoomExtraCharge[];
  discount: number;
  gstPercent: number;
  checkOutDate: string;
  paymentMethod: 'cash' | 'upi' | 'card' | 'split';
  paymentDetails: { cashAmount: number; upiAmount: number; cardAmount: number };
  settledBy?: string;
  notes?: string;
}

function getElectron(): ElectronRoomStayApi | undefined {
  return typeof window !== 'undefined' ? (window as Window & { ElectronAPI?: ElectronRoomStayApi }).ElectronAPI : undefined;
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
    if (res.status === 204 || res.headers.get('content-length') === '0') return { ok: true, data: null };
    const text = await res.text();
    return { ok: true, data: text ? (JSON.parse(text) as T) : null };
  } catch {
    return { ok: false, data: null };
  }
}

interface RoomStayRow {
  id: string;
  room_id: string;
  room_name?: string;
  stay_type?: string;
  guest_name: string;
  guest_phone?: string;
  num_guests?: number;
  id_proof_note?: string;
  check_in_at?: string;
  check_in_date: string;
  expected_check_out_date?: string;
  check_out_at?: string;
  check_out_date?: string;
  nightly_rate?: number | string;
  nights?: number;
  custom_stay_price?: number | string;
  extra_charges?: RoomExtraCharge[];
  advance_paid?: number | string;
  advance_payment_mode?: RoomStayRecord['advancePaymentMode'];
  discount?: number | string;
  gst_percent?: number | string;
  tax_amount?: number | string;
  total_amount?: number | string;
  status?: RoomStayRecord['status'];
  bill_id?: string;
  bill_number?: number;
  payment_method?: RoomStayRecord['paymentMethod'];
  notes?: string;
  created_by?: string;
  settled_by?: string;
  created_at?: string;
  updated_at?: string;
}

const mapRow = (r: RoomStayRow): RoomStayRecord => ({
  id: r.id,
  roomId: r.room_id,
  roomName: r.room_name || r.room_id,
  stayType: r.stay_type === 'short_stay' ? 'short_stay' : 'nightly',
  guestName: r.guest_name,
  guestPhone: r.guest_phone || '',
  numGuests: Number(r.num_guests) || 1,
  idProofNote: r.id_proof_note || '',
  checkInAt: r.check_in_at || new Date().toISOString(),
  checkInDate: r.check_in_date,
  expectedCheckOutDate: r.expected_check_out_date || '',
  checkOutAt: r.check_out_at || undefined,
  checkOutDate: r.check_out_date || undefined,
  nightlyRate: Number(r.nightly_rate) || 0,
  nights: Number(r.nights) || 1,
  customStayPrice: Number(r.custom_stay_price) || 0,
  extraCharges: Array.isArray(r.extra_charges) ? r.extra_charges : [],
  advancePaid: Number(r.advance_paid) || 0,
  advancePaymentMode: r.advance_payment_mode || 'Cash',
  discount: Number(r.discount) || 0,
  gstPercent: Number(r.gst_percent) || 0,
  taxAmount: Number(r.tax_amount) || 0,
  totalAmount: Number(r.total_amount) || 0,
  status: r.status || 'active',
  billId: r.bill_id || undefined,
  billNumber: r.bill_number ? Number(r.bill_number) : undefined,
  paymentMethod: r.payment_method || undefined,
  notes: r.notes || '',
  createdBy: r.created_by || 'Manager',
  settledBy: r.settled_by || undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toRow = (s: RoomStayRecord) => ({
  id: s.id,
  room_id: s.roomId,
  room_name: s.roomName,
  stay_type: s.stayType,
  guest_name: s.guestName,
  guest_phone: s.guestPhone || null,
  num_guests: s.numGuests,
  id_proof_note: s.idProofNote || null,
  check_in_at: s.checkInAt,
  check_in_date: s.checkInDate,
  expected_check_out_date: s.expectedCheckOutDate || null,
  check_out_at: s.checkOutAt || null,
  check_out_date: s.checkOutDate || null,
  nightly_rate: s.nightlyRate,
  nights: s.nights,
  custom_stay_price: s.customStayPrice,
  extra_charges: s.extraCharges || [],
  advance_paid: s.advancePaid,
  advance_payment_mode: s.advancePaymentMode,
  discount: s.discount,
  gst_percent: s.gstPercent,
  tax_amount: s.taxAmount,
  total_amount: s.totalAmount,
  status: s.status,
  bill_id: s.billId || null,
  bill_number: s.billNumber || null,
  payment_method: s.paymentMethod || null,
  notes: s.notes || null,
  created_by: s.createdBy || 'Manager',
  settled_by: s.settledBy || null,
  updated_at: new Date().toISOString(),
});

function upsertLocalStay(stay: RoomStayRecord): void {
  const list = readJson<RoomStayRecord[]>(STORAGE_KEY, []);
  const idx = list.findIndex((x) => x.id === stay.id);
  const next = idx >= 0 ? list.map((x, i) => (i === idx ? stay : x)) : [stay, ...list];
  writeJson(STORAGE_KEY, next);
}

export async function fetchRoomStaysApi(query: { status?: string; roomId?: string } = {}): Promise<RoomStayRecord[]> {
  const el = getElectron();
  if (el?.getRoomStays) {
    try {
      const list = await el.getRoomStays(query);
      if (Array.isArray(list)) {
        if (!query.status && !query.roomId) writeJson(STORAGE_KEY, list);
        return list;
      }
    } catch { /* fall through */ }
  }

  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.roomId) params.set('roomId', query.roomId);
  const httpRes = await fetchHttp(`/api/room-stays?${params.toString()}`);
  if (httpRes?.ok) {
    const json = await httpRes.json().catch(() => null);
    if (Array.isArray(json?.stays)) {
      if (!query.status && !query.roomId) writeJson(STORAGE_KEY, json.stays);
      return json.stays;
    }
  }

  let filter = 'select=*&order=check_in_at.desc&limit=500';
  if (query.status && query.status !== 'all') filter += `&status=eq.${encodeURIComponent(query.status)}`;
  if (query.roomId) filter += `&room_id=eq.${encodeURIComponent(query.roomId)}`;
  const cloud = await supabaseRequest<RoomStayRow[]>(`room_stays?${filter}`);
  if (cloud.ok && Array.isArray(cloud.data)) {
    const mapped = cloud.data.map(mapRow);
    if (!query.status && !query.roomId) writeJson(STORAGE_KEY, mapped);
    return mapped;
  }

  return readJson<RoomStayRecord[]>(STORAGE_KEY, []).filter((s) => {
    if (query.status && query.status !== 'all' && s.status !== query.status) return false;
    if (query.roomId && s.roomId !== query.roomId) return false;
    return true;
  });
}

export async function checkInRoomStayApi(
  stayInput: Partial<RoomStayRecord>
): Promise<{ success: boolean; stay?: RoomStayRecord; error?: string }> {
  const el = getElectron();
  if (el?.checkInRoomStay) {
    const res = await el.checkInRoomStay(stayInput);
    if (res.stay) upsertLocalStay(res.stay);
    return res;
  }

  const httpRes = await fetchHttp('/api/room-stays/check-in', {
    method: 'POST',
    body: JSON.stringify({ stay: stayInput }),
  });
  if (httpRes?.ok) {
    const json = await httpRes.json();
    if (json.stay) upsertLocalStay(json.stay);
    return json;
  }

  const nowIso = new Date().toISOString();
  const stayType = stayInput.stayType === 'short_stay' ? 'short_stay' : 'nightly';
  const totals = calculateRoomStayTotals({
    stayType,
    nightlyRate: Number(stayInput.nightlyRate) || 0,
    nights: stayType === 'short_stay' ? 1 : Math.max(1, Number(stayInput.nights) || 1),
    customStayPrice: stayType === 'short_stay' ? Number(stayInput.customStayPrice) || 0 : 0,
    extraCharges: stayInput.extraCharges || [],
    discount: Number(stayInput.discount) || 0,
    gstPercent: Number(stayInput.gstPercent) || 0,
    advancePaid: Number(stayInput.advancePaid) || 0,
  });

  const stay: RoomStayRecord = {
    id: stayInput.id || `STAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    roomId: stayInput.roomId || '',
    roomName: stayInput.roomName || stayInput.roomId || '',
    stayType,
    guestName: String(stayInput.guestName || '').trim(),
    guestPhone: stayInput.guestPhone?.trim() || '',
    numGuests: Math.max(1, Number(stayInput.numGuests) || 1),
    idProofNote: stayInput.idProofNote?.trim() || '',
    checkInAt: stayInput.checkInAt || nowIso,
    checkInDate: stayInput.checkInDate || localDateString(),
    expectedCheckOutDate: stayInput.expectedCheckOutDate || '',
    nightlyRate: Number(stayInput.nightlyRate) || 0,
    nights: stayType === 'short_stay' ? 1 : Math.max(1, Number(stayInput.nights) || 1),
    customStayPrice: stayType === 'short_stay' ? Number(stayInput.customStayPrice) || 0 : 0,
    extraCharges: stayInput.extraCharges || [],
    advancePaid: totals.advancePaid,
    advancePaymentMode: stayInput.advancePaymentMode || 'Cash',
    discount: totals.discount,
    gstPercent: totals.gstPercent,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    status: 'active',
    notes: stayInput.notes?.trim() || '',
    createdBy: stayInput.createdBy || 'Manager',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const cloud = await supabaseRequest('room_stays', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(toRow(stay)),
  });
  if (cloud.ok) {
    await supabaseRequest(`rooms?id=eq.${encodeURIComponent(stay.roomId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'occupied',
        guest_name: stay.guestName,
        check_in_date: stay.checkInDate,
        check_out_date: stay.expectedCheckOutDate || null,
        folio_amount: stay.totalAmount,
        notes: stay.notes || null,
        updated_at: nowIso,
      }),
    });
    upsertLocalStay(stay);
    return { success: true, stay };
  }
  return { success: false, error: 'Failed to check in guest.' };
}

export async function saveRoomStayApi(
  stay: RoomStayRecord
): Promise<{ success: boolean; stay?: RoomStayRecord; error?: string }> {
  const el = getElectron();
  if (el?.saveRoomStay) {
    const res = await el.saveRoomStay(stay);
    if (res.stay) upsertLocalStay(res.stay);
    return res;
  }

  const httpRes = await fetchHttp('/api/room-stays/save', {
    method: 'POST',
    body: JSON.stringify({ stay }),
  });
  if (httpRes?.ok) {
    const json = await httpRes.json();
    if (json.stay) upsertLocalStay(json.stay);
    return json;
  }

  const totals = calculateRoomStayTotals(stay);
  const updated: RoomStayRecord = {
    ...stay,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    updatedAt: new Date().toISOString(),
  };

  const cloud = await supabaseRequest('room_stays', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(toRow(updated)),
  });
  if (cloud.ok) {
    if (updated.status === 'active') {
      await supabaseRequest(`rooms?id=eq.${encodeURIComponent(updated.roomId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          guest_name: updated.guestName,
          check_in_date: updated.checkInDate,
          check_out_date: updated.expectedCheckOutDate || null,
          folio_amount: updated.totalAmount,
          notes: updated.notes || null,
          updated_at: updated.updatedAt,
        }),
      });
    }
    upsertLocalStay(updated);
    return { success: true, stay: updated };
  }
  return { success: false, error: 'Failed to save stay updates.' };
}

export async function checkoutRoomStayApi(
  stay: RoomStayRecord,
  payload: CheckoutStayPayload
): Promise<{ success: boolean; stay?: RoomStayRecord; billNumber?: number; error?: string }> {
  const el = getElectron();
  if (el?.checkoutRoomStay) {
    const res = await el.checkoutRoomStay(payload);
    if (res.stay) upsertLocalStay(res.stay);
    return { success: res.success, stay: res.stay, billNumber: res.bill?.billNumber, error: res.error };
  }

  const httpRes = await fetchHttp('/api/room-stays/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (httpRes?.ok) {
    const json = await httpRes.json();
    if (json.stay) upsertLocalStay(json.stay);
    return { success: json.success, stay: json.stay, billNumber: json.bill?.billNumber, error: json.error };
  }

  // Supabase cloud direct fallback
  const totals = calculateRoomStayTotals({
    stayType: payload.stayType,
    nightlyRate: payload.nightlyRate,
    nights: payload.nights,
    customStayPrice: payload.customStayPrice,
    extraCharges: payload.extraCharges,
    discount: payload.discount,
    gstPercent: payload.gstPercent,
    advancePaid: stay.advancePaid,
  });
  const nowIso = new Date().toISOString();
  const billId = `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const billNumber = Math.floor(1000 + Math.random() * 9000);
  const items = [
    {
      name:
        payload.stayType === 'short_stay'
          ? `${stay.roomName || stay.roomId} (Short Stay / Custom)`
          : `${stay.roomName || stay.roomId} (${payload.nights} Night${payload.nights === 1 ? '' : 's'})`,
      quantity: payload.stayType === 'short_stay' ? 1 : payload.nights,
      price: payload.stayType === 'short_stay' ? payload.customStayPrice : payload.nightlyRate,
      isCustom: payload.stayType === 'short_stay',
    },
    ...payload.extraCharges.map((ex) => ({
      name: ex.label,
      quantity: 1,
      price: ex.amount,
      isCustom: true,
    })),
  ];

  const billRes = await supabaseRequest('bills', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: billId,
      bill_number: billNumber,
      status: 'settled',
      department: 'rooms',
      table_id: stay.roomId,
      order_type: 'room-stay',
      room_number: stay.roomId,
      server_name: 'Front Desk',
      settled_by: payload.settledBy || 'Manager',
      customer_phone: stay.guestPhone || null,
      customer_name: stay.guestName,
      subtotal: totals.subtotal,
      tax: totals.taxAmount,
      discount: totals.discount,
      total: totals.totalAmount,
      payment_method: payload.paymentMethod,
      payment_details: payload.paymentDetails,
      items,
      date_str: payload.checkOutDate,
      timestamp: nowIso,
    }),
  });
  if (!billRes.ok) return { success: false, error: 'Could not save room bill to cloud.' };

  const checkedOutStay: RoomStayRecord = {
    ...stay,
    stayType: payload.stayType,
    nightlyRate: payload.nightlyRate,
    nights: payload.nights,
    customStayPrice: payload.customStayPrice,
    extraCharges: payload.extraCharges,
    discount: totals.discount,
    gstPercent: totals.gstPercent,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    status: 'checked_out',
    checkOutAt: nowIso,
    checkOutDate: payload.checkOutDate,
    billId,
    billNumber,
    paymentMethod: payload.paymentMethod,
    settledBy: payload.settledBy || 'Manager',
    notes: payload.notes ?? stay.notes,
    updatedAt: nowIso,
  };

  await supabaseRequest('room_stays', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(toRow(checkedOutStay)),
  });
  await supabaseRequest(`rooms?id=eq.${encodeURIComponent(stay.roomId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'dirty',
      guest_name: null,
      check_in_date: null,
      check_out_date: null,
      folio_amount: 0,
      notes: null,
      updated_at: nowIso,
    }),
  });
  upsertLocalStay(checkedOutStay);
  return { success: true, stay: checkedOutStay, billNumber };
}
