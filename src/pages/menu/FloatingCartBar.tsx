import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface FloatingCartBarProps {
  totalItemsCount: number;
  totalPrice: number;
  tableNumber: string;
  setIsOrderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({
  totalItemsCount,
  totalPrice,
  tableNumber,
  setIsOrderModalOpen,
}) => (
  <div className="fixed bottom-3 left-3 right-3 z-40 max-w-lg mx-auto">
    <div className="p-3 sm:p-3.5 rounded-2xl bg-[#11131c]/95 border border-gold-400/50 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 ring-2 ring-gold-400/20">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-gold-400 text-black flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
          {totalItemsCount}
        </div>
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
            <span>₹{totalPrice}</span>
            <span className="text-[10px] font-normal text-sand-400">
              ({totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'})
            </span>
          </div>
          <span className="text-[10px] text-gold-300 truncate block">
            {tableNumber ? `Table: ${tableNumber} • Ready to show waiter` : 'Ready to show waiter'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOrderModalOpen(true)}
        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-black text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5 shrink-0 active:scale-95 transition-all cursor-pointer"
      >
        <span>Show Waiter</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);
