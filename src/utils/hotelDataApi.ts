import { MenuCategory, MenuItem, HotelRoomRecord, TableConfigItem } from '../types';
import { MENU_CATEGORIES } from '../data/menuData';

declare global {
  interface Window {
    ElectronAPI?: any;
  }
}

const DEFAULT_ROOMS: HotelRoomRecord[] = [
  { id: 'Room 101', name: 'Room 101 (Deluxe King)', tier: 'deluxe', pricePerNight: 1600, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 102', name: 'Room 102 (Deluxe King)', tier: 'deluxe', pricePerNight: 1600, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 103', name: 'Room 103 (Deluxe King)', tier: 'deluxe', pricePerNight: 1600, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 201', name: 'Room 201 (Super Deluxe)', tier: 'executive', pricePerNight: 2200, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 202', name: 'Room 202 (Super Deluxe)', tier: 'executive', pricePerNight: 2200, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 203', name: 'Room 203 (Super Deluxe)', tier: 'executive', pricePerNight: 2200, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 204', name: 'Room 204 (Super Deluxe)', tier: 'executive', pricePerNight: 2200, status: 'available', maxGuests: 2, bedType: '1 King Bed' },
  { id: 'Room 301', name: 'Room 301 (Family Suite)', tier: 'family', pricePerNight: 3000, status: 'available', maxGuests: 4, bedType: '2 Double Beds' },
  { id: 'Room 302', name: 'Room 302 (Family Suite)', tier: 'family', pricePerNight: 3000, status: 'available', maxGuests: 4, bedType: '2 Double Beds' },
  { id: 'Room 305', name: 'Room 305 (Family Suite)', tier: 'family', pricePerNight: 3000, status: 'available', maxGuests: 4, bedType: '2 Double Beds' },
];

const DEFAULT_TABLES: TableConfigItem[] = [
  { id: 'T-1', name: 'Table 1', section: 'dining', capacity: 4, isActive: true, sortOrder: 1 },
  { id: 'T-2', name: 'Table 2', section: 'dining', capacity: 4, isActive: true, sortOrder: 2 },
  { id: 'T-3', name: 'Table 3', section: 'dining', capacity: 4, isActive: true, sortOrder: 3 },
  { id: 'T-4', name: 'Table 4', section: 'dining', capacity: 4, isActive: true, sortOrder: 4 },
  { id: 'T-5', name: 'Table 5', section: 'dining', capacity: 4, isActive: true, sortOrder: 5 },
  { id: 'T-6', name: 'Table 6', section: 'dining', capacity: 4, isActive: true, sortOrder: 6 },
  { id: 'T-7', name: 'Table 7', section: 'dining', capacity: 6, isActive: true, sortOrder: 7 },
  { id: 'T-8', name: 'Table 8', section: 'dining', capacity: 6, isActive: true, sortOrder: 8 },
  { id: 'T-9', name: 'Table 9', section: 'dining', capacity: 6, isActive: true, sortOrder: 9 },
  { id: 'T-10', name: 'Table 10', section: 'dining', capacity: 8, isActive: true, sortOrder: 10 },
  { id: 'T-11', name: 'Table 11', section: 'dining', capacity: 8, isActive: true, sortOrder: 11 },
  { id: 'T-12', name: 'Table 12', section: 'dining', capacity: 8, isActive: true, sortOrder: 12 },
  { id: 'Parcel 1', name: 'Parcel 1', section: 'parcel', capacity: 1, isActive: true, sortOrder: 13 },
  { id: 'Parcel 2', name: 'Parcel 2', section: 'parcel', capacity: 1, isActive: true, sortOrder: 14 },
  { id: 'Parcel 3', name: 'Parcel 3', section: 'parcel', capacity: 1, isActive: true, sortOrder: 15 },
  { id: 'Parcel 4', name: 'Parcel 4', section: 'parcel', capacity: 1, isActive: true, sortOrder: 16 },
  { id: 'Takeaway Counter', name: 'Takeaway Counter', section: 'parcel', capacity: 1, isActive: true, sortOrder: 17 },
  { id: 'Lawn 1', name: 'Lawn Table 1', section: 'lawn', capacity: 6, isActive: true, sortOrder: 18 },
  { id: 'Banquet Hall', name: 'Banquet Hall 1', section: 'banquet', capacity: 50, isActive: true, sortOrder: 19 },
];

export const DEFAULT_SUPABASE_URL = 'https://kupbuusakxvsfprwdpbr.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_lZf74V3b-jAG3sIYxSDeVA_cFIdt74o';

