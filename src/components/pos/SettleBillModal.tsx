import React from 'react';
import { X, DollarSign, Smartphone, CreditCard, Building2, CheckCircle, AlertOctagon, Split } from 'lucide-react';
import { WaiterItemRecord } from '../../utils/tableMerge';

export interface SettleBillModalProps {
  activeTable: string;
  currentItemsList: WaiterItemRecord[];
  subtotalPrice: number;
  setIsSettleModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  grandTotal: number;
  applyGst: boolean;
  gstAmount: number;
  setSettleDepartment: React.Dispatch<React.SetStateAction<'restaurant' | 'rooms' | 'banquet'>>;
  settleDepartment: 'restaurant' | 'rooms' | 'banquet';
  setSettlePaymentMethod: React.Dispatch<React.SetStateAction<'cash' | 'upi' | 'card' | 'room-folio' | 'split'>>;
  settlePaymentMethod: 'cash' | 'upi' | 'card' | 'room-folio' | 'split';
  splitCashAmount: string;
  splitUpiAmount: string;
  setSplitCashAmount: React.Dispatch<React.SetStateAction<string>>;
  setSplitUpiAmount: React.Dispatch<React.SetStateAction<string>>;
  setSplitCardAmount: React.Dispatch<React.SetStateAction<string>>;
  handleSplitCashChange: (val: string) => void;
  handleSplitUpiChange: (val: string) => void;
  isSplitBalanced: boolean;
  splitDifference: number;
  settleRoomNumber: string;
  setSettleRoomNumber: React.Dispatch<React.SetStateAction<string>>;
  settleCustomerPhone: string;
  setSettleCustomerPhone: React.Dispatch<React.SetStateAction<string>>;
  isSubmittingSettlement: boolean;
  handleConfirmSettlement: () => Promise<void>;
}

