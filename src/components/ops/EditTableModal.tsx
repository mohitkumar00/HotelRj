import React from 'react';
import { X } from 'lucide-react';
import { TableConfigItem } from '../../types';

export interface EditTableModalProps {
  setEditingTable: React.Dispatch<React.SetStateAction<(Partial<TableConfigItem> & { originalId?: string }) | null>>;
  handleSaveTable: (e: React.FormEvent) => Promise<void>;
  editingTable: Partial<TableConfigItem> & { originalId?: string };
}

export const EditTableModal: React.FC<EditTableModalProps> = ({
  setEditingTable,
  handleSaveTable,
  editingTable,
}) => (
  <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl text-slate-100">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
        <h3 className="font-bold text-lg text-white">Edit Table / Slot</h3>
        <button onClick={() => setEditingTable(null)} className="p-1 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSaveTable} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Table ID *</label>
            <input
              type="text"
              required
              value={editingTable.id || ''}
              onChange={(e) => setEditingTable({ ...editingTable, id: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
              placeholder="e.g., T-13 or Parcel 5"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Section</label>
            <select
              value={editingTable.section || 'dining'}
              onChange={(e) => setEditingTable({ ...editingTable, section: e.target.value as any })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            >
              <option value="dining">Dining Hall</option>
              <option value="parcel">Takeaway / Parcel</option>
              <option value="lawn">Lawn Area</option>
              <option value="banquet">Banquet Hall</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Display Label</label>
          <input
            type="text"
            value={editingTable.name || ''}
            onChange={(e) => setEditingTable({ ...editingTable, name: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Seating Capacity (Guests)</label>
          <input
            type="number"
            min={1}
            value={editingTable.capacity || 4}
            onChange={(e) => setEditingTable({ ...editingTable, capacity: Number(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setEditingTable(null)}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition"
          >
            Save Table
          </button>
        </div>
      </form>
    </div>
  </div>
);