export function getSupabaseHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: DEFAULT_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
  };
}

function getApiBaseUrl(): string {
  try {
    const saved = localStorage.getItem('hotel_rj_counter_sync_url');
    if (saved && saved.trim()) {
      let clean = saved.trim();
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = `http://${clean}`;
      }
      return clean.replace(/\/+$/, '');
    }
  } catch {}

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    if (window.location.origin.includes(':5050')) {
      return window.location.origin;
    }
  }
  return 'http://127.0.0.1:5050';
}

// -------------------------------------------------------------
// Menu & Kitchen 86 Sold-Out Tracking APIs
// -------------------------------------------------------------
export async function fetchMenuApi(): Promise<MenuCategory[]> {
  // 1. Electron IPC (Counter PC Desktop)
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.getMenu) {
    try {
      const menu = await window.ElectronAPI.getMenu();
      if (Array.isArray(menu) && menu.length > 0) {
        localStorage.setItem('hotel_rj_menu_cache', JSON.stringify(menu));
        return menu;
      }
    } catch (err) {
      console.warn('[HotelDataApi] Electron getMenu error:', err);
    }
  }

  // 2. HTTP Server API (Waiter Android Wi-Fi)
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/menu`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.menu) && json.menu.length > 0) {
        localStorage.setItem('hotel_rj_menu_cache', JSON.stringify(json.menu));
        return json.menu;
      }
    }
  } catch {
    // Sync server might not be running or client is on mobile data
  }

  // 3. Supabase Cloud API (For Guest QR Menu Scans on 4G/5G)
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/menu_items?select=*&order=category_id,name`, {
      headers: {
        apikey: DEFAULT_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
      },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const items: any[] = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        // Build quick lookup of bundled dishes to preserve images & default assets
        const baseItemMap = new Map<string, MenuItem>();
        for (const cat of MENU_CATEGORIES) {
          for (const it of cat.items) {
            baseItemMap.set(it.id, it);
          }
        }

        const categoryMap = new Map<string, any[]>();
        for (const item of items) {
          const catId = item.category_id || 'chef-specials';
          if (!categoryMap.has(catId)) categoryMap.set(catId, []);
          const base = baseItemMap.get(item.id);
          categoryMap.get(catId)!.push({
            id: item.id,
            name: item.name,
            hindiName: item.hindi_name || base?.hindiName || undefined,
            price: Number(item.price) || (typeof base?.price === 'number' ? base.price : 0),
            dietary: item.dietary || base?.dietary || 'veg',
            category: catId,
            popular: item.popular !== undefined ? !!item.popular : !!base?.popular,
            isAvailable: item.is_available !== false,
            description: item.description || base?.description || undefined,
            image: item.image || base?.image || undefined,
          });
        }

        const rebuilt: MenuCategory[] = MENU_CATEGORIES.map((baseCat) => {
          const dbItems = categoryMap.get(baseCat.id);
          if (!dbItems || dbItems.length === 0) return baseCat;

          const dbMap = new Map<string, any>(dbItems.map((i: any) => [i.id, i]));
          const mergedItems: MenuItem[] = baseCat.items.map((bItem) => {
            const dbItem = dbMap.get(bItem.id);
            if (!dbItem) return bItem;
            return {
              ...bItem,
              ...dbItem,
              image: dbItem.image || bItem.image,
            };
          });

          // Add any custom items added in this category that didn't exist in base
          const baseIds = new Set(baseCat.items.map((i) => i.id));
          for (const dbItem of dbItems) {
            if (!baseIds.has(dbItem.id)) {
              mergedItems.push(dbItem);
            }
          }

          return {
            ...baseCat,
            items: mergedItems,
          };
        });

        localStorage.setItem('hotel_rj_menu_cache', JSON.stringify(rebuilt));
        return rebuilt;
      }
    }
  } catch (err) {
    console.warn('[HotelDataApi] Supabase fetchMenu error:', err);
  }

  // 4. Fallback: LocalStorage cache or bundled seed
  try {
    const cached = localStorage.getItem('hotel_rj_menu_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const baseMap = new Map<string, string>();
        for (const cat of MENU_CATEGORIES) {
          for (const it of cat.items) {
            if (it.image) baseMap.set(it.id, it.image);
          }
        }
        return parsed.map((cat: MenuCategory) => ({
          ...cat,
          items: (cat.items || []).map((it: MenuItem) => ({
            ...it,
            image: it.image || baseMap.get(it.id),
          })),
        }));
      }
    }
  } catch {}

  return MENU_CATEGORIES;
}