export const SettleBillModal: React.FC<SettleBillModalProps> = ({
  activeTable,
  currentItemsList,
  subtotalPrice,
  setIsSettleModalOpen,
  grandTotal,
  applyGst,
  gstAmount,
  setSettleDepartment,
  settleDepartment,
  setSettlePaymentMethod,
  settlePaymentMethod,
  splitCashAmount,
  splitUpiAmount,
  setSplitCashAmount,
  setSplitUpiAmount,
  setSplitCardAmount,
  handleSplitCashChange,
  handleSplitUpiChange,
  isSplitBalanced,
  splitDifference,
  settleRoomNumber,
  setSettleRoomNumber,
  settleCustomerPhone,
  setSettleCustomerPhone,
  isSubmittingSettlement,
  handleConfirmSettlement,
}) => (
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSettlePaymentMethod('cash')}
            className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
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
            className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
              settlePaymentMethod === 'upi'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-md'
                : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
            }`}
          >
            <Smartphone className="w-4 h-4 text-sky-400" />
            <span>UPI (QR)</span>
          </button>
          <button
            type="button"
            onClick={() => setSettlePaymentMethod('card')}
            className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
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
            onClick={() => {
              setSettlePaymentMethod('split');
              if (!splitCashAmount && !splitUpiAmount) {
                const half = Math.floor(grandTotal / 2);
                setSplitCashAmount(String(half));
                setSplitUpiAmount(String(Math.round((grandTotal - half) * 100) / 100));
              }
            }}
            className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
              settlePaymentMethod === 'split'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md ring-1 ring-amber-500/40'
                : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
            }`}
          >
            <Split className="w-4 h-4 text-amber-400" />
            <span>Partial (Cash+UPI)</span>
          </button>
          <button
            type="button"
            onClick={() => setSettlePaymentMethod('room-folio')}
            className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all col-span-2 sm:col-span-1 ${
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

      {/* Split / Partial Payment Box */}
      {settlePaymentMethod === 'split' && (
        <div className="p-3 bg-gradient-to-br from-amber-500/10 via-stone-900/60 to-stone-950 border border-amber-500/30 rounded-2xl space-y-3 text-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <Split className="w-4 h-4 text-amber-400" />
              <span>Partial Payment (Split Amount)</span>
            </div>
            <div className="text-[11px] font-mono font-bold text-white bg-black/50 px-2 py-0.5 rounded-lg border border-white/10">
              Total: ₹{grandTotal.toFixed(2)}
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-stone-400 font-medium">Quick Split:</span>
            <button
              type="button"
              onClick={() => {
                const half = Math.floor(grandTotal / 2);
                setSplitCashAmount(String(half));
                setSplitUpiAmount(String(Math.round((grandTotal - half) * 100) / 100));
              }}
              className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-semibold border border-white/10 transition-all"
            >
              50% Cash / 50% UPI
            </button>
            <button
              type="button"
              onClick={() => {
                setSplitCashAmount('');
                setSplitUpiAmount('');
                setSplitCardAmount('');
              }}
              className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 text-[10px] border border-white/10 ml-auto transition-all"
            >
              Clear
            </button>
          </div>

          {/* Input Fields Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Cash Portion */}
            <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/25 space-y-1">
              <div className="flex items-center justify-between text-emerald-400 font-semibold text-[11px]">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Cash Amount
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const curU = parseFloat(splitUpiAmount) || 0;
                    const rem = Math.max(0, grandTotal - curU);
                    setSplitCashAmount(String(Math.round(rem * 100) / 100));
                  }}
                  className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded font-bold transition-all"
                >
                  Auto
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-mono text-xs">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={splitCashAmount}
                  onChange={(e) => handleSplitCashChange(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 bg-stone-950 border border-stone-700 rounded-lg text-white font-mono text-sm font-bold focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* UPI Portion */}
            <div className="p-2.5 rounded-xl bg-black/40 border border-sky-500/25 space-y-1">
              <div className="flex items-center justify-between text-sky-400 font-semibold text-[11px]">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> UPI Amount
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const curC = parseFloat(splitCashAmount) || 0;
                    const rem = Math.max(0, grandTotal - curC);
                    setSplitUpiAmount(String(Math.round(rem * 100) / 100));
                  }}
                  className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded font-bold transition-all"
                >
                  Auto
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-mono text-xs">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={splitUpiAmount}
                  onChange={(e) => handleSplitUpiChange(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 bg-stone-950 border border-stone-700 rounded-lg text-white font-mono text-sm font-bold focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
          </div>

          {/* Balance validation bar */}
          <div className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center justify-between border transition-all ${
            isSplitBalanced
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : splitDifference > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-1.5">
              {isSplitBalanced ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>✅ Balanced: Cash ₹{Number(splitCashAmount) || 0} + UPI ₹{Number(splitUpiAmount) || 0} = ₹{grandTotal}</span>
                </>
              ) : splitDifference > 0 ? (
                <>
                  <AlertOctagon className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>₹{splitDifference.toFixed(2)} remaining to balance bill</span>
                </>
              ) : (
                <>
                  <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Overpaid by ₹{Math.abs(splitDifference).toFixed(2)}</span>
                </>
              )}
            </div>
            {!isSplitBalanced && splitDifference > 0 && (
              <button
                type="button"
                onClick={() => {
                  const curU = parseFloat(splitUpiAmount) || 0;
                  setSplitUpiAmount(String(Math.round((curU + splitDifference) * 100) / 100));
                }}
                className="text-[10px] px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded transition-all"
              >
                Fill into UPI
              </button>
            )}
          </div>
        </div>
      )}

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
          disabled={isSubmittingSettlement || (settlePaymentMethod === 'split' && !isSplitBalanced)}
          onClick={handleConfirmSettlement}
          className={`flex-1 py-3 font-bold rounded-xl text-xs transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5 ${
            isSubmittingSettlement || (settlePaymentMethod === 'split' && !isSplitBalanced)
              ? 'bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed opacity-60'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-emerald-950/50'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>
            {isSubmittingSettlement
              ? 'Saving to DB...'
              : settlePaymentMethod === 'split' && !isSplitBalanced
              ? 'Balance Split to Settle'
              : 'Confirm & Settle'}
          </span>
        </button>
      </div>
    </div>
  </div>
);
