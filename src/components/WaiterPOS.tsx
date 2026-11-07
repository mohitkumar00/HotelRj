import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { verifyManagerPin, formatLock } from '../utils/pin';
import { MENU_CATEGORIES } from '../data/menuData';
import { MenuItem, DietaryType, MenuCategory, TableConfigItem } from '../types';
import {
  BluetoothPrinter,
  KOTPrintData,
  BillPrintData,
} from '../utils/thermalPrinter';
import { Logger, LogEntry } from '../utils/logger';
import { Capacitor } from '@capacitor/core';
import { Search, Plus, Minus, Printer, Check, X, User, ChevronUp, ShoppingBag, Edit3, Bug, RefreshCw, Wifi, WifiOff, Monitor, Users, PlusCircle, TrendingUp, Receipt, Sliders, AlertTriangle, Calendar } from 'lucide-react';
import { parseItemPrice } from '../utils/priceUtils';
import { OwnerInsights } from './OwnerInsights';
import { HotelOperationsModal } from './HotelOperationsModal';
import { BanquetCalendarModal } from './BanquetCalendarModal';
import { fetchMenuApi, fetchTablesConfigApi } from '../utils/hotelDataApi';
import {
  settleBill,
  recordAuditLog,
  cancelBillApi,
  fetchRecentBills,
  SettleBillPayload,
} from '../utils/analyticsApi';
import { mergeTables, type TableOrder, type WaiterItemRecord } from '../utils/tableMerge';
import type { ConnectedWaiter, SyncServerInfo } from './pos/types';
import { ALL_TABLE_IDS } from './pos/constants';
import { ManagerMenuModal } from './pos/ManagerMenuModal';
import { ManagerPinPromptModal } from './pos/ManagerPinPromptModal';
import { CancelBillModal } from './pos/CancelBillModal';
import { BillsHistoryModal } from './pos/BillsHistoryModal';
import { LogsModal } from './pos/LogsModal';
import { WaitersModal } from './pos/WaitersModal';
import { SyncModal } from './pos/SyncModal';
import { PrinterModal } from './pos/PrinterModal';
import { ItemNoteModal } from './pos/ItemNoteModal';
import { VoidItemModal } from './pos/VoidItemModal';
import { SettleBillModal } from './pos/SettleBillModal';
import { CustomDishModal } from './pos/CustomDishModal';
import { OrderDrawer } from './pos/OrderDrawer';

interface WaiterPOSProps {
  onSwitchToGuestMenu?: () => void;
}