export async function toggleDishAvailabilityApi(
  dishId: string,
  isAvailable?: boolean
): Promise<{ success: boolean; isAvailable?: boolean }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.toggleDishAvailability) {
    try {
      const res = await window.ElectronAPI.toggleDishAvailability(dishId, isAvailable);
      return res;
    } catch (err: any) {
      return { success: false };
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/menu/toggle-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dishId, isAvailable }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[HotelDataApi] toggleDishAvailability HTTP error:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    let newStatus = isAvailable;
    if (newStatus === undefined) {
      const getRes = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/menu_items?id=eq.${encodeURIComponent(dishId)}&select=is_available`, {
        headers: getSupabaseHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      if (getRes.ok) {
        const rows = await getRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          newStatus = !rows[0].is_available;
        }
      }
    }
    if (newStatus === undefined) newStatus = false;

    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/menu_items?id=eq.${encodeURIComponent(dishId)}`, {
      method: 'PATCH',
      headers: { ...getSupabaseHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ is_available: newStatus, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return { success: true, isAvailable: newStatus };
    }
  } catch (err) {
    console.warn('[HotelDataApi] Supabase toggleDishAvailability error:', err);
  }

  return { success: false };
}

export async function saveDishApi(dishData: Partial<MenuItem> & { categoryId?: string }): Promise<{ success: boolean; dish?: MenuItem }> {
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.saveDish) {
    try {
      return await window.ElectronAPI.saveDish(dishData);
    } catch (err: any) {
      return { success: false };
    }
  }

  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/menu/dish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish: dishData }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[HotelDataApi] saveDish HTTP error:', err);
  }

  // Supabase Cloud API Fallback
  try {
    const id = dishData.id || `dish-${Date.now()}`;
    const row = {
      id,
      name: dishData.name || 'Unnamed Dish',
      hindi_name: dishData.hindiName || null,
      price: Number(dishData.price) || 0,
      category_id: dishData.categoryId || dishData.category || 'chef-specials',
      dietary: dishData.dietary || 'veg',
      popular: !!dishData.popular,
      is_available: dishData.isAvailable !== false,
      image: dishData.image || null,
      description: dishData.description || null,
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/menu_items`, {
      method: 'POST',
      headers: {
        ...getSupabaseHeaders(),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const saved = await res.json();
      const r = Array.isArray(saved) && saved.length > 0 ? saved[0] : row;
      return {
        success: true,
        dish: {
          id: r.id,
          name: r.name,
          hindiName: r.hindi_name || undefined,
          price: Number(r.price) || 0,
          category: r.category_id,
          dietary: r.dietary,
          popular: !!r.popular,
          isAvailable: r.is_available !== false,
          image: r.image || undefined,
          description: r.description || undefined,
        },
      };
    }
  } catch (err) {
    console.warn('[HotelDataApi] Supabase saveDish error:', err);
  }

  return { success: false };
}

export async function deleteDishApi(dishId: string): Promise<{ success: boolean }> {
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.deleteDish) {
    try {
      return await window.ElectronAPI.deleteDish(dishId);
    } catch (err: any) {
      return { success: false };
    }
  }

  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/menu/dish/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dishId }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[HotelDataApi] deleteDish HTTP error:', err);
  }

  // Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/menu_items?id=eq.${encodeURIComponent(dishId)}`, {
      method: 'DELETE',
      headers: getSupabaseHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return { success: true };
  } catch (err) {
    console.warn('[HotelDataApi] Supabase deleteDish error:', err);
  }

  return { success: false };
}

// -------------------------------------------------------------
// Rooms Management APIs
// -------------------------------------------------------------
export async function fetchRoomsApi(): Promise<HotelRoomRecord[]> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.getRooms) {
    try {
      const rooms = await window.ElectronAPI.getRooms();
      if (Array.isArray(rooms) && rooms.length > 0) {
        localStorage.setItem('hotel_rj_rooms_cache', JSON.stringify(rooms));
        return rooms;
      }
    } catch (err) {
      console.warn('[HotelDataApi] Electron getRooms error:', err);
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/rooms`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.rooms) && json.rooms.length > 0) {
        localStorage.setItem('hotel_rj_rooms_cache', JSON.stringify(json.rooms));
        return json.rooms;
      }
    }
  } catch {}

  // 3. Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/rooms?select=*&order=id`, {
      headers: getSupabaseHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const rows: any[] = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const rooms: HotelRoomRecord[] = rows.map((r) => ({
          id: r.id,
          name: r.name,
          tier: r.tier || 'deluxe',
          pricePerNight: Number(r.price_per_night) || 0,
          status: r.status || 'available',
          maxGuests: Number(r.max_guests) || 2,
          bedType: r.bed_type || '1 King Bed',
          guestName: r.guest_name || undefined,
          checkInDate: r.check_in_date || undefined,
          checkOutDate: r.check_out_date || undefined,
          folioAmount: Number(r.folio_amount) || 0,
          notes: r.notes || undefined,
        }));
        localStorage.setItem('hotel_rj_rooms_cache', JSON.stringify(rooms));
        return rooms;
      }
    }
  } catch (err) {
    console.warn('[HotelDataApi] Supabase fetchRooms error:', err);
  }

  // 4. LocalStorage cache or bundled defaults
  try {
    const cached = localStorage.getItem('hotel_rj_rooms_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return DEFAULT_ROOMS;
}

export async function updateRoomStatusApi(
  roomId: string,
  status: string,
  guestDetails?: {
    guestName?: string;
    checkInDate?: string;
    checkOutDate?: string;
    folioAmount?: number;
    notes?: string;
  }
): Promise<{ success: boolean; room?: HotelRoomRecord }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.updateRoomStatus) {
    try {
      return await window.ElectronAPI.updateRoomStatus(roomId, status, guestDetails);
    } catch (err: any) {
      return { success: false };
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/rooms/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, status, guestDetails }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[HotelDataApi] updateRoomStatus HTTP error:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const patchBody: any = {
      status,
      guest_name: guestDetails?.guestName || null,
      check_in_date: guestDetails?.checkInDate || null,
      check_out_date: guestDetails?.checkOutDate || null,
      folio_amount: guestDetails?.folioAmount ?? 0,
      notes: guestDetails?.notes || null,
      updated_at: new Date().toISOString(),
    };
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/rooms?id=eq.${encodeURIComponent(roomId)}`, {
      method: 'PATCH',
      headers: { ...getSupabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(patchBody),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const updated = await res.json();
      if (Array.isArray(updated) && updated.length > 0) {
        const r = updated[0];
        return {
          success: true,
          room: {
            id: r.id,
            name: r.name,
            tier: r.tier || 'deluxe',
            pricePerNight: Number(r.price_per_night) || 0,
            status: r.status,
            maxGuests: Number(r.max_guests) || 2,
            bedType: r.bed_type,
            guestName: r.guest_name || undefined,
            checkInDate: r.check_in_date || undefined,
            checkOutDate: r.check_out_date || undefined,
            folioAmount: Number(r.folio_amount) || 0,
            notes: r.notes || undefined,
          },
        };
      }
      return { success: true };
    }
  } catch (err) {
    console.warn('[HotelDataApi] Supabase updateRoomStatus error:', err);
  }

  return { success: false };
}

export async function saveRoomApi(roomData: Partial<HotelRoomRecord>): Promise<{ success: boolean; room?: HotelRoomRecord }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.saveRoom) {
    try {
      return await window.ElectronAPI.saveRoom(roomData);
    } catch (err: any) {
      return { success: false };
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: roomData }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[HotelDataApi] saveRoom HTTP error:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const id = roomData.id || `Room ${Date.now()}`;
    const row = {
      id,
      name: roomData.name || id,
      tier: roomData.tier || 'deluxe',
      price_per_night: Number(roomData.pricePerNight) || 0,
      status: roomData.status || 'available',
      max_guests: Number(roomData.maxGuests) || 2,
      bed_type: roomData.bedType || '1 King Bed',
      guest_name: roomData.guestName || null,
      check_in_date: roomData.checkInDate || null,
      check_out_date: roomData.checkOutDate || null,
      folio_amount: roomData.folioAmount ?? 0,
      notes: roomData.notes || null,
      updated_at: new Date().toISOString(),
    };
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/rooms`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const saved = await res.json();
      const r = Array.isArray(saved) && saved.length > 0 ? saved[0] : row;
      return {
        success: true,
        room: {
          id: r.id,
          name: r.name,
          tier: r.tier,
          pricePerNight: Number(r.price_per_night) || 0,
          status: r.status,
          maxGuests: Number(r.max_guests) || 2,
          bedType: r.bed_type,
          guestName: r.guest_name || undefined,
          checkInDate: r.check_in_date || undefined,
          checkOutDate: r.check_out_date || undefined,
          folioAmount: Number(r.folio_amount) || 0,
          notes: r.notes || undefined,
        },
      };
    }
  } catch (err) {
    console.warn('[HotelDataApi] Supabase saveRoom error:', err);
  }

  return { success: false };
}

