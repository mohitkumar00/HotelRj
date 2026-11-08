import { MenuCategory, MenuItem, HotelRoomRecord, TableConfigItem } from '../types';
import { MENU_CATEGORIES } from '../data/menuData';
import { SUPABASE_URL } from '../config';
import { getSupabaseHeaders } from './deviceAuth';
import { getApiBaseUrl } from './syncBase';
import { DEFAULT_ROOMS, DEFAULT_TABLES } from '../data/defaultHotelConfig';

declare global {
  interface Window {
    ElectronAPI?: any;
  }
}

export const DEFAULT_SUPABASE_URL = SUPABASE_URL;
export { getSupabaseHeaders };

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
  const base = getApiBaseUrl();
  if (base) {
    try {
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
  }

  // 3. Supabase Cloud API (For Guest QR Menu Scans on 4G/5G)
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/menu_items?select=*&order=category_id,name`, {
      headers: await getSupabaseHeaders(),
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
  const base = getApiBaseUrl();
  if (base) {
    try {
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
  }

  // 3. Supabase Cloud API Fallback
  try {
    let newStatus = isAvailable;
    if (newStatus === undefined) {
      const getRes = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/menu_items?id=eq.${encodeURIComponent(dishId)}&select=is_available`, {
        headers: await getSupabaseHeaders(),
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
      headers: { ...(await getSupabaseHeaders()), Prefer: 'return=minimal' },
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

export async function saveDishApi(dishData: Partial<MenuItem> & { categoryId?: string; originalId?: string }): Promise<{ success: boolean; dish?: MenuItem }> {
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.saveDish) {
    try {
      return await window.ElectronAPI.saveDish(dishData);
    } catch (err: any) {
      return { success: false };
    }
  }

  const base = getApiBaseUrl();
  if (base) {
    try {
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
  }

  // Supabase Cloud API Fallback
  try {
    const id = dishData.id || `dish-${Date.now()}`;
    const origId = dishData.originalId;

    if (origId && origId !== id) {
      await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/menu_items?id=eq.${encodeURIComponent(origId)}`, {
        method: 'DELETE',
        headers: await getSupabaseHeaders(),
        signal: AbortSignal.timeout(4000),
      }).catch(() => {});
    }

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
        ...(await getSupabaseHeaders()),
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

  const base = getApiBaseUrl();
  if (base) {
    try {
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
  }

  // Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/menu_items?id=eq.${encodeURIComponent(dishId)}`, {
      method: 'DELETE',
      headers: await getSupabaseHeaders(),
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
  const base = getApiBaseUrl();
  if (base) {
    try {
      const res = await fetch(`${base}/api/rooms`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.rooms) && json.rooms.length > 0) {
          localStorage.setItem('hotel_rj_rooms_cache', JSON.stringify(json.rooms));
          return json.rooms;
        }
      }
    } catch {}
  }

  // 3. Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/rooms?select=*&order=id`, {
      headers: await getSupabaseHeaders(),
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
  const base = getApiBaseUrl();
  if (base) {
    try {
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
      headers: { ...(await getSupabaseHeaders()), Prefer: 'return=representation' },
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

export async function saveRoomApi(roomData: Partial<HotelRoomRecord> & { originalId?: string }): Promise<{ success: boolean; room?: HotelRoomRecord }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.saveRoom) {
    try {
      return await window.ElectronAPI.saveRoom(roomData);
    } catch (err: any) {
      return { success: false };
    }
  }

  // 2. HTTP Server API
  const base = getApiBaseUrl();
  if (base) {
    try {
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
  }

  // 3. Supabase Cloud API Fallback
  try {
    const id = roomData.id || `Room ${Date.now()}`;
    // If room was renamed, delete the old ID in Supabase
    if (roomData.originalId && roomData.originalId !== id) {
      fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/rooms?id=eq.${encodeURIComponent(roomData.originalId)}`, {
        method: 'DELETE',
        headers: await getSupabaseHeaders(),
      }).catch(() => {});
    }
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
      headers: { ...(await getSupabaseHeaders()), Prefer: 'resolution=merge-duplicates,return=representation' },
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
  const base = getApiBaseUrl();
  if (base) {
    try {
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
  }

  // 3. Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/rooms?id=eq.${encodeURIComponent(roomId)}`, {
      method: 'DELETE',
      headers: await getSupabaseHeaders(),
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
  const base = getApiBaseUrl();
  if (base) {
    try {
      const res = await fetch(`${base}/api/tables-config`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.tablesConfig) && json.tablesConfig.length > 0) {
          localStorage.setItem('hotel_rj_tables_config_cache', JSON.stringify(json.tablesConfig));
          return json.tablesConfig;
        }
      }
    } catch {}
  }

  // 3. Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/tables_config?select=*&order=sort_order`, {
      headers: await getSupabaseHeaders(),
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

export async function saveTableConfigApi(tableData: Partial<TableConfigItem> & { originalId?: string }): Promise<{ success: boolean; table?: TableConfigItem }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && window.ElectronAPI && window.ElectronAPI.saveTableConfig) {
    try {
      return await window.ElectronAPI.saveTableConfig(tableData);
    } catch (err: any) {
      return { success: false };
    }
  }

  // 2. HTTP Server API
  const base = getApiBaseUrl();
  if (base) {
    try {
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
  }

  // 3. Supabase Cloud API Fallback
  try {
    const id = tableData.id || `T-${Date.now()}`;
    // If table was renamed, delete the old ID in Supabase
    if (tableData.originalId && tableData.originalId !== id) {
      fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/tables_config?id=eq.${encodeURIComponent(tableData.originalId)}`, {
        method: 'DELETE',
        headers: await getSupabaseHeaders(),
      }).catch(() => {});
    }
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
      headers: { ...(await getSupabaseHeaders()), Prefer: 'resolution=merge-duplicates,return=representation' },
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
  const base = getApiBaseUrl();
  if (base) {
    try {
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
  }

  // 3. Supabase Cloud API Fallback
  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/tables_config?id=eq.${encodeURIComponent(tableId)}`, {
      method: 'DELETE',
      headers: await getSupabaseHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return { success: true };
  } catch (err) {
    console.warn('[HotelDataApi] Supabase deleteTableConfig error:', err);
  }

  return { success: false };
}
