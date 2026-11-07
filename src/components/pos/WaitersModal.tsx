import React from 'react';
import { X, Users, ShieldCheck } from 'lucide-react';
import type { ConnectedWaiter } from './types';

export interface WaitersModalProps {
  setIsWaitersModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFirewallStatusMsg: React.Dispatch<React.SetStateAction<string | null>>;
  firewallStatusMsg: string | null;
  connectedWaiters: ConnectedWaiter[];
}

export const WaitersModal: React.FC<WaitersModalProps> = ({
  setIsWaitersModalOpen,
  setFirewallStatusMsg,
  firewallStatusMsg,
  connectedWaiters,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
    <div className="w-full max-w-md bg-[#11131c] border border-blue-500/30 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          <div>
            <h3 className="font-bold text-sm text-white">Active Waiters Station</h3>
            <p className="text-[10px] text-sand-400">
              Live devices connected to this Counter POS (Port 5050)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsWaitersModalOpen(false)}
          className="p-1 rounded-full text-sand-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Firewall Quick Action Card */}
      <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Windows Firewall Rule
          </span>
          <button
            type="button"
            onClick={async () => {
              if ((window as any).ElectronAPI?.fixFirewall) {
                setFirewallStatusMsg('Applying rule (check UAC popup)...');
                const res = await (window as any).ElectronAPI.fixFirewall();
                setFirewallStatusMsg(res?.message || 'Rule applied');
                setTimeout(() => setFirewallStatusMsg(null), 4000);
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30 active:scale-95 transition-all"
          >
            Unblock Port 5050
          </button>
        </div>
        <p className="text-[10px] text-sand-400">
          If mobile waiters get "signal timeout", click above to allow incoming Wi-Fi connections through Windows Defender.
        </p>
        {firewallStatusMsg && (
          <div className="text-[10px] text-center font-mono text-amber-300 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
            {firewallStatusMsg}
          </div>
        )}
      </div>

      {/* Waiters List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[45vh]">
        {connectedWaiters.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-white/5 space-y-2">
            <Users className="w-8 h-8 text-sand-600 mx-auto" />
            <div className="text-xs font-semibold text-sand-300">No Waiters Connected Yet</div>
            <p className="text-[11px] text-sand-500 max-w-xs mx-auto">
              Waiters will appear here automatically as soon as they tap "Connect & Sync Now" or work on a table from their Android app.
            </p>
          </div>
        ) : (
          connectedWaiters.map((w) => (
            <div
              key={w.id}
              className="p-3 rounded-2xl bg-zinc-900/80 border border-white/10 flex items-center justify-between gap-3 hover:border-blue-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">
                  {w.name?.charAt(0) || 'W'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">{w.name}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ONLINE
                    </span>
                  </div>
                  <div className="text-[10px] text-sand-400 font-mono flex items-center gap-2 mt-0.5">
                    <span>IP: {w.ip}</span>
                    <span>•</span>
                    <span className="text-sand-300">{w.device}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[11px] font-bold text-amber-300">
                  {w.activeTable ? `Viewing ${w.activeTable}` : 'Lobby'}
                </div>
                <div className="text-[9px] text-sand-500 font-mono mt-0.5">
                  {new Date(w.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-sand-400">
        <span>Total Active: <strong className="text-white">{connectedWaiters.length}</strong></span>
        <button
          type="button"
          onClick={() => setIsWaitersModalOpen(false)}
          className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs active:scale-95 transition-all"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);