export async function deleteRoomApi(roomId: string): Promise<{ success: boolean }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.deleteRoom) {
    try {
      return await window.ElectronAPI.deleteRoom(roomId);
    } catch (err: any) {
      return { success: false };
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/rooms/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[HotelDataApi] deleteRoom HTTP error:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/rooms?id=eq.${encodeURIComponent(roomId)}`, {
      method: 'DELETE',
      headers: getSupabaseHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return { success: true };
  } catch (err) {
    console.warn('[HotelDataApi] Supabase deleteRoom error:', err);
  }

  return { success: false };
}

// -------------------------------------------------------------
// Tables & Outlets Configuration APIs
// -------------------------------------------------------------
export async function fetchTablesConfigApi(): Promise<TableConfigItem[]> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.getTablesConfig) {
    try {
      const tables = await window.ElectronAPI.getTablesConfig();
      if (Array.isArray(tables) && tables.length > 0) {
        localStorage.setItem('hotel_rj_tables_config_cache', JSON.stringify(tables));
        return tables;
      }
    } catch (err) {
      console.warn('[HotelDataApi] Electron getTablesConfig error:', err);
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/tables-config`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.tablesConfig) && json.tablesConfig.length > 0) {
        localStorage.setItem('hotel_rj_tables_config_cache', JSON.stringify(json.tablesConfig));
        return json.tablesConfig;
      }
    }
  } catch {}

  // 3. Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/tables_config?select=*&order=sort_order`, {
      headers: getSupabaseHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const rows: any[] = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const tables: TableConfigItem[] = rows.map((t) => ({
          id: t.id,
          name: t.name,
          section: t.section || 'dining',
          capacity: Number(t.capacity) || 4,
          isActive: t.is_active !== false,
          sortOrder: Number(t.sort_order) || 1,
        }));
        localStorage.setItem('hotel_rj_tables_config_cache', JSON.stringify(tables));
        return tables;
      }
    }
  } catch (err) {
    console.warn('[HotelDataApi] Supabase fetchTablesConfig error:', err);
  }

  // 4. LocalStorage cache or bundled defaults
  try {
    const cached = localStorage.getItem('hotel_rj_tables_config_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return DEFAULT_TABLES;
}

export async function saveTableConfigApi(tableData: Partial<TableConfigItem>): Promise<{ success: boolean; table?: TableConfigItem }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.saveTableConfig) {
    try {
      return await window.ElectronAPI.saveTableConfig(tableData);
    } catch (err: any) {
      return { success: false };
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/tables-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: tableData }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[HotelDataApi] saveTableConfig HTTP error:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const id = tableData.id || `T-${Date.now()}`;
    const row = {
      id,
      name: tableData.name || id,
      section: tableData.section || 'dining',
      capacity: Number(tableData.capacity) || 4,
      is_active: tableData.isActive !== false,
      sort_order: Number(tableData.sortOrder) || 1,
      updated_at: new Date().toISOString(),
    };
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/tables_config`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const saved = await res.json();
      const r = Array.isArray(saved) && saved.length > 0 ? saved[0] : row;
      return {
        success: true,
        table: {
          id: r.id,
          name: r.name,
          section: r.section,
          capacity: Number(r.capacity) || 4,
          isActive: r.is_active !== false,
          sortOrder: Number(r.sort_order) || 1,
        },
      };
    }
  } catch (err) {
    console.warn('[HotelDataApi] Supabase saveTableConfig error:', err);
  }

  return { success: false };
}

export async function deleteTableConfigApi(tableId: string): Promise<{ success: boolean }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.deleteTableConfig) {
    try {
      return await window.ElectronAPI.deleteTableConfig(tableId);
    } catch (err: any) {
      return { success: false };
    }
  }

  // 2. HTTP Server API
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/tables-config/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[HotelDataApi] deleteTableConfig HTTP error:', err);
  }

  // 3. Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/tables_config?id=eq.${encodeURIComponent(tableId)}`, {
      method: 'DELETE',
      headers: getSupabaseHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return { success: true };
  } catch (err) {
    console.warn('[HotelDataApi] Supabase deleteTableConfig error:', err);
  }

  return { success: false };
}
