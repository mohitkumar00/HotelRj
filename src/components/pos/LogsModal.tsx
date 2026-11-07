import React from 'react';
import { BluetoothPrinter } from '../../utils/thermalPrinter';
import { Logger, LogEntry } from '../../utils/logger';
import { Capacitor } from '@capacitor/core';
import { MessageCircle, X, Trash2, Bug, Copy } from 'lucide-react';

export interface LogsModalProps {
  isElectron: boolean;
  setIsLogsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTable: string;
  totalItemsCount: number;
  newItemsToFire: { name: string; quantity: number; notes?: string; }[];
  selectedWindowsPrinter: string;
  logs: LogEntry[];
  setPrintSuccessMsg: React.Dispatch<React.SetStateAction<string | null>>;
}

export const LogsModal: React.FC<LogsModalProps> = ({
  isElectron,
  setIsLogsModalOpen,
  activeTable,
  totalItemsCount,
  newItemsToFire,
  selectedWindowsPrinter,
  logs,
  setPrintSuccessMsg,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-4">
    <div className="w-full max-w-lg bg-[#0e1017] border border-amber-400/30 rounded-3xl p-4 shadow-2xl flex flex-col max-h-[92vh]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="font-bold text-sm text-white">Live Debug Console</h3>
            <p className="text-[10px] text-sand-400">
              {isElectron
                ? 'Windows Error & Warning Monitor (%APPDATA%)'
                : 'Real-time logs for KOT, printer & errors'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsLogsModalOpen(false)}
          className="p-1 rounded-full text-sand-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Diagnostic Badges */}
      <div className="grid grid-cols-2 gap-2 my-3 text-[10px]">
        <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
          <span className="text-sand-400 block">Platform:</span>
          <span className="font-bold text-white">
            {isElectron
              ? 'Windows Desktop App (Electron)'
              : Capacitor.isNativePlatform()
              ? 'Native Android APK'
              : 'Web Browser'}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
          <span className="text-sand-400 block">Native Engine:</span>
          <span
            className={`font-bold ${
              isElectron
                ? 'text-emerald-400'
                : BluetoothPrinter.isNativeAndroidAvailable()
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {isElectron
              ? 'Active (Windows Silent Thermal)'
              : BluetoothPrinter.isNativeAndroidAvailable()
              ? 'Active (AndroidPrinter)'
              : 'Web Mode'}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
          <span className="text-sand-400 block">Active Table:</span>
          <span className="font-bold text-white">
            {activeTable} ({totalItemsCount} items, {newItemsToFire.length} unfired)
          </span>
        </div>
        <div className="p-2 rounded-xl bg-zinc-900 border border-white/10">
          <span className="text-sand-400 block">Target Printer:</span>
          <span className="font-bold text-white truncate block">
            {isElectron
              ? selectedWindowsPrinter || 'Windows Default Device'
              : localStorage.getItem('hotel_rj_printer_name') || 'Auto / Android Spooler'}
          </span>
        </div>
      </div>

      {/* Privacy notice */}
      {isElectron && (
        <div className="mb-2 p-2 rounded-xl bg-zinc-900/80 border border-white/10 text-[10px] text-sand-400 flex items-center justify-between">
          <span>📁 Errors and warnings saved to Windows logs folder. Order details omitted.</span>
          <button
            type="button"
            onClick={() => BluetoothPrinter.openWindowsLogsFolder()}
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-sand-200 text-[9px] font-bold shrink-0 ml-2"
          >
            Open Folder
          </button>
        </div>
      )}

      {/* Logs List Container */}
      <div className="flex-1 overflow-y-auto bg-black/60 rounded-2xl p-2.5 border border-white/10 font-mono text-[10px] space-y-1.5 max-h-[46vh]">
        {logs.length === 0 ? (
          <div className="text-center text-sand-500 py-6">No logs recorded yet.</div>
        ) : (
          logs.map((l) => {
            let badgeColor = 'text-sand-300';
            if (l.level === 'error') badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
            else if (l.level === 'warn') badgeColor = 'text-amber-300 bg-amber-500/10 border-amber-500/30';
            else if (l.level === 'success') badgeColor = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
            else badgeColor = 'text-blue-300 bg-blue-500/10 border-blue-500/30';

            return (
              <div key={l.id} className="p-1.5 rounded-lg bg-zinc-900/60 border border-white/5 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[9px]">
                  <span className="text-sand-500">{l.timestamp}</span>
                  <span className={`px-1 py-0.2 rounded border uppercase font-bold text-[8px] ${badgeColor}`}>
                    {l.level}
                  </span>
                  <span className="text-sand-400 font-sans font-semibold">[{l.category}]</span>
                </div>
                <div className="text-sand-200 text-[10.5px] break-words">{l.message}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-3 border-t border-white/10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const text = logs
              .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}`)
              .join('\n');
            if (navigator.clipboard) {
              navigator.clipboard.writeText(text);
              setPrintSuccessMsg('✅ Logs copied to clipboard!');
              setTimeout(() => setPrintSuccessMsg(null), 2500);
            }
          }}
          className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copy All</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const text =
              `*HOTEL RJ POS LOGS*\nDate: ${new Date().toLocaleString()}\nPlatform: ${
                isElectron ? 'Windows Desktop' : Capacitor.isNativePlatform() ? 'Android Native' : 'Browser'
              }\n--------------------\n` +
              logs.slice(0, 25).map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }}
          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>WhatsApp Logs</span>
        </button>

        <button
          type="button"
          onClick={() => Logger.clear()}
          className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-rose-400 text-xs font-semibold"
          title="Clear Logs"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
);
