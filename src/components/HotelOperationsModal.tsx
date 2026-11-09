import React, { useState, useEffect, useMemo } from 'react';
import { verifyManagerPin, formatLock } from '../utils/pin';
import { PairDeviceModal } from './PairDeviceModal';
import { ChangePinModal } from './pos/ChangePinModal';
import {
  X,
  Search,
  CheckCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  Lock,
  Unlock,
  KeyRound,
  Bed,
  Utensils,
  LayoutGrid,
  RefreshCw,
  Sliders,
  Check,
} from 'lucide-react';
import { MenuCategory, MenuItem, HotelRoomRecord, TableConfigItem, DietaryType } from '../types';
import {
  fetchMenuApi,
  toggleDishAvailabilityApi,
  saveDishApi,
  deleteDishApi,
  fetchRoomsApi,
  updateRoomStatusApi,
  saveRoomApi,
  deleteRoomApi,
  fetchTablesConfigApi,
  saveTableConfigApi,
  deleteTableConfigApi,
} from '../utils/hotelDataApi';
import { EditTableModal } from './ops/EditTableModal';
import { EditRoomModal } from './ops/EditRoomModal';
import { EditDishModal } from './ops/EditDishModal';

interface HotelOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const HotelOperationsModal: React.FC<HotelOperationsModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  // Tabs: 'dishes' | 'rooms' | 'tables'
  const [activeTab, setActiveTab] = useState<'dishes' | 'rooms' | 'tables'>('dishes');

  // Manager PIN Authorization State (Persists for the session)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('hotel_rj_owner_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isPairOpen, setIsPairOpen] = useState(false);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);

  // Data states
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Dishes state
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dishSearch, setDishSearch] = useState('');
  const [onlySoldOut, setOnlySoldOut] = useState(false);

  // Dish Edit/Create Modal state
  const [editingDish, setEditingDish] = useState<{
    id?: string;
    originalId?: string;
    categoryId?: string;
    name: string;
    hindiName?: string;
    price: number;
    dietary: DietaryType;
    isAvailable: boolean;
    popular: boolean;
    description?: string;
  } | null>(null);

  // Rooms state
  const [rooms, setRooms] = useState<HotelRoomRecord[]>([]);
  const [roomFilter, setRoomFilter] = useState<'all' | 'available' | 'occupied' | 'dirty' | 'maintenance'>('all');
  const [editingRoom, setEditingRoom] = useState<(HotelRoomRecord & { originalId?: string }) | null>(null);

  // Tables state
  const [tablesConfig, setTablesConfig] = useState<TableConfigItem[]>([]);
  const [tableSectionFilter, setTableSectionFilter] = useState<'all' | 'dining' | 'parcel' | 'lawn' | 'banquet'>('all');
  const [editingTable, setEditingTable] = useState<(Partial<TableConfigItem> & { originalId?: string }) | null>(null);

  // Load all data when modal opens
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [menu, rList, tList] = await Promise.all([
        fetchMenuApi(),
        fetchRoomsApi(),
        fetchTablesConfigApi(),
      ]);
      setMenuCategories(menu);
      setRooms(rList);
      setTablesConfig(tList);
    } catch (err) {
      console.warn('Failed to load hotel operations data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen]);

  const showNotification = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // PIN Unlock Verification
  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const result = await verifyManagerPin(pinInput);
    if (result.ok) {
      setIsUnlocked(true);
      sessionStorage.setItem('hotel_rj_owner_auth', 'true');
      setPinError(null);
      setPinInput('');
    } else {
      setPinError(
        result.reason === 'locked'
          ? `Too many attempts. Try again in ${formatLock(result.remainingMs || 0)}.`
          : 'Incorrect Manager PIN.'
      );
      setPinInput('');
    }
  };

  // -------------------------------------------------------------
  // Dishes Handlers
  // -------------------------------------------------------------
  const allDishes = useMemo(() => {
    const list: (MenuItem & { categoryTitle: string; categoryId: string })[] = [];
    for (const cat of menuCategories) {
      if (Array.isArray(cat.items)) {
        for (const item of cat.items) {
          list.push({
            ...item,
            categoryTitle: cat.title,
            categoryId: cat.id,
          });
        }
      }
    }
    return list;
  }, [menuCategories]);

  const filteredDishes = useMemo(() => {
    return allDishes.filter((dish) => {
      if (selectedCategory !== 'all' && dish.categoryId !== selectedCategory) return false;
      if (onlySoldOut && dish.isAvailable !== false) return false;
      if (dishSearch.trim()) {
        const query = dishSearch.toLowerCase();
        const matchesName = dish.name.toLowerCase().includes(query);
        const matchesHindi = dish.hindiName ? dish.hindiName.toLowerCase().includes(query) : false;
        if (!matchesName && !matchesHindi) return false;
      }
      return true;
    });
  }, [allDishes, selectedCategory, onlySoldOut, dishSearch]);

  const soldOutCount = useMemo(() => {
    return allDishes.filter((d) => d.isAvailable === false).length;
  }, [allDishes]);

  const handleToggleDish = async (dishId: string, currentAvailable: boolean | undefined) => {
    const nextStatus = currentAvailable === false ? true : false;
    // Optimistic UI update
    setMenuCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items.map((it) => (it.id === dishId ? { ...it, isAvailable: nextStatus } : it)),
      }))
    );

    const res = await toggleDishAvailabilityApi(dishId, nextStatus);
    if (res.success) {
      showNotification(`Dish is now ${nextStatus ? 'IN STOCK' : 'SOLD OUT [86]'}`);
      if (onDataChanged) onDataChanged();
    } else {
      // Revert if failed
      loadAllData();
    }
  };

  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish || !editingDish.name.trim()) return;

    setLoading(true);
    const res = await saveDishApi(editingDish);
    setLoading(false);

    if (res.success) {
      showNotification(`Dish "${editingDish.name}" saved successfully!`);
      setEditingDish(null);
      await loadAllData();
      if (onDataChanged) onDataChanged();
    } else {
      alert('Failed to save dish. Please try again.');
    }
  };

  const handleDeleteDish = async (dishId: string, dishName: string) => {
    if (!window.confirm(`Are you sure you want to completely remove "${dishName}" from the menu?`)) {
      return;
    }
    setLoading(true);
    const res = await deleteDishApi(dishId);
    setLoading(false);
    if (res.success) {
      showNotification(`Dish "${dishName}" deleted`);
      await loadAllData();
      if (onDataChanged) onDataChanged();
    }
  };

  // -------------------------------------------------------------
  // Rooms Handlers
  // -------------------------------------------------------------
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (roomFilter === 'all') return true;
      return r.status === roomFilter;
    });
  }, [rooms, roomFilter]);

  const handleRoomStatusChange = async (roomId: string, newStatus: string) => {
    // Optimistic update
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, status: newStatus as any } : r)));

    const res = await updateRoomStatusApi(roomId, newStatus);
    if (res.success) {
      showNotification(`Room ${roomId} marked as ${newStatus.toUpperCase()}`);
      if (onDataChanged) onDataChanged();
    } else {
      loadAllData();
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !editingRoom.id.trim()) return;

    setLoading(true);
    const res = await saveRoomApi(editingRoom);
    setLoading(false);

    if (res.success) {
      showNotification(`Room "${editingRoom.name || editingRoom.id}" saved!`);
      setEditingRoom(null);
      await loadAllData();
      if (onDataChanged) onDataChanged();
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm(`Delete ${roomId} from hotel database?`)) return;
    setLoading(true);
    const res = await deleteRoomApi(roomId);
    setLoading(false);
    if (res.success) {
      showNotification(`Room ${roomId} removed`);
      await loadAllData();
      if (onDataChanged) onDataChanged();
    } else {
      showNotification(`Failed to delete room ${roomId}`);
    }
  };

  // -------------------------------------------------------------
  // Tables Config Handlers
  // -------------------------------------------------------------
  const filteredTables = useMemo(() => {
    return tablesConfig.filter((t) => {
      if (tableSectionFilter === 'all') return true;
      return t.section === tableSectionFilter;
    });
  }, [tablesConfig, tableSectionFilter]);

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable || !editingTable.id?.trim()) return;

    setLoading(true);
    const res = await saveTableConfigApi(editingTable);
    setLoading(false);

    if (res.success) {
      showNotification(`Table "${editingTable.name || editingTable.id}" saved!`);
      setEditingTable(null);
      await loadAllData();
      if (onDataChanged) onDataChanged();
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!window.confirm(`Delete table slot "${tableId}"?`)) return;
    setLoading(true);
    const res = await deleteTableConfigApi(tableId);
    setLoading(false);
    if (res.success) {
      showNotification(`Table "${tableId}" removed`);
      await loadAllData();
      if (onDataChanged) onDataChanged();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Hotel RJ Operations & Inventory</h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live DB Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">Dishes (Kitchen 86 sold-out list), Housekeeping & Tables</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsChangePinOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
              title="Change Manager PIN"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Change PIN</span>
            </button>
            <button
              onClick={loadAllData}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Refresh from Database"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Notification Toast */}
        {actionSuccess && (
          <div className="bg-emerald-600/90 text-white text-xs px-4 py-2 font-medium flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{actionSuccess}</span>
            </div>
          </div>
        )}

        {/* PIN Authorization Screen if locked */}
        {!isUnlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/5">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Manager Authorization Required</h3>
            <p className="text-sm text-slate-400 max-w-sm mb-6">
              Enter the Manager PIN to manage dishes, sold-out items, rooms and tables.
            </p>

            <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-3">
              <input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="Enter PIN"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(null);
                }}
                className={`w-full text-center tracking-[0.5em] text-2xl font-mono py-3 px-4 rounded-xl bg-slate-800 border ${
                  pinError ? 'border-rose-500 text-rose-300' : 'border-slate-700 text-white'
                } focus:outline-none focus:border-amber-400`}
              />
              {pinError && <p className="text-xs text-rose-400 font-medium">{pinError}</p>}
              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                Unlock Operations
              </button>
              <button
                type="button"
                onClick={() => setIsChangePinOpen(true)}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1.5 mx-auto font-medium transition py-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Change Manager PIN</span>
              </button>
            </form>
            <ChangePinModal isOpen={isChangePinOpen} onClose={() => setIsChangePinOpen(false)} />
            <PairDeviceModal isOpen={isPairOpen} onClose={() => setIsPairOpen(false)} />
          </div>
        ) : (
          <>
            {/* Top Navigation Tabs */}
            <div className="flex items-center justify-between px-5 pt-3 border-b border-slate-800 bg-slate-900/50">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('dishes')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition border-b-2 ${
                    activeTab === 'dishes'
                      ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                  }`}
                >
                  <Utensils className="w-4 h-4" />
                  <span>Dishes & Sold Out</span>
                  {soldOutCount > 0 && (
                    <span className="text-xs px-1.5 py-0.2 bg-rose-500 text-white font-bold rounded-full">
                      {soldOutCount} 86'd
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('rooms')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition border-b-2 ${
                    activeTab === 'rooms'
                      ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                  }`}
                >
                  <Bed className="w-4 h-4" />
                  <span>Rooms & Housekeeping</span>
                  <span className="text-xs px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded-full">
                    {rooms.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('tables')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition border-b-2 ${
                    activeTab === 'tables'
                      ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Tables & Outlets</span>
                  <span className="text-xs px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded-full">
                    {tablesConfig.length}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2 pb-2">
                {activeTab === 'dishes' && (
                  <button
                    onClick={() =>
                      setEditingDish({
                        name: '',
                        hindiName: '',
                        price: 150,
                        dietary: 'veg',
                        categoryId: menuCategories[0]?.id || 'chef_specials',
                        isAvailable: true,
                        popular: false,
                        description: '',
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Dish
                  </button>
                )}
                {activeTab === 'rooms' && (
                  <button
                    onClick={() =>
                      setEditingRoom({
                        id: `Room ${rooms.length + 101}`,
                        name: `Room ${rooms.length + 101}`,
                        tier: 'deluxe',
                        pricePerNight: 1600,
                        status: 'available',
                        maxGuests: 2,
                        bedType: '1 King Bed',
                        originalId: '',
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add Room
                  </button>
                )}
                {activeTab === 'tables' && (
                  <button
                    onClick={() =>
                      setEditingTable({
                        id: `T-${tablesConfig.length + 1}`,
                        name: `Table ${tablesConfig.length + 1}`,
                        section: 'dining',
                        capacity: 4,
                        isActive: true,
                        sortOrder: tablesConfig.length + 1,
                        originalId: '',
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add Table / Slot
                  </button>
                )}
              </div>
            </div>

            {/* TAB 1: DISHES & KITCHEN 86 SOLD-OUT */}
            {activeTab === 'dishes' && (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-950/40">
                {/* Search & Filter Toolbar */}
                <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search 400+ dishes by name or Hindi..."
                        value={dishSearch}
                        onChange={(e) => setDishSearch(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                      />
                      {dishSearch && (
                        <button
                          onClick={() => setDishSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setOnlySoldOut(!onlySoldOut)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        onlySoldOut
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Sold Out Only ({soldOutCount})</span>
                    </button>
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition ${
                        selectedCategory === 'all'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      All ({allDishes.length})
                    </button>
                    {menuCategories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCategory(c.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition ${
                          selectedCategory === c.id
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {c.title} ({c.items?.length || 0})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dishes Table / Grid */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                  {filteredDishes.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                      <Utensils className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">No dishes match the selected filters.</p>
                    </div>
                  ) : (
                    filteredDishes.map((dish) => {
                      const isSoldOut = dish.isAvailable === false;
                      return (
                        <div
                          key={dish.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                            isSoldOut
                              ? 'bg-rose-950/20 border-rose-900/40 hover:bg-rose-950/30'
                              : 'bg-slate-900/70 border-slate-800 hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Dietary badge */}
                            <span
                              className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border shrink-0 ${
                                dish.dietary === 'veg'
                                  ? 'border-emerald-500'
                                  : dish.dietary === 'egg'
                                  ? 'border-amber-500'
                                  : 'border-rose-500'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  dish.dietary === 'veg'
                                    ? 'bg-emerald-500'
                                    : dish.dietary === 'egg'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                              />
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold truncate ${isSoldOut ? 'text-slate-300' : 'text-white'}`}>
                                  {dish.name}
                                </span>
                                {dish.hindiName && (
                                  <span className="text-xs text-slate-400 hidden sm:inline">
                                    ({dish.hindiName})
                                  </span>
                                )}
                                {isSoldOut && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-600 text-white tracking-wider animate-pulse">
                                    [SOLD OUT 86]
                                  </span>
                                )}
                                {dish.popular && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    ⭐ Best Seller
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                <span className="font-mono text-amber-400 font-bold">₹{dish.price}</span>
                                <span>•</span>
                                <span className="text-slate-500">{dish.categoryTitle}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {/* 1-Tap Toggle Sold Out / Available */}
                            <button
                              onClick={() => handleToggleDish(dish.id, dish.isAvailable)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                                isSoldOut
                                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                              title={isSoldOut ? 'Tap to mark In Stock' : 'Tap to 86 / Mark Sold Out'}
                            >
                              {isSoldOut ? (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>SOLD OUT</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>IN STOCK</span>
                                </>
                              )}
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() =>
                                setEditingDish({
                                  id: dish.id,
                                  originalId: dish.id,
                                  categoryId: dish.categoryId,
                                  name: dish.name,
                                  hindiName: dish.hindiName || '',
                                  price: Number(dish.price) || 0,
                                  dietary: dish.dietary || 'veg',
                                  isAvailable: dish.isAvailable !== false,
                                  popular: !!dish.popular,
                                  description: dish.description || '',
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                              title="Edit price & details"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteDish(dish.id, dish.name)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                              title="Delete dish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: ROOMS & HOUSEKEEPING */}
            {activeTab === 'rooms' && (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-950/40">
                {/* Status Filter Toolbar */}
                <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {(['all', 'available', 'occupied', 'dirty', 'maintenance'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setRoomFilter(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                          roomFilter === st
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {st === 'available' ? '🟢 Available' : st === 'occupied' ? '🔴 Occupied' : st === 'dirty' ? '🟡 Dirty' : st === 'maintenance' ? '🔧 Maintenance' : `All (${rooms.length})`}
                      </button>
                    ))}
                  </div>

                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Tap a status pill to update room housekeeping in 1 click
                  </span>
                </div>

                {/* Rooms Grid */}
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredRooms.map((room) => {
                    const statusColors = {
                      available: 'border-emerald-500/40 bg-emerald-950/10 text-emerald-400',
                      occupied: 'border-rose-500/40 bg-rose-950/10 text-rose-400',
                      dirty: 'border-amber-500/40 bg-amber-950/10 text-amber-400',
                      maintenance: 'border-slate-600 bg-slate-800/40 text-slate-400',
                    };

                    return (
                      <div
                        key={room.id}
                        className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                          statusColors[room.status] || 'border-slate-800 bg-slate-900/70'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-base text-white">{room.name}</h4>
                              <p className="text-xs text-slate-400 capitalize">
                                {room.tier} Tier • {room.bedType}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-base font-bold text-amber-400">
                                ₹{room.pricePerNight}
                              </span>
                              <span className="text-[10px] text-slate-400 block">/ night</span>
                            </div>
                          </div>

                          {room.guestName && (
                            <div className="mt-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
                              <span className="text-slate-400">Guest:</span>{' '}
                              <span className="font-semibold text-white">{room.guestName}</span>
                              {room.checkInDate && (
                                <span className="text-slate-400 block text-[10px] mt-0.5">
                                  Checked in: {room.checkInDate}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Housekeeping Status Quick Selector */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                            Status
                          </label>
                          <div className="grid grid-cols-4 gap-1">
                            {(['available', 'occupied', 'dirty', 'maintenance'] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => handleRoomStatusChange(room.id, st)}
                                className={`py-1 rounded text-[10px] font-bold uppercase transition ${
                                  room.status === st
                                    ? st === 'available'
                                      ? 'bg-emerald-600 text-white'
                                      : st === 'occupied'
                                      ? 'bg-rose-600 text-white'
                                      : st === 'dirty'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-slate-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                {st === 'available' ? 'Vacant' : st}
                              </button>
                            ))}
                          </div>

                          {/* Edit / Delete Footer */}
                          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-800 text-xs">
                            <button
                              onClick={() => setEditingRoom({ ...room, originalId: room.id })}
                              className="text-slate-400 hover:text-white flex items-center gap-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit Tariff
                            </button>
                            <button
                              onClick={() => handleDeleteRoom(room.id)}
                              className="text-slate-500 hover:text-rose-400 flex items-center gap-1 ml-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: TABLES & OUTLETS CONFIGURATION */}
            {activeTab === 'tables' && (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-950/40">
                {/* Section filter */}
                <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center gap-2">
                  {(['all', 'dining', 'parcel', 'lawn', 'banquet'] as const).map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setTableSectionFilter(sec)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                        tableSectionFilter === sec
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {sec === 'all' ? `All (${tablesConfig.length})` : sec}
                    </button>
                  ))}
                </div>

                {/* Tables Grid */}
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredTables.map((tbl) => (
                    <div
                      key={tbl.id}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-900/70 flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white">{tbl.id}</span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              tbl.isActive ? 'bg-emerald-500' : 'bg-slate-500'
                            }`}
                          />
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{tbl.name}</p>
                        <p className="text-[10px] text-slate-500 capitalize">
                          {tbl.section} • {tbl.capacity} Pax
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <button
                          onClick={() => setEditingTable({ ...tbl, originalId: tbl.id })}
                          className="p-1 text-slate-400 hover:text-white rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTable(tbl.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* MODAL: Edit or Add Dish */}
        {editingDish && (
          <EditDishModal
            editingDish={editingDish}
            setEditingDish={setEditingDish}
            handleSaveDish={handleSaveDish}
            menuCategories={menuCategories}
          />
        )}

        {/* MODAL: Edit or Add Room */}
        {editingRoom && (
          <EditRoomModal
            setEditingRoom={setEditingRoom}
            handleSaveRoom={handleSaveRoom}
            editingRoom={editingRoom}
          />
        )}

        {/* MODAL: Edit or Add Table */}
        {editingTable && (
          <EditTableModal
            setEditingTable={setEditingTable}
            handleSaveTable={handleSaveTable}
            editingTable={editingTable}
          />
        )}

        <ChangePinModal isOpen={isChangePinOpen} onClose={() => setIsChangePinOpen(false)} />
      </div>
    </div>
  );
};
