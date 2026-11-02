import React, { useState, useEffect, useMemo } from 'react';
import { MENU_CATEGORIES } from '../data/menuData';
import { MenuItem, DietaryType } from '../types';
import {
  BluetoothPrinter,
  KOTPrintData,
  BillPrintData,
} from '../utils/thermalPrinter';
import {
  Search,
  Plus,
  Minus,
  Printer,
  FileText,
  Check,
  MessageCircle,
  X,
  Sparkles,
  User,
  Trash2,
  ChevronUp,
  BookOpen,
} from 'lucide-react';

interface WaiterItemRecord {
  item: MenuItem;
  quantity: number;
  notes?: string;
  firedCount: number; // How many were already printed in previous KOTs
}

interface TableOrder {
  tableId: string;
  serverName: string;
  openedAt: string;
  status: 'vacant' | 'active' | 'kot_sent' | 'billed';
  kotNumber: number;
  items: { [itemId: string]: WaiterItemRecord };
  generalNote?: string;
}

const ALL_TABLE_IDS = [
  // Dine-in tables
  'T-1',
  'T-2',
  'T-3',
  'T-4',
  'T-5',
  'T-6',
  'T-7',
  'T-8',
  'T-9',
  'T-10',
  'T-11',
  'T-12',
  // Hotel rooms
  'Room 101',
  'Room 102',
  'Room 103',
  'Room 201',
  'Room 202',
  'Room 203',
  'Room 204',
  'Room 301',
  'Room 302',
  'Room 305',
  // Parcel
  'Takeaway',
];

interface WaiterPOSProps {
  onSwitchToGuestMenu?: () => void;
}

