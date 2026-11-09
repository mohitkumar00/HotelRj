import React from 'react';
import { Printer, X, Bug, TrendingUp, Receipt, Sliders, Calendar, KeyRound } from 'lucide-react';

export interface ManagerMenuModalProps {
  setIsManagerMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenManagerAction: (action: 'insights' | 'menu' | 'banquet' | 'bills' | 'printer' | 'logs') => void;
  onOpenChangePin?: () => void;
}

export const ManagerMenuModal: React.FC<ManagerMenuModalProps> = ({
  setIsManagerMenuOpen,
  handleOpenManagerAction,
  onOpenChangePin,
}) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            👑
          </div>
          <div>
            <h3 className="text-base font-black text-white">Manager &amp; Owner Operations</h3>
            <p className="text-[10px] text-zinc-400">
              {sessionStorage.getItem('hotel_rj_owner_auth') === 'true'
                ? 'Authenticated Session Active'
                : 'PIN Required for protected actions'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsManagerMenuOpen(false)}
          className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-4">
        {/* Card 1: Owner Insights */}
        <button
          type="button"
          onClick={() => handleOpenManagerAction('insights')}
          className="p-3.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-amber-500/30 text-left flex items-start gap-3 transition-all active:scale-95 group shadow-sm"
        >
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 group-hover:bg-amber-500/25">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white">Owner Insights</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Gross sales, daily kharacha, void audit &amp; WhatsApp reports
            </p>
          </div>
        </button>

        {/* Card 2: Hotel Operations & Dishes */}
        <button
          type="button"
          onClick={() => handleOpenManagerAction('menu')}
          className="p-3.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-purple-500/30 text-left flex items-start gap-3 transition-all active:scale-95 group shadow-sm"
        >
          <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 group-hover:bg-purple-500/25">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white">Menu &amp; Kitchen 86</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Toggle sold-out items, dish pricing, rooms &amp; tables setup
            </p>
          </div>
        </button>

        {/* Card 3: Banquet Event Calendar */}
        <button
          type="button"
          onClick={() => handleOpenManagerAction('banquet')}
          className="p-3.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-emerald-500/30 text-left flex items-start gap-3 transition-all active:scale-95 group shadow-sm"
        >
          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white">Banquet Calendar</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Advance bookings, avoid double-booking, lawn/hall schedules
            </p>
          </div>
        </button>

        {/* Card 4: Bills History */}
        <button
          type="button"
          onClick={() => handleOpenManagerAction('bills')}
          className="p-3.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 text-left flex items-start gap-3 transition-all active:scale-95 group shadow-sm"
        >
          <div className="p-2.5 rounded-xl bg-zinc-800 text-emerald-400 group-hover:bg-zinc-750">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white">Bills &amp; Reprints</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Recent settled bills, duplicate print, cancel/void records
            </p>
          </div>
        </button>

        {/* Card 5: Printer Setup */}
        <button
          type="button"
          onClick={() => handleOpenManagerAction('printer')}
          className="p-3 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850 border border-zinc-850 text-left flex items-center gap-3 transition-all active:scale-95 text-zinc-300"
        >
          <Printer className="w-4 h-4 text-gold-400" />
          <span className="text-xs font-semibold">Thermal Printer Setup</span>
        </button>

        {/* Card 6: Debug Logs */}
        <button
          type="button"
          onClick={() => handleOpenManagerAction('logs')}
          className="p-3 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850 border border-zinc-850 text-left flex items-center gap-3 transition-all active:scale-95 text-zinc-300"
        >
          <Bug className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold">Debug &amp; Sync Logs</span>
        </button>

        {/* Card 7: Change Manager PIN */}
        {onOpenChangePin && (
          <button
            type="button"
            onClick={() => {
              setIsManagerMenuOpen(false);
              onOpenChangePin();
            }}
            className="p-3 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850 border border-amber-500/20 text-left flex items-center gap-3 transition-all active:scale-95 text-zinc-300 sm:col-span-2"
          >
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-white">Change Manager PIN</span>
              <p className="text-[10px] text-zinc-400 mt-0.5">Update the 4-digit PIN used to access reports, rooms & management</p>
            </div>
          </button>
        )}
      </div>

      {/* Session Sign-Out / Lock */}
      {sessionStorage.getItem('hotel_rj_owner_auth') === 'true' && (
        <div className="pt-3 border-t border-zinc-850 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">Lock manager tools on this device:</span>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem('hotel_rj_owner_auth');
              setIsManagerMenuOpen(false);
            }}
            className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold"
          >
            🔒 Lock Session
          </button>
        </div>
      )}
    </div>
  </div>
);
