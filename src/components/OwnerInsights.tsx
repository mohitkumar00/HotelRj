import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Smartphone,
  ChefHat,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  PlusCircle,
  Trash2,
  Share2,
  Lock,
  AlertTriangle,
  Receipt,
  Download,
  Building,
  PartyPopper,
  UtensilsCrossed,
  Calendar,
  Layers,
  Cloud,
  Database,
  Check,
  Ban,
} from 'lucide-react';
import {
  fetchAnalytics,
  addExpense,
  removeExpense,
  exportDatabaseBackup,
  getCloudSyncConfig,
  saveCloudSyncConfig,
  testCloudSyncConnection,
  triggerCloudSyncNow,
  AnalyticsSummary,
  AnalyticsQueryOptions,
  CloudSyncPublicConfig,
} from '../utils/analyticsApi';
import { HOTEL_INFO } from '../data/hotelData';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_KEYS } from '../config';
import { verifyManagerPin, formatLock } from '../utils/pin';
import { PairDeviceModal } from './PairDeviceModal';
import { PairedDevicesPanel } from './PairedDevicesPanel';

interface OwnerInsightsProps {
  onBack: () => void;
  serverUrl?: string;
}

export const OwnerInsights: React.FC<OwnerInsightsProps> = ({ onBack }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('hotel_rj_owner_auth') === 'true';
  });
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isPairOpen, setIsPairOpen] = useState<boolean>(false);

  // Filter States
  const [period, setPeriod] = useState<AnalyticsQueryOptions['period']>('today');
  const [department, setDepartment] = useState<'all' | 'restaurant' | 'rooms' | 'banquet'>('all');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11');

  const [loading, setLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  // Expense modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [expenseCategory, setExpenseCategory] = useState<string>('Kitchen / Vegetables');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expensePaidBy, setExpensePaidBy] = useState<'Cash Drawer' | 'UPI'>('Cash Drawer');
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  const [expenseSubmitting, setExpenseSubmitting] = useState<boolean>(false);

  // Cloud Sync state
  const [cloudConfig, setCloudConfig] = useState<CloudSyncPublicConfig | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);
  const [inputSupabaseUrl, setInputSupabaseUrl] = useState<string>(() => SUPABASE_URL);
  const [inputSupabaseKey, setInputSupabaseKey] = useState<string>(() => SUPABASE_ANON_KEY);
  const [testingCloud, setTestingCloud] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [syncingCloud, setSyncingCloud] = useState<boolean>(false);

  // WhatsApp share modal
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [targetPhone, setTargetPhone] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ownerPhone) || '';
  });

  const loadCloudConfig = async () => {
    try {
      const cfg = await getCloudSyncConfig();
      if (cfg) {
        setCloudConfig(cfg);
        if (cfg.supabaseUrl && !inputSupabaseUrl) setInputSupabaseUrl(cfg.supabaseUrl);
      }
    } catch (e) {
      console.warn('Failed to load cloud config:', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAnalytics({
        period,
        department,
        year: selectedYear,
        month: selectedMonth,
      });
      setAnalytics(data);
    } catch (e) {
      console.error('Error loading analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      loadCloudConfig();
    }
  }, [isAuthenticated, period, department, selectedYear, selectedMonth]);

  const handleTestCloudConnection = async () => {
    setTestingCloud(true);
    setTestResult(null);
    try {
      const result = await testCloudSyncConnection(inputSupabaseUrl, inputSupabaseKey);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingCloud(false);
    }
  };

  const handleSaveCloudConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await saveCloudSyncConfig({
        supabaseUrl: inputSupabaseUrl.trim(),
        supabaseAnonKey: inputSupabaseKey.trim(),
        autoSyncEnabled: true,
      });
      if (res.success) {
        alert('✅ Supabase configuration saved! Background cloud sync is active.');
        loadCloudConfig();
        setIsCloudModalOpen(false);
      } else {
        alert(`Failed to save: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error saving cloud config: ${err.message}`);
    }
  };

  const handleTriggerCloudSync = async () => {
    setSyncingCloud(true);
    try {
      const res = await triggerCloudSyncNow();
      if (res.success) {
        alert(`✅ Synced ${res.syncedBills || 0} bills to Supabase successfully!`);
        loadCloudConfig();
      } else {
        alert(`Cloud sync issue: ${res.error || 'Check internet connection'}`);
      }
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setSyncingCloud(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await verifyManagerPin(enteredPin);
    if (result.ok) {
      setIsAuthenticated(true);
      sessionStorage.setItem('hotel_rj_owner_auth', 'true');
      setPinError(null);
    } else {
      setPinError(
        result.reason === 'locked'
          ? `Too many attempts. Try again in ${formatLock(result.remainingMs || 0)}.`
          : 'Incorrect PIN.'
      );
      setEnteredPin('');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) return;

    setExpenseSubmitting(true);
    await addExpense({
      category: expenseCategory,
      amount: amt,
      paidBy: expensePaidBy,
      notes: expenseNotes.trim(),
      recordedBy: 'Owner/Manager',
    });
    setExpenseSubmitting(false);
    setExpenseAmount('');
    setExpenseNotes('');
    setIsExpenseModalOpen(false);
    loadData();
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense record?')) {
      await removeExpense(id);
      loadData();
    }
  };

  // 1-Click Database Export to CSV / Excel
  const handleExportBackup = async (format: 'csv' | 'json' = 'csv') => {
    setExporting(true);
    try {
      const result = await exportDatabaseBackup();
      if (!result.success) {
        alert('Could not export backup. Please ensure POS server is active.');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      if (format === 'csv' && result.csvContent) {
        const blob = new Blob([result.csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HotelRJ-Bills-Backup-${timestamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (result.jsonData) {
        const blob = new Blob([JSON.stringify(result.jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HotelRJ-Database-Backup-${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Generate formatted WhatsApp summary
  const whatsappSummaryText = useMemo(() => {
    if (!analytics) return '';

    const dateStr = analytics.dateFormatted || new Date().toISOString().split('T')[0];
    const topDishesList = (analytics.topDishes || [])
      .slice(0, 5)
      .map((d, i) => `${i + 1}. ${d.name} (${d.quantity} plates - ₹${d.revenue})`)
      .join('\n');

    const restRev = analytics.departments.restaurant.revenue;
    const roomRev = analytics.departments.rooms.revenue;
    const banqRev = analytics.departments.banquet.revenue;

    return `🏨 *HOTEL RJ — EXECUTIVE BUSINESS DIGEST*
📅 *Period:* ${analytics.period.toUpperCase()} (${dateStr})
🏢 *Filter:* ${department === 'all' ? 'All Departments' : department.toUpperCase()}
⏰ *Generated:* ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}

💰 *TOTAL GROSS REVENUE: ₹${analytics.grossRevenue.toLocaleString('en-IN')}* (${analytics.billsCount} Bills)

🏢 *DEPARTMENT BREAKDOWN:*
• 🍽️ Restaurant: *₹${restRev.toLocaleString('en-IN')}* (${analytics.departments.restaurant.count} orders)
  └─ Custom Meat Making: ₹${analytics.departments.restaurant.customCookingRevenue.toLocaleString('en-IN')} (${analytics.departments.restaurant.customKgEstimate} Kg)
• 🛏️ Rooms & Lodging: *₹${roomRev.toLocaleString('en-IN')}* (${analytics.departments.rooms.count} stays)
• 🎉 Banquet & Events: *₹${banqRev.toLocaleString('en-IN')}* (${analytics.departments.banquet.count} functions)

💵 *PAYMENT COLLECTIONS:*
• Cash in Drawer: ₹${analytics.paymentSplit.cash.toLocaleString('en-IN')}
• UPI Collections: ₹${analytics.paymentSplit.upi.toLocaleString('en-IN')}
${analytics.paymentSplit.roomFolio > 0 ? `• Room Folios: ₹${analytics.paymentSplit.roomFolio.toLocaleString('en-IN')}\n` : ''}
${analytics.paymentSplit.card > 0 ? `• Card/POS: ₹${analytics.paymentSplit.card.toLocaleString('en-IN')}\n` : ''}

📉 *EXPENSES & NET MARGIN:*
• Petty Expenses: ₹${analytics.expenses.total.toLocaleString('en-IN')}
• *Net Profit:* *₹${analytics.netProfit.toLocaleString('en-IN')}*

🛡️ *ANTI-THEFT & VOID AUDIT:*
• Voided Items: ${analytics.antiTheft.voidsCount} items (₹${analytics.antiTheft.voidAmount.toLocaleString('en-IN')})
${analytics.antiTheft.cancelledBillsCount ? `• Cancelled Bills: ${analytics.antiTheft.cancelledBillsCount} bills (₹${(analytics.antiTheft.cancelledBillsAmount || 0).toLocaleString('en-IN')})\n` : ''}

🏆 *TOP 5 RESTAURANT DISHES:*
${topDishesList || '• None recorded'}

--------------------------------
_Saved permanently in Hotel RJ Database_`;
  }, [analytics, department]);

  const handleShareWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetPhone.trim()) {
      localStorage.setItem(STORAGE_KEYS.ownerPhone, targetPhone.trim());
    }
    const cleanPhone = targetPhone.replace(/\D/g, '');
    const encoded = encodeURIComponent(whatsappSummaryText);
    const url = cleanPhone
      ? `https://wa.me/91${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
    setIsShareModalOpen(false);
  };

  // -------------------------------------------------------------
  // PIN Protection Screen
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-stone-900 border border-gold-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-gold-500/10 border border-gold-500/30 rounded-2xl flex items-center justify-center mx-auto text-gold-400">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-gold-200">Owner Insights Access</h2>
            <p className="text-xs sm:text-sm text-stone-400 mt-1">
              Protected executive portal. Enter the Master PIN to review revenue, audit logs & expenses.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                placeholder="Enter PIN"
                className="w-full text-center text-2xl tracking-[0.4em] py-3.5 bg-stone-950 border border-stone-700 rounded-xl focus:border-gold-400 focus:outline-none text-gold-300 font-mono"
                autoFocus
              />
              {pinError && (
                <p className="text-xs text-rose-400 mt-2 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {pinError}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsPairOpen(true)}
              className="text-[11px] text-gold-400 hover:text-gold-300 underline underline-offset-2"
            >
              Owner: pair this device / set PIN
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium rounded-xl text-sm transition-all"
              >
                Back to POS
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-black font-bold rounded-xl text-sm transition-all shadow-lg active:scale-95"
              >
                Unlock Dashboard
              </button>
            </div>
          </form>

          <p className="text-[11px] text-stone-500">
            Note: Counter waiters cannot view business margins or void summaries without the PIN.
          </p>
        </div>
        <PairDeviceModal isOpen={isPairOpen} onClose={() => setIsPairOpen(false)} />
      </div>
    );
  }

  // -------------------------------------------------------------
  // Authenticated Owner Dashboard
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>POS</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold font-serif text-gold-200">Owner Insights</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Persistent DB
              </span>
            </div>
            <p className="text-[11px] text-stone-400 hidden sm:block">
              {HOTEL_INFO.name} • Restaurant, Rooms & Banquet Revenue Intelligence
            </p>
          </div>
        </div>

        {/* Right Header Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh */}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all active:scale-95 disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gold-400' : ''}`} />
          </button>

          {/* Cloud Sync Status / Config Button */}
          <button
            onClick={() => setIsCloudModalOpen(true)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all ${
              cloudConfig?.connected
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
                : cloudConfig?.isConfigured
                ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
                : 'bg-stone-800/80 hover:bg-stone-700 border-stone-700 text-stone-300'
            }`}
            title="Configure or view Supabase Cloud Database Sync"
          >
            <Cloud className={`w-3.5 h-3.5 ${syncingCloud ? 'animate-pulse text-gold-400' : ''}`} />
            <span>
              {syncingCloud
                ? 'Syncing...'
                : cloudConfig?.connected
                ? 'Cloud Synced'
                : cloudConfig?.isConfigured
                ? 'Cloud Offline'
                : 'Supabase Sync'}
            </span>
            {cloudConfig?.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Export to Excel (CSV) Button */}
          <button
            onClick={() => handleExportBackup('csv')}
            disabled={exporting}
            className="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            title="Download full Excel CSV spreadsheet backup"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export to Excel'}</span>
          </button>

          {/* WhatsApp Share Button */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp Report</span>
          </button>
        </div>
      </header>

      {/* Main Filter & Navigation Strip */}
      <section className="bg-stone-900 border-b border-stone-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* 1. Department Tabs */}
          <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-2xl border border-stone-800 text-xs overflow-x-auto">
            <button
              onClick={() => setDepartment('all')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                department === 'all'
                  ? 'bg-gold-500 text-black shadow-md'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Outlets</span>
            </button>
            <button
              onClick={() => setDepartment('restaurant')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                department === 'restaurant'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Restaurant</span>
            </button>
            <button
              onClick={() => setDepartment('rooms')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                department === 'rooms'
                  ? 'bg-sky-500 text-black shadow-md'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Rooms & Lodging</span>
            </button>
            <button
              onClick={() => setDepartment('banquet')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                department === 'banquet'
                  ? 'bg-purple-500 text-black shadow-md'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <PartyPopper className="w-3.5 h-3.5" />
              <span>Banquet & Events</span>
            </button>
          </div>

          {/* 2. Time Granularity Selector */}
          <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-2xl border border-stone-800 text-xs overflow-x-auto">
            <button
              onClick={() => setPeriod('today')}
              className={`px-2.5 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
                period === 'today' ? 'bg-stone-800 text-white font-bold' : 'text-stone-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPeriod('yesterday')}
              className={`px-2.5 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
                period === 'yesterday' ? 'bg-stone-800 text-white font-bold' : 'text-stone-400 hover:text-white'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setPeriod('this_month')}
              className={`px-2.5 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
                period === 'this_month' ? 'bg-stone-800 text-white font-bold' : 'text-stone-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('last_month')}
              className={`px-2.5 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
                period === 'last_month' ? 'bg-stone-800 text-white font-bold' : 'text-stone-400 hover:text-white'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => setPeriod('this_year')}
              className={`px-2.5 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
                period === 'this_year' ? 'bg-stone-800 text-white font-bold' : 'text-stone-400 hover:text-white'
              }`}
            >
              Year {selectedYear}
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-2.5 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
                period === 'all' ? 'bg-stone-800 text-white font-bold' : 'text-stone-400 hover:text-white'
              }`}
            >
              All Time
            </button>

            {/* Month & Year Selectors */}
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-stone-800 shrink-0">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setPeriod('custom_month');
                }}
                className="bg-stone-900 text-stone-300 text-[11px] px-2 py-1 rounded-lg border border-stone-750 focus:outline-none focus:border-gold-400"
                title="Select Specific Month"
              />
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setPeriod('custom_year');
                }}
                className="bg-stone-900 text-stone-300 text-[11px] px-2 py-1 rounded-lg border border-stone-750 focus:outline-none focus:border-gold-400"
                title="Select Specific Year"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Active Filter Label */}
        <div className="flex items-center justify-between text-xs text-stone-400 pb-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gold-400" />
            <span className="font-semibold text-white">Showing: {analytics?.dateFormatted}</span>
            <span>•</span>
            <span className="capitalize font-bold text-gold-300">
              {department === 'all' ? 'Consolidated (All Outlets)' : `${department} Only`}
            </span>
          </div>
          <span className="font-mono text-stone-500">{analytics?.billsCount || 0} Bills Recorded</span>
        </div>

        {/* 1. THREE DEPARTMENT REVENUE CARDS (Consolidated View) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Restaurant Card */}
          <div
            onClick={() => setDepartment('restaurant')}
            className={`cursor-pointer transition-all rounded-2xl p-5 border shadow-lg ${
              department === 'restaurant' || department === 'all'
                ? 'bg-gradient-to-br from-amber-950/40 via-stone-900 to-stone-900 border-amber-500/40 hover:border-amber-400'
                : 'bg-stone-900/60 border-stone-800 opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <UtensilsCrossed className="w-4 h-4" /> Restaurant
              </span>
              <span className="text-xs font-mono text-stone-400">
                {analytics?.departments.restaurant.count || 0} Orders
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                ₹{(analytics?.departments.restaurant.revenue || 0).toLocaleString('en-IN')}
              </div>
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-stone-400">
                <span>Custom Meat Cooked:</span>
                <span className="text-amber-200 font-bold">
                  {analytics?.departments.restaurant.customKgEstimate || 0} Kg (₹
                  {(analytics?.departments.restaurant.customCookingRevenue || 0).toLocaleString('en-IN')})
                </span>
              </div>
            </div>
          </div>

          {/* Rooms Card */}
          <div
            onClick={() => setDepartment('rooms')}
            className={`cursor-pointer transition-all rounded-2xl p-5 border shadow-lg ${
              department === 'rooms' || department === 'all'
                ? 'bg-gradient-to-br from-sky-950/40 via-stone-900 to-stone-900 border-sky-500/40 hover:border-sky-400'
                : 'bg-stone-900/60 border-stone-800 opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4" /> Rooms & Lodging
              </span>
              <span className="text-xs font-mono text-stone-400">
                {analytics?.departments.rooms.count || 0} Stays
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-sky-400 font-mono">
                ₹{(analytics?.departments.rooms.revenue || 0).toLocaleString('en-IN')}
              </div>
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-stone-400">
                <span>Room Tariffs & Room Service:</span>
                <span className="text-sky-200 font-bold">Consolidated Folio</span>
              </div>
            </div>
          </div>

          {/* Banquet & Events Card */}
          <div
            onClick={() => setDepartment('banquet')}
            className={`cursor-pointer transition-all rounded-2xl p-5 border shadow-lg ${
              department === 'banquet' || department === 'all'
                ? 'bg-gradient-to-br from-purple-950/40 via-stone-900 to-stone-900 border-purple-500/40 hover:border-purple-400'
                : 'bg-stone-900/60 border-stone-800 opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <PartyPopper className="w-4 h-4" /> Banquet & Lawn Events
              </span>
              <span className="text-xs font-mono text-stone-400">
                {analytics?.departments.banquet.count || 0} Functions
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-purple-400 font-mono">
                ₹{(analytics?.departments.banquet.revenue || 0).toLocaleString('en-IN')}
              </div>
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-stone-400">
                <span>Marriage / Birthday / Hall:</span>
                <span className="text-purple-200 font-bold">Advance & Final</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. CORE FINANCIAL & OPERATIONAL KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: Total Gross Revenue */}
          <div className="bg-stone-900 border border-gold-500/30 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Total Gross Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                ₹{(analytics?.grossRevenue || 0).toLocaleString('en-IN')}
              </span>
              <div className="flex items-center justify-between text-xs text-stone-400 mt-2">
                <span>{analytics?.billsCount || 0} Bills</span>
                <span>Avg: ₹{analytics?.avgBillValue || 0}</span>
              </div>
            </div>
          </div>

          {/* Card: Cash vs UPI Breakdown */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Payment Collections</span>
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-stone-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Cash:
                </span>
                <span className="font-bold font-mono text-emerald-400">
                  ₹{(analytics?.paymentSplit.cash || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" /> UPI:
                </span>
                <span className="font-bold font-mono text-sky-400">
                  ₹{(analytics?.paymentSplit.upi || 0).toLocaleString('en-IN')}
                </span>
              </div>
              {((analytics?.paymentSplit.roomFolio || 0) > 0 || (analytics?.paymentSplit.card || 0) > 0) && (
                <div className="flex justify-between items-center pt-1 border-t border-stone-800 text-[11px] text-stone-400">
                  <span>Room/Card:</span>
                  <span className="font-mono">
                    ₹{((analytics?.paymentSplit.roomFolio || 0) + (analytics?.paymentSplit.card || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card: Petty Expenses & Net Margin */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Net Shift Margin</span>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="text-[11px] text-gold-400 hover:text-gold-300 flex items-center gap-1 font-semibold"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Kharacha</span>
              </button>
            </div>
            <div className="mt-3">
              <span
                className={`text-2xl sm:text-3xl font-black font-mono ${
                  (analytics?.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ₹{(analytics?.netProfit || 0).toLocaleString('en-IN')}
              </span>
              <div className="flex items-center justify-between text-xs text-stone-400 mt-2">
                <span>Expenses: ₹{(analytics?.expenses.total || 0).toLocaleString('en-IN')}</span>
                <span className="text-[11px] text-stone-500">{analytics?.expenses.count || 0} entries</span>
              </div>
            </div>
          </div>

          {/* Card: Anti-Theft Void Audits */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Anti-Theft Audits</span>
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">
                {(analytics?.antiTheft.voidsCount || 0) + (analytics?.antiTheft.cancelledBillsCount || 0)} Audits
              </span>
              <div className="flex items-center justify-between text-xs text-stone-400 mt-2">
                <span>
                  {analytics?.antiTheft.voidsCount || 0} Voids (₹{(analytics?.antiTheft.voidAmount || 0).toLocaleString('en-IN')})
                  {analytics?.antiTheft.cancelledBillsCount ? ` • ${analytics.antiTheft.cancelledBillsCount} Cancelled (₹${(analytics.antiTheft.cancelledBillsAmount || 0).toLocaleString('en-IN')})` : ''}
                </span>
                <span className="text-[11px] text-stone-500">Tracked</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. TIME-BASED TREND BREAKDOWN (MONTHLY / DAILY) */}
        {(period === 'this_year' || period === 'all') && analytics?.monthlyTrends && analytics.monthlyTrends.length > 0 && (
          <section className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gold-400" />
                  <span>Month-by-Month Revenue Breakdown (Year 2026)</span>
                </h3>
                <p className="text-xs text-stone-400">Annual performance across Restaurant, Rooms, and Banquet</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3">🍽️ Restaurant</th>
                    <th className="py-2.5 px-3">🛏️ Rooms</th>
                    <th className="py-2.5 px-3">🎉 Banquet</th>
                    <th className="py-2.5 px-3">Bills Count</th>
                    <th className="py-2.5 px-3 font-bold text-white">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-mono">
                  {analytics.monthlyTrends.map((m) => (
                    <tr key={m.month} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-gold-300 font-bold font-sans">
                        {m.monthName} ({m.month})
                      </td>
                      <td className="py-2.5 px-3 text-amber-300">₹{m.restaurant.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-sky-300">₹{m.rooms.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-purple-300">₹{m.banquet.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-stone-400 font-sans">{m.billsCount}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold text-sm">₹{m.total.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(period === 'this_month' || period === 'last_month') && analytics?.dailyTrends && analytics.dailyTrends.length > 0 && (
          <section className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gold-400" />
                  <span>Day-by-Day Sales in this Month</span>
                </h3>
                <p className="text-xs text-stone-400">Daily sales progression across all 3 departments</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">🍽️ Restaurant</th>
                    <th className="py-2.5 px-3">🛏️ Rooms</th>
                    <th className="py-2.5 px-3">🎉 Banquet</th>
                    <th className="py-2.5 px-3">Bills</th>
                    <th className="py-2.5 px-3 font-bold text-white">Daily Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-mono">
                  {analytics.dailyTrends.map((d) => (
                    <tr key={d.date} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-gold-300 font-bold font-sans">
                        Day {d.day} ({d.date})
                      </td>
                      <td className="py-2.5 px-3 text-amber-300">₹{d.restaurant.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-sky-300">₹{d.rooms.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-purple-300">₹{d.banquet.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-stone-400 font-sans">{d.billsCount}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">₹{d.total.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 4. ANTI-THEFT AUDIT LOG TABLE */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Anti-Theft Void & Cancellation Audit</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono font-bold">
                    {analytics?.antiTheft.voidsCount || 0} Voids (₹{(analytics?.antiTheft.voidAmount || 0).toLocaleString('en-IN')})
                  </span>
                </h3>
                <p className="text-xs text-stone-400">
                  Every item deleted after a Kitchen Order Ticket (KOT) was fired is permanently recorded here.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Share WhatsApp Alert</span>
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {(!analytics?.antiTheft.recentAudits || analytics.antiTheft.recentAudits.length === 0) ? (
              <div className="text-center py-6 text-stone-500 text-xs">
                ✅ Clean shift! No suspicious item cancellations or voided KOTs recorded for this period.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Table</th>
                    <th className="py-2.5 px-3">Cancelled Item</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Staff / Waiter</th>
                    <th className="py-2.5 px-3">Cancellation Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-mono">
                  {analytics.antiTheft.recentAudits.map((audit) => (
                    <tr key={audit.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-stone-400 font-sans">
                        {new Date(audit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 text-gold-300 font-bold font-sans">{audit.tableId}</td>
                      <td className="py-2.5 px-3 text-white font-sans">{audit.itemName || 'Order Void'}</td>
                      <td className="py-2.5 px-3 text-rose-400 font-bold">
                        ₹{((audit.itemPrice || 0) * (audit.quantity || 1)).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-stone-300 font-sans">{audit.staffName}</td>
                      <td className="py-2.5 px-3 text-stone-400 font-sans italic">"{audit.reason}"</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* 4B. TOP DISHES & PETTY CASH EXPENSES */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Selling Dishes */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-amber-400" />
                <span>Top Selling Dishes & Services</span>
              </span>
              <span className="text-xs text-stone-400 font-normal">Ranked by volume</span>
            </h3>

            {(!analytics?.topDishes || analytics.topDishes.length === 0) ? (
              <p className="text-stone-500 text-xs py-6 text-center">No dishes sold in this period.</p>
            ) : (
              <div className="space-y-2">
                {analytics.topDishes.map((dish, i) => (
                  <div
                    key={dish.name}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-center font-mono font-bold text-stone-500">#{i + 1}</span>
                      <span className="font-semibold text-stone-200">{dish.name}</span>
                      {dish.isCustom && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 font-mono text-stone-300">
                      <span className="text-stone-400">{dish.quantity} qty</span>
                      <span className="font-bold text-white">₹{dish.revenue.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Petty Cash Expenses Ledger */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Petty Cash & Daily Expenses</h3>
                <p className="text-xs text-stone-400">Total: ₹{(analytics?.expenses.total || 0).toLocaleString('en-IN')}</p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 border border-gold-500/30 text-xs font-bold flex items-center gap-1 transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Expense</span>
              </button>
            </div>

            {(!analytics?.expenses.list || analytics.expenses.list.length === 0) ? (
              <div className="flex-1 flex items-center justify-center py-6 text-stone-500 text-xs">
                No petty cash expenses logged for this period.
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
                {analytics.expenses.list.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/80 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-200">{exp.category}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">
                          {exp.paidBy}
                        </span>
                      </div>
                      {exp.notes && <p className="text-[11px] text-stone-400 mt-0.5 italic">"{exp.notes}"</p>}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-rose-400">₹{exp.amount.toLocaleString('en-IN')}</span>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="text-stone-500 hover:text-rose-400 p-1 transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 5. RECENT BILLS SECTION */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gold-400" />
                <span>Recent Settled Bills ({analytics?.recentBills.length || 0})</span>
              </h3>
              <p className="text-xs text-stone-400">Historical transactions saved in database</p>
            </div>

            <button
              onClick={() => handleExportBackup('csv')}
              className="text-xs text-gold-400 hover:text-gold-300 font-semibold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel Backup</span>
            </button>
          </div>

          {(!analytics?.recentBills || analytics.recentBills.length === 0) ? (
            <p className="text-center py-6 text-stone-500 text-xs">No settled bills recorded for this selection.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Bill #</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Table/Room</th>
                    <th className="py-2.5 px-3">Items Count</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-mono">
                  {analytics.recentBills.map((bill) => {
                    const isCancelled = bill.status === 'cancelled';
                    return (
                      <tr
                        key={bill.id}
                        className={`transition-colors ${
                          isCancelled ? 'bg-rose-950/20 text-stone-400' : 'hover:bg-stone-800/30'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-stone-400 font-sans font-bold">
                          #{bill.billNumber}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          {isCancelled ? (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 w-fit"
                              title={`Reason: ${bill.cancelReason || 'Not specified'}`}
                            >
                              <Ban className="w-2.5 h-2.5" />
                              <span>CANCELLED</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              SETTLED
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-stone-400 font-sans">
                          {new Date(bill.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {new Date(bill.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                              bill.department === 'rooms'
                                ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                                : bill.department === 'banquet'
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {bill.department || 'restaurant'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gold-300 font-bold font-sans">{bill.tableId}</td>
                        <td className="py-2.5 px-3 text-stone-300 font-sans">
                          {(bill.items || []).reduce((s: number, it: any) => s + (it.quantity || 1), 0)} items
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-stone-800 text-stone-300">
                            {bill.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          {isCancelled ? (
                            <div className="flex flex-col">
                              <span className="line-through text-stone-500">
                                ₹{bill.total.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] font-sans font-normal text-rose-400 italic">
                                {bill.cancelReason || 'Voided'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-emerald-400">
                              ₹{bill.total.toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ----------------------------------------------------------- */}
      {/* Add Expense Modal */}
      {/* ----------------------------------------------------------- */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-gold-400" />
              <span>Record Daily Expense (Kharacha)</span>
            </h3>

            <form onSubmit={handleAddExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-400 mb-1">Expense Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full py-2.5 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white focus:outline-none focus:border-gold-400"
                >
                  <option value="Kitchen / Vegetables">Vegetables & Grocery</option>
                  <option value="Dairy / Milk / Paneer">Dairy / Milk / Paneer</option>
                  <option value="Raw Chicken / Meat / Fish">Raw Chicken / Meat / Fish</option>
                  <option value="Ice / Cold Storage">Ice Blocks / Cold Storage</option>
                  <option value="Gas Cylinder / Fuel">LPG Cylinder / Fuel</option>
                  <option value="Diesel (Generator)">Diesel for Generator</option>
                  <option value="Staff Advance / Daily Wage">Staff Daily Advance</option>
                  <option value="Hotel Maintenance">Cleaning / Maintenance</option>
                  <option value="Other Misc">Other Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  placeholder="e.g. 500"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full py-2.5 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white font-mono text-base font-bold focus:outline-none focus:border-gold-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Paid From</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpensePaidBy('Cash Drawer')}
                    className={`py-2 rounded-xl font-semibold transition-all border ${
                      expensePaidBy === 'Cash Drawer'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-stone-950 text-stone-400 border-stone-800'
                    }`}
                  >
                    💵 Cash Drawer
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpensePaidBy('UPI')}
                    className={`py-2 rounded-xl font-semibold transition-all border ${
                      expensePaidBy === 'UPI'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                        : 'bg-stone-950 text-stone-400 border-stone-800'
                    }`}
                  >
                    📱 Counter UPI
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Notes / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 10 kg potatoes + 5 kg onions"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full py-2.5 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white focus:outline-none focus:border-gold-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitting}
                  className="flex-1 py-2.5 bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* WhatsApp Share Modal */}
      {/* ----------------------------------------------------------- */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-stone-900 border border-stone-700 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-emerald-400" />
              <span>Share Daily Business Report on WhatsApp</span>
            </h3>

            <form onSubmit={handleShareWhatsApp} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-400 mb-1">
                  Recipient Mobile Number (Optional, leave blank to pick in WhatsApp)
                </label>
                <div className="flex">
                  <span className="py-2.5 px-3 bg-stone-800 border border-r-0 border-stone-700 rounded-l-xl text-stone-400 font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    placeholder="Enter owner 10-digit mobile number"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    className="flex-1 py-2.5 px-3 bg-stone-950 border border-stone-700 rounded-r-xl text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Message Preview:</label>
                <pre className="p-3 bg-stone-950 border border-stone-800 rounded-xl text-[11px] text-stone-300 font-mono max-h-56 overflow-y-auto whitespace-pre-wrap">
                  {whatsappSummaryText}
                </pre>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-xl transition-all"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Open WhatsApp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* Supabase Cloud Sync Configuration Modal */}
      {/* ----------------------------------------------------------- */}
      {isCloudModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-stone-900 border border-stone-700 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Supabase Cloud Sync</h3>
                  <p className="text-[11px] text-stone-400">
                    Real-time cloud backup of all bills, audit logs & expenses
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCloudModalOpen(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Cloud Status Card */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400 font-medium">Sync Status:</span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                    cloudConfig?.connected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : cloudConfig?.isConfigured
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      cloudConfig?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-stone-400'
                    }`}
                  />
                  {cloudConfig?.connected
                    ? 'Connected & Active'
                    : cloudConfig?.isConfigured
                    ? 'Configured (Offline/Checking)'
                    : 'Not Configured (Offline Mode)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800/80">
                  <span className="text-stone-400 block">Last Synced:</span>
                  <span className="font-semibold text-stone-200">
                    {cloudConfig?.lastSyncTime
                      ? new Date(cloudConfig.lastSyncTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Never'}
                  </span>
                </div>
                <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800/80">
                  <span className="text-stone-400 block">Queued Bills:</span>
                  <span className="font-semibold text-stone-200">
                    {cloudConfig?.pendingBills ?? 0} bills pending upload
                  </span>
                </div>
              </div>

              {cloudConfig?.isConfigured && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={handleTriggerCloudSync}
                    disabled={syncingCloud}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingCloud ? 'animate-spin' : ''}`} />
                    <span>{syncingCloud ? 'Syncing...' : 'Sync All Records Now'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Supabase Credentials Form */}
            <form onSubmit={handleSaveCloudConfig} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  placeholder="https://your-project-id.supabase.co"
                  value={inputSupabaseUrl}
                  onChange={(e) => setInputSupabaseUrl(e.target.value)}
                  className="w-full py-2.5 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Found in: Supabase Dashboard &gt; Project Settings &gt; API &gt; Project URL
                </span>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Supabase Anon Public API Key
                </label>
                <textarea
                  rows={2}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={inputSupabaseKey}
                  onChange={(e) => setInputSupabaseKey(e.target.value)}
                  className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-400 resize-none"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Found in: Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API keys &gt; <code className="text-stone-400">anon public</code>
                </span>
              </div>

              {/* Live Test Connection Section */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestCloudConnection}
                  disabled={testingCloud || !inputSupabaseUrl.trim() || !inputSupabaseKey.trim()}
                  className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingCloud ? 'animate-spin text-gold-400' : ''}`} />
                  <span>{testingCloud ? 'Testing...' : 'Test Connection'}</span>
                </button>

                {testResult && (
                  <div
                    className={`flex-1 py-1.5 px-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 ${
                      testResult.success
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {testResult.success ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Connected! Supabase bills table verified.</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">{testResult.error || 'Connection failed'}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <PairedDevicesPanel onPair={() => setIsPairOpen(true)} />

              {/* Free Setup Instructions Box */}
              <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-gold-400 font-bold text-xs">
                  <Database className="w-3.5 h-3.5" />
                  <span>Cloud Database Status: Active &amp; Pre-configured</span>
                </div>
                <p className="text-[11px] text-stone-300 leading-relaxed">
                  Your Supabase cloud database is pre-configured with project <code className="text-emerald-400 font-mono">kupbuusakxvsfprwdpbr</code>. All 6 tables (<span className="text-stone-200">bills, audit_logs, expenses, menu_items, rooms, tables_config</span>) are synchronized in real-time.
                </p>
                <p className="text-[11px] text-stone-400">
                  You can click <strong className="text-emerald-400">Sync All Records Now</strong> anytime to trigger an immediate force sync, or enter custom credentials if migrating to another Supabase project.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloudModalOpen(false)}
                  className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Save &amp; Enable Sync</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <PairDeviceModal isOpen={isPairOpen} onClose={() => setIsPairOpen(false)} />
    </div>
  );
};
