import React from 'react';
import { X } from 'lucide-react';

export interface ItemNoteModalProps {
  customizingItem: { id: string; name: string; notes?: string; };
  setCustomizingItem: React.Dispatch<React.SetStateAction<{ id: string; name: string; notes?: string; } | null>>;
  setCustomNoteText: React.Dispatch<React.SetStateAction<string>>;
  customNoteText: string;
  handleSaveItemNote: (noteText: string) => void;
}

export const ItemNoteModal: React.FC<ItemNoteModalProps> = ({
  customizingItem,
  setCustomizingItem,
  setCustomNoteText,
  customNoteText,
  handleSaveItemNote,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
    <div className="w-full max-w-sm bg-[#131622] border border-amber-400/40 rounded-3xl p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Cooking Note / Request
          </span>
          <h4 className="font-bold text-sm text-white">
            {customizingItem.name}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => setCustomizingItem(null)}
          className="p-1 rounded-full text-sand-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick 1-Tap Cooking Chips */}
      <div>
        <label className="text-[10px] uppercase font-bold text-sand-400 tracking-wider block mb-2">
          Tap Quick Instructions:
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[
            '🌶️ Less Spicy',
            '🔥 Extra Spicy',
            '🥬 No Onion-Garlic (Jain)',
            '🧈 Extra Butter',
            '🥣 Extra Gravy',
            '🍟 Extra Crispy',
            '⏱️ Bring First (Starter)',
            '📦 Pack / Parcel',
            '🧂 Low Salt',
            '🚫 No Coriander',
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setCustomNoteText((prev) => {
                  const cleanChip = chip.replace(/^[^\w\s]+/, '').trim();
                  if (prev.includes(cleanChip)) return prev;
                  return prev ? `${prev}, ${cleanChip}` : cleanChip;
                });
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs bg-white/10 hover:bg-amber-400 hover:text-black text-sand-200 border border-white/10 active:scale-95 transition-all font-medium"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Custom instruction textarea */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase font-bold text-sand-400 tracking-wider block">
          Instruction Text:
        </label>
        <input
          type="text"
          value={customNoteText}
          onChange={(e) => setCustomNoteText(e.target.value)}
          placeholder="e.g. Less spicy, make gravy thick..."
          className="w-full text-xs bg-zinc-900 text-white p-2.5 rounded-xl border border-white/15 focus:border-amber-400 focus:outline-none"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => handleSaveItemNote(customNoteText.trim())}
          className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
        >
          Save Note
        </button>
        <button
          type="button"
          onClick={() => {
            setCustomNoteText('');
            handleSaveItemNote('');
          }}
          className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-rose-400 text-xs font-semibold"
        >
          Clear
        </button>
      </div>
    </div>
  </div>
);
