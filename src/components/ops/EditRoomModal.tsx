import React from 'react';
import { X } from 'lucide-react';
import { HotelRoomRecord } from '../../types';

export interface EditRoomModalProps {
  setEditingRoom: React.Dispatch<React.SetStateAction<(HotelRoomRecord & { originalId?: string }) | null>>;
  handleSaveRoom: (e: React.FormEvent) => Promise<void>;
  editingRoom: HotelRoomRecord & { originalId?: string };
}

export const EditRoomModal: React.FC<EditRoomModalProps> = ({
  setEditingRoom,
  handleSaveRoom,
  editingRoom,
}) => (
  <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl text-slate-100">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
        <h3 className="font-bold text-lg text-white">Edit Room Details</h3>
        <button onClick={() => setEditingRoom(null)} className="p-1 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSaveRoom} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Room ID / Number *</label>
            <input
              type="text"
              required
              value={editingRoom.id}
              onChange={(e) => setEditingRoom({ ...editingRoom, id: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Nightly Tariff (₹) *</label>
            <input
              type="number"
              required
              value={editingRoom.pricePerNight}
              onChange={(e) => setEditingRoom({ ...editingRoom, pricePerNight: Number(e.target.value) })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Room Display Name</label>
          <input
            type="text"
            value={editingRoom.name}
            onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Tier</label>
            <select
              value={editingRoom.tier}
              onChange={(e) => setEditingRoom({ ...editingRoom, tier: e.target.value as any })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            >
              <option value="deluxe">Deluxe King</option>
              <option value="executive">Super Deluxe</option>
              <option value="family">Family Suite</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Bed Configuration</label>
            <input
              type="text"
              value={editingRoom.bedType}
              onChange={(e) => setEditingRoom({ ...editingRoom, bedType: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Housekeeping Status</label>
          <select
            value={editingRoom.status}
            onChange={(e) => setEditingRoom({ ...editingRoom, status: e.target.value as any })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
          >
            <option value="available">🟢 Available (Clean & Ready)</option>
            <option value="occupied">🔴 Occupied</option>
            <option value="dirty">🟡 Dirty (Needs Cleaning)</option>
            <option value="maintenance">🔧 Maintenance</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setEditingRoom(null)}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition"
          >
            Save Room
          </button>
        </div>
      </form>
    </div>
  </div>
);
