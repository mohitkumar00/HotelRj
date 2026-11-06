import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MENU_CATEGORIES } from '../data/menuData';
import { MenuItem, DietaryType, MenuCategory, TableConfigItem } from '../types';
import {
  BluetoothPrinter,
  KOTPrintData,
  BillPrintData,
} from '../utils/thermalPrinter';
import { Logger, LogEntry } from '../utils/logger';
import { Capacitor } from '@capacitor/core';
import { QRCodeSVG } from 'qrcode.react';
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
  Wifi,
  WifiOff,
  Monitor,
  FolderOpen,
  Users,
  ShieldCheck,
  ShieldAlert,
  ChefHat,
  PlusCircle,
  TrendingUp,
  DollarSign,
  Smartphone,
  CreditCard,
  Building2,
  CheckCircle,
  Receipt,
  Ban,
  KeyRound,
  AlertOctagon,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { parseItemPrice } from '../utils/priceUtils';
import { OwnerInsights } from './OwnerInsights';
import { HotelOperationsModal } from './HotelOperationsModal';
import { fetchMenuApi, fetchTablesConfigApi } from '../utils/hotelDataApi';
import {
  settleBill,
  recordAuditLog,
  cancelBillApi,
  fetchRecentBills,
  SettleBillPayload,
} from '../utils/analyticsApi';

interface WaiterItemRecord {
  item: MenuItem;
  quantity: number;
  notes?: string;
  firedCount: number;
}

interface ConnectedWaiter {
  id: string;
  name: string;
  ip: string;
  activeTable: string;
  device: string;
  lastSeen: number;
  lastSeenTime: string;
  status: 'online' | 'idle';
}

interface TableOrder {
  tableId: string;
  serverName: string;
  openedAt: string;
  status: 'vacant' | 'active' | 'kot_sent' | 'billed';
  kotNumber: number;
  items: { [itemId: string]: WaiterItemRecord };
  generalNote?: string;
  updatedAt?: number;
}

interface SyncServerInfo {
  running: boolean;
  port: number;
  ip: string;
  localUrl: string;
}

