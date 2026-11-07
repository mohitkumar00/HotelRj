import React from 'react';
import { PlusCircle } from 'lucide-react';

export interface ExpenseModalProps {
  handleAddExpense: (e: React.FormEvent) => Promise<void>;
  expenseCategory: string;
  setExpenseCategory: React.Dispatch<React.SetStateAction<string>>;
  expenseAmount: string;
  setExpenseAmount: React.Dispatch<React.SetStateAction<string>>;
  setExpensePaidBy: React.Dispatch<React.SetStateAction<'Cash Drawer' | 'UPI'>>;
  expensePaidBy: 'Cash Drawer' | 'UPI';
  expenseNotes: string;
  setExpenseNotes: React.Dispatch<React.SetStateAction<string>>;
  setIsExpenseModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  expenseSubmitting: boolean;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  handleAddExpense,
  expenseCategory,
  setExpenseCategory,
  expenseAmount,
  setExpenseAmount,
  setExpensePaidBy,
  expensePaidBy,
  expenseNotes,
  setExpenseNotes,
  setIsExpenseModalOpen,
  expenseSubmitting,
}) => (
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
);
