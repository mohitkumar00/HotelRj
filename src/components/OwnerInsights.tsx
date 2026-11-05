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
} from 'lucide-react';
import {
  fetchAnalytics,
  addExpense,
  removeExpense,
  AnalyticsSummary,
} from '../utils/analyticsApi';
import { HOTEL_INFO } from '../data/hotelData';

interface OwnerInsightsProps {
  onBack: () => void;
  serverUrl?: string;
}

export const OwnerInsights: React.FC<OwnerInsightsProps> = ({ onBack }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('hotel_rj_owner_auth') === 'true';
  });
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);

  const [period, setPeriod] = useState<'today' | 'yesterday' | 'last7days' | 'all'>('today');
  const [loading, setLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  // Expense modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [expenseCategory, setExpenseCategory] = useState<string>('Kitchen / Vegetables');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expensePaidBy, setExpensePaidBy] = useState<'Cash Drawer' | 'UPI'>('Cash Drawer');
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  const [expenseSubmitting, setExpenseSubmitting] = useState<boolean>(false);

  // WhatsApp share modal
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [targetPhone, setTargetPhone] = useState<string>(() => {
    return localStorage.getItem('hotel_rj_owner_phone') || '';
  });

  const loadData = async (selectedPeriod = period) => {
    setLoading(true);
    try {
      const data = await fetchAnalytics(selectedPeriod);
      setAnalytics(data);
    } catch (e) {
      console.error('Error loading analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData(period);
    }
  }, [isAuthenticated, period]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default Owner PIN is 1234 or 8888
    if (enteredPin === '1234' || enteredPin === '8888') {
      setIsAuthenticated(true);
      sessionStorage.setItem('hotel_rj_owner_auth', 'true');
      setPinError(false);
    } else {
      setPinError(true);
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
    loadData(period);
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense record?')) {
      await removeExpense(id);
      loadData(period);
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

    return `🏨 *HOTEL RJ — EXECUTIVE BUSINESS DIGEST*
📅 *Period:* ${analytics.period.toUpperCase()} (${dateStr})
⏰ *Generated:* ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}

💰 *REVENUE BREAKDOWN:*
• Gross Sales: *₹${analytics.grossRevenue.toLocaleString('en-IN')}* (${analytics.billsCount} Bills)
• Cash in Drawer: ₹${analytics.paymentSplit.cash.toLocaleString('en-IN')}
• UPI Collections: ₹${analytics.paymentSplit.upi.toLocaleString('en-IN')}
${analytics.paymentSplit.roomFolio > 0 ? `• Room Folios: ₹${analytics.paymentSplit.roomFolio.toLocaleString('en-IN')}\n` : ''}
${analytics.paymentSplit.card > 0 ? `• Card/POS: ₹${analytics.paymentSplit.card.toLocaleString('en-IN')}\n` : ''}
🍗 *CUSTOM COOKING & DHABA SERVICES:*
• Total Service Charges: ₹${analytics.customCooking.revenue.toLocaleString('en-IN')}
• Customer Meat Prepared: ${analytics.customCooking.kgEstimate} Kg (${analytics.customCooking.count} orders)

📉 *PETTY EXPENSES & NET PROFIT:*
• Daily Expenses: ₹${analytics.expenses.total.toLocaleString('en-IN')}
• *Net Profit:* *₹${analytics.netProfit.toLocaleString('en-IN')}*

🛡️ *ANTI-THEFT & AUDIT LOG:*
• Voided Items: ${analytics.antiTheft.voidsCount} items (₹${analytics.antiTheft.voidAmount.toLocaleString('en-IN')})
${
  analytics.antiTheft.recentAudits.length > 0
    ? `• Latest Void: "${analytics.antiTheft.recentAudits[0].itemName || 'Item'}" by ${analytics.antiTheft.recentAudits[0].staffName} (${analytics.antiTheft.recentAudits[0].reason})\n`
    : ''
}
🏆 *TOP 5 DISHES SOLD:*
${topDishesList || '• No dishes recorded yet'}

--------------------------------
_Generated automatically from Hotel RJ POS System_`;
  }, [analytics]);

  const handleShareWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetPhone.trim()) {
      localStorage.setItem('hotel_rj_owner_phone', targetPhone.trim());
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
                placeholder="Enter 4-digit PIN (default: 1234)"
                className="w-full text-center text-2xl tracking-[0.4em] py-3.5 bg-stone-950 border border-stone-700 rounded-xl focus:border-gold-400 focus:outline-none text-gold-300 font-mono"
                autoFocus
              />
              {pinError && (
                <p className="text-xs text-rose-400 mt-2 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Incorrect PIN. Try default: 1234
                </p>
              )}
            </div>

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
      </div>
    );
  }

  // -------------------------------------------------------------
  // Authenticated Owner Dashboard
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 px-4 py-3 flex items-center justify-between gap-3">
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
                Live DB
              </span>
            </div>
            <p className="text-[11px] text-stone-400 hidden sm:block">
              {HOTEL_INFO.name} • Executive Intelligence & Anti-Theft Ledger
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
            <button
              onClick={() => setPeriod('today')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                period === 'today' ? 'bg-gold-500 text-black font-bold shadow' : 'text-stone-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPeriod('yesterday')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                period === 'yesterday' ? 'bg-gold-500 text-black font-bold shadow' : 'text-stone-400 hover:text-white'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setPeriod('last7days')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                period === 'last7days' ? 'bg-gold-500 text-black font-bold shadow' : 'text-stone-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => loadData(period)}
            disabled={loading}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all active:scale-95 disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gold-400' : ''}`} />
          </button>

          {/* WhatsApp Share Button */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WhatsApp Report</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* KPI Cards Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Gross Revenue */}
          <div className="bg-gradient-to-br from-stone-900 to-stone-900/60 border border-gold-500/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Gross Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                ₹{(analytics?.grossRevenue || 0).toLocaleString('en-IN')}
              </span>
              <div className="flex items-center justify-between text-xs text-stone-400 mt-2">
                <span>{analytics?.billsCount || 0} Bills Settled</span>
                <span>Avg: ₹{analytics?.avgBillValue || 0}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Cash vs UPI Breakdown */}
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
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Cash in Drawer:
                </span>
                <span className="font-bold font-mono text-emerald-400">
                  ₹{(analytics?.paymentSplit.cash || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" /> UPI (GPay/PhonePe):
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

          {/* Card 3: Custom Cooking & Hotel Services */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Custom Cooking Services</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ChefHat className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                ₹{(analytics?.customCooking.revenue || 0).toLocaleString('en-IN')}
              </span>
              <div className="flex items-center justify-between text-xs text-stone-400 mt-2">
                <span>{analytics?.customCooking.count || 0} Making Charges</span>
                <span className="text-amber-300 font-bold">~{analytics?.customCooking.kgEstimate || 0} Kg Cooked</span>
              </div>
            </div>
          </div>

          {/* Card 4: Net Profit (Revenue - Expenses) */}
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
                <span className="text-[11px] text-stone-500">{analytics?.expenses.count || 0} logs</span>
              </div>
            </div>
          </div>
        </section>

        {/* Anti-Theft Void & Cancellation Banner / Section */}
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

          {/* Voids Table */}
          <div className="mt-4 overflow-x-auto">
            {(!analytics?.antiTheft.recentAudits || analytics.antiTheft.recentAudits.length === 0) ? (
              <div className="text-center py-8 text-stone-500 text-xs">
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

        {/* Lower Grid: Top Dishes & Daily Expenses */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Selling Dishes */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
              <span>Top Dishes Sold</span>
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

        {/* Recent Settled Bills Section */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gold-400" />
                <span>Recent Settled Bills ({analytics?.recentBills.length || 0})</span>
              </h3>
              <p className="text-xs text-stone-400">Completed table orders archived in local database</p>
            </div>
          </div>

          {(!analytics?.recentBills || analytics.recentBills.length === 0) ? (
            <p className="text-center py-6 text-stone-500 text-xs">No settled bills recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Bill #</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Table</th>
                    <th className="py-2.5 px-3">Items Count</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-mono">
                  {analytics.recentBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-stone-400 font-sans font-bold">#{bill.billNumber}</td>
                      <td className="py-2.5 px-3 text-stone-400 font-sans">
                        {new Date(bill.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 text-gold-300 font-bold font-sans">{bill.tableId}</td>
                      <td className="py-2.5 px-3 text-stone-300 font-sans">
                        {bill.items.reduce((s, it) => s + (it.quantity || 1), 0)} items
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                          {bill.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">₹{bill.total.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
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
    </div>
  );
};