export const WaiterPOS: React.FC<WaiterPOSProps> = ({ onSwitchToGuestMenu }) => {
  // Active selected table / parcel
  const [activeTable, setActiveTable] = useState<string>('T-1');
  const [tableFilter, setTableFilter] = useState<'all' | 'dinein' | 'takeaway' | 'rooms' | 'banquet' | 'active'>('all');
  const isIncomingSyncRef = useRef<boolean>(false);

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
  const [counterInputToken, setCounterInputToken] = useState<string>(() => localStorage.getItem('hotel_rj_sync_token') || '');
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
          isIncomingSyncRef.current = true;
          setTables((prev) => {
            const merged = mergeTables(prev, data.tables);
            if (activeTable && prev[activeTable]) {
              merged[activeTable] = prev[activeTable];
            }
            return merged;
          });
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
          isIncomingSyncRef.current = true;
          setTables((prev) => mergeTables(prev, data.tables));
        }
        Logger.success('Sync', `✅ Connected & Synced with Counter PC at ${cleanUrl}!`);
        setPrintSuccessMsg('✅ Connected & Synced with Counter PC!');
        setTimeout(() => setPrintSuccessMsg(null), 3500);
        return true;
      } else {
        setIsSyncConnected(false);
        const errMsg =
          postRes.status === 401
            ? 'Pairing code missing or wrong. Enter the code shown on the Counter POS screen.'
            : postRes.status === 429
              ? 'Too many wrong codes. Wait 5 minutes and try again.'
              : `Counter PC returned HTTP ${postRes.status} (${postRes.statusText})`;
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

    if (isIncomingSyncRef.current) {
      isIncomingSyncRef.current = false;
      return;
    }

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
          isIncomingSyncRef.current = true;
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
              isIncomingSyncRef.current = true;
              setTables((prev) => {
                const merged = mergeTables(prev, data.tables);
                const cur = prev[activeTable];
                const hasUnfired = cur && Object.values(cur.items || {}).some(it => (it.quantity || 0) > (it.firedCount || 0));
                if (hasUnfired && cur) {
                  merged[activeTable] = cur;
                }
                return merged;
              });
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
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<'cash' | 'upi' | 'card' | 'room-folio' | 'split'>('cash');
  const [splitCashAmount, setSplitCashAmount] = useState<string>('');
  const [splitUpiAmount, setSplitUpiAmount] = useState<string>('');
  const [splitCardAmount, setSplitCardAmount] = useState<string>('');
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
  const [cancelPinMessage, setCancelPinMessage] = useState('');
  const [cancelReasonPreset, setCancelReasonPreset] = useState('Entered Wrong Table / Duplicate');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [isCancellingBill, setIsCancellingBill] = useState(false);

  // Hotel Operations Modal State (Dishes, Kitchen 86 Sold-Out, Rooms & Tables)
  const [isHotelOpsOpen, setIsHotelOpsOpen] = useState(false);

  // Banquet Event Calendar State
  const [isBanquetCalendarOpen, setIsBanquetCalendarOpen] = useState(false);

  // Responsive Manager Hub & Mobile PIN Authorization State
  const [isManagerMenuOpen, setIsManagerMenuOpen] = useState(false);
  const [isManagerPinPromptOpen, setIsManagerPinPromptOpen] = useState(false);
  const [targetManagerAction, setTargetManagerAction] = useState<
    'insights' | 'menu' | 'banquet' | 'bills' | 'printer' | 'logs' | null
  >(null);
  const [managerPinInput, setManagerPinInput] = useState('');
  const [managerPinError, setManagerPinError] = useState<string | null>(null);
  const [isCheckingManagerPin, setIsCheckingManagerPin] = useState(false);

  const handleOpenManagerAction = (
    action: 'insights' | 'menu' | 'banquet' | 'bills' | 'printer' | 'logs'
  ) => {
    setIsManagerMenuOpen(false);
    const isAuth = sessionStorage.getItem('hotel_rj_owner_auth') === 'true';

    // Printer and debug logs don't strictly require owner PIN
    if (action === 'printer') {
      setIsPrinterModalOpen(true);
      return;
    }
    if (action === 'logs') {
      setIsLogsModalOpen(true);
      return;
    }

    if (isAuth) {
      if (action === 'insights') setShowOwnerInsights(true);
      else if (action === 'menu') setIsHotelOpsOpen(true);
      else if (action === 'banquet') setIsBanquetCalendarOpen(true);
      else if (action === 'bills') {
        setIsBillsHistoryOpen(true);
        loadRecentBills();
      }
      return;
    }

    // Not authenticated: prompt for manager PIN
    setTargetManagerAction(action);
    setManagerPinInput('');
    setManagerPinError(null);
    setIsManagerPinPromptOpen(true);
  };

  const handleManagerPinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!managerPinInput.trim()) return;
    setIsCheckingManagerPin(true);
    setManagerPinError(null);
    try {
      const res = await verifyManagerPin(managerPinInput.trim());
      if (res.ok) {
        sessionStorage.setItem('hotel_rj_owner_auth', 'true');
        setIsManagerPinPromptOpen(false);
        const action = targetManagerAction;
        setTargetManagerAction(null);
        setManagerPinInput('');
        if (action === 'insights') setShowOwnerInsights(true);
        else if (action === 'menu') setIsHotelOpsOpen(true);
        else if (action === 'banquet') setIsBanquetCalendarOpen(true);
        else if (action === 'bills') {
          setIsBillsHistoryOpen(true);
          loadRecentBills();
        }
      } else {
        setManagerPinError(
          res.reason === 'locked'
            ? `Too many attempts. Try again in ${formatLock(res.remainingMs || 0)}.`
            : 'Incorrect Manager PIN.'
        );
      }
    } catch (err: any) {
      setManagerPinError(err?.message || 'Error verifying PIN');
    } finally {
      setIsCheckingManagerPin(false);
    }
  };
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
        paymentMode:
          bill.paymentMethod === 'split'
            ? `SPLIT (Cash ₹${bill.paymentDetails?.cashAmount || 0} + UPI ₹${bill.paymentDetails?.upiAmount || 0})`
            : (bill.paymentMethod || 'cash').toUpperCase(),
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

    const pinResult = await verifyManagerPin(cancelPin);
    if (!pinResult.ok) {
      setCancelPinError(true);
      setCancelPinMessage(
        pinResult.reason === 'locked'
          ? `Too many attempts. Try again in ${formatLock(pinResult.remainingMs || 0)}.`
          : 'Incorrect PIN. Only authorized managers can void bills.'
      );
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
            kotNumber: (prev[activeTable]?.kotNumber || 1) + 1,
            items: {},
            generalNote: '',
            updatedAt: Date.now(),
          },
        }));
        setIsOrderDrawerOpen(false);
      }
      return;
    }
    setSplitCashAmount('');
    setSplitUpiAmount('');
    setSplitCardAmount('');
    setSettlePaymentMethod('cash');
    setIsSettleModalOpen(true);
  };

  const handleSplitCashChange = (val: string) => {
    setSplitCashAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= grandTotal) {
      const remaining = Math.round((grandTotal - num - (parseFloat(splitCardAmount) || 0)) * 100) / 100;
      setSplitUpiAmount(remaining >= 0 ? String(remaining) : '0');
    }
  };

  const handleSplitUpiChange = (val: string) => {
    setSplitUpiAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= grandTotal) {
      const remaining = Math.round((grandTotal - num - (parseFloat(splitCardAmount) || 0)) * 100) / 100;
      setSplitCashAmount(remaining >= 0 ? String(remaining) : '0');
    }
  };

  const currentSplitSum = useMemo(() => {
    const c = parseFloat(splitCashAmount) || 0;
    const u = parseFloat(splitUpiAmount) || 0;
    const card = parseFloat(splitCardAmount) || 0;
    return Math.round((c + u + card) * 100) / 100;
  }, [splitCashAmount, splitUpiAmount, splitCardAmount]);

  const splitDifference = useMemo(() => {
    return Math.round((grandTotal - currentSplitSum) * 100) / 100;
  }, [grandTotal, currentSplitSum]);

  const isSplitBalanced = useMemo(() => {
    return Math.abs(splitDifference) < 0.05 && currentSplitSum > 0;
  }, [splitDifference, currentSplitSum]);

  // Action: CONFIRM SETTLEMENT & SAVE TO DATABASE
  const handleConfirmSettlement = async () => {
    setIsSubmittingSettlement(true);
    try {
      if (settlePaymentMethod === 'split') {
        const c = Number(splitCashAmount) || 0;
        const u = Number(splitUpiAmount) || 0;
        const card = Number(splitCardAmount) || 0;
        const sum = Math.round((c + u + card) * 100) / 100;
        if (Math.abs(sum - grandTotal) > 0.05) {
          alert(`⚠️ Split amounts (₹${sum.toFixed(2)}) must equal the total bill (₹${grandTotal.toFixed(2)})!`);
          setIsSubmittingSettlement(false);
          return;
        }
      }

      const cashAmt = settlePaymentMethod === 'cash' ? grandTotal : settlePaymentMethod === 'split' ? (Number(splitCashAmount) || 0) : 0;
      const upiAmt = settlePaymentMethod === 'upi' ? grandTotal : settlePaymentMethod === 'split' ? (Number(splitUpiAmount) || 0) : 0;
      const cardAmt = settlePaymentMethod === 'card' ? grandTotal : settlePaymentMethod === 'split' ? (Number(splitCardAmount) || 0) : 0;

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
          cashAmount: cashAmt,
          upiAmount: upiAmt,
          cardAmount: cardAmt,
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
          kotNumber: (prev[activeTable]?.kotNumber || 1) + 1,
          items: {},
          generalNote: '',
          updatedAt: Date.now(),
        },
      }));

      const methodDisplay = settlePaymentMethod === 'split'
        ? `SPLIT (Cash ₹${cashAmt} + UPI ₹${upiAmt})`
        : settlePaymentMethod.toUpperCase();
      setPrintSuccessMsg(`✅ Bill (₹${grandTotal}) settled via ${methodDisplay} & saved to DB!`);
      setTimeout(() => setPrintSuccessMsg(null), 3500);

      setIsSettleModalOpen(false);
      setIsOrderDrawerOpen(false);
      setSettleCustomerPhone('');
      setSettleCustomerName('');
      setSplitCashAmount('');
      setSplitUpiAmount('');
      setSplitCardAmount('');
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
    if (tableFilter === 'banquet') {
      return currentTableIds.filter((t) => {
        const lower = t.toLowerCase();
        return lower.includes('banquet') || lower.includes('lawn') || lower.includes('property') || lower.includes('hall');
      });
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

            {/* Mobile / Android: Dedicated Touch-Friendly Manager & Owner Portal Button */}
            <button
              type="button"
              onClick={() => setIsManagerMenuOpen(true)}
              className="lg:hidden px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/25 via-gold-500/25 to-amber-500/25 hover:from-amber-500/40 hover:to-gold-500/40 text-gold-300 text-xs font-bold flex items-center gap-1.5 border border-gold-500/40 active:scale-95 transition-all shadow-md"
              title="Open Manager & Owner Portal (Insights, Menu, Rooms, Banquet)"
            >
              <Sliders className="w-3.5 h-3.5 text-gold-400" />
              <span>Manager</span>
            </button>

            {/* DESKTOP CONTROLS (Hidden on mobile phones to prevent header overflow) */}
            <div className="hidden lg:flex items-center gap-1.5">
              {/* Live Debug Logs Button */}
              <button
                type="button"
                onClick={() => setIsLogsModalOpen(true)}
                className="px-2 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1 border border-white/10 active:scale-95 transition-all"
                title="Live Debug Console & System Logs"
              >
                <Bug className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px]">Logs</span>
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
                <span className="text-[10px]">Bills History</span>
              </button>

              {/* Banquet Event Calendar Button */}
              <button
                type="button"
                onClick={() => setIsBanquetCalendarOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold flex items-center gap-1.5 border border-amber-500/30 active:scale-95 transition-all shadow-sm"
                title="Banquet & Lawn Advance Bookings Calendar"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px]">Banquet</span>
              </button>

              {/* Hotel Operations & Inventory Modal Button */}
              <button
                type="button"
                onClick={() => handleOpenManagerAction('menu')}
                className="px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-semibold flex items-center gap-1.5 border border-purple-500/30 active:scale-95 transition-all shadow-sm"
                title="Manage Dishes, Kitchen 86 Sold-Out, Rooms & Tables"
              >
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px]">Menu & Rooms</span>
              </button>

              {/* Owner Insights & Anti-Theft Analytics Button */}
              <button
                type="button"
                onClick={() => handleOpenManagerAction('insights')}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-gold-500/20 hover:from-amber-500/30 hover:to-gold-500/30 text-gold-300 text-xs font-bold flex items-center gap-1.5 border border-gold-500/30 active:scale-95 transition-all shadow-sm"
                title="Open Owner Analytics, Anti-Theft Ledger & Daily Kharacha"
              >
                <TrendingUp className="w-3.5 h-3.5 text-gold-400" />
                <span className="text-[10px]">Owner Insights</span>
              </button>
            </div>

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
                  { id: 'banquet', label: '🎉 Banquet' },
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

          {/* Banquet Calendar Quick Action Banner */}
          {tableFilter === 'banquet' && (
            <div className="bg-gradient-to-r from-amber-500/20 via-zinc-900 to-amber-500/15 border border-amber-500/40 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/25 border border-amber-500/40 text-amber-300 flex items-center justify-center font-bold text-base shadow">
                  🎉
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black text-white">Banquet & Lawn Advance Bookings</h4>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Duplicate Protection Active
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Plan birthdays, weddings & corporate events months in advance with custom hours & conflict detection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBanquetCalendarOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
              >
                <Calendar className="w-4 h-4" />
                <span>Open Event Calendar</span>
              </button>
            </div>
          )}

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
        <OrderDrawer
          activeTable={activeTable}
          serverName={serverName}
          currentOrder={currentOrder}
          setIsOrderDrawerOpen={setIsOrderDrawerOpen}
          currentItemsList={currentItemsList}
          setIsCustomModalOpen={setIsCustomModalOpen}
          newItemsToFire={newItemsToFire}
          openNoteEditor={openNoteEditor}
          handleRemoveItem={handleRemoveItem}
          handleFireKOT={handleFireKOT}
          alreadyFiredItems={alreadyFiredItems}
          applyGst={applyGst}
          setApplyGst={setApplyGst}
          totalItemsCount={totalItemsCount}
          subtotalPrice={subtotalPrice}
          gstAmount={gstAmount}
          grandTotal={grandTotal}
          handlePrintBill={handlePrintBill}
          handleSendWhatsApp={handleSendWhatsApp}
          handleOpenSettleModal={handleOpenSettleModal}
        />
      )}

      {/* 9B. CUSTOM DISH & HOTEL SERVICE MODAL */}
      {isCustomModalOpen && (
        <CustomDishModal
          activeTable={activeTable}
          setIsCustomModalOpen={setIsCustomModalOpen}
          setCustomDishName={setCustomDishName}
          setCustomDishPrice={setCustomDishPrice}
          setCustomDietary={setCustomDietary}
          handleAddCustomDish={handleAddCustomDish}
          customDishName={customDishName}
          customDishPrice={customDishPrice}
          setCustomQuantity={setCustomQuantity}
          customQuantity={customQuantity}
          customDietary={customDietary}
          customNotes={customNotes}
          setCustomNotes={setCustomNotes}
        />
      )}

      {/* 9C. BILL SETTLEMENT & LOCAL DATABASE SAVE MODAL */}
      {isSettleModalOpen && (
        <SettleBillModal
          activeTable={activeTable}
          currentItemsList={currentItemsList}
          subtotalPrice={subtotalPrice}
          setIsSettleModalOpen={setIsSettleModalOpen}
          grandTotal={grandTotal}
          applyGst={applyGst}
          gstAmount={gstAmount}
          setSettleDepartment={setSettleDepartment}
          settleDepartment={settleDepartment}
          setSettlePaymentMethod={setSettlePaymentMethod}
          settlePaymentMethod={settlePaymentMethod}
          splitCashAmount={splitCashAmount}
          splitUpiAmount={splitUpiAmount}
          setSplitCashAmount={setSplitCashAmount}
          setSplitUpiAmount={setSplitUpiAmount}
          setSplitCardAmount={setSplitCardAmount}
          handleSplitCashChange={handleSplitCashChange}
          handleSplitUpiChange={handleSplitUpiChange}
          isSplitBalanced={isSplitBalanced}
          splitDifference={splitDifference}
          settleRoomNumber={settleRoomNumber}
          setSettleRoomNumber={setSettleRoomNumber}
          settleCustomerPhone={settleCustomerPhone}
          setSettleCustomerPhone={setSettleCustomerPhone}
          isSubmittingSettlement={isSubmittingSettlement}
          handleConfirmSettlement={handleConfirmSettlement}
        />
      )}

      {/* 9D. ANTI-THEFT KOT VOID INTERCEPTION MODAL */}
      {isVoidModalOpen && voidCandidate && (
        <VoidItemModal
          voidCandidate={voidCandidate}
          activeTable={activeTable}
          setVoidReason={setVoidReason}
          setCustomVoidReason={setCustomVoidReason}
          voidReason={voidReason}
          customVoidReason={customVoidReason}
          setVoidCandidate={setVoidCandidate}
          setIsVoidModalOpen={setIsVoidModalOpen}
          handleConfirmVoid={handleConfirmVoid}
        />
      )}

      {/* 9. COOKING NOTES & INSTRUCTIONS POPUP (LESS SPICY, JAIN, ETC.) */}
      {customizingItem && (
        <ItemNoteModal
          customizingItem={customizingItem}
          setCustomizingItem={setCustomizingItem}
          setCustomNoteText={setCustomNoteText}
          customNoteText={customNoteText}
          handleSaveItemNote={handleSaveItemNote}
        />
      )}

      {/* 10. THERMAL PRINTER INSTRUCTIONS & SETUP MODAL */}
      {isPrinterModalOpen && (
        <PrinterModal
          isElectron={isElectron}
          setIsPrinterModalOpen={setIsPrinterModalOpen}
          refreshWindowsPrinters={refreshWindowsPrinters}
          refreshPairedDevices={refreshPairedDevices}
          windowsPrinters={windowsPrinters}
          handleSelectWindowsPrinter={handleSelectWindowsPrinter}
          selectedWindowsPrinter={selectedWindowsPrinter}
          pairedPrinters={pairedPrinters}
          selectedPrinterAddress={selectedPrinterAddress}
          handleSelectPrinter={handleSelectPrinter}
          triggerHaptic={triggerHaptic}
          setPrintSuccessMsg={setPrintSuccessMsg}
          setIsLogsModalOpen={setIsLogsModalOpen}
          logs={logs}
        />
      )}

      {/* 11. LOCAL WI-FI SYNC SERVER & CONNECTION MODAL */}
      {isSyncModalOpen && (
        <SyncModal
          isElectron={isElectron}
          setIsSyncModalOpen={setIsSyncModalOpen}
          syncInfo={syncInfo}
          setFirewallStatusMsg={setFirewallStatusMsg}
          firewallStatusMsg={firewallStatusMsg}
          isSyncConnected={isSyncConnected}
          counterInputUrl={counterInputUrl}
          setCounterInputUrl={setCounterInputUrl}
          counterInputToken={counterInputToken}
          setCounterInputToken={setCounterInputToken}
          syncErrorDetail={syncErrorDetail}
          setIsSyncConnected={setIsSyncConnected}
          setCounterSyncUrl={setCounterSyncUrl}
          performManualSync={performManualSync}
          counterSyncUrl={counterSyncUrl}
          setPrintSuccessMsg={setPrintSuccessMsg}
        />
      )}

      {/* 11b. ACTIVE WAITERS & COUNTER NETWORK MODAL */}
      {isWaitersModalOpen && (
        <WaitersModal
          setIsWaitersModalOpen={setIsWaitersModalOpen}
          setFirewallStatusMsg={setFirewallStatusMsg}
          firewallStatusMsg={firewallStatusMsg}
          connectedWaiters={connectedWaiters}
        />
      )}

      {/* 12. LIVE DEBUG CONSOLE & SYSTEM LOGS MODAL */}
      {isLogsModalOpen && (
        <LogsModal
          isElectron={isElectron}
          setIsLogsModalOpen={setIsLogsModalOpen}
          activeTable={activeTable}
          totalItemsCount={totalItemsCount}
          newItemsToFire={newItemsToFire}
          selectedWindowsPrinter={selectedWindowsPrinter}
          logs={logs}
          setPrintSuccessMsg={setPrintSuccessMsg}
        />
      )}

      {/* 9E. RECENT BILLS HISTORY & VOID MANAGER MODAL */}
      {isBillsHistoryOpen && (
        <BillsHistoryModal
          recentBillsList={recentBillsList}
          loadRecentBills={loadRecentBills}
          loadingBills={loadingBills}
          setIsBillsHistoryOpen={setIsBillsHistoryOpen}
          billsSearchTerm={billsSearchTerm}
          setBillsSearchTerm={setBillsSearchTerm}
          setBillsFilterStatus={setBillsFilterStatus}
          billsFilterStatus={billsFilterStatus}
          filteredRecentBills={filteredRecentBills}
          handleReprintSettledBill={handleReprintSettledBill}
          setBillToCancel={setBillToCancel}
          setCancelPin={setCancelPin}
          setCancelPinError={setCancelPinError}
          setCustomCancelReason={setCustomCancelReason}
        />
      )}

      {/* 9F. CANCEL BILL AUTHORIZATION MODAL */}
      {billToCancel && (
        <CancelBillModal
          billToCancel={billToCancel}
          handleConfirmCancelBill={handleConfirmCancelBill}
          cancelPin={cancelPin}
          setCancelPin={setCancelPin}
          setCancelPinError={setCancelPinError}
          cancelPinError={cancelPinError}
          cancelPinMessage={cancelPinMessage}
          setCancelReasonPreset={setCancelReasonPreset}
          setCustomCancelReason={setCustomCancelReason}
          cancelReasonPreset={cancelReasonPreset}
          customCancelReason={customCancelReason}
          setBillToCancel={setBillToCancel}
          isCancellingBill={isCancellingBill}
        />
      )}

      {/* Hotel Operations & Inventory Management Modal */}
      <HotelOperationsModal
        isOpen={isHotelOpsOpen}
        onClose={() => setIsHotelOpsOpen(false)}
        onDataChanged={() => loadHotelOpsData()}
      />

      {/* Banquet Event Calendar Modal */}
      <BanquetCalendarModal
        isOpen={isBanquetCalendarOpen}
        onClose={() => setIsBanquetCalendarOpen(false)}
        serverName={serverName}
      />

      {/* Manager Access PIN Prompt Modal */}
      {isManagerPinPromptOpen && (
        <ManagerPinPromptModal
          handleManagerPinSubmit={handleManagerPinSubmit}
          managerPinInput={managerPinInput}
          setManagerPinInput={setManagerPinInput}
          setManagerPinError={setManagerPinError}
          managerPinError={managerPinError}
          setIsManagerPinPromptOpen={setIsManagerPinPromptOpen}
          setTargetManagerAction={setTargetManagerAction}
          isCheckingManagerPin={isCheckingManagerPin}
        />
      )}

      {/* Manager Action Hub Sheet (Mobile & Quick Access) */}
      {isManagerMenuOpen && (
        <ManagerMenuModal
          setIsManagerMenuOpen={setIsManagerMenuOpen}
          handleOpenManagerAction={handleOpenManagerAction}
        />
      )}
    </div>
  );
};