export const WaiterPOS: React.FC<WaiterPOSProps> = ({ onSwitchToGuestMenu }) => {
  // Active selected table
  const [activeTable, setActiveTable] = useState<string>('T-1');
  const [tableFilter, setTableFilter] = useState<'all' | 'dinein' | 'rooms' | 'active'>('all');

  // Staff / Server Name
  const [serverName, setServerName] = useState<string>(() => {
    return localStorage.getItem('hotel_rj_server_name') || 'Server 1';
  });
  const [isEditingServer, setIsEditingServer] = useState(false);

  // Multi-Table State Store
  const [tables, setTables] = useState<{ [tableId: string]: TableOrder }>(() => {
    try {
      const saved = localStorage.getItem('hotel_rj_pos_tables_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Default initial empty tables
    const init: { [tableId: string]: TableOrder } = {};
    for (const t of ALL_TABLE_IDS) {
      init[t] = {
        tableId: t,
        serverName: 'Server 1',
        openedAt: '',
        status: 'vacant',
        kotNumber: 1,
        items: {},
      };
    }
    return init;
  });

  // Save tables state on every change
  useEffect(() => {
    try {
      localStorage.setItem('hotel_rj_pos_tables_v2', JSON.stringify(tables));
    } catch {}
  }, [tables]);

  // Current active table data
  const currentOrder: TableOrder = useMemo(() => {
    return (
      tables[activeTable] || {
        tableId: activeTable,
        serverName,
        openedAt: '',
        status: 'vacant',
        kotNumber: 1,
        items: {},
      }
    );
  }, [tables, activeTable, serverName]);

  // Search & Filter State for Menu
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDietary, setSelectedDietary] = useState<DietaryType | 'all'>('all');

  // UI Drawers & Modals
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [printerStatus, setPrinterStatus] = useState<string | null>(null);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);

  // Item customization modal
  const [customizingItem, setCustomizingItem] = useState<WaiterItemRecord | null>(null);

  // Check printer connection on mount
  useEffect(() => {
    setPrinterStatus(BluetoothPrinter.getConnectedDeviceName());
  }, []);

  // Haptic feedback helper
  const triggerHaptic = (ms = 35) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  };

  // Add / Increment Item on Active Table
  const handleAddItem = (item: MenuItem) => {
    triggerHaptic(30);
    setTables((prev) => {
      const existingTable = prev[activeTable] || {
        tableId: activeTable,
        serverName,
        openedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'active',
        kotNumber: 1,
        items: {},
      };

      const existingRecord = existingTable.items[item.id];
      const newQty = (existingRecord?.quantity || 0) + 1;

      return {
        ...prev,
        [activeTable]: {
          ...existingTable,
          status: 'active',
          openedAt: existingTable.openedAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          items: {
            ...existingTable.items,
            [item.id]: {
              item,
              quantity: newQty,
              notes: existingRecord?.notes || '',
              firedCount: existingRecord?.firedCount || 0,
            },
          },
        },
      };
    });
  };

  // Decrement / Remove Item
  const handleRemoveItem = (itemId: string) => {
    triggerHaptic(20);
    setTables((prev) => {
      const existingTable = prev[activeTable];
      if (!existingTable || !existingTable.items[itemId]) return prev;

      const record = existingTable.items[itemId];
      const newItems = { ...existingTable.items };

      if (record.quantity <= 1) {
        delete newItems[itemId];
      } else {
        newItems[itemId] = {
          ...record,
          quantity: record.quantity - 1,
        };
      }

      const hasRemaining = Object.keys(newItems).length > 0;

      return {
        ...prev,
        [activeTable]: {
          ...existingTable,
          status: hasRemaining ? existingTable.status : 'vacant',
          items: newItems,
        },
      };
    });
  };

  // Update notes on a specific dish
  const handleSaveItemNote = (itemId: string, noteText: string) => {
    setTables((prev) => {
      const table = prev[activeTable];
      if (!table || !table.items[itemId]) return prev;

      return {
        ...prev,
        [activeTable]: {
          ...table,
          items: {
            ...table.items,
            [itemId]: {
              ...table.items[itemId],
              notes: noteText,
            },
          },
        },
      };
    });
    setCustomizingItem(null);
  };

  // Calculations for current table
  const currentItemsList = useMemo(() => {
    return Object.values(currentOrder.items || {});
  }, [currentOrder]);

  const totalItemsCount = useMemo(() => {
    return currentItemsList.reduce((sum, ci) => sum + ci.quantity, 0);
  }, [currentItemsList]);

  const subtotalPrice = useMemo(() => {
    return currentItemsList.reduce((sum, ci) => {
      const p = typeof ci.item.price === 'number' ? ci.item.price : parseInt(String(ci.item.price).replace(/\D/g, ''), 10) || 0;
      return sum + p * ci.quantity;
    }, 0);
  }, [currentItemsList]);

  const gstAmount = Math.round(subtotalPrice * 0.05); // 5% GST
  const grandTotal = subtotalPrice + gstAmount;

  // Distinguish between New Items to Fire vs Already Fired to Kitchen
  const newItemsToFire = useMemo(() => {
    return currentItemsList
      .map((ci) => {
        const unfiredQty = ci.quantity - ci.firedCount;
        if (unfiredQty <= 0) return null;
        return {
          name: ci.item.name,
          quantity: unfiredQty,
          notes: ci.notes,
        };
      })
      .filter(Boolean) as { name: string; quantity: number; notes?: string }[];
  }, [currentItemsList]);

  const alreadyFiredItems = useMemo(() => {
    return currentItemsList
      .filter((ci) => ci.firedCount > 0)
      .map((ci) => ({
        name: ci.item.name,
        quantity: ci.firedCount,
        notes: ci.notes,
      }));
  }, [currentItemsList]);

  // Action: FIRE KOT TO KITCHEN
  const handleFireKOT = async () => {
    if (newItemsToFire.length === 0) return;
    triggerHaptic(60);

    const kotData: KOTPrintData = {
      tableNumber: activeTable,
      kotNumber: currentOrder.kotNumber,
      serverName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: newItemsToFire,
      orderNote: currentOrder.generalNote,
    };

    try {
      await BluetoothPrinter.printKOT(kotData);
      setPrintSuccessMsg(`KOT #${currentOrder.kotNumber} sent to Kitchen!`);
      setTimeout(() => setPrintSuccessMsg(null), 3000);

      // Lock newly fired items so they aren't printed twice next round
      setTables((prev) => {
        const table = prev[activeTable];
        if (!table) return prev;

        const updatedItems: { [id: string]: WaiterItemRecord } = {};
        for (const [id, rec] of Object.entries(table.items)) {
          updatedItems[id] = {
            ...rec,
            firedCount: rec.quantity, // all current quantity is now fired
          };
        }

        return {
          ...prev,
          [activeTable]: {
            ...table,
            status: 'kot_sent',
            kotNumber: table.kotNumber + 1,
            items: updatedItems,
          },
        };
      });
    } catch (err) {
      console.error('Failed to fire KOT:', err);
    }
  };

  // Action: PRINT FINAL BILL
  const handlePrintBill = async () => {
    if (currentItemsList.length === 0) return;
    triggerHaptic(50);

    const billData: BillPrintData = {
      tableNumber: activeTable,
      billNumber: `${activeTable.replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`,
      serverName,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
      items: currentItemsList.map((ci) => ({
        name: ci.item.name,
        quantity: ci.quantity,
        price: typeof ci.item.price === 'number' ? ci.item.price : parseInt(String(ci.item.price).replace(/\D/g, ''), 10) || 0,
      })),
      subtotal: subtotalPrice,
      gstRate: 5,
      grandTotal,
    };

    try {
      await BluetoothPrinter.printBill(billData);
      setPrintSuccessMsg(`Tax Invoice printed for ${activeTable}!`);
      setTimeout(() => setPrintSuccessMsg(null), 3000);

      setTables((prev) => ({
        ...prev,
        [activeTable]: {
          ...prev[activeTable],
          status: 'billed',
        },
      }));
    } catch (err) {
      console.error('Failed to print bill:', err);
    }
  };

  // Action: SETTLE & CLEAR TABLE
  const handleClearTable = () => {
    if (confirm(`Clear all items and mark ${activeTable} as Vacant?`)) {
      triggerHaptic(40);
      setTables((prev) => ({
        ...prev,
        [activeTable]: {
          tableId: activeTable,
          serverName,
          openedAt: '',
          status: 'vacant',
          kotNumber: 1,
          items: {},
          generalNote: '',
        },
      }));
      setIsOrderDrawerOpen(false);
    }
  };

  // Action: SHARE ON WHATSAPP
  const handleSendWhatsApp = () => {
    const itemsListStr = currentItemsList
      .map((ci) => {
        const p = typeof ci.item.price === 'number' ? ci.item.price : parseInt(String(ci.item.price).replace(/\D/g, ''), 10) || 0;
        return `• ${ci.quantity}x ${ci.item.name} - ₹${p * ci.quantity}${ci.notes ? ` (${ci.notes})` : ''}`;
      })
      .join('\n');

    const text = `*HOTEL RJ - TABLE ${activeTable}*\nServer: ${serverName}\nTime: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n--------------------\n${itemsListStr}\n--------------------\n*Subtotal:* ₹${subtotalPrice}\n*GST (5%):* ₹${gstAmount}\n*Total Bill:* ₹${grandTotal}\n_Where Comfort Meets Great Taste_`;

    window.open(`https://wa.me/917004865824?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Bluetooth Connect Action
  const handleConnectBluetooth = async () => {
    setIsConnectingPrinter(true);
    const res = await BluetoothPrinter.connect();
    setIsConnectingPrinter(false);
    if (res.success) {
      setPrinterStatus(res.deviceName || 'Thermal Printer');
    } else {
      alert(res.error || 'Bluetooth device selection cancelled');
    }
  };

  const handleTestPrint = async () => {
    const success = await BluetoothPrinter.printTestReceipt();
    if (success) {
      setPrintSuccessMsg('Test slip printed successfully!');
      setTimeout(() => setPrintSuccessMsg(null), 3000);
    }
  };

  // Filtered Menu Items for fast searching
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return MENU_CATEGORIES.map((cat) => {
      if (selectedCategory !== 'all' && cat.id !== selectedCategory) {
        return null;
      }

      const items = cat.items.filter((item) => {
        if (selectedDietary !== 'all') {
          if (item.dietary !== selectedDietary) return false;
        }

        if (query) {
          const matchName = item.name.toLowerCase().includes(query);
          const matchPrice = String(item.price).includes(query);
          // Acronym matching e.g. "pbm" for Paneer Butter Masala
          const acronym = item.name.split(/\s+/).map((w) => w[0]).join('').toLowerCase();
          const matchAcronym = acronym.includes(query);

          if (!matchName && !matchPrice && !matchAcronym) return false;
        }

        return true;
      });

      if (items.length === 0) return null;

      return {
        ...cat,
        items,
      };
    }).filter(Boolean) as typeof MENU_CATEGORIES;
  }, [selectedCategory, selectedDietary, searchQuery]);

  // Filtered Table IDs list
  const filteredTables = useMemo(() => {
    if (tableFilter === 'dinein') {
      return ALL_TABLE_IDS.filter((t) => t.startsWith('T-'));
    }
    if (tableFilter === 'rooms') {
      return ALL_TABLE_IDS.filter((t) => t.startsWith('Room'));
    }
    if (tableFilter === 'active') {
      return ALL_TABLE_IDS.filter((t) => {
        const order = tables[t];
        return order && Object.keys(order.items || {}).length > 0;
      });
    }
    return ALL_TABLE_IDS;
  }, [tableFilter, tables]);

  return (
    <div className="min-h-screen bg-[#08090d] text-sand-50 select-none pb-28 font-sans">
      {/* 1. TOP WAITER HEADER BAR */}
      <header className="sticky top-0 z-40 bg-[#0d0f16]/95 backdrop-blur-md border-b border-white/10 px-3 py-2.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Brand & Staff Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-gold-400/50 shadow-md">
              <img
                src="./icons/hotel-rj-emblem.png"
                alt="Hotel RJ"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-sm font-bold tracking-wider text-white">
                  HOTEL RJ
                </span>
                <span className="px-1.5 py-0.2 rounded bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider">
                  POS
                </span>
              </div>
              {/* Server Name Tag */}
              {isEditingServer ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    onBlur={() => {
                      setIsEditingServer(false);
                      localStorage.setItem('hotel_rj_server_name', serverName);
                    }}
                    autoFocus
                    className="text-[10px] bg-zinc-800 text-white px-1.5 py-0.5 rounded border border-gold-400 focus:outline-none w-24"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingServer(true)}
                  className="text-[10px] text-gold-400 flex items-center gap-1 hover:underline"
                  title="Tap to change server name"
                >
                  <User className="w-2.5 h-2.5" />
                  <span>{serverName} (Edit)</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Header Controls: Printer, Guest Menu, Status */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Bluetooth Printer Pill */}
            <button
              type="button"
              onClick={() => setIsPrinterModalOpen(true)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all active:scale-95 ${
                printerStatus
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-sand-400 hover:text-white'
              }`}
              title="Thermal Printer Connection"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden xs:inline">
                {printerStatus ? printerStatus.slice(0, 10) : 'Connect Printer'}
              </span>
            </button>

            {/* Optional Switch to Guest Menu Presentation */}
            {onSwitchToGuestMenu && (
              <button
                type="button"
                onClick={onSwitchToGuestMenu}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold flex items-center gap-1 border border-white/10 active:scale-95 transition-all"
                title="Show Photo Menu Card to Guests"
              >
                <BookOpen className="w-3.5 h-3.5 text-gold-400" />
                <span className="hidden sm:inline">Guest Menu</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. SUCCESS NOTICE BANNER */}
      {printSuccessMsg && (
        <div className="bg-emerald-500 text-black px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top duration-200">
          <Check className="w-4 h-4" />
          <span>{printSuccessMsg}</span>
        </div>
      )}

      {/* 3. MULTI-TABLE QUICK SWITCHER BAR */}
      <div className="bg-[#11131c] border-b border-white/10 px-3 py-2">
        <div className="max-w-7xl mx-auto space-y-2">
          {/* Table Type Filter Tabs */}
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase font-bold tracking-wider">
            <span className="text-sand-400">Select Table / Room:</span>
            <div className="flex items-center gap-1">
              {(['all', 'dinein', 'rooms', 'active'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTableFilter(mode)}
                  className={`px-2 py-0.5 rounded-full transition-colors ${
                    tableFilter === mode
                      ? 'bg-amber-400 text-black'
                      : 'text-sand-400 hover:text-white'
                  }`}
                >
                  {mode === 'all'
                    ? 'All'
                    : mode === 'dinein'
                    ? 'Dine-In'
                    : mode === 'rooms'
                    ? 'Rooms'
                    : 'Active'}
                </button>
              ))}
            </div>
          </div>

          {/* Horizontal Scrollable Table Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {filteredTables.map((tblId) => {
              const tblData = tables[tblId];
              const itemCount = tblData ? Object.values(tblData.items || {}).reduce((sum, it) => sum + it.quantity, 0) : 0;
              const isSelected = activeTable === tblId;
              const isKotSent = tblData?.status === 'kot_sent';

              return (
                <button
                  key={tblId}
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    setActiveTable(tblId);
                  }}
                  className={`relative px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border active:scale-95 ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black border-amber-300 shadow-md scale-105'
                      : itemCount > 0
                      ? isKotSent
                        ? 'bg-amber-950/60 text-amber-300 border-amber-500/50'
                        : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                      : 'bg-zinc-900/90 text-sand-300 border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Status Indicator Dot */}
                  <span
                    className={`w-2 h-2 rounded-full ${
                      itemCount === 0
                        ? 'bg-stone-600'
                        : isKotSent
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span>{tblId}</span>
                  {itemCount > 0 && (
                    <span
                      className={`text-[9.5px] px-1 py-0.2 rounded-full font-black ${
                        isSelected
                          ? 'bg-black text-amber-400'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      {itemCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. SEARCH & FAST CATEGORY TABS */}
      <div className="sticky top-[52px] z-30 bg-[#08090d]/95 backdrop-blur-md px-3 pt-2.5 pb-2 border-b border-white/5 shadow-md">
        <div className="max-w-7xl mx-auto space-y-2">
          {/* Quick Search with Acronym hint */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dish or shortcode (e.g. 'pbm', 'cb', 'naan')..."
              className="w-full bg-zinc-900/90 text-xs sm:text-sm text-white pl-9 pr-8 py-2 rounded-xl border border-white/10 focus:border-gold-400 focus:outline-none placeholder:text-sand-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-sand-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Pills & Veg/Non-Veg filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-gold-400 text-black'
                  : 'bg-zinc-900 text-sand-300 hover:text-white border border-white/10'
              }`}
            >
              All Items
            </button>
            {MENU_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-gold-400 text-black'
                    : 'bg-zinc-900 text-sand-300 hover:text-white border border-white/10'
                }`}
              >
                {cat.title}
              </button>
            ))}

            {/* Dietary Filter Buttons */}
            <div className="flex items-center gap-1 pl-2 border-l border-white/10 shrink-0">
              {(['all', 'veg', 'non-veg'] as const).map((diet) => (
                <button
                  key={diet}
                  type="button"
                  onClick={() => setSelectedDietary(diet)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-colors ${
                    selectedDietary === diet
                      ? diet === 'veg'
                        ? 'bg-emerald-600 text-white'
                        : diet === 'non-veg'
                        ? 'bg-rose-600 text-white'
                        : 'bg-white/20 text-white'
                      : 'text-sand-400 hover:text-white bg-zinc-900 border border-white/5'
                  }`}
                >
                  {diet === 'all' ? 'All Diet' : diet === 'veg' ? '🟢 Veg' : '🔴 Non-Veg'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. DISH PUNCHING GRID */}
      <main className="max-w-7xl mx-auto px-3 py-3">
        <div className="space-y-6">
          {filteredCategories.map((category) => (
            <div key={category.id} className="space-y-2">
              <h3 className="text-xs uppercase font-bold tracking-widest text-gold-400 flex items-center gap-1.5">
                <span>{category.title}</span>
                <span className="text-[10px] text-sand-500 font-normal font-mono">
                  ({category.items.length})
                </span>
              </h3>

              {/* Fast 2 to 3 column punch cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {category.items.map((dish) => {
                  const record = currentOrder.items[dish.id];
                  const inCartQty = record?.quantity || 0;
                  const priceNum = typeof dish.price === 'number' ? dish.price : parseInt(String(dish.price).replace(/\D/g, ''), 10) || 0;

                  return (
                    <div
                      key={dish.id}
                      className={`relative p-2.5 rounded-xl border transition-all flex flex-col justify-between select-none ${
                        inCartQty > 0
                          ? 'bg-[#181a24] border-amber-400 shadow-md ring-1 ring-amber-400/30'
                          : 'bg-zinc-900/60 border-white/5 hover:border-white/15'
                      }`}
                    >
                      {/* Top Row: Dietary dot & Price */}
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center p-0.5 shrink-0 ${
                            dish.dietary === 'veg'
                              ? 'border-emerald-600 bg-white'
                              : 'border-rose-600 bg-white'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              dish.dietary === 'veg' ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                        </span>

                        <span className="font-mono text-xs font-bold text-gold-300">
                          ₹{priceNum}
                        </span>
                      </div>

                      {/* Dish Name */}
                      <h4 className="text-xs font-semibold text-white leading-tight line-clamp-2 min-h-[32px]">
                        {dish.name}
                      </h4>

                      {/* Cooking Note Indicator if set */}
                      {record?.notes && (
                        <div className="text-[9px] text-amber-300 italic truncate mt-1">
                          Note: {record.notes}
                        </div>
                      )}

                      {/* Stepper Buttons for Fast Thumb Tapping */}
                      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between gap-1">
                        {inCartQty > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(dish.id)}
                              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-90 transition-transform"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setCustomizingItem(record)}
                              className="font-mono text-xs font-black text-amber-300 px-1 hover:underline"
                              title="Tap to add cooking note"
                            >
                              x{inCartQty}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAddItem(dish)}
                              className="w-8 h-8 rounded-lg bg-amber-400 text-black flex items-center justify-center active:scale-90 transition-transform shadow-sm"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddItem(dish)}
                            className="w-full py-1.5 px-2 rounded-lg bg-white/5 hover:bg-amber-400 hover:text-black text-sand-200 text-xs font-semibold flex items-center justify-center gap-1 border border-white/10 active:scale-95 transition-all"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 6. PERSISTENT FLOATING BOTTOM ACTION BAR */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0f17]/98 backdrop-blur-xl border-t border-amber-400/40 p-2.5 sm:p-3 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Active Table Summary */}
          <div
            onClick={() => setIsOrderDrawerOpen(true)}
            className="flex items-center gap-2 cursor-pointer min-w-0"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-black flex items-center justify-center font-black text-sm shrink-0 shadow-md">
              {totalItemsCount}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {activeTable}
                </span>
                <span className="text-[10px] text-sand-400">
                  ({totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'})
                </span>
              </div>
              <div className="font-mono text-xs font-bold text-amber-300">
                ₹{subtotalPrice}
                {newItemsToFire.length > 0 && (
                  <span className="ml-1.5 text-[9px] text-emerald-400 font-sans font-normal">
                    ({newItemsToFire.length} new to fire)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Quick Fire KOT Button (if there are new items) */}
            {newItemsToFire.length > 0 && (
              <button
                type="button"
                onClick={handleFireKOT}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                title="Print KOT and send new items to kitchen"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Fire KOT ({newItemsToFire.length})</span>
              </button>
            )}

            {/* View Full Order Sheet */}
            <button
              type="button"
              onClick={() => setIsOrderDrawerOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 active:scale-95 transition-all"
            >
              <span>Order</span>
              <ChevronUp className="w-3.5 h-3.5 text-sand-300" />
            </button>
          </div>
        </div>
      </footer>

      {/* 7. FULL ORDER DRAWER & KOT / BILLING SLIP MODAL */}
      {isOrderDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[92vh] bg-[#0e1017] text-white rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#131622]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold text-xs">
                  {activeTable}
                </div>
                <div>
                  <h3 className="font-serif text-sm font-bold text-white">
                    {activeTable} Order Summary
                  </h3>
                  <span className="text-[10px] text-sand-400">
                    Server: {serverName} • KOT #{currentOrder.kotNumber}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOrderDrawerOpen(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sand-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Two Wave Sections */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {currentItemsList.length === 0 ? (
                <div className="py-12 text-center text-sand-400">
                  <p className="text-sm font-medium">Table {activeTable} is empty.</p>
                  <p className="text-xs mt-1">Tap dishes on the menu to add items.</p>
                </div>
              ) : (
                <>
                  {/* Wave 1: NEW ITEMS TO FIRE */}
                  {newItemsToFire.length > 0 && (
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>New Items (Ready to Fire to Kitchen)</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400 text-black font-bold">
                          KOT #{currentOrder.kotNumber}
                        </span>
                      </div>

                      <div className="divide-y divide-white/5">
                        {currentItemsList
                          .filter((ci) => ci.quantity > ci.firedCount)
                          .map((ci) => {
                            const unfiredQty = ci.quantity - ci.firedCount;
                            const price = typeof ci.item.price === 'number' ? ci.item.price : parseInt(String(ci.item.price).replace(/\D/g, ''), 10) || 0;

                            return (
                              <div key={ci.item.id} className="py-2 flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-xs font-semibold text-white">
                                    {unfiredQty}x {ci.item.name}
                                  </div>
                                  {ci.notes && (
                                    <div className="text-[10px] text-amber-300 italic">
                                      * {ci.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-sand-300">
                                    ₹{price * unfiredQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(ci.item.id)}
                                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-rose-400"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <button
                        type="button"
                        onClick={handleFireKOT}
                        className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print & Fire KOT #{currentOrder.kotNumber}</span>
                      </button>
                    </div>
                  )}

                  {/* Wave 2: ALREADY COOKING IN KITCHEN */}
                  {alreadyFiredItems.length > 0 && (
                    <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Already Fired to Kitchen (Cooking)</span>
                      </span>

                      <div className="divide-y divide-white/5 text-xs text-sand-300">
                        {alreadyFiredItems.map((it, idx) => (
                          <div key={idx} className="py-1.5 flex items-center justify-between">
                            <span>
                              {it.quantity}x {it.name}
                            </span>
                            {it.notes && (
                              <span className="text-[10px] text-sand-500 italic">
                                ({it.notes})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bill Total Summary */}
                  <div className="p-3.5 rounded-2xl bg-[#131622] border border-white/10 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-sand-300">
                      <span>Subtotal ({totalItemsCount} items):</span>
                      <span className="font-mono">₹{subtotalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sand-300">
                      <span>GST (5%):</span>
                      <span className="font-mono">₹{gstAmount.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between font-bold text-sm">
                      <span className="text-white">Grand Total:</span>
                      <span className="font-mono text-amber-300 text-base">
                        ₹{grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer Actions */}
            {currentItemsList.length > 0 && (
              <div className="p-4 border-t border-white/10 bg-[#131622] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handlePrintBill}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Print Bill (Tax Invoice)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp Bill</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleClearTable}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Settle & Mark Vacant</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOrderDrawerOpen(false)}
                    className="text-[11px] text-sand-400 hover:text-white"
                  >
                    + Add More Dishes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. DISH CUSTOMIZATION / COOKING NOTE POPUP */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#131622] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-white">
                Cooking Note: {customizingItem.item.name}
              </h4>
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="p-1 text-sand-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick preset chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'Less Spicy',
                'Extra Spicy',
                'No Onion-Garlic (Jain)',
                'Extra Gravy',
                'Crispy',
                'Bring First (Starter)',
                'Pack / Parcel',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSaveItemNote(customizingItem.item.id, chip)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-gold-400 hover:text-black text-sand-300 border border-white/10 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Custom text */}
            <div className="pt-2">
              <input
                type="text"
                defaultValue={customizingItem.notes || ''}
                placeholder="Or type custom instructions..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveItemNote(customizingItem.item.id, (e.target as HTMLInputElement).value);
                  }
                }}
                className="w-full text-xs bg-zinc-900 text-white p-2.5 rounded-xl border border-white/10 focus:border-gold-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 9. BLUETOOTH PRINTER SCANNER MODAL */}
      {isPrinterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#11131c] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-gold-400" />
                <h3 className="font-bold text-sm text-white">Thermal Printer Setup</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPrinterModalOpen(false)}
                className="p-1 rounded-full text-sand-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Status */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-sand-400 tracking-wider">
                Printer Status:
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    printerStatus ? 'bg-emerald-400' : 'bg-rose-500'
                  }`}
                />
                <span className="text-xs font-semibold text-white">
                  {printerStatus ? `Connected to ${printerStatus}` : 'No printer paired'}
                </span>
              </div>
            </div>

            <p className="text-xs text-sand-400 leading-relaxed">
              Works with any 58mm or 80mm Bluetooth thermal printer. Tap below to pair once. No extra apps needed.
            </p>

            {/* Connect Button */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={isConnectingPrinter}
                onClick={handleConnectBluetooth}
                className="w-full py-2.5 rounded-xl bg-gold-400 hover:bg-gold-300 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {isConnectingPrinter ? 'Scanning Devices...' : 'Pair Bluetooth Printer'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleTestPrint}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
              >
                <span>Print Test Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
