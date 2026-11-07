import React from 'react';
import { Search, Printer, X, RefreshCw, Receipt, Ban, AlertOctagon } from 'lucide-react';

export interface BillsHistoryModalProps {
  recentBillsList: any[];
  loadRecentBills: () => Promise<void>;
  loadingBills: boolean;
  setIsBillsHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  billsSearchTerm: string;
  setBillsSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setBillsFilterStatus: React.Dispatch<React.SetStateAction<'all' | 'settled' | 'cancelled'>>;
  billsFilterStatus: 'all' | 'settled' | 'cancelled';
  filteredRecentBills: any[];
  handleReprintSettledBill: (bill: any) => Promise<void>;
  setBillToCancel: React.Dispatch<any>;
  setCancelPin: React.Dispatch<React.SetStateAction<string>>;
  setCancelPinError: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomCancelReason: React.Dispatch<React.SetStateAction<string>>;
}

export const BillsHistoryModal: React.FC<BillsHistoryModalProps> = ({
  recentBillsList,
  loadRecentBills,
  loadingBills,
  setIsBillsHistoryOpen,
  billsSearchTerm,
  setBillsSearchTerm,
  setBillsFilterStatus,
  billsFilterStatus,
  filteredRecentBills,
  handleReprintSettledBill,
  setBillToCancel,
  setCancelPin,
  setCancelPinError,
  setCustomCancelReason,
}) => (
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
                    ) : b.paymentMethod === 'split' ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        SPLIT (Cash ₹{b.paymentDetails?.cashAmount || 0} + UPI ₹{b.paymentDetails?.upiAmount || 0})
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
);
