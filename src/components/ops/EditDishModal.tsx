import React from 'react';
import { X } from 'lucide-react';
import { MenuCategory, DietaryType } from '../../types';

export interface EditDishModalProps {
  editingDish: { id?: string; categoryId?: string; name: string; hindiName?: string; price: number; dietary: DietaryType; isAvailable: boolean; popular: boolean; description?: string; };
  setEditingDish: React.Dispatch<React.SetStateAction<{ id?: string; categoryId?: string; name: string; hindiName?: string; price: number; dietary: DietaryType; isAvailable: boolean; popular: boolean; description?: string; } | null>>;
  handleSaveDish: (e: React.FormEvent) => Promise<void>;
  menuCategories: MenuCategory[];
}

export const EditDishModal: React.FC<EditDishModalProps> = ({
  editingDish,
  setEditingDish,
  handleSaveDish,
  menuCategories,
}) => (
  <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl text-slate-100">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
        <h3 className="font-bold text-lg text-white">
          {editingDish.id ? 'Edit Dish' : 'Add New Dish to Menu'}
        </h3>
        <button
          onClick={() => setEditingDish(null)}
          className="p-1 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSaveDish} className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Dish Name (English) *</label>
          <input
            type="text"
            required
            value={editingDish.name}
            onChange={(e) => setEditingDish({ ...editingDish, name: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            placeholder="e.g., Handi Mutton"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Hindi / Local Name (Optional)</label>
          <input
            type="text"
            value={editingDish.hindiName || ''}
            onChange={(e) => setEditingDish({ ...editingDish, hindiName: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            placeholder="e.g., हांडी मटन"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Price (₹) *</label>
            <input
              type="number"
              required
              min={0}
              value={editingDish.price}
              onChange={(e) => setEditingDish({ ...editingDish, price: Number(e.target.value) })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Dietary Type</label>
            <select
              value={editingDish.dietary}
              onChange={(e) => setEditingDish({ ...editingDish, dietary: e.target.value as DietaryType })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            >
              <option value="veg">🟢 Pure Veg</option>
              <option value="non-veg">🔴 Non-Veg</option>
              <option value="egg">🟡 Egg</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Category</label>
          <select
            value={editingDish.categoryId}
            onChange={(e) => setEditingDish({ ...editingDish, categoryId: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
          >
            {menuCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={editingDish.isAvailable}
              onChange={(e) => setEditingDish({ ...editingDish, isAvailable: e.target.checked })}
              className="w-4 h-4 rounded text-amber-500"
            />
            <span>Available In Stock</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={editingDish.popular}
              onChange={(e) => setEditingDish({ ...editingDish, popular: e.target.checked })}
              className="w-4 h-4 rounded text-amber-500"
            />
            <span>⭐ Mark Popular</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setEditingDish(null)}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition"
          >
            Save Dish
          </button>
        </div>
      </form>
    </div>
  </div>
);