function mergeTables(
  local: { [key: string]: TableOrder },
  remote: { [key: string]: TableOrder }
): { [key: string]: TableOrder } {
  if (!remote || typeof remote !== 'object') return local;
  const merged: { [key: string]: TableOrder } = { ...local };

  for (const tableId of Object.keys(remote)) {
    const remoteTable = remote[tableId];
    const localTable = merged[tableId];

    if (!localTable) {
      merged[tableId] = remoteTable;
      continue;
    }

    const rTime = remoteTable.updatedAt || 0;
    const lTime = localTable.updatedAt || 0;

    if (rTime > lTime) {
      const items = { ...remoteTable.items };
      for (const itemId of Object.keys(localTable.items || {})) {
        const localItem = localTable.items[itemId];
        if (!items[itemId] && localItem.quantity > (localItem.firedCount || 0)) {
          items[itemId] = localItem;
        }
      }
      merged[tableId] = {
        ...remoteTable,
        items,
      };
    } else if (lTime > rTime) {
      continue;
    } else {
      const mergedItems = { ...localTable.items };
      for (const itemId of Object.keys(remoteTable.items || {})) {
        const rItem = remoteTable.items[itemId];
        const lItem = mergedItems[itemId];
        if (!lItem) {
          mergedItems[itemId] = rItem;
        } else {
          mergedItems[itemId] = {
            ...lItem,
            quantity: Math.max(lItem.quantity, rItem.quantity),
            firedCount: Math.max(lItem.firedCount, rItem.firedCount),
            notes: rItem.notes || lItem.notes,
          };
        }
      }
      merged[tableId] = {
        ...localTable,
        status: remoteTable.status !== 'vacant' ? remoteTable.status : localTable.status,
        kotNumber: Math.max(localTable.kotNumber || 1, remoteTable.kotNumber || 1),
        openedAt: localTable.openedAt || remoteTable.openedAt,
        items: mergedItems,
      };
    }
  }
  return merged;
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
        updatedAt: 0,
      };
    }
    return init;
  });

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

  // Platform & Desktop App Check
  const isElectron = useMemo(() => BluetoothPrinter.isElectron(), []);

  // UI Drawers & Modals
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);

  // Local Wi-Fi Sync State (Counter PC Server & Waiter Client)
  const [syncInfo, setSyncInfo] = useState<SyncServerInfo | null>(null);
  const [counterSyncUrl, setCounterSyncUrl] = useState<string>(() => {
    const saved = localStorage.getItem('hotel_rj_counter_sync_url');
    if (saved) return saved;
    if (typeof window !== 'undefined' && window.location.port === '5050') {
      return window.location.host;
    }
    return '';
  });
  const [counterInputUrl, setCounterInputUrl] = useState<string>(() => {
    const saved = localStorage.getItem('hotel_rj_counter_sync_url');
    if (saved) return saved;
    if (typeof window !== 'undefined' && window.location.port === '5050') {
      return window.location.host;
    }
    return '';
  });
  const [isSyncConnected, setIsSyncConnected] = useState<boolean>(false);

  // Windows Installed Printers List (Bluetooth & USB)
  const [windowsPrinters, setWindowsPrinters] = useState<Array<{ name: string; displayName?: string; isDefault?: boolean }>>([]);
  const [selectedWindowsPrinter, setSelectedWindowsPrinter] = useState<string>(() => {
    return localStorage.getItem('hotel_rj_windows_printer') || '';
  });

  // Optional 5% GST Selection on Billing
  const [applyGst, setApplyGst] = useState<boolean>(true);

  // Live Debug Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Paired Bluetooth Printers (via Android Native Bridge)
  const [pairedPrinters, setPairedPrinters] = useState<Array<{ name: string; address: string }>>([]);
  const [selectedPrinterAddress, setSelectedPrinterAddress] = useState<string>(() => {
    return localStorage.getItem('hotel_rj_printer_address') || '';
  });

  // Desktop alert notification when a waiter sends table updates
  const [tableUpdateNotice, setTableUpdateNotice] = useState<{
    tableId: string;
    server: string;
    itemCount: number;
    timestamp: string;
  } | null>(null);

  // Active connected waiters list (on Counter Desktop)
  const [connectedWaiters, setConnectedWaiters] = useState<ConnectedWaiter[]>([]);
  const [isWaitersModalOpen, setIsWaitersModalOpen] = useState(false);
  const [firewallStatusMsg, setFirewallStatusMsg] = useState<string | null>(null);
  const [syncErrorDetail, setSyncErrorDetail] = useState<string | null>(null);

  // Helper to push tables to Windows Counter PC over local Wi-Fi
  const pushTablesToCounter = useCallback(async (currentTables: { [tableId: string]: TableOrder }) => {
    if (isElectron || !counterSyncUrl.trim()) return;
    let cleanUrl = counterSyncUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    if (!cleanUrl.match(/:\d+$/)) {
      cleanUrl = `${cleanUrl}:5050`;
    }
    try {
      const res = await fetch(`${cleanUrl}/api/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables: currentTables,
          serverName,
          activeTable,
          deviceInfo: Capacitor.isNativePlatform() ? 'Android APK' : 'Mobile Web Browser',
        }),
        signal: AbortSignal.timeout(7000),
      });
      if (res.ok) {
        setIsSyncConnected(true);
        const data = await res.json();
        if (data?.tables) {
          setTables((prev) => mergeTables(prev, data.tables));
        }
      }
    } catch (err: any) {
      Logger.warn('Sync', `Background push failed: ${err?.message || 'unreachable'}`);
      setIsSyncConnected(false);
    }
  }, [isElectron, counterSyncUrl, serverName, activeTable]);

  // Full 2-way sync helper: Sends local tables and receives latest counter state
  const performManualSync = useCallback(async (customUrl?: string) => {
    const target = customUrl || counterSyncUrl;
    if (!target.trim()) return false;
    let cleanUrl = target.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    if (!cleanUrl.match(/:\d+$/)) {
      cleanUrl = `${cleanUrl}:5050`;
    }
    triggerHaptic(30);
    setSyncErrorDetail(null);
    setPrintSuccessMsg('Connecting to Counter POS (Port 5050)...');
    Logger.info('Sync', `Sending 2-way sync request to ${cleanUrl} (timeout: 8s)...`);

    try {
      const postRes = await fetch(`${cleanUrl}/api/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables,
          serverName,
          activeTable,
          deviceInfo: Capacitor.isNativePlatform() ? 'Android APK' : 'Mobile Web Browser',
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (postRes.ok) {
        const data = await postRes.json();
        setIsSyncConnected(true);
        if (data?.tables) {
          setTables((prev) => mergeTables(prev, data.tables));
        }
        Logger.success('Sync', `✅ Connected & Synced with Counter PC at ${cleanUrl}!`);
        setPrintSuccessMsg('✅ Connected & Synced with Counter PC!');
        setTimeout(() => setPrintSuccessMsg(null), 3500);
        return true;
      } else {
        setIsSyncConnected(false);
        const errMsg = `Counter PC returned HTTP ${postRes.status} (${postRes.statusText})`;
        Logger.error('Sync', errMsg);
        setSyncErrorDetail(errMsg);
        setPrintSuccessMsg(`❌ ${errMsg}`);
        setTimeout(() => setPrintSuccessMsg(null), 4000);
        return false;
      }
    } catch (err: any) {
      setIsSyncConnected(false);
      const isTimeout =
        err?.name === 'AbortError' ||
        err?.name === 'TimeoutError' ||
        String(err?.message || '').toLowerCase().includes('timeout');

      const isMixedContent =
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        cleanUrl.startsWith('http://');

      let errReason = `Network error: ${err?.message || 'Could not connect'}`;
      if (isMixedContent) {
        errReason = `Mixed Content Block: Web browsers block local http:// when opened from an https:// website. Please open ${cleanUrl} directly in your phone browser, or use the native Waiter Android APK.`;
      } else if (isTimeout) {
        errReason = 'Connection timed out (8s). Counter PC and phone must be on the exact same Wi-Fi router (not 5G vs 2.4G) with Mobile Data turned OFF.';
      } else if (String(err?.message || '').toLowerCase().includes('failed to fetch')) {
        errReason = `Failed to reach ${cleanUrl}. Check: 1) Turn off Mobile Data (Jio/Airtel 4G/5G). 2) Connect phone to same Wi-Fi as Counter PC. 3) Verify Counter PC IP.`;
      }

      Logger.error('Sync', errReason);
      setSyncErrorDetail(errReason);
      setPrintSuccessMsg(`❌ ${isMixedContent ? 'Mixed Content Block' : isTimeout ? 'Connection timed out (8s)' : 'Connection failed'}`);
      setTimeout(() => setPrintSuccessMsg(null), 4000);
      return false;
    }
  }, [counterSyncUrl, tables, serverName, activeTable]);

  // Save tables state on every change and propagate sync
  useEffect(() => {
    try {
      localStorage.setItem('hotel_rj_pos_tables_v3', JSON.stringify(tables));
    } catch {}

    if (isElectron && (window as any).ElectronAPI?.syncTables) {
      (window as any).ElectronAPI.syncTables(tables);
    } else if (!isElectron && counterSyncUrl.trim()) {
      pushTablesToCounter(tables);
    }
  }, [tables, isElectron, counterSyncUrl, pushTablesToCounter]);

  // Windows: Query Sync Server Info on mount
  useEffect(() => {
    if (isElectron && (window as any).ElectronAPI?.getSyncInfo) {
      (window as any).ElectronAPI.getSyncInfo()
        .then((info: any) => {
          if (info) {
            setSyncInfo(info);
            setIsSyncConnected(true);
            Logger.info('Sync', `Windows Counter Sync Server running on port ${info.port} (${info.ip})`);
          }
        })
        .catch((err: any) => {
          Logger.warn('Sync', `Could not query sync info: ${err?.message}`);
        });
    }
  }, [isElectron]);

  // Windows: Listen for connected waiters updates
  useEffect(() => {
    if (isElectron && (window as any).ElectronAPI?.onWaitersUpdate) {
      if ((window as any).ElectronAPI?.getWaiters) {
        (window as any).ElectronAPI.getWaiters()
          .then((list: any) => {
            if (Array.isArray(list)) setConnectedWaiters(list);
          })
          .catch(() => {});
      }

      const unsubscribe = (window as any).ElectronAPI.onWaitersUpdate((waiters: any) => {
        if (Array.isArray(waiters)) {
          setConnectedWaiters(waiters);
        }
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [isElectron]);

  // Waiter Mobile: Send periodic heartbeat every 12 seconds when connected
  useEffect(() => {
    if (isElectron || !counterSyncUrl.trim() || !isSyncConnected) return;

    let cleanUrl = counterSyncUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    if (!cleanUrl.match(/:\d+$/)) {
      cleanUrl = `${cleanUrl}:5050`;
    }

    const sendHeartbeat = async () => {
      try {
        await fetch(`${cleanUrl}/api/waiter/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverName,
            activeTable,
            deviceInfo: Capacitor.isNativePlatform() ? 'Android APK' : 'Mobile Web Browser',
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // quiet
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 12000);
    return () => clearInterval(interval);
  }, [isElectron, counterSyncUrl, isSyncConnected, serverName, activeTable]);

  // Windows: Real-time listener for incoming orders from Waiter Android phones
  useEffect(() => {
    if (isElectron && (window as any).ElectronAPI?.onSyncUpdate) {
      const unsubscribe = (window as any).ElectronAPI.onSyncUpdate((payload: any) => {
        const remoteTables = payload?.tables || payload;
        const incomingPatch = payload?.incomingPatch;

        if (remoteTables && typeof remoteTables === 'object') {
          Logger.info('Sync', 'Received real-time table sync from waiter device');
          setTables((prev) => mergeTables(prev, remoteTables));

          // If incoming update has active items, notify the counter manager
          if (incomingPatch && typeof incomingPatch === 'object') {
            const activeModified = Object.keys(incomingPatch).find((tId) => {
              const t = incomingPatch[tId];
              return t && Object.keys(t.items || {}).length > 0;
            });
            if (activeModified) {
              const tblData = incomingPatch[activeModified];
              const count = Object.values(tblData.items || {}).reduce(
                (sum: number, it: any) => sum + (it.quantity || 0),
                0
              );
              setTableUpdateNotice({
                tableId: activeModified,
                server: tblData.serverName || 'Waiter',
                itemCount: count,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              });
            }
          }
        }
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [isElectron]);

  // Waiter Phone (Android / Web): Periodic polling with Counter POS
  useEffect(() => {
    if (isElectron || !counterSyncUrl.trim()) return;

    let cleanUrl = counterSyncUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    if (!cleanUrl.match(/:\d+$/)) {
      cleanUrl = `${cleanUrl}:5050`;
    }

    let isMounted = true;

    const pollSync = async () => {
      try {
        const res = await fetch(`${cleanUrl}/api/tables`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setIsSyncConnected(true);
            if (data?.tables) {
              setTables((prev) => mergeTables(prev, data.tables));
            }
          }
        } else {
          if (isMounted) setIsSyncConnected(false);
        }
      } catch {
        if (isMounted) setIsSyncConnected(false);
      }
    };

    pollSync();
    const interval = setInterval(pollSync, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [counterSyncUrl, isElectron]);

  // Subscribe to live logger
  useEffect(() => {
    const unsubscribe = Logger.subscribe((newLogs) => setLogs(newLogs));
    const isNative = Capacitor.isNativePlatform();
    const hasBridge = BluetoothPrinter.isNativeAndroidAvailable();
    Logger.info(
      'App',
      `WaiterPOS loaded on ${isElectron ? 'Windows Desktop App' : isNative ? 'Android Native APK' : 'Browser'}. Native Bridge: ${hasBridge ? 'ONLINE' : isElectron ? 'ELECTRON_IPC' : 'OFFLINE'}`
    );
    return () => unsubscribe();
  }, [isElectron]);

  const refreshPairedDevices = () => {
    const list = BluetoothPrinter.getPairedDevices();
    setPairedPrinters(list);
    Logger.info('Printer', `Found ${list.length} paired Bluetooth devices`);
  };

  const refreshWindowsPrinters = async () => {
    if (isElectron) {
      const list = await BluetoothPrinter.getWindowsPrinters();
      setWindowsPrinters(list);
      Logger.info('Printer', `Found ${list.length} Windows thermal printers`);
    }
  };

  useEffect(() => {
    if (isPrinterModalOpen) {
      if (isElectron) {
        refreshWindowsPrinters();
      } else {
        refreshPairedDevices();
      }
    }
  }, [isPrinterModalOpen, isElectron]);

  const handleSelectPrinter = (dev: { name: string; address: string }) => {
    setSelectedPrinterAddress(dev.address);
    localStorage.setItem('hotel_rj_printer_address', dev.address);
    localStorage.setItem('hotel_rj_printer_name', dev.name);
    Logger.success('Printer', `Selected printer: ${dev.name} (${dev.address})`);
    setPrintSuccessMsg(`Selected: ${dev.name}`);
    setTimeout(() => setPrintSuccessMsg(null), 2500);
  };

  const handleSelectWindowsPrinter = (printerName: string) => {
    setSelectedWindowsPrinter(printerName);
    localStorage.setItem('hotel_rj_windows_printer', printerName);
    Logger.success('Printer', `Selected Windows thermal printer: ${printerName || 'Default System Printer'}`);
    setPrintSuccessMsg(`Printer: ${printerName || 'System Default'}`);
    setTimeout(() => setPrintSuccessMsg(null), 2500);
  };

  // Item customization modal
  const [customizingItem, setCustomizingItem] = useState<{ id: string; name: string; notes?: string } | null>(null);
  const [customNoteText, setCustomNoteText] = useState<string>('');

  // Custom dish / service modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customDishName, setCustomDishName] = useState('');
  const [customDishPrice, setCustomDishPrice] = useState('');
  const [customDietary, setCustomDietary] = useState<DietaryType>('non-veg');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customNotes, setCustomNotes] = useState('');

  // Owner Insights View State
  const [showOwnerInsights, setShowOwnerInsights] = useState(false);

  // Settlement & DB billing modal
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleDepartment, setSettleDepartment] = useState<'restaurant' | 'rooms' | 'banquet'>('restaurant');
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<'cash' | 'upi' | 'card' | 'room-folio'>('cash');
  const [settleRoomNumber, setSettleRoomNumber] = useState('Room 101');
  const [settleCustomerPhone, setSettleCustomerPhone] = useState('');
  const [settleCustomerName, setSettleCustomerName] = useState('');
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  // Anti-Theft Void Interception Modal
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidCandidate, setVoidCandidate] = useState<{ itemId: string; item: MenuItem; quantity: number; firedCount?: number } | null>(null);
  const [voidReason, setVoidReason] = useState('Customer cancelled after delay');
  const [customVoidReason, setCustomVoidReason] = useState('');

  // Bills History & Cancellation Modal State
  const [isBillsHistoryOpen, setIsBillsHistoryOpen] = useState(false);
  const [recentBillsList, setRecentBillsList] = useState<any[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [billsSearchTerm, setBillsSearchTerm] = useState('');
  const [billsFilterStatus, setBillsFilterStatus] = useState<'all' | 'settled' | 'cancelled'>('all');

  // Cancel Bill Modal State
  const [billToCancel, setBillToCancel] = useState<any | null>(null);
  const [cancelPin, setCancelPin] = useState('');
  const [cancelPinError, setCancelPinError] = useState(false);
  const [cancelReasonPreset, setCancelReasonPreset] = useState('Entered Wrong Table / Duplicate');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [isCancellingBill, setIsCancellingBill] = useState(false);

  // Hotel Operations Modal State (Dishes, Kitchen 86 Sold-Out, Rooms & Tables)
  const [isHotelOpsOpen, setIsHotelOpsOpen] = useState(false);
  const [liveMenuCategories, setLiveMenuCategories] = useState<MenuCategory[]>(() => {
    try {
      const cached = localStorage.getItem('hotel_rj_menu_cache');
      if (cached) return JSON.parse(cached);
    } catch {}
    return MENU_CATEGORIES;
  });
  const [tablesConfigList, setTablesConfigList] = useState<TableConfigItem[]>([]);

  const loadHotelOpsData = useCallback(async () => {
    try {
      const [menu, tbls] = await Promise.all([
        fetchMenuApi(),
        fetchTablesConfigApi(),
      ]);
      if (menu && menu.length > 0) setLiveMenuCategories(menu);
      if (tbls && tbls.length > 0) setTablesConfigList(tbls);
    } catch (err) {
      console.warn('Could not load hotel ops data:', err);
    }
  }, []);

  useEffect(() => {
    loadHotelOpsData();
  }, [loadHotelOpsData]);

  const loadRecentBills = async () => {
    setLoadingBills(true);
    try {
      const data = await fetchRecentBills(60);
      setRecentBillsList(data || []);
    } catch (e) {
      console.warn('Failed to load recent bills:', e);
    } finally {
      setLoadingBills(false);
    }
  };

  const filteredRecentBills = useMemo(() => {
    let list = recentBillsList;
    if (billsFilterStatus === 'settled') {
      list = list.filter((b) => b.status !== 'cancelled');
    } else if (billsFilterStatus === 'cancelled') {
      list = list.filter((b) => b.status === 'cancelled');
    }

    if (billsSearchTerm.trim()) {
      const q = billsSearchTerm.toLowerCase();
      list = list.filter((b) => {
        const bNum = String(b.billNumber || '').toLowerCase();
        const tId = String(b.tableId || '').toLowerCase();
        const dept = String(b.department || '').toLowerCase();
        const phone = String(b.customerPhone || '').toLowerCase();
        const dishes = (b.items || []).map((i: any) => i.name).join(' ').toLowerCase();
        return bNum.includes(q) || tId.includes(q) || dept.includes(q) || phone.includes(q) || dishes.includes(q);
      });
    }

    return list;
  }, [recentBillsList, billsFilterStatus, billsSearchTerm]);

  const handleReprintSettledBill = async (bill: any) => {
    try {
      const items = (bill.items || []).map((i: any) => ({
        name: i.name,
        quantity: Number(i.quantity) || 1,
        price: Number(i.price) || 0,
      }));

      const printData: BillPrintData = {
        billNumber: String(bill.billNumber || ''),
        tableNumber: `${bill.tableId} [DUPLICATE]`,
        serverName: bill.serverName || serverName,
        timestamp: bill.timestamp
          ? new Date(bill.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
          : new Date().toLocaleString(),
        items,
        subtotal: Number(bill.subtotal) || Number(bill.total) || 0,
        gstRate: bill.tax ? 5 : 0,
        grandTotal: Number(bill.total) || 0,
        paymentMode: (bill.paymentMethod || 'cash').toUpperCase(),
      };

      const res = await BluetoothPrinter.printBill(printData);
      if (res.success) {
        setPrintSuccessMsg(`🖨️ Bill #${bill.billNumber} reprinted successfully!`);
      } else {
        setPrintSuccessMsg(`⚠️ Print note: ${res.error || 'Check printer connection'}`);
      }
      setTimeout(() => setPrintSuccessMsg(null), 3500);
    } catch (err: any) {
      alert(`Reprint error: ${err?.message || err}`);
    }
  };

  const handleConfirmCancelBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billToCancel) return;

    if (cancelPin !== '1234' && cancelPin !== '8888') {
      setCancelPinError(true);
      return;
    }

    const finalReason = (customCancelReason.trim() || cancelReasonPreset).trim();
    if (!finalReason) {
      alert('Please enter or select a cancellation reason.');
      return;
    }

    setIsCancellingBill(true);
    try {
      const res = await cancelBillApi({
        billId: billToCancel.id,
        reason: finalReason,
        cancelledBy: `${serverName} (PIN Authorized)`,
      });

      if (res.success) {
        triggerHaptic(60);
        setPrintSuccessMsg(`❌ Bill #${billToCancel.billNumber} (₹${billToCancel.total}) was CANCELLED and deducted from today's sales.`);
        setTimeout(() => setPrintSuccessMsg(null), 4500);
        setBillToCancel(null);
        setCancelPin('');
        setCancelPinError(false);
        setCustomCancelReason('');
        loadRecentBills();
      } else {
        alert(`Failed to cancel bill: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error cancelling bill: ${err?.message || err}`);
    } finally {
      setIsCancellingBill(false);
    }
  };

  // Haptic feedback helper
  const triggerHaptic = (ms = 35) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  };

  // Add custom dish / hotel service (e.g. Chicken Making Charge)
  const handleAddCustomDish = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = customDishName.trim();
    if (!name) return;
    const price = parseFloat(customDishPrice) || 0;
    if (price < 0) return;

    const customId = `cst-${Date.now()}`;
    const customItem: MenuItem = {
      id: customId,
      name,
      price,
      dietary: customDietary,
      category: 'custom-services',
      isCustom: true,
      description: 'Custom preparation or hotel service charge',
      image: customDietary === 'non-veg' ? './images/food/chicken-curry.jpg' : './images/food/hero-veg-starters.jpg',
    };

    triggerHaptic(35);
    setTables((prev) => {
      const existingTable = prev[activeTable] || {
        tableId: activeTable,
        serverName,
        openedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'active',
        kotNumber: 1,
        items: {},
      };

      return {
        ...prev,
        [activeTable]: {
          ...existingTable,
          status: 'active',
          openedAt: existingTable.openedAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          updatedAt: Date.now(),
          items: {
            ...existingTable.items,
            [customId]: {
              item: customItem,
              quantity: Math.max(1, customQuantity),
              notes: customNotes.trim(),
              firedCount: 0,
            },
          },
        },
      };
    });

    setPrintSuccessMsg(`✅ Added custom "${name}" (₹${price}) to ${activeTable}`);
    setTimeout(() => setPrintSuccessMsg(null), 3500);

    // Reset and close
    setCustomDishName('');
    setCustomDishPrice('');
    setCustomNotes('');
    setCustomQuantity(1);
    setIsCustomModalOpen(false);
  };

  // Add / Increment Item on Active Table
  const handleAddItem = (item: MenuItem) => {
    if (item.isAvailable === false) {
      triggerHaptic(80);
      alert(`⚠️ "${item.name}" is marked SOLD OUT (Kitchen 86) and cannot be ordered.`);
      return;
    }
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
          updatedAt: Date.now(),
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
    const existingTable = tables[activeTable];
    if (!existingTable || !existingTable.items[itemId]) return;

    const record = existingTable.items[itemId];
    // If item was already fired to kitchen on KOT, prompt for Anti-Theft Void Reason!
    if ((record.firedCount || 0) > 0) {
      setVoidCandidate({ itemId, item: record.item, quantity: 1, firedCount: record.firedCount });
      setIsVoidModalOpen(true);
      return;
    }

    setTables((prev) => {
      const curTable = prev[activeTable];
      if (!curTable || !curTable.items[itemId]) return prev;

      const rec = curTable.items[itemId];
      const newItems = { ...curTable.items };

      if (rec.quantity <= 1) {
        delete newItems[itemId];
      } else {
        newItems[itemId] = {
          ...rec,
          quantity: rec.quantity - 1,
        };
      }

      const hasRemaining = Object.keys(newItems).length > 0;

      return {
        ...prev,
        [activeTable]: {
          ...curTable,
          status: hasRemaining ? curTable.status : 'vacant',
          updatedAt: Date.now(),
          items: newItems,
        },
      };
    });
  };

  // Confirm Anti-Theft Void and save audit log
  const handleConfirmVoid = async () => {
    if (!voidCandidate) return;
    const reason = (customVoidReason.trim() || voidReason).trim();

    await recordAuditLog({
      type: 'ITEM_VOID',
      tableId: activeTable,
      staffName: serverName,
      itemName: voidCandidate.item.name,
      itemPrice: parseItemPrice(voidCandidate.item.price),
      quantity: 1,
      reason,
    });

    const itemId = voidCandidate.itemId;
    setTables((prev) => {
      const curTable = prev[activeTable];
      if (!curTable || !curTable.items[itemId]) return prev;

      const rec = curTable.items[itemId];
      const newItems = { ...curTable.items };

      if (rec.quantity <= 1) {
        delete newItems[itemId];
      } else {
        newItems[itemId] = {
          ...rec,
          quantity: rec.quantity - 1,
          firedCount: Math.max(0, (rec.firedCount || 1) - 1),
        };
      }

      const hasRemaining = Object.keys(newItems).length > 0;

      return {
        ...prev,
        [activeTable]: {
          ...curTable,
          status: hasRemaining ? curTable.status : 'vacant',
          updatedAt: Date.now(),
          items: newItems,
        },
      };
    });

    setPrintSuccessMsg(`🛡️ Void recorded in Audit Log: "${reason}"`);
    setTimeout(() => setPrintSuccessMsg(null), 3500);

    setVoidCandidate(null);
    setIsVoidModalOpen(false);
    setCustomVoidReason('');
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
          updatedAt: Date.now(),
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
      const p = parseItemPrice(ci.item.price);
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
            updatedAt: Date.now(),
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
        price: parseItemPrice(ci.item.price),
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
          updatedAt: Date.now(),
        },
      }));
    } catch (err: any) {
      Logger.error('Bill', `Failed to print bill: ${err?.message || err}`);
      setPrintSuccessMsg(`❌ Bill print failed: ${err?.message || 'Check Logs'}`);
      setTimeout(() => setPrintSuccessMsg(null), 4000);
    }
  };

  // Action: OPEN SETTLE MODAL OR DIRECT CLEAR IF EMPTY
  const handleOpenSettleModal = () => {
    if (activeTable.startsWith('R-') || activeTable.includes('Room')) {
      setSettleDepartment('rooms');
    } else if (activeTable.toLowerCase().includes('banquet') || activeTable.toLowerCase().includes('hall') || activeTable.toLowerCase().includes('lawn')) {
      setSettleDepartment('banquet');
    } else {
      setSettleDepartment('restaurant');
    }

    if (currentItemsList.length === 0) {
      if (confirm(`Mark ${activeTable} as Vacant?`)) {
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
            updatedAt: Date.now(),
          },
        }));
        setIsOrderDrawerOpen(false);
      }
      return;
    }
    setIsSettleModalOpen(true);
  };

  // Action: CONFIRM SETTLEMENT & SAVE TO DATABASE
  const handleConfirmSettlement = async () => {
    setIsSubmittingSettlement(true);
    try {
      const payload: SettleBillPayload = {
        tableId: activeTable,
        department: settleDepartment,
        orderType: isTakeawayActive ? 'takeaway' : activeTable.startsWith('R-') ? 'room-service' : settleDepartment === 'banquet' ? 'banquet' : 'dine-in',
        roomNumber: settlePaymentMethod === 'room-folio' ? settleRoomNumber : undefined,
        serverName,
        settledBy: 'Counter Cashier',
        customerPhone: settleCustomerPhone.trim() || undefined,
        customerName: settleCustomerName.trim() || undefined,
        items: currentItemsList.map((ci) => ({
          name: ci.item.name,
          quantity: ci.quantity,
          price: parseItemPrice(ci.item.price),
          notes: ci.notes,
          isCustom: ci.item.isCustom,
          dietary: ci.item.dietary,
        })),
        subtotal: subtotalPrice,
        tax: applyGst ? gstAmount : 0,
        total: grandTotal,
        paymentMethod: settlePaymentMethod,
        paymentDetails: {
          cashAmount: settlePaymentMethod === 'cash' ? grandTotal : 0,
          upiAmount: settlePaymentMethod === 'upi' ? grandTotal : 0,
          cardAmount: settlePaymentMethod === 'card' ? grandTotal : 0,
        },
      };

      await settleBill(payload);

      triggerHaptic(50);
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
          updatedAt: Date.now(),
        },
      }));

      setPrintSuccessMsg(`✅ Bill (₹${grandTotal}) settled via ${settlePaymentMethod.toUpperCase()} & saved to DB!`);
      setTimeout(() => setPrintSuccessMsg(null), 3500);

      setIsSettleModalOpen(false);
      setIsOrderDrawerOpen(false);
      setSettleCustomerPhone('');
      setSettleCustomerName('');
    } catch (err: any) {
      Logger.error('Settle', `Failed to settle bill: ${err?.message || err}`);
      setPrintSuccessMsg(`❌ Settlement error: ${err?.message || 'Check connection'}`);
      setTimeout(() => setPrintSuccessMsg(null), 4000);
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  // Action: SEND VIA WHATSAPP (Kitchen or Guest)
  const handleSendWhatsApp = () => {
    const itemsListStr = currentItemsList
      .map((ci) => {
        const p = parseItemPrice(ci.item.price);
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

    return liveMenuCategories.map((cat) => {
      if (selectedCategory !== 'all' && cat.id !== selectedCategory) {
        return null;
      }

      const items = (cat.items || []).filter((item) => {
        if (selectedDietary !== 'all') {
          if (item.dietary !== selectedDietary) return false;
        }

        if (query) {
          const matchName = item.name.toLowerCase().includes(query);
          const matchHindi = item.hindiName ? item.hindiName.toLowerCase().includes(query) : false;
          const matchPrice = String(item.price).includes(query);
          const acronym = item.name.split(/\s+/).map((w) => w[0]).join('').toLowerCase();
          const matchAcronym = acronym.includes(query);

          if (!matchName && !matchHindi && !matchPrice && !matchAcronym) return false;
        }

        return true;
      });

      if (items.length === 0) return null;

      return {
        ...cat,
        items,
      };
    }).filter(Boolean) as MenuCategory[];
  }, [liveMenuCategories, selectedCategory, selectedDietary, searchQuery]);

  // Dynamic Table IDs list
  const currentTableIds = useMemo(() => {
    if (tablesConfigList.length > 0) {
      return tablesConfigList.filter((t) => t.isActive).map((t) => t.id);
    }
    return ALL_TABLE_IDS;
  }, [tablesConfigList]);

  // Filtered Table IDs list
  const filteredTables = useMemo(() => {
    if (tableFilter === 'dinein') {
      return currentTableIds.filter((t) => t.startsWith('T-'));
    }
    if (tableFilter === 'takeaway') {
      return currentTableIds.filter((t) => t.toLowerCase().includes('parcel') || t.toLowerCase().includes('takeaway'));
    }
    if (tableFilter === 'rooms') {
      return currentTableIds.filter((t) => t.toLowerCase().startsWith('room'));
    }
    if (tableFilter === 'active') {
      return currentTableIds.filter((t) => {
        const order = tables[t];
        return order && Object.keys(order.items || {}).length > 0;
      });
    }
    return currentTableIds;
  }, [tableFilter, currentTableIds, tables]);

  if (showOwnerInsights) {
    return <OwnerInsights onBack={() => setShowOwnerInsights(false)} serverUrl={syncInfo?.localUrl} />;
  }

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
                {isElectron && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Monitor className="w-2.5 h-2.5" />
                    <span>Counter</span>
                  </span>
                )}
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

            {/* Local Wi-Fi Sync Button */}
            {isElectron ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/30 active:scale-95 transition-all"
                  title="Counter Wi-Fi Sync Server (Click for IP & QR Code)"
                >
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-mono hidden sm:inline">
                    {syncInfo?.ip ? `${syncInfo.ip}:5050` : 'Sync Server'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsWaitersModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-xs font-semibold flex items-center gap-1.5 border border-blue-500/30 active:scale-95 transition-all"
                  title="View active waiters connected to this Counter"
                >
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] font-bold hidden sm:inline">
                    {connectedWaiters.filter((w) => w.status === 'online').length} Waiters Online
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(true)}
                  className={`px-2 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border active:scale-95 transition-all ${
                    isSyncConnected
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-white/5 border-white/10 text-sand-400 hover:bg-white/10'
                  }`}
                  title="Wi-Fi Sync Settings with Counter PC"
                >
                  {isSyncConnected ? (
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-sand-500" />
                  )}
                  <span className="text-[10px] hidden sm:inline">
                    {isSyncConnected ? 'Synced' : 'Connect Counter'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => performManualSync()}
                  className={`p-1.5 rounded-xl border active:scale-95 transition-all ${
                    isSyncConnected
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                      : 'bg-white/5 border-white/10 text-sand-400 hover:bg-white/10'
                  }`}
                  title="Tap to sync all tables now with Counter PC"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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

            {/* Bills History & Void Management Button */}
            <button
              type="button"
              onClick={() => {
                setIsBillsHistoryOpen(true);
                loadRecentBills();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/30 active:scale-95 transition-all shadow-sm"
              title="Recent Bills, Reprints & Anti-Theft Cancellations"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] hidden xs:inline">Bills History</span>
            </button>

            {/* Hotel Operations & Inventory Modal Button */}
            <button
              type="button"
              onClick={() => setIsHotelOpsOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-semibold flex items-center gap-1.5 border border-purple-500/30 active:scale-95 transition-all shadow-sm"
              title="Manage Dishes, Kitchen 86 Sold-Out, Rooms & Tables"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] hidden xs:inline">Menu & Rooms</span>
            </button>

            {/* Owner Insights & Anti-Theft Analytics Button */}
            <button
              type="button"
              onClick={() => setShowOwnerInsights(true)}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-gold-500/20 hover:from-amber-500/30 hover:to-gold-500/30 text-gold-300 text-xs font-bold flex items-center gap-1.5 border border-gold-500/30 active:scale-95 transition-all shadow-sm"
              title="Open Owner Analytics, Anti-Theft Ledger & Daily Kharacha"
            >
              <TrendingUp className="w-3.5 h-3.5 text-gold-400" />
              <span className="text-[10px] hidden sm:inline">Owner Insights</span>
            </button>

            {/* Browser preview exit (hidden on Android native APK and Windows Desktop App) */}
            {!Capacitor.isNativePlatform() && !isElectron && onSwitchToGuestMenu && (
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

      {/* 1.1 COUNTER DESKTOP: LIVE WAITER ORDER NOTIFICATION BANNER */}
      {isElectron && tableUpdateNotice && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black px-4 py-2.5 flex items-center justify-between shadow-xl animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 font-bold text-xs">
            <span className="text-base animate-bounce">🔔</span>
            <span>
              New update on <strong>{tableUpdateNotice.tableId}</strong> ({tableUpdateNotice.itemCount} items by {tableUpdateNotice.server} at {tableUpdateNotice.timestamp})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTable(tableUpdateNotice.tableId);
                setTableUpdateNotice(null);
              }}
              className="px-3 py-1 rounded-lg bg-black text-amber-300 hover:bg-zinc-900 text-xs font-black uppercase tracking-wider shadow active:scale-95 transition-all"
            >
              Open {tableUpdateNotice.tableId}
            </button>
            <button
              type="button"
              onClick={() => setTableUpdateNotice(null)}
              className="p-1 text-black/70 hover:text-black"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
              onClick={() => setIsCustomModalOpen(true)}
              className="px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Custom Dish / Service</span>
            </button>

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
            {liveMenuCategories.map((cat) => (
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
                  const priceNum = parseItemPrice(dish.price);
                  const isSoldOut = dish.isAvailable === false;

                  return (
                    <div
                      key={dish.id}
                      className={`relative p-2 rounded-2xl border transition-all flex flex-col justify-between select-none overflow-hidden ${
                        isSoldOut
                          ? 'bg-rose-950/20 border-rose-900/60 opacity-80'
                          : inCartQty > 0
                          ? 'bg-[#181a24] border-amber-400 shadow-lg ring-1 ring-amber-400/40'
                          : 'bg-zinc-900/80 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Dish Thumbnail Image */}
                      <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden mb-2 bg-zinc-950 shrink-0">
                        <img
                          src={dish.image || './images/food/hero-veg-starters.jpg'}
                          alt={dish.name}
                          className={`w-full h-full object-cover ${isSoldOut ? 'grayscale contrast-125' : ''}`}
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = './images/food/hero-veg-starters.jpg';
                          }}
                        />

                        {/* Sold Out Red Banner or Dietary Dot */}
                        {isSoldOut ? (
                          <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider shadow z-10 animate-pulse">
                            [SOLD OUT]
                          </span>
                        ) : (
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
                        )}

                        {/* Custom Service Tag */}
                        {dish.isCustom && (
                          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-amber-400 text-black text-[8.5px] font-black uppercase tracking-wider shadow z-10">
                            Service
                          </span>
                        )}

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
                        {isSoldOut ? (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic(80);
                              alert(`⚠️ "${dish.name}" is marked SOLD OUT (Kitchen 86).`);
                            }}
                            className="w-full py-1.5 px-2 rounded-xl bg-rose-950/60 text-rose-300 text-xs font-bold flex items-center justify-center gap-1 border border-rose-800/80 cursor-not-allowed"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            <span>[SOLD OUT]</span>
                          </button>
                        ) : inCartQty > 0 ? (
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
                <div className="py-10 text-center text-sand-400 space-y-3">
                  <p className="text-sm font-medium">{activeTable} is empty.</p>
                  <p className="text-xs">Tap dishes on the menu or add a custom service below.</p>
                  <button
                    type="button"
                    onClick={() => setIsCustomModalOpen(true)}
                    className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 text-xs font-bold shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ Add Custom Service / Chicken Prep</span>
                  </button>
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
                            const price = parseItemPrice(ci.item.price);

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

                  {/* Add Custom Item / Service Charge Button */}
                  <button
                    type="button"
                    onClick={() => setIsCustomModalOpen(true)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-amber-400/10 hover:bg-amber-400/20 border border-dashed border-amber-400/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ Add Custom Dish / Chicken Making Charge</span>
                  </button>

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
                    onClick={handleOpenSettleModal}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 active:scale-95 transition-all"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
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

      {/* 9B. CUSTOM DISH & HOTEL SERVICE MODAL */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#131622] border border-amber-400/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-400/30">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Add Custom Dish / Service</h4>
                  <p className="text-[10px] text-amber-400 font-mono">Adding to Table: <strong>{activeTable}</strong></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className="p-1.5 rounded-full text-sand-400 hover:text-white bg-white/5 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets for Highway Hotel & Dhaba Services */}
            <div>
              <label className="text-[10px] uppercase font-bold text-sand-400 tracking-wider block mb-1.5">
                ⚡ Quick Presets (Tap to Auto-Fill):
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { name: 'Chicken Making Charge (1 Kg)', price: '200', diet: 'non-veg' as const },
                  { name: 'Desi Chicken Making Charge', price: '250', diet: 'non-veg' as const },
                  { name: 'Mutton Making Charge (1 Kg)', price: '300', diet: 'non-veg' as const },
                  { name: 'Fish Making / Fry Charge', price: '180', diet: 'non-veg' as const },
                  { name: 'Ice Bucket & Glass Service', price: '50', diet: 'veg' as const },
                  { name: 'Packing & Container Charge', price: '30', diet: 'veg' as const },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setCustomDishName(preset.name);
                      setCustomDishPrice(preset.price);
                      setCustomDietary(preset.diet);
                    }}
                    className="p-2 rounded-xl bg-white/5 hover:bg-amber-400/15 border border-white/5 hover:border-amber-400/30 text-left text-[11px] text-sand-200 hover:text-white flex items-center justify-between transition-colors active:scale-98"
                  >
                    <span className="truncate">{preset.name}</span>
                    <span className="font-mono text-amber-300 font-bold shrink-0 ml-1">₹{preset.price}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddCustomDish} className="space-y-3.5 pt-1">
              {/* Dish / Service Name */}
              <div>
                <label className="text-[10px] uppercase font-bold text-sand-400 tracking-wider block mb-1">
                  Dish or Service Name *
                </label>
                <input
                  type="text"
                  value={customDishName}
                  onChange={(e) => setCustomDishName(e.target.value)}
                  placeholder="e.g. Chicken Making Charge, Desi Mutton Handi..."
                  className="w-full bg-zinc-900 text-xs sm:text-sm text-white px-3 py-2 rounded-xl border border-white/10 focus:border-amber-400 focus:outline-none placeholder:text-sand-500 font-medium"
                  required
                  autoFocus
                />
              </div>

              {/* Price & Quantity Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-sand-400 tracking-wider block mb-1">
                    Charge / Price (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={customDishPrice}
                      onChange={(e) => setCustomDishPrice(e.target.value)}
                      placeholder="e.g. 200"
                      className="w-full bg-zinc-900 text-xs sm:text-sm text-white pl-7 pr-3 py-2 rounded-xl border border-white/10 focus:border-amber-400 focus:outline-none placeholder:text-sand-500 font-mono font-bold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-sand-400 tracking-wider block mb-1">
                    Quantity
                  </label>
                  <div className="flex items-center bg-zinc-900 rounded-xl border border-white/10 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setCustomQuantity((q) => Math.max(1, q - 1))}
                      className="p-2 hover:bg-white/10 text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="flex-1 text-center font-mono text-xs font-bold text-white">
                      {customQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomQuantity((q) => q + 1)}
                      className="p-2 hover:bg-white/10 text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Dietary Toggle */}
              <div>
                <label className="text-[10px] uppercase font-bold text-sand-400 tracking-wider block mb-1">
                  Item Category:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setCustomDietary('non-veg')}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all ${
                      customDietary === 'non-veg'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-zinc-900 border-white/10 text-sand-400 hover:text-white'
                    }`}
                  >
                    <span>🔴 Non-Veg (Chicken/Meat)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomDietary('veg')}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all ${
                      customDietary === 'veg'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-900 border-white/10 text-sand-400 hover:text-white'
                    }`}
                  >
                    <span>🟢 Veg / Hotel Service</span>
                  </button>
                </div>
              </div>

              {/* Special Instructions / Kitchen Note */}
              <div>
                <label className="text-[10px] uppercase font-bold text-sand-400 tracking-wider block mb-1">
                  Kitchen Cooking Note / Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="e.g. Customer brought 1.5kg chicken, spicy handi style, less oil..."
                  className="w-full bg-zinc-900 text-xs text-white px-3 py-2 rounded-xl border border-white/10 focus:border-amber-400 focus:outline-none placeholder:text-sand-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sand-300 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!customDishName.trim()}
                  className="flex-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add to Table {activeTable}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9C. BILL SETTLEMENT & LOCAL DATABASE SAVE MODAL */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-stone-900 border border-gold-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-white">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Settle Bill & Vacate {activeTable}</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  {currentItemsList.reduce((s, ci) => s + ci.quantity, 0)} items • Subtotal: ₹{subtotalPrice}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grand Total Display */}
            <div className="p-4 rounded-2xl bg-stone-950 border border-gold-500/30 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Total Payable Amount</span>
              <div className="text-3xl font-black text-gold-300 font-mono mt-1">₹{grandTotal}</div>
              {applyGst && <span className="text-[10px] text-stone-400">Includes 5% GST (₹{gstAmount})</span>}
            </div>

            {/* Department Selection */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5">Business Department:</label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSettleDepartment('restaurant')}
                  className={`py-2 px-2 rounded-xl font-bold border transition-all text-center ${
                    settleDepartment === 'restaurant'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-stone-950 text-stone-400 border-stone-800'
                  }`}
                >
                  🍽️ Restaurant
                </button>
                <button
                  type="button"
                  onClick={() => setSettleDepartment('rooms')}
                  className={`py-2 px-2 rounded-xl font-bold border transition-all text-center ${
                    settleDepartment === 'rooms'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                      : 'bg-stone-950 text-stone-400 border-stone-800'
                  }`}
                >
                  🛏️ Rooms
                </button>
                <button
                  type="button"
                  onClick={() => setSettleDepartment('banquet')}
                  className={`py-2 px-2 rounded-xl font-bold border transition-all text-center ${
                    settleDepartment === 'banquet'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                      : 'bg-stone-950 text-stone-400 border-stone-800'
                  }`}
                >
                  🎉 Banquet
                </button>
              </div>
            </div>

            {/* Payment Mode Selection */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-2">Select Payment Mode:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSettlePaymentMethod('cash')}
                  className={`py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                    settlePaymentMethod === 'cash'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettlePaymentMethod('upi')}
                  className={`py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                    settlePaymentMethod === 'upi'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-md'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <span>UPI (GPay/PhonePe)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettlePaymentMethod('card')}
                  className={`py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                    settlePaymentMethod === 'card'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-md'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  <span>Card / POS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettlePaymentMethod('room-folio')}
                  className={`py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                    settlePaymentMethod === 'room-folio'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>Post to Room</span>
                </button>
              </div>
            </div>

            {/* Room Selection Dropdown if room-folio */}
            {settlePaymentMethod === 'room-folio' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5 text-xs">
                <label className="block text-amber-300 font-semibold">Select Guest Room:</label>
                <select
                  value={settleRoomNumber}
                  onChange={(e) => setSettleRoomNumber(e.target.value)}
                  className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-lg text-white font-medium focus:outline-none focus:border-amber-400"
                >
                  <option value="Room 101">Room 101 (Deluxe AC)</option>
                  <option value="Room 102">Room 102 (Deluxe AC)</option>
                  <option value="Room 103">Room 103 (Executive)</option>
                  <option value="Room 201">Room 201 (Super Deluxe)</option>
                  <option value="Room 202">Room 202 (Family Suite)</option>
                  <option value="Room 203">Room 203 (Standard AC)</option>
                  <option value="Room 204">Room 204 (Standard Non-AC)</option>
                </select>
                <p className="text-[11px] text-stone-400">
                  Restaurant bill will be posted to this room's folio and billed upon checkout.
                </p>
              </div>
            )}

            {/* Customer Phone (Optional) */}
            <div className="text-xs">
              <label className="block text-stone-400 mb-1">Customer Mobile Number (Optional for WhatsApp CRM):</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={settleCustomerPhone}
                onChange={(e) => setSettleCustomerPhone(e.target.value)}
                className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white font-mono focus:outline-none focus:border-gold-400"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-xl text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingSettlement}
                onClick={handleConfirmSettlement}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isSubmittingSettlement ? 'Saving to DB...' : 'Confirm & Settle'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9D. ANTI-THEFT KOT VOID INTERCEPTION MODAL */}
      {isVoidModalOpen && voidCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-stone-900 border border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-white">
            <div className="flex items-center gap-3 border-b border-stone-800 pb-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Anti-Theft Security Alert</h3>
                <p className="text-xs text-rose-300">Item already dispatched to kitchen on KOT</p>
              </div>
            </div>

            <div className="p-3 bg-stone-950 border border-rose-500/20 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-400">Dish to Cancel:</span>
                <span className="font-bold text-white">{voidCandidate.item.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Price:</span>
                <span className="font-mono text-rose-400 font-bold">₹{parseItemPrice(voidCandidate.item.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Table:</span>
                <span className="text-gold-300 font-bold">{activeTable}</span>
              </div>
            </div>

            <div className="text-xs space-y-2">
              <label className="block text-stone-300 font-semibold">Select Cancellation Reason (Recorded in Audit Log):</label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  'Customer cancelled after long delay',
                  'Customer changed mind / Left table',
                  'Wrong item punched by waiter',
                  'Kitchen out of stock / Burnt in kitchen',
                ].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setVoidReason(r);
                      setCustomVoidReason('');
                    }}
                    className={`py-2 px-3 rounded-lg text-left transition-all border text-[11px] ${
                      voidReason === r && !customVoidReason
                        ? 'bg-rose-500/20 text-rose-200 border-rose-500/40 font-bold'
                        : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-white'
                    }`}
                  >
                    • {r}
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <input
                  type="text"
                  placeholder="Or type custom reason..."
                  value={customVoidReason}
                  onChange={(e) => setCustomVoidReason(e.target.value)}
                  className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-lg text-white text-xs focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setVoidCandidate(null);
                  setIsVoidModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-xl text-xs transition-all"
              >
                Keep Item
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Void</span>
              </button>
            </div>
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
                <h3 className="font-bold text-sm text-white">
                  {isElectron ? 'Windows Thermal Printer' : 'Thermal Printer Setup'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPrinterModalOpen(false)}
                className="p-1 rounded-full text-sand-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Print Engine Status */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-sand-400">Print Engine:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isElectron
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : BluetoothPrinter.isNativeAndroidAvailable()
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {isElectron
                    ? '● Windows Silent Background'
                    : BluetoothPrinter.isNativeAndroidAvailable()
                    ? '● Native Android Bridge'
                    : '● Browser Mode'}
                </span>
              </div>

              {/* Printers List */}
              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    <span>{isElectron ? 'Installed Windows Printers:' : 'Paired Bluetooth Printers:'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={isElectron ? refreshWindowsPrinters : refreshPairedDevices}
                    className="p-1 rounded text-sand-400 hover:text-white flex items-center gap-1 text-[10px]"
                    title="Refresh printers"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Scan</span>
                  </button>
                </div>

                {isElectron ? (
                  windowsPrinters.length > 0 ? (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => handleSelectWindowsPrinter('')}
                        className={`w-full p-2 rounded-xl text-left text-xs border transition-all flex items-center justify-between ${
                          !selectedWindowsPrinter
                            ? 'bg-amber-400/20 border-amber-400 text-white font-bold'
                            : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'
                        }`}
                      >
                        <div>
                          <div className="font-medium">System Default Printer</div>
                          <div className="text-[9px] font-mono text-sand-400">Windows default device</div>
                        </div>
                        {!selectedWindowsPrinter && <Check className="w-4 h-4 text-amber-400" />}
                      </button>

                      {windowsPrinters.map((p) => {
                        const isSelected = selectedWindowsPrinter === p.name;
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => handleSelectWindowsPrinter(p.name)}
                            className={`w-full p-2 rounded-xl text-left text-xs border transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-amber-400/20 border-amber-400 text-white font-bold'
                                : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-medium truncate">{p.displayName || p.name}</div>
                              <div className="text-[9px] font-mono text-sand-400">
                                {p.isDefault ? 'Default Device' : 'Windows Thermal/USB/Bluetooth'}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-sand-400 bg-white/5 p-2 rounded-xl">
                      Scanning Windows printers... Connect your USB or Bluetooth thermal printer.
                    </div>
                  )
                ) : (
                  pairedPrinters.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {pairedPrinters.map((dev) => {
                        const isSelected = selectedPrinterAddress === dev.address;
                        return (
                          <button
                            key={dev.address}
                            type="button"
                            onClick={() => handleSelectPrinter(dev)}
                            className={`w-full p-2 rounded-xl text-left text-xs border transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-amber-400/20 border-amber-400 text-white font-bold'
                                : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'
                            }`}
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
                  )
                )}
              </div>
            </div>

            {/* Quick Guide */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 text-[11px] text-sand-300 space-y-1.5">
              <div className="font-bold text-white">
                {isElectron ? '💻 Windows Counter Setup:' : '📱 Pairing Steps:'}
              </div>
              {isElectron ? (
                <ol className="list-decimal pl-4 space-y-1 text-sand-400">
                  <li>Pair Bluetooth thermal printer or plug via USB cable.</li>
                  <li>Windows installs driver or Generic Text printer.</li>
                  <li>Select printer above (or leave Default).</li>
                  <li>Tap <strong>Print Test Slip</strong> to test silent print!</li>
                </ol>
              ) : (
                <ol className="list-decimal pl-4 space-y-1 text-sand-400">
                  <li>Turn ON your 58mm Bluetooth printer.</li>
                  <li>Go to phone's <strong>Android Bluetooth Settings</strong>.</li>
                  <li>Pair with printer (PIN is <code>0000</code> or <code>1234</code>).</li>
                  <li>Return here & tap <strong>Print Test Slip</strong>.</li>
                </ol>
              )}
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

              {isElectron && (
                <button
                  type="button"
                  onClick={() => BluetoothPrinter.openWindowsLogsFolder()}
                  className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sand-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Open Windows Logs Folder</span>
                </button>
              )}

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

      {/* 11. LOCAL WI-FI SYNC SERVER & CONNECTION MODAL */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#11131c] border border-emerald-500/30 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">
                  {isElectron ? 'Counter Wi-Fi Sync Server' : 'Connect to Counter POS'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="p-1 rounded-full text-sand-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isElectron ? (
              <>
                <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                    ● Server Running on Port 5050
                  </span>
                  <div className="font-mono text-base font-bold text-white bg-black/40 py-1.5 px-3 rounded-xl border border-white/10 inline-block">
                    {syncInfo?.ip || '127.0.0.1'}:5050
                  </div>
                  <p className="text-[11px] text-sand-400">
                    Waiters connect to this Counter IP over the local restaurant Wi-Fi to sync orders live.
                  </p>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white space-y-2 shadow-inner">
                  <QRCodeSVG
                    value={`http://${syncInfo?.ip || '127.0.0.1'}:5050`}
                    size={150}
                    level="M"
                  />
                  <span className="text-[10px] font-bold text-zinc-800 font-mono">
                    http://{syncInfo?.ip || '127.0.0.1'}:5050
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 text-[11px] text-sand-300 space-y-1.5">
                  <div className="font-bold text-white">📲 Instructions for Waiters:</div>
                  <ol className="list-decimal pl-4 space-y-1 text-sand-400">
                    <li>Connect phone to same hotel Wi-Fi (turn off Mobile Data 4G/5G).</li>
                    <li>Open Hotel RJ Waiter APK, or visit <strong className="text-white font-mono">http://{syncInfo?.ip || '127.0.0.1'}:5050</strong> directly in Chrome.</li>
                    <li>Tap <strong>Sync Counter</strong> in top header.</li>
                    <li>Counter IP is <strong className="text-white font-mono">{syncInfo?.ip || '127.0.0.1'}</strong>.</li>
                  </ol>
                  <p className="text-[10px] text-amber-400/90 pt-0.5">
                    💡 Tip: If using Chrome, open the local http link directly. Visiting from https:// will be blocked by Chrome as mixed content.
                  </p>
                </div>

                <div className="pt-2 border-t border-white/10 space-y-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if ((window as any).ElectronAPI?.fixFirewall) {
                        setFirewallStatusMsg('Applying firewall rule (check Windows prompt)...');
                        const res = await (window as any).ElectronAPI.fixFirewall();
                        setFirewallStatusMsg(res?.message || 'Rule applied');
                        setTimeout(() => setFirewallStatusMsg(null), 4000);
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>Unblock Windows Firewall (Port 5050)</span>
                  </button>
                  {firewallStatusMsg && (
                    <div className="text-[10px] text-center font-mono text-amber-300 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                      {firewallStatusMsg}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-sand-400">Sync Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isSyncConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-sand-400'
                      }`}
                    >
                      {isSyncConnected ? '● Connected to Counter PC' : '○ Offline / Local Mode'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase font-bold text-sand-400 tracking-wider block">
                    Counter PC IP Address:
                  </label>
                  <input
                    type="text"
                    value={counterInputUrl}
                    onChange={(e) => setCounterInputUrl(e.target.value)}
                    placeholder="e.g. 192.168.1.15:5050"
                    className="w-full text-xs font-mono bg-zinc-900 text-white p-2.5 rounded-xl border border-white/15 focus:border-emerald-400 focus:outline-none"
                  />
                  <p className="text-[10px] text-sand-400">
                    Look at the Counter POS screen on Windows to see the exact IP address.
                  </p>
                </div>

                {syncErrorDetail && (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-rose-400">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Sync Troubleshooting</span>
                    </div>
                    <div className="text-[10px] text-sand-300 font-mono bg-black/40 p-2 rounded-lg border border-white/5 break-words">
                      {syncErrorDetail}
                    </div>
                    <div className="space-y-1 text-[10px] text-sand-400">
                      <div>1. Ensure phone & PC are on the <strong>same Wi-Fi router</strong>.</div>
                      <div>2. On Desktop Counter POS, click <strong>"Unblock Windows Firewall"</strong> to allow Port 5050.</div>
                      <div>3. Verify IP on Counter POS screen matches what you typed.</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const target = counterInputUrl.trim();
                      if (!target) {
                        setIsSyncConnected(false);
                        return;
                      }
                      localStorage.setItem('hotel_rj_counter_sync_url', target);
                      setCounterSyncUrl(target);
                      const ok = await performManualSync(target);
                      if (ok) {
                        setTimeout(() => setIsSyncModalOpen(false), 900);
                      }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
                  >
                    Connect & Sync Now
                  </button>

                  {counterSyncUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('hotel_rj_counter_sync_url');
                        setCounterSyncUrl('');
                        setCounterInputUrl('');
                        setIsSyncConnected(false);
                        setPrintSuccessMsg('Disconnected from Counter');
                        setTimeout(() => setPrintSuccessMsg(null), 2500);
                      }}
                      className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-rose-400 text-xs font-semibold"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 11b. ACTIVE WAITERS & COUNTER NETWORK MODAL */}
      {isWaitersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#11131c] border border-blue-500/30 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Active Waiters Station</h3>
                  <p className="text-[10px] text-sand-400">
                    Live devices connected to this Counter POS (Port 5050)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWaitersModalOpen(false)}
                className="p-1 rounded-full text-sand-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Firewall Quick Action Card */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Windows Firewall Rule
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if ((window as any).ElectronAPI?.fixFirewall) {
                      setFirewallStatusMsg('Applying rule (check UAC popup)...');
                      const res = await (window as any).ElectronAPI.fixFirewall();
                      setFirewallStatusMsg(res?.message || 'Rule applied');
                      setTimeout(() => setFirewallStatusMsg(null), 4000);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30 active:scale-95 transition-all"
                >
                  Unblock Port 5050
                </button>
              </div>
              <p className="text-[10px] text-sand-400">
                If mobile waiters get "signal timeout", click above to allow incoming Wi-Fi connections through Windows Defender.
              </p>
              {firewallStatusMsg && (
                <div className="text-[10px] text-center font-mono text-amber-300 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                  {firewallStatusMsg}
                </div>
              )}
            </div>

            {/* Waiters List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[45vh]">
              {connectedWaiters.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-white/5 space-y-2">
                  <Users className="w-8 h-8 text-sand-600 mx-auto" />
                  <div className="text-xs font-semibold text-sand-300">No Waiters Connected Yet</div>
                  <p className="text-[11px] text-sand-500 max-w-xs mx-auto">
                    Waiters will appear here automatically as soon as they tap "Connect & Sync Now" or work on a table from their Android app.
                  </p>
                </div>
              ) : (
                connectedWaiters.map((w) => (
                  <div
                    key={w.id}
                    className="p-3 rounded-2xl bg-zinc-900/80 border border-white/10 flex items-center justify-between gap-3 hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">
                        {w.name?.charAt(0) || 'W'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white">{w.name}</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ONLINE
                          </span>
                        </div>
                        <div className="text-[10px] text-sand-400 font-mono flex items-center gap-2 mt-0.5">
                          <span>IP: {w.ip}</span>
                          <span>•</span>
                          <span className="text-sand-300">{w.device}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-bold text-amber-300">
                        {w.activeTable ? `Viewing ${w.activeTable}` : 'Lobby'}
                      </div>
                      <div className="text-[9px] text-sand-500 font-mono mt-0.5">
                        {new Date(w.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-sand-400">
              <span>Total Active: <strong className="text-white">{connectedWaiters.length}</strong></span>
              <button
                type="button"
                onClick={() => setIsWaitersModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. LIVE DEBUG CONSOLE & SYSTEM LOGS MODAL */}
      {isLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-4">
          <div className="w-full max-w-lg bg-[#0e1017] border border-amber-400/30 rounded-3xl p-4 shadow-2xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Live Debug Console</h3>
                  <p className="text-[10px] text-sand-400">
                    {isElectron
                      ? 'Windows Error & Warning Monitor (%APPDATA%)'
                      : 'Real-time logs for KOT, printer & errors'}
                  </p>
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
                <span className="font-bold text-white">
                  {isElectron
                    ? 'Windows Desktop App (Electron)'
                    : Capacitor.isNativePlatform()
                    ? 'Native Android APK'
                    : 'Web Browser'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
                <span className="text-sand-400 block">Native Engine:</span>
                <span
                  className={`font-bold ${
                    isElectron
                      ? 'text-emerald-400'
                      : BluetoothPrinter.isNativeAndroidAvailable()
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {isElectron
                    ? 'Active (Windows Silent Thermal)'
                    : BluetoothPrinter.isNativeAndroidAvailable()
                    ? 'Active (AndroidPrinter)'
                    : 'Web Mode'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
                <span className="text-sand-400 block">Active Table:</span>
                <span className="font-bold text-white">
                  {activeTable} ({totalItemsCount} items, {newItemsToFire.length} unfired)
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
                <span className="text-sand-400 block">Target Printer:</span>
                <span className="font-bold text-white truncate block">
                  {isElectron
                    ? selectedWindowsPrinter || 'Windows Default Device'
                    : localStorage.getItem('hotel_rj_printer_name') || 'Auto / Android Spooler'}
                </span>
              </div>
            </div>

            {/* Privacy notice */}
            {isElectron && (
              <div className="mb-2 p-2 rounded-xl bg-zinc-900/80 border border-white/10 text-[10px] text-sand-400 flex items-center justify-between">
                <span>📁 Errors and warnings saved to Windows logs folder. Order details omitted.</span>
                <button
                  type="button"
                  onClick={() => BluetoothPrinter.openWindowsLogsFolder()}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-sand-200 text-[9px] font-bold shrink-0 ml-2"
                >
                  Open Folder
                </button>
              </div>
            )}

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
                  const text =
                    `*HOTEL RJ POS LOGS*\nDate: ${new Date().toLocaleString()}\nPlatform: ${
                      isElectron ? 'Windows Desktop' : Capacitor.isNativePlatform() ? 'Android Native' : 'Browser'
                    }\n--------------------\n` +
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

      {/* 9E. RECENT BILLS HISTORY & VOID MANAGER MODAL */}
      {isBillsHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-stone-900 border border-gold-500/30 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] text-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>Recent Bills &amp; Sales History</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono">
                      {recentBillsList.length} Total
                    </span>
                  </h3>
                  <p className="text-xs text-stone-400">
                    Reprint duplicate bills or cancel voided orders with manager authorization
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={loadRecentBills}
                  disabled={loadingBills}
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all active:scale-95 disabled:opacity-50"
                  title="Refresh bills list"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingBills ? 'animate-spin text-gold-400' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsBillsHistoryOpen(false)}
                  className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="py-3 flex flex-col sm:flex-row gap-2 shrink-0 border-b border-stone-800/80">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search by Bill #, table, phone, or dish..."
                  value={billsSearchTerm}
                  onChange={(e) => setBillsSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-gold-400"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setBillsFilterStatus('all')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    billsFilterStatus === 'all'
                      ? 'bg-gold-500 text-black shadow-sm font-bold'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  All ({recentBillsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBillsFilterStatus('settled')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    billsFilterStatus === 'settled'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  🟢 Settled ({recentBillsList.filter((b) => b.status !== 'cancelled').length})
                </button>
                <button
                  type="button"
                  onClick={() => setBillsFilterStatus('cancelled')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    billsFilterStatus === 'cancelled'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  🔴 Cancelled ({recentBillsList.filter((b) => b.status === 'cancelled').length})
                </button>
              </div>
            </div>

            {/* Bills List Body */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
              {loadingBills ? (
                <div className="p-8 text-center text-stone-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gold-400" />
                  Loading bills from database...
                </div>
              ) : filteredRecentBills.length === 0 ? (
                <div className="p-10 text-center text-stone-400 border border-dashed border-stone-800 rounded-2xl">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-stone-600" />
                  <p className="text-sm font-bold text-stone-300">No matching bills found</p>
                  <p className="text-xs text-stone-500 mt-1">
                    When you settle a table or parcel, the bill will appear here permanently.
                  </p>
                </div>
              ) : (
                filteredRecentBills.map((b) => {
                  const isCancelled = b.status === 'cancelled';
                  return (
                    <div
                      key={b.id || b.billNumber}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isCancelled
                          ? 'bg-stone-950/80 border-rose-500/30 opacity-80'
                          : 'bg-stone-950 border-stone-800 hover:border-gold-500/40 shadow-sm'
                      }`}
                    >
                      {/* Top Header of Card */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-gold-300">
                            #{b.billNumber}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-stone-800 text-stone-200">
                            {b.tableId}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-stone-800/80 text-stone-400 border border-stone-700">
                            {b.department || 'restaurant'}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-stone-400">
                            {b.timestamp
                              ? new Date(b.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                          {isCancelled ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                              <Ban className="w-3 h-3" />
                              <span>CANCELLED</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              {(b.paymentMethod || 'cash').toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dishes summary */}
                      <div className="py-2 text-xs text-stone-300 leading-relaxed">
                        <div className="text-[11px] text-stone-400 line-clamp-2">
                          {(b.items || [])
                            .map((i: any) => `${i.quantity}x ${i.name}`)
                            .join(', ') || 'No item details recorded'}
                        </div>

                        {/* Cancellation note banner */}
                        {isCancelled && (
                          <div className="mt-2 p-2 rounded-xl bg-rose-950/40 border border-rose-900/50 text-[11px] text-rose-300 flex items-start gap-1.5">
                            <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Reason: </span>
                              <span>{b.cancelReason || 'Not specified'}</span>
                              <span className="text-stone-400 block text-[10px] mt-0.5">
                                Cancelled by {b.cancelledBy || 'Cashier'} at{' '}
                                {b.cancelledAt
                                  ? new Date(b.cancelledAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Amount and Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-stone-900">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[11px] text-stone-400">Total:</span>
                          <span
                            className={`font-mono font-bold text-base ${
                              isCancelled
                                ? 'line-through text-stone-500'
                                : 'text-gold-200'
                            }`}
                          >
                            ₹{b.total}
                          </span>
                          {isCancelled && (
                            <span className="text-[10px] font-bold text-rose-400">
                              (Deducted from sales)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Reprint Button */}
                          <button
                            type="button"
                            onClick={() => handleReprintSettledBill(b)}
                            className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                            title="Reprint customer bill"
                          >
                            <Printer className="w-3.5 h-3.5 text-gold-400" />
                            <span>Reprint</span>
                          </button>

                          {/* Cancel / Void Bill Button (only if active) */}
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => {
                                setBillToCancel(b);
                                setCancelPin('');
                                setCancelPinError(false);
                                setCustomCancelReason('');
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                              title="Cancel / Void this bill (Manager PIN required)"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-400" />
                              <span>Cancel Bill</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Bottom Close */}
            <div className="pt-3 border-t border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsBillsHistoryOpen(false)}
                className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-xl text-xs transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9F. CANCEL BILL AUTHORIZATION MODAL */}
      {billToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-stone-900 border border-rose-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-white">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-stone-800 pb-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                <AlertOctagon className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cancel &amp; Void Bill #{billToCancel.billNumber}</h3>
                <p className="text-xs text-rose-300">Manager Authorization Required</p>
              </div>
            </div>

            {/* Bill Info Card */}
            <div className="p-3 bg-stone-950 border border-rose-500/25 rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-400">Table / Room:</span>
                <span className="font-bold text-white">{billToCancel.tableId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Department:</span>
                <span className="text-gold-300 font-bold uppercase">{billToCancel.department || 'restaurant'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Payment Method:</span>
                <span className="font-mono text-emerald-400 font-bold uppercase">{billToCancel.paymentMethod}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-800/80">
                <span className="text-stone-300 font-semibold">Amount to Deduct:</span>
                <span className="font-mono text-rose-400 font-black text-base">₹{billToCancel.total}</span>
              </div>
            </div>

            <p className="text-[11px] text-stone-400 leading-relaxed">
              ⚠️ <strong>Warning:</strong> Cancelling this bill will deduct <strong className="text-white">₹{billToCancel.total}</strong> from Gross Revenue and today&apos;s Cash Drawer. An anti-theft entry will be permanently logged.
            </p>

            <form onSubmit={handleConfirmCancelBill} className="space-y-3.5 text-xs">
              {/* Manager PIN */}
              <div>
                <label className="block text-stone-300 font-semibold mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-gold-400" />
                  <span>Enter Manager PIN (1234 or 8888):</span>
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Enter 4-digit PIN"
                  value={cancelPin}
                  onChange={(e) => {
                    setCancelPin(e.target.value);
                    setCancelPinError(false);
                  }}
                  autoFocus
                  className={`w-full py-2.5 px-3 bg-stone-950 border rounded-xl text-center font-mono tracking-widest text-lg text-white focus:outline-none ${
                    cancelPinError ? 'border-rose-500 bg-rose-950/20' : 'border-stone-700 focus:border-gold-400'
                  }`}
                />
                {cancelPinError && (
                  <span className="text-[11px] text-rose-400 mt-1 block">
                    ❌ Incorrect PIN. Only authorized managers can void bills.
                  </span>
                )}
              </div>

              {/* Cancellation Reason Presets */}
              <div>
                <label className="block text-stone-300 font-semibold mb-1.5">
                  Mandatory Cancellation Reason:
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    'Entered Wrong Table / Duplicate',
                    'Customer Dispute / Returned Food',
                    'Customer Left Without Paying',
                    'Wrong Dish Punched / Prepared',
                    'Guest Changed Payment Method',
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setCancelReasonPreset(r);
                        setCustomCancelReason('');
                      }}
                      className={`py-2 px-3 rounded-xl text-left border transition-all text-xs ${
                        cancelReasonPreset === r && !customCancelReason
                          ? 'bg-rose-500/20 text-rose-200 border-rose-500/50 font-bold'
                          : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-white'
                      }`}
                    >
                      • {r}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <input
                    type="text"
                    placeholder="Or type custom reason..."
                    value={customCancelReason}
                    onChange={(e) => setCustomCancelReason(e.target.value)}
                    className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBillToCancel(null)}
                  className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-xl text-xs transition-all"
                >
                  Keep Bill
                </button>
                <button
                  type="submit"
                  disabled={isCancellingBill || !cancelPin.trim()}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{isCancellingBill ? 'Voiding...' : 'Confirm Void'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hotel Operations & Inventory Management Modal */}
      <HotelOperationsModal
        isOpen={isHotelOpsOpen}
        onClose={() => setIsHotelOpsOpen(false)}
        onDataChanged={() => loadHotelOpsData()}
      />
    </div>
  );
};
