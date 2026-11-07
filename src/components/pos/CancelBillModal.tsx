import React from 'react';
import { Ban, KeyRound, AlertOctagon } from 'lucide-react';

export interface CancelBillModalProps {
  billToCancel: any;
  handleConfirmCancelBill: (e: React.FormEvent) => Promise<void>;
  cancelPin: string;
  setCancelPin: React.Dispatch<React.SetStateAction<string>>;
  setCancelPinError: React.Dispatch<React.SetStateAction<boolean>>;
  cancelPinError: boolean;
  cancelPinMessage: string;
  setCancelReasonPreset: React.Dispatch<React.SetStateAction<string>>;
  setCustomCancelReason: React.Dispatch<React.SetStateAction<string>>;
  cancelReasonPreset: string;
  customCancelReason: string;
  setBillToCancel: React.Dispatch<any>;
  isCancellingBill: boolean;
}

export const CancelBillModal: React.FC<CancelBillModalProps> = ({
  billToCancel,
  handleConfirmCancelBill,
  cancelPin,
  setCancelPin,
  setCancelPinError,
  cancelPinError,
  cancelPinMessage,
  setCancelReasonPreset,
  setCustomCancelReason,
  cancelReasonPreset,
  customCancelReason,
  setBillToCancel,
  isCancellingBill,
}) => (
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
            <span>Enter Manager PIN:</span>
          </label>
          <input
            type="password"
            maxLength={6}
            placeholder="Enter PIN"
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
              ❌ {cancelPinMessage || 'Incorrect PIN. Only authorized managers can void bills.'}
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
);
