/**
 * Hotel RJ - Banquet & Event Bookings API
 * Layered persistence: LocalStorage (Offline) -> Electron IPC -> Local Sync HTTP -> Supabase Cloud
 */

import { SUPABASE_URL } from '../config';
import { getSupabaseHeaders } from './deviceAuth';
import { BanquetBooking } from '../types/banquet';
import { getApiBaseUrl } from './syncBase';

const LOCAL_STORAGE_KEY = 'hotel_rj_banquet_bookings';

// Default initial mock bookings so manager immediately sees how it looks
const INITIAL_DEMO_BOOKINGS: BanquetBooking[] = [
  {
    id: 'bnq-sample-1',
    eventDate: '2026-11-15',
    slot: 'dinner',
    venue: 'Banquet Hall 1 (AC)',
    eventType: 'Birthday Party',
    noOfGuests: 60,
    customerName: 'Vikram Choudhary',
    customerPhone: '9829012345',
    totalAmount: 35000,
    advancePaid: 10000,
    balanceDue: 25000,
    advancePaymentMode: 'UPI',
    specialNotes: 'Paneer tikka starters, Birthday cake arrival at 9 PM',
    status: 'confirmed',
    createdBy: 'Manager',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bnq-sample-2',
    eventDate: '2026-11-22',
    slot: 'lunch',
    venue: 'Garden Lawn',
    eventType: 'Anniversary',
    noOfGuests: 120,
    customerName: 'Anil Singhania',
    customerPhone: '9414098765',
    totalAmount: 65000,
    advancePaid: 20000,
    balanceDue: 45000,
    advancePaymentMode: 'Cash',
    specialNotes: 'Live counter chaat + Special buffet setup',
    status: 'confirmed',
    createdBy: 'Manager',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

async function fetchHttpServer(endpoint: string, init?: RequestInit): Promise<Response | null> {
  const base = getApiBaseUrl();
  if (!base) return null;
  const url = `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  try {
    return await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null;
  }
}

// Convert DB snake_case row to TS camelCase BanquetBooking
function mapRowToBooking(row: any): BanquetBooking {
  return {
    id: row.id,
    eventDate: row.event_date || row.eventDate,
    slot: row.slot,
    customStartTime: row.custom_start_time || row.customStartTime,
    customEndTime: row.custom_end_time || row.customEndTime,
    venue: row.venue,
    eventType: row.event_type || row.eventType,
    noOfGuests: Number(row.no_of_guests ?? row.noOfGuests ?? 0),
    customerName: row.customer_name || row.customerName || 'Guest',
    customerPhone: row.customer_phone || row.customerPhone || '',
    totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
    advancePaid: Number(row.advance_paid ?? row.advancePaid ?? 0),
    balanceDue: Number(row.balance_due ?? row.balanceDue ?? 0),
    advancePaymentMode: row.advance_payment_mode || row.advancePaymentMode || 'Cash',
    specialNotes: row.special_notes || row.specialNotes || '',
    status: row.status || 'confirmed',
    createdBy: row.created_by || row.createdBy || 'Staff',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
  };
}

// Convert TS camelCase to DB snake_case
function mapBookingToRow(booking: BanquetBooking): any {
  return {
    id: booking.id,
    event_date: booking.eventDate,
    slot: booking.slot,
    custom_start_time: booking.customStartTime || null,
    custom_end_time: booking.customEndTime || null,
    venue: booking.venue,
    event_type: booking.eventType,
    no_of_guests: booking.noOfGuests,
    customer_name: booking.customerName,
    customer_phone: booking.customerPhone,
    total_amount: booking.totalAmount,
    advance_paid: booking.advancePaid,
    balance_due: booking.balanceDue,
    advance_payment_mode: booking.advancePaymentMode,
    special_notes: booking.specialNotes || null,
    status: booking.status,
    created_by: booking.createdBy || 'Staff',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Fetch all banquet bookings
 */
export async function fetchBanquetBookings(): Promise<BanquetBooking[]> {
  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.getBanquetBookings) {
    try {
      const data = await (window as any).ElectronAPI.getBanquetBookings();
      if (Array.isArray(data)) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('[BanquetApi] Electron getBanquetBookings error:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const res = await fetchHttpServer('/api/banquet-bookings');
    if (res && res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json));
        return json;
      }
    }
  } catch (e) {
    console.warn('[BanquetApi] HTTP getBanquetBookings error:', e);
  }

  // 3. Cloud Supabase Direct API Fallback
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/banquet_bookings?select=*&order=event_date.asc`,
      {
        headers: await getSupabaseHeaders(),
        signal: AbortSignal.timeout(5000),
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        const bookings = rows.map(mapRowToBooking);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookings));
        return bookings;
      }
    }
  } catch (e) {
    console.warn('[BanquetApi] Supabase fetch fallback error:', e);
  }

  // 4. LocalStorage Fallback
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Initialize with initial demo bookings if none exist yet
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_BOOKINGS));
  return INITIAL_DEMO_BOOKINGS;
}

