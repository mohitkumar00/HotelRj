import React from 'react';
import { MenuItem } from '../../types';
import { Trash2, ShieldAlert } from 'lucide-react';
import { parseItemPrice } from '../../utils/priceUtils';

export interface VoidItemModalProps {
  voidCandidate: { itemId: string; item: MenuItem; quantity: number; firedCount?: number; };
  activeTable: string;
  setVoidReason: React.Dispatch<React.SetStateAction<string>>;
  setCustomVoidReason: React.Dispatch<React.SetStateAction<string>>;
  voidReason: string;
  customVoidReason: string;
  setVoidCandidate: React.Dispatch<React.SetStateAction<{ itemId: string; item: MenuItem; quantity: number; firedCount?: number; } | null>>;
  setIsVoidModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleConfirmVoid: () => Promise<void>;
}

export const VoidItemModal: React.FC<VoidItemModalProps> = ({
  voidCandidate,
  activeTable,
  setVoidReason,
  setCustomVoidReason,
  voidReason,
  customVoidReason,
  setVoidCandidate,
  setIsVoidModalOpen,
  handleConfirmVoid,
}) => (
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
);
