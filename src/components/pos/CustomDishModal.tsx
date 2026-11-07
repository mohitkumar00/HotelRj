import React from 'react';
import { DietaryType } from '../../types';
import { Plus, Minus, X, ChefHat, PlusCircle } from 'lucide-react';

export interface CustomDishModalProps {
  activeTable: string;
  setIsCustomModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomDishName: React.Dispatch<React.SetStateAction<string>>;
  setCustomDishPrice: React.Dispatch<React.SetStateAction<string>>;
  setCustomDietary: React.Dispatch<React.SetStateAction<DietaryType>>;
  handleAddCustomDish: (e?: React.FormEvent) => void;
  customDishName: string;
  customDishPrice: string;
  setCustomQuantity: React.Dispatch<React.SetStateAction<number>>;
  customQuantity: number;
  customDietary: DietaryType;
  customNotes: string;
  setCustomNotes: React.Dispatch<React.SetStateAction<string>>;
}

export const CustomDishModal: React.FC<CustomDishModalProps> = ({
  activeTable,
  setIsCustomModalOpen,
  setCustomDishName,
  setCustomDishPrice,
  setCustomDietary,
  handleAddCustomDish,
  customDishName,
  customDishPrice,
  setCustomQuantity,
  customQuantity,
  customDietary,
  customNotes,
  setCustomNotes,
}) => (
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

      {/* Quick Presets for Highway Hotel & Restaurant Services */}
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
);