/**
 * Save / Update a banquet booking
 */
export async function saveBanquetBooking(
  booking: BanquetBooking
): Promise<{ success: boolean; booking?: BanquetBooking; error?: string }> {
  const updatedBooking: BanquetBooking = {
    ...booking,
    updatedAt: new Date().toISOString(),
  };

  // Update local storage first
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: BanquetBooking[] = saved ? JSON.parse(saved) : [];
    const idx = list.findIndex((b) => b.id === updatedBooking.id);
    if (idx >= 0) {
      list[idx] = updatedBooking;
    } else {
      list.push(updatedBooking);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('[BanquetApi] LocalStorage save error:', err);
  }

  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.saveBanquetBooking) {
    try {
      const res = await (window as any).ElectronAPI.saveBanquetBooking(updatedBooking);
      if (res && res.success) return { success: true, booking: updatedBooking };
    } catch (e) {
      console.warn('[BanquetApi] Electron saveBanquetBooking error:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const res = await fetchHttpServer('/api/banquet-bookings', {
      method: 'POST',
      body: JSON.stringify(updatedBooking),
    });
    if (res && res.ok) {
      return { success: true, booking: updatedBooking };
    }
  } catch (e) {
    console.warn('[BanquetApi] HTTP saveBanquetBooking error:', e);
  }

  // 3. Supabase Direct Cloud API
  try {
    const row = mapBookingToRow(updatedBooking);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/banquet_bookings`, {
      method: 'POST',
      headers: {
        ...(await getSupabaseHeaders()),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return { success: true, booking: updatedBooking };
    }
  } catch (e) {
    console.warn('[BanquetApi] Supabase save error:', e);
  }

  // Return success since it was saved to LocalStorage
  return { success: true, booking: updatedBooking };
}

/**
 * Delete / Cancel a banquet booking
 */
export async function deleteBanquetBooking(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  // Update local storage
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const list: BanquetBooking[] = JSON.parse(saved);
      const filtered = list.filter((b) => b.id !== bookingId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.warn('[BanquetApi] LocalStorage delete error:', err);
  }

  // 1. Electron API
  if (typeof window !== 'undefined' && (window as any).ElectronAPI?.deleteBanquetBooking) {
    try {
      const res = await (window as any).ElectronAPI.deleteBanquetBooking(bookingId);
      if (res && res.success) return { success: true };
    } catch (e) {
      console.warn('[BanquetApi] Electron delete error:', e);
    }
  }

  // 2. HTTP Server API
  try {
    const res = await fetchHttpServer(`/api/banquet-bookings/delete`, {
      method: 'POST',
      body: JSON.stringify({ id: bookingId }),
    });
    if (res && res.ok) return { success: true };
  } catch (e) {
    console.warn('[BanquetApi] HTTP delete error:', e);
  }

  // 3. Supabase Direct Cloud API
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/banquet_bookings?id=eq.${encodeURIComponent(bookingId)}`,
      {
        method: 'DELETE',
        headers: await getSupabaseHeaders(),
        signal: AbortSignal.timeout(5000),
      }
    );
    if (res.ok) return { success: true };
  } catch (e) {
    console.warn('[BanquetApi] Supabase delete error:', e);
  }

  return { success: true };
}
