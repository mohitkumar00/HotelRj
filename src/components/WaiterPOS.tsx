import React, { useState, useEffect, useMemo } from 'react';
import { MENU_CATEGORIES } from '../data/menuData';
import { MenuItem, DietaryType } from '../types';
import {
  BluetoothPrinter,
  KOTPrintData,
  BillPrintData,
} from '../utils/thermalPrinter';
import { Logger, LogEntry } from '../utils/logger';
import { Capacitor } from '@capacitor/core';
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
  ShoppingBag,
  Edit3,
  Bug,
  Copy,
  RefreshCw,
} from 'lucide-react';

interface WaiterItemRecord {
  item: MenuItem;
  quantity: number;
  notes?: string;
  firedCount: number;
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
  // 1. Dine-in tables
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
  // 2. Takeaway / Parcel slots
  'Parcel 1',
  'Parcel 2',
  'Parcel 3',
  'Parcel 4',
  'Takeaway Counter',
  // 3. Hotel rooms
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
];

interface WaiterPOSProps {
  onSwitchToGuestMenu?: () => void;
}

export const WaiterPOS: React.FC<WaiterPOSProps> = ({ onSwitchToGuestMenu }) => {
  // Active selected table / parcel
  const [activeTable, setActiveTable] = useState<string>('T-1');
  const [tableFilter, setTableFilter] = useState<'all' | 'dinein' | 'takeaway' | 'rooms' | 'active'>('all');

  // Staff / Server Name
  const [serverName, setServerName] = useState<string>(() => {
    return localStorage.getItem('hotel_rj_server_name') || 'Server 1';
  });
  const [isEditingServer, setIsEditingServer] = useState(false);

  // Multi-Table State Store
  const [tables, setTables] = useState<{ [tableId: string]: TableOrder }>(() => {
    try {
      const saved = localStorage.getItem('hotel_rj_pos_tables_v3');
      if (saved) return JSON.parse(saved);
    } catch {}
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
      localStorage.setItem('hotel_rj_pos_tables_v3', JSON.stringify(tables));
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

  const isTakeawayActive = useMemo(() => {
    return activeTable.toLowerCase().includes('parcel') || activeTable.toLowerCase().includes('takeaway');
  }, [activeTable]);

  // Search & Filter State for Menu
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDietary, setSelectedDietary] = useState<DietaryType | 'all'>('all');

  // UI Drawers & Modals
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);

  // Optional 5% GST Selection on Billing
  const [applyGst, setApplyGst] = useState<boolean>(true);

  // Live Debug Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Paired Bluetooth Printers (via Android Native Bridge)
  const [pairedPrinters, setPairedPrinters] = useState<Array<{ name: string; address: string }>>([]);
  const [selectedPrinterAddress, setSelectedPrinterAddress] = useState<string>(() => {
    return localStorage.getItem('hotel_rj_printer_address') || '';
  });

  // Subscribe to live logger
  useEffect(() => {
    const unsubscribe = Logger.subscribe((newLogs) => setLogs(newLogs));
    const isNative = Capacitor.isNativePlatform();
    const hasBridge = BluetoothPrinter.isNativeAndroidAvailable();
    Logger.info('App', `WaiterPOS loaded on ${isNative ? 'Android Native APK' : 'Browser'}. Native Bridge: ${hasBridge ? 'ONLINE' : 'OFFLINE'}`);
    return () => unsubscribe();
  }, []);

  const refreshPairedDevices = () => {
    const list = BluetoothPrinter.getPairedDevices();
    setPairedPrinters(list);
    Logger.info('Printer', `Found ${list.length} paired Bluetooth devices`);
  };

  useEffect(() => {
    if (isPrinterModalOpen) {
      refreshPairedDevices();
    }
  }, [isPrinterModalOpen]);

  const handleSelectPrinter = (dev: { name: string; address: string }) => {
    setSelectedPrinterAddress(dev.address);
    localStorage.setItem('hotel_rj_printer_address', dev.address);
    localStorage.setItem('hotel_rj_printer_name', dev.name);
    Logger.success('Printer', `Selected printer: ${dev.name} (${dev.address})`);
    setPrintSuccessMsg(`Selected: ${dev.name}`);
    setTimeout(() => setPrintSuccessMsg(null), 2500);
  };

  // Item customization modal
  const [customizingItem, setCustomizingItem] = useState<{ id: string; name: string; notes?: string } | null>(null);
  const [customNoteText, setCustomNoteText] = useState<string>('');

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

  // Open note editor for item
  const openNoteEditor = (itemId: string, itemName: string, currentNotes?: string) => {
    setCustomizingItem({ id: itemId, name: itemName, notes: currentNotes || '' });
    setCustomNoteText(currentNotes || '');
  };

  // Save cooking note on a specific dish
  const handleSaveItemNote = (noteText: string) => {
    if (!customizingItem) return;
    const itemId = customizingItem.id;

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

  // GST is optional based on waiter's choice (5% or 0%)
  const gstAmount = applyGst ? Math.round(subtotalPrice * 0.05) : 0;
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
    Logger.info('KOT', `handleFireKOT tapped for table: ${activeTable}`);
    if (newItemsToFire.length === 0) {
      if (currentItemsList.length === 0) {
        setPrintSuccessMsg('⚠️ Cart is empty! Add dishes first.');
        setTimeout(() => setPrintSuccessMsg(null), 3000);
        Logger.warn('KOT', `No dishes in cart for table ${activeTable}`);
      } else {
        setPrintSuccessMsg('ℹ️ All dishes are already cooking in the kitchen!');
        setTimeout(() => setPrintSuccessMsg(null), 3000);
        Logger.info('KOT', `All dishes on table ${activeTable} were already fired`);
      }
      return;
    }
    triggerHaptic(60);

    const kotData: KOTPrintData = {
      tableNumber: activeTable,
      kotNumber: currentOrder.kotNumber,
      serverName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: newItemsToFire,
      orderNote: currentOrder.generalNote,
      isTakeaway: isTakeawayActive,
    };

    setPrintSuccessMsg(`Sending KOT #${currentOrder.kotNumber} to printer...`);

    try {
      const res = await BluetoothPrinter.printKOT(kotData);
      setPrintSuccessMsg(`✅ KOT #${currentOrder.kotNumber} sent to Kitchen (${res.method})!`);
      setTimeout(() => setPrintSuccessMsg(null), 4000);
      Logger.success('KOT', `KOT #${currentOrder.kotNumber} fired successfully via ${res.method}`);

      // Lock newly fired items so they aren't printed twice next round
      setTables((prev) => {
        const table = prev[activeTable];
        if (!table) return prev;

        const updatedItems: { [id: string]: WaiterItemRecord } = {};
        for (const [id, rec] of Object.entries(table.items)) {
          updatedItems[id] = {
            ...rec,
            firedCount: rec.quantity,
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
    } catch (err: any) {
      Logger.error('KOT', `Failed to fire KOT: ${err?.message || err}`);
      setPrintSuccessMsg(`❌ Print failed: ${err?.message || 'Check Logs'}`);
      setTimeout(() => setPrintSuccessMsg(null), 4000);
    }
  };

  // Action: PRINT FINAL BILL
  const handlePrintBill = async () => {
    Logger.info('Bill', `handlePrintBill tapped for table: ${activeTable}`);
    if (currentItemsList.length === 0) {
      setPrintSuccessMsg('⚠️ Cannot print bill for an empty table!');
      setTimeout(() => setPrintSuccessMsg(null), 3000);
      Logger.warn('Bill', `Table ${activeTable} is empty`);
      return;
    }
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
        notes: ci.notes,
      })),
      subtotal: subtotalPrice,
      gstRate: applyGst ? 5 : 0,
      grandTotal,
      isTakeaway: isTakeawayActive,
    };

    setPrintSuccessMsg('Sending bill to printer...');

    try {
      const res = await BluetoothPrinter.printBill(billData);
      setPrintSuccessMsg(`✅ ${applyGst ? 'Tax Invoice' : 'Retail Bill'} printed (${res.method})!`);
      setTimeout(() => setPrintSuccessMsg(null), 4000);
      Logger.success('Bill', `Bill for ${activeTable} printed via ${res.method} (GST: ${applyGst ? '5%' : '0%'})`);

      setTables((prev) => ({
        ...prev,
        [activeTable]: {
          ...prev[activeTable],
          status: 'billed',
        },
      }));
    } catch (err: any) {
      Logger.error('Bill', `Failed to print bill: ${err?.message || err}`);
      setPrintSuccessMsg(`❌ Bill print failed: ${err?.message || 'Check Logs'}`);
      setTimeout(() => setPrintSuccessMsg(null), 4000);
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

  // Action: SEND VIA WHATSAPP (Kitchen or Guest)
  const handleSendWhatsApp = () => {
    const itemsListStr = currentItemsList
      .map((ci) => {
        const p = typeof ci.item.price === 'number' ? ci.item.price : parseInt(String(ci.item.price).replace(/\D/g, ''), 10) || 0;
        return `• ${ci.quantity}x ${ci.item.name} - ₹${p * ci.quantity}${ci.notes ? ` [${ci.notes}]` : ''}`;
      })
      .join('\n');

    const takeawayHeader = isTakeawayActive ? '\n*** TAKEAWAY / PARCEL ORDER ***\n' : '\n';
    const gstLine = applyGst ? `*GST (5%):* ₹${gstAmount}\n` : '';

    const text = `*HOTEL RJ - ${activeTable.toUpperCase()}*${takeawayHeader}GSTIN: 20BGPPJ2962J1ZA\nServer: ${serverName}\nTime: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n--------------------\n${itemsListStr}\n--------------------\n*Subtotal:* ₹${subtotalPrice}\n${gstLine}*Total Bill:* ₹${grandTotal}\n_Where Comfort Meets Great Taste_`;

    window.open(`https://wa.me/917004865824?text=${encodeURIComponent(text)}`, '_blank');
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
    if (tableFilter === 'takeaway') {
      return ALL_TABLE_IDS.filter((t) => t.toLowerCase().includes('parcel') || t.toLowerCase().includes('takeaway'));
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

          {/* Right Header Controls: Printer Setup */}
          <div className="flex items-center gap-1.5">
            {/* Active Table indicator pill */}
            <div className="px-2.5 py-1 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-bold">
              {activeTable}
            </div>

            {/* Thermal Printer Button */}
            <button
              type="button"
              onClick={() => setIsPrinterModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 active:scale-95 transition-all"
              title="Thermal Printer & Printing Setup"
            >
              <Printer className="w-3.5 h-3.5 text-gold-400" />
              <span className="text-[10px] hidden xs:inline">Printer</span>
            </button>

            {/* Live Debug Logs Button */}
            <button
              type="button"
              onClick={() => setIsLogsModalOpen(true)}
              className="px-2 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1 border border-white/10 active:scale-95 transition-all"
              title="Live Debug Console & System Logs"
            >
              <Bug className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] hidden xs:inline">Logs</span>
              {logs.length > 0 && (
                <span className="px-1 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[9px] font-mono">
                  {logs.length}
                </span>
              )}
            </button>

            {/* Browser preview exit (hidden on Android native APK) */}
            {!Capacitor.isNativePlatform() && onSwitchToGuestMenu && (
              <button
                type="button"
                onClick={onSwitchToGuestMenu}
                className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium border border-white/10"
                title="Exit POS mode back to guest menu (browser only)"
              >
                Exit POS
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

      {/* 3. MULTI-TABLE & TAKEAWAY QUICK SWITCHER */}
      <div className="bg-[#11131c] border-b border-white/10 px-3 py-2">
        <div className="max-w-7xl mx-auto space-y-2">
          {/* Table Type Filter Tabs */}
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase font-bold tracking-wider">
            <span className="text-sand-400">Order For:</span>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'dinein', label: '🍽️ Dine-In' },
                  { id: 'takeaway', label: '🛍️ Takeaway' },
                  { id: 'rooms', label: '🏨 Rooms' },
                  { id: 'active', label: '🟢 Active' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTableFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                    tableFilter === tab.id
                      ? 'bg-amber-400 text-black font-black'
                      : 'text-sand-300 hover:text-white bg-zinc-900 border border-white/5'
                  }`}
                >
                  {tab.label}
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
              const isParcel = tblId.toLowerCase().includes('parcel') || tblId.toLowerCase().includes('takeaway');

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
                      : isParcel
                      ? 'bg-purple-950/40 text-purple-200 border-purple-500/30 hover:border-purple-400/50'
                      : 'bg-zinc-900/90 text-sand-300 border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Status Indicator Dot / Icon */}
                  {isParcel ? (
                    <ShoppingBag className="w-3 h-3 text-purple-300" />
                  ) : (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        itemCount === 0
                          ? 'bg-stone-600'
                          : isKotSent
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-emerald-400'
                      }`}
                    />
                  )}
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

      {/* 4. TAKEAWAY NOTICE BANNER (when parcel selected) */}
      {isTakeawayActive && (
        <div className="bg-purple-900/40 border-b border-purple-500/30 px-3 py-1.5 text-center text-xs text-purple-200 font-semibold flex items-center justify-center gap-2">
          <ShoppingBag className="w-3.5 h-3.5 text-purple-300" />
          <span>Takeaway / Parcel Active — Food will be packed for takeaway</span>
        </div>
      )}

      {/* 5. SEARCH & FAST CATEGORY TABS */}
      <div className="sticky top-[52px] z-30 bg-[#08090d]/95 backdrop-blur-md px-3 pt-2.5 pb-2 border-b border-white/5 shadow-md">
        <div className="max-w-7xl mx-auto space-y-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes or shortcodes ('pbm', 'cb', 'naan', 'dal')..."
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
                  {diet === 'all' ? 'All' : diet === 'veg' ? '🟢 Veg' : '🔴 Non-Veg'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 6. DISH PUNCHING GRID WITH CLEAR FOOD PHOTOS */}
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

              {/* 2 to 3 column cards with food photos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {category.items.map((dish) => {
                  const record = currentOrder.items[dish.id];
                  const inCartQty = record?.quantity || 0;
                  const priceNum = typeof dish.price === 'number' ? dish.price : parseInt(String(dish.price).replace(/\D/g, ''), 10) || 0;

                  return (
                    <div
                      key={dish.id}
                      className={`relative p-2 rounded-2xl border transition-all flex flex-col justify-between select-none overflow-hidden ${
                        inCartQty > 0
                          ? 'bg-[#181a24] border-amber-400 shadow-lg ring-1 ring-amber-400/40'
                          : 'bg-zinc-900/80 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Dish Thumbnail Image */}
                      <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden mb-2 bg-zinc-950 shrink-0">
                        <img
                          src={dish.image || './images/food/hero-veg-starters.jpg'}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = './images/food/hero-veg-starters.jpg';
                          }}
                        />

                        {/* Overlay Dietary Dot */}
                        <span
                          className={`absolute top-1.5 left-1.5 w-4 h-4 rounded border flex items-center justify-center p-0.5 shadow-md ${
                            dish.dietary === 'veg'
                              ? 'border-emerald-600 bg-white'
                              : 'border-rose-600 bg-white'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              dish.dietary === 'veg' ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                        </span>

                        {/* Price Badge */}
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-xs font-mono text-xs font-bold text-amber-300 shadow">
                          ₹{priceNum}
                        </span>

                        {/* Active Quantity Badge Overlay */}
                        {inCartQty > 0 && (
                          <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-amber-400 text-black text-xs font-black shadow-md">
                            x{inCartQty}
                          </span>
                        )}
                      </div>

                      {/* Dish Name */}
                      <h4 className="text-xs font-semibold text-white leading-tight line-clamp-2 min-h-[30px] px-1">
                        {dish.name}
                      </h4>

                      {/* Cooking Note Button / Display */}
                      {inCartQty > 0 ? (
                        <button
                          type="button"
                          onClick={() => openNoteEditor(dish.id, dish.name, record?.notes)}
                          className="mt-1.5 w-full py-1 px-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-[10px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all truncate"
                          title="Tap to add cooking note"
                        >
                          <Edit3 className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">
                            {record?.notes ? record.notes : '+ Cooking Note'}
                          </span>
                        </button>
                      ) : null}

                      {/* Stepper Buttons */}
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between gap-1">
                        {inCartQty > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(dish.id)}
                              className="w-9 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-90 transition-transform"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <span className="font-mono text-xs font-black text-white px-1">
                              {inCartQty}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleAddItem(dish)}
                              className="w-9 h-8 rounded-lg bg-amber-400 text-black flex items-center justify-center active:scale-90 transition-transform shadow-sm"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddItem(dish)}
                            className="w-full py-1.5 px-2 rounded-xl bg-white/10 hover:bg-amber-400 hover:text-black text-white text-xs font-semibold flex items-center justify-center gap-1 border border-white/10 active:scale-95 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
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

      {/* 7. PERSISTENT FLOATING BOTTOM ACTION BAR */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0f17]/98 backdrop-blur-xl border-t border-amber-400/40 p-2.5 sm:p-3 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Active Table Summary */}
          <div
            onClick={() => setIsOrderDrawerOpen(true)}
            className="flex items-center gap-2.5 cursor-pointer min-w-0"
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
                  ({totalItemsCount} items)
                </span>
              </div>
              <div className="font-mono text-xs font-bold text-amber-300">
                ₹{subtotalPrice}
                {newItemsToFire.length > 0 && (
                  <span className="ml-1.5 text-[9.5px] text-emerald-400 font-sans font-normal">
                    ({newItemsToFire.length} ready to fire)
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

      {/* 8. ORDER DRAWER & KOT / BILLING SLIP MODAL */}
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
                    {activeTable} Order Sheet
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

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {currentItemsList.length === 0 ? (
                <div className="py-12 text-center text-sand-400">
                  <p className="text-sm font-medium">{activeTable} is empty.</p>
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
                          <span>New Items to Cook</span>
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
                              <div key={ci.item.id} className="py-2.5 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-white">
                                    {unfiredQty}x {ci.item.name}
                                  </div>
                                  {/* Note Button */}
                                  <button
                                    type="button"
                                    onClick={() => openNoteEditor(ci.item.id, ci.item.name, ci.notes)}
                                    className="text-[10px] text-amber-300 italic hover:underline flex items-center gap-1 mt-0.5"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                    <span>{ci.notes ? ci.notes : '+ Add note (Spicy / Jain...)'}</span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
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
                        <span>Already Cooking in Kitchen</span>
                      </span>

                      <div className="divide-y divide-white/5 text-xs text-sand-300">
                        {alreadyFiredItems.map((it, idx) => (
                          <div key={idx} className="py-1.5 flex items-center justify-between">
                            <span>
                              {it.quantity}x {it.name}
                            </span>
                            {it.notes && (
                              <span className="text-[10px] text-amber-300 italic">
                                [{it.notes}]
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tax / GST Selection Radio Option */}
                  <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sand-400">
                        Tax Option (GST):
                      </span>
                      <span className="text-[9.5px] font-mono text-sand-500">
                        GSTIN: 20BGPPJ2962J1ZA
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label
                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                          applyGst
                            ? 'bg-amber-400/15 border-amber-400 text-white font-bold'
                            : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name="gstOptionRadio"
                          checked={applyGst}
                          onChange={() => setApplyGst(true)}
                          className="accent-amber-400 w-3.5 h-3.5"
                        />
                        <span>With 5% GST</span>
                      </label>

                      <label
                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                          !applyGst
                            ? 'bg-amber-400/15 border-amber-400 text-white font-bold'
                            : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name="gstOptionRadio"
                          checked={!applyGst}
                          onChange={() => setApplyGst(false)}
                          className="accent-amber-400 w-3.5 h-3.5"
                        />
                        <span>Without GST (0%)</span>
                      </label>
                    </div>
                  </div>

                  {/* Bill Total Summary */}
                  <div className="p-3.5 rounded-2xl bg-[#131622] border border-white/10 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-sand-300">
                      <span>Subtotal ({totalItemsCount} items):</span>
                      <span className="font-mono">₹{subtotalPrice.toFixed(2)}</span>
                    </div>
                    {applyGst ? (
                      <div className="flex items-center justify-between text-sand-300">
                        <span>GST (5%):</span>
                        <span className="font-mono text-amber-300">₹{gstAmount.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sand-400 text-[11px]">
                        <span>GST (0%):</span>
                        <span className="font-mono text-emerald-400">Not Added (₹0.00)</span>
                      </div>
                    )}
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
                    <span>Print Bill</span>
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

      {/* 9. COOKING NOTES & INSTRUCTIONS POPUP (LESS SPICY, JAIN, ETC.) */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#131622] border border-amber-400/40 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Cooking Note / Request
                </span>
                <h4 className="font-bold text-sm text-white">
                  {customizingItem.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="p-1 rounded-full text-sand-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick 1-Tap Cooking Chips */}
            <div>
              <label className="text-[10px] uppercase font-bold text-sand-400 tracking-wider block mb-2">
                Tap Quick Instructions:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '🌶️ Less Spicy',
                  '🔥 Extra Spicy',
                  '🥬 No Onion-Garlic (Jain)',
                  '🧈 Extra Butter',
                  '🥣 Extra Gravy',
                  '🍟 Extra Crispy',
                  '⏱️ Bring First (Starter)',
                  '📦 Pack / Parcel',
                  '🧂 Low Salt',
                  '🚫 No Coriander',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setCustomNoteText((prev) => {
                        const cleanChip = chip.replace(/^[^\w\s]+/, '').trim();
                        if (prev.includes(cleanChip)) return prev;
                        return prev ? `${prev}, ${cleanChip}` : cleanChip;
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs bg-white/10 hover:bg-amber-400 hover:text-black text-sand-200 border border-white/10 active:scale-95 transition-all font-medium"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom instruction textarea */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-sand-400 tracking-wider block">
                Instruction Text:
              </label>
              <input
                type="text"
                value={customNoteText}
                onChange={(e) => setCustomNoteText(e.target.value)}
                placeholder="e.g. Less spicy, make gravy thick..."
                className="w-full text-xs bg-zinc-900 text-white p-2.5 rounded-xl border border-white/15 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleSaveItemNote(customNoteText.trim())}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
              >
                Save Note
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomNoteText('');
                  handleSaveItemNote('');
                }}
                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-rose-400 text-xs font-semibold"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. THERMAL PRINTER INSTRUCTIONS & SETUP MODAL */}
      {isPrinterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#11131c] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
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

            {/* Native Bridge Status */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-sand-400">Android Print Engine:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${BluetoothPrinter.isNativeAndroidAvailable() ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {BluetoothPrinter.isNativeAndroidAvailable() ? '● Native Bridge Active' : '● Browser Mode'}
                </span>
              </div>

              {/* Paired Bluetooth Printers List */}
              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    <span>Paired Bluetooth Printers:</span>
                  </span>
                  <button
                    type="button"
                    onClick={refreshPairedDevices}
                    className="p-1 rounded text-sand-400 hover:text-white flex items-center gap-1 text-[10px]"
                    title="Refresh paired devices"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Scan</span>
                  </button>
                </div>

                {pairedPrinters.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {pairedPrinters.map((dev) => {
                      const isSelected = selectedPrinterAddress === dev.address;
                      return (
                        <button
                          key={dev.address}
                          type="button"
                          onClick={() => handleSelectPrinter(dev)}
                          className={`w-full p-2 rounded-xl text-left text-xs border transition-all flex items-center justify-between ${isSelected ? 'bg-amber-400/20 border-amber-400 text-white font-bold' : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'}`}
                        >
                          <div>
                            <div className="font-medium">{dev.name}</div>
                            <div className="text-[9px] font-mono text-sand-400">{dev.address}</div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-sand-400 bg-white/5 p-2 rounded-xl">
                    No Bluetooth printers paired in Android Settings yet. Pair your printer once in phone settings.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Guide */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 text-[11px] text-sand-300 space-y-1.5">
              <div className="font-bold text-white">📱 Pairing Steps:</div>
              <ol className="list-decimal pl-4 space-y-1 text-sand-400">
                <li>Turn ON your 58mm Bluetooth printer.</li>
                <li>Go to phone's <strong>Android Bluetooth Settings</strong>.</li>
                <li>Pair with printer (PIN is <code>0000</code> or <code>1234</code>).</li>
                <li>Return here & tap <strong>Print Test Slip</strong>.</li>
              </ol>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic(40);
                  setPrintSuccessMsg('Printing test slip...');
                  try {
                    const res = await BluetoothPrinter.printTestReceipt();
                    setPrintSuccessMsg(`✅ Test slip sent (${res.method})!`);
                    setTimeout(() => setPrintSuccessMsg(null), 4000);
                  } catch (err: any) {
                    setPrintSuccessMsg(`❌ Test failed: ${err?.message}`);
                    setTimeout(() => setPrintSuccessMsg(null), 4000);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-gold-400 hover:bg-gold-300 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Test Slip (58mm)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPrinterModalOpen(false);
                  setIsLogsModalOpen(true);
                }}
                className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sand-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
              >
                <Bug className="w-4 h-4 text-amber-400" />
                <span>View Live Debug Logs ({logs.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. LIVE DEBUG CONSOLE & SYSTEM LOGS MODAL */}
      {isLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-4">
          <div className="w-full max-w-lg bg-[#0e1017] border border-amber-400/30 rounded-3xl p-4 shadow-2xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Live Debug Console</h3>
                  <p className="text-[10px] text-sand-400">Real-time logs for KOT, printer & errors</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLogsModalOpen(false)}
                className="p-1 rounded-full text-sand-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diagnostic Badges */}
            <div className="grid grid-cols-2 gap-2 my-3 text-[10px]">
              <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
                <span className="text-sand-400 block">Platform:</span>
                <span className="font-bold text-white">{Capacitor.isNativePlatform() ? 'Native Android APK' : 'Web Browser'}</span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
                <span className="text-sand-400 block">Native Bridge:</span>
                <span className={`font-bold ${BluetoothPrinter.isNativeAndroidAvailable() ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {BluetoothPrinter.isNativeAndroidAvailable() ? 'Active (AndroidPrinter)' : 'Web Mode'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
                <span className="text-sand-400 block">Active Table:</span>
                <span className="font-bold text-white">{activeTable} ({totalItemsCount} items, {newItemsToFire.length} unfired)</span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
                <span className="text-sand-400 block">Target Printer:</span>
                <span className="font-bold text-white truncate block">{localStorage.getItem('hotel_rj_printer_name') || 'Auto / Android Spooler'}</span>
              </div>
            </div>

            {/* Logs List Container */}
            <div className="flex-1 overflow-y-auto bg-black/60 rounded-2xl p-2.5 border border-white/10 font-mono text-[10px] space-y-1.5 max-h-[46vh]">
              {logs.length === 0 ? (
                <div className="text-center text-sand-500 py-6">No logs recorded yet.</div>
              ) : (
                logs.map((l) => {
                  let badgeColor = 'text-sand-300';
                  if (l.level === 'error') badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
                  else if (l.level === 'warn') badgeColor = 'text-amber-300 bg-amber-500/10 border-amber-500/30';
                  else if (l.level === 'success') badgeColor = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
                  else badgeColor = 'text-blue-300 bg-blue-500/10 border-blue-500/30';

                  return (
                    <div key={l.id} className="p-1.5 rounded-lg bg-zinc-900/60 border border-white/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[9px]">
                        <span className="text-sand-500">{l.timestamp}</span>
                        <span className={`px-1 py-0.2 rounded border uppercase font-bold text-[8px] ${badgeColor}`}>
                          {l.level}
                        </span>
                        <span className="text-sand-400 font-sans font-semibold">[{l.category}]</span>
                      </div>
                      <div className="text-sand-200 text-[10.5px] break-words">{l.message}</div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-white/10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = logs
                    .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}`)
                    .join('\n');
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(text);
                    setPrintSuccessMsg('✅ Logs copied to clipboard!');
                    setTimeout(() => setPrintSuccessMsg(null), 2500);
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const text = `*HOTEL RJ POS LOGS*\nDate: ${new Date().toLocaleString()}\nPlatform: ${Capacitor.isNativePlatform() ? 'Android Native' : 'Browser'}\n--------------------\n` +
                    logs.slice(0, 25).map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Logs</span>
              </button>

              <button
                type="button"
                onClick={() => Logger.clear()}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-rose-400 text-xs font-semibold"
                title="Clear Logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
