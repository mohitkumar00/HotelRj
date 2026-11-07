import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Wifi, ShieldAlert } from 'lucide-react';
import type { SyncServerInfo } from './types';

export interface SyncModalProps {
  isElectron: boolean;
  setIsSyncModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  syncInfo: SyncServerInfo | null;
  setFirewallStatusMsg: React.Dispatch<React.SetStateAction<string | null>>;
  firewallStatusMsg: string | null;
  isSyncConnected: boolean;
  counterInputUrl: string;
  setCounterInputUrl: React.Dispatch<React.SetStateAction<string>>;
  counterInputToken: string;
  setCounterInputToken: React.Dispatch<React.SetStateAction<string>>;
  syncErrorDetail: string | null;
  setIsSyncConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setCounterSyncUrl: React.Dispatch<React.SetStateAction<string>>;
  performManualSync: (customUrl?: string) => Promise<boolean>;
  counterSyncUrl: string;
  setPrintSuccessMsg: React.Dispatch<React.SetStateAction<string | null>>;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isElectron,
  setIsSyncModalOpen,
  syncInfo,
  setFirewallStatusMsg,
  firewallStatusMsg,
  isSyncConnected,
  counterInputUrl,
  setCounterInputUrl,
  counterInputToken,
  setCounterInputToken,
  syncErrorDetail,
  setIsSyncConnected,
  setCounterSyncUrl,
  performManualSync,
  counterSyncUrl,
  setPrintSuccessMsg,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
    <div className="w-full max-w-sm bg-[#11131c] border border-emerald-500/30 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Wifi className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm text-white">
            {isElectron ? 'Counter Wi-Fi Sync Server' : 'Connect to Counter POS'}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setIsSyncModalOpen(false)}
          className="p-1 rounded-full text-sand-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isElectron ? (
        <>
          <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
              ● Server Running on Port 5050
            </span>
            <div className="font-mono text-base font-bold text-white bg-black/40 py-1.5 px-3 rounded-xl border border-white/10 inline-block">
              {syncInfo?.ip || '127.0.0.1'}:5050
            </div>
            <p className="text-[11px] text-sand-400">
              Waiters connect to this Counter IP over the local restaurant Wi-Fi to sync orders live.
            </p>
            {syncInfo?.token && (
              <div className="pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Waiter Pairing Code</span>
                <div className="font-mono text-xl font-black tracking-[0.3em] text-white bg-black/40 py-1.5 px-3 rounded-xl border border-amber-500/30 inline-block select-all">
                  {syncInfo.token}
                </div>
                <p className="text-[10px] text-sand-400 mt-1">Enter this code once on each waiter phone.</p>
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white space-y-2 shadow-inner">
            <QRCodeSVG
              value={`http://${syncInfo?.ip || '127.0.0.1'}:5050`}
              size={150}
              level="M"
            />
            <span className="text-[10px] font-bold text-zinc-800 font-mono">
              http://{syncInfo?.ip || '127.0.0.1'}:5050
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 text-[11px] text-sand-300 space-y-1.5">
            <div className="font-bold text-white">📲 Instructions for Waiters:</div>
            <ol className="list-decimal pl-4 space-y-1 text-sand-400">
              <li>Connect phone to same hotel Wi-Fi (turn off Mobile Data 4G/5G).</li>
              <li>Open Hotel RJ Waiter APK, or visit <strong className="text-white font-mono">http://{syncInfo?.ip || '127.0.0.1'}:5050</strong> directly in Chrome.</li>
              <li>Tap <strong>Sync Counter</strong> in top header.</li>
              <li>Counter IP is <strong className="text-white font-mono">{syncInfo?.ip || '127.0.0.1'}</strong>.</li>
            </ol>
            <p className="text-[10px] text-amber-400/90 pt-0.5">
              💡 Tip: If using Chrome, open the local http link directly. Visiting from https:// will be blocked by Chrome as mixed content.
            </p>
          </div>

          <div className="pt-2 border-t border-white/10 space-y-2">
            <button
              type="button"
              onClick={async () => {
                if ((window as any).ElectronAPI?.fixFirewall) {
                  setFirewallStatusMsg('Applying firewall rule (check Windows prompt)...');
                  const res = await (window as any).ElectronAPI.fixFirewall();
                  setFirewallStatusMsg(res?.message || 'Rule applied');
                  setTimeout(() => setFirewallStatusMsg(null), 4000);
                }
              }}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Unblock Windows Firewall (Port 5050)</span>
            </button>
            {firewallStatusMsg && (
              <div className="text-[10px] text-center font-mono text-amber-300 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                {firewallStatusMsg}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-sand-400">Sync Status:</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isSyncConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-sand-400'
                }`}
              >
                {isSyncConnected ? '● Connected to Counter PC' : '○ Offline / Local Mode'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase font-bold text-sand-400 tracking-wider block">
              Counter PC IP Address:
            </label>
            <input
              type="text"
              value={counterInputUrl}
              onChange={(e) => setCounterInputUrl(e.target.value)}
              placeholder="e.g. 192.168.1.15:5050"
              className="w-full text-xs font-mono bg-zinc-900 text-white p-2.5 rounded-xl border border-white/15 focus:border-emerald-400 focus:outline-none"
            />
            <p className="text-[10px] text-sand-400">
              Look at the Counter POS screen on Windows to see the exact IP address.
            </p>
            <label className="text-[11px] uppercase font-bold text-sand-400 tracking-wider block pt-1">
              Pairing Code:
            </label>
            <input
              type="text"
              value={counterInputToken}
              onChange={(e) => setCounterInputToken(e.target.value.toUpperCase())}
              placeholder="8-character code from Counter POS"
              autoCapitalize="characters"
              maxLength={16}
              className="w-full text-xs font-mono tracking-widest bg-zinc-900 text-white p-2.5 rounded-xl border border-white/15 focus:border-emerald-400 focus:outline-none"
            />
          </div>

          {syncErrorDetail && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-rose-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Sync Troubleshooting</span>
              </div>
              <div className="text-[10px] text-sand-300 font-mono bg-black/40 p-2 rounded-lg border border-white/5 break-words">
                {syncErrorDetail}
              </div>
              <div className="space-y-1 text-[10px] text-sand-400">
                <div>1. Ensure phone & PC are on the <strong>same Wi-Fi router</strong>.</div>
                <div>2. On Desktop Counter POS, click <strong>"Unblock Windows Firewall"</strong> to allow Port 5050.</div>
                <div>3. Verify IP on Counter POS screen matches what you typed.</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                const target = counterInputUrl.trim();
                if (!target) {
                  setIsSyncConnected(false);
                  return;
                }
                localStorage.setItem('hotel_rj_counter_sync_url', target);
                localStorage.setItem('hotel_rj_sync_token', counterInputToken.trim());
                setCounterSyncUrl(target);
                const ok = await performManualSync(target);
                if (ok) {
                  setTimeout(() => setIsSyncModalOpen(false), 900);
                }
              }}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
            >
              Connect & Sync Now
            </button>

            {counterSyncUrl && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('hotel_rj_counter_sync_url');
                  setCounterSyncUrl('');
                  setCounterInputUrl('');
                  setIsSyncConnected(false);
                  setPrintSuccessMsg('Disconnected from Counter');
                  setTimeout(() => setPrintSuccessMsg(null), 2500);
                }}
                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-rose-400 text-xs font-semibold"
              >
                Disconnect
              </button>
            )}
          </div>
        </>
      )}
    </div>
  </div>
);
