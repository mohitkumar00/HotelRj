import React from 'react';
import { BluetoothPrinter } from '../../utils/thermalPrinter';
import { LogEntry } from '../../utils/logger';
import { Printer, Check, X, Bug, RefreshCw, FolderOpen } from 'lucide-react';

export interface PrinterModalProps {
  isElectron: boolean;
  setIsPrinterModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  refreshWindowsPrinters: () => Promise<void>;
  refreshPairedDevices: () => void;
  windowsPrinters: { name: string; displayName?: string; isDefault?: boolean; }[];
  handleSelectWindowsPrinter: (printerName: string) => void;
  selectedWindowsPrinter: string;
  pairedPrinters: { name: string; address: string; }[];
  selectedPrinterAddress: string;
  handleSelectPrinter: (dev: { name: string; address: string; }) => void;
  triggerHaptic: (ms?: number) => void;
  setPrintSuccessMsg: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLogsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  logs: LogEntry[];
}

export const PrinterModal: React.FC<PrinterModalProps> = ({
  isElectron,
  setIsPrinterModalOpen,
  refreshWindowsPrinters,
  refreshPairedDevices,
  windowsPrinters,
  handleSelectWindowsPrinter,
  selectedWindowsPrinter,
  pairedPrinters,
  selectedPrinterAddress,
  handleSelectPrinter,
  triggerHaptic,
  setPrintSuccessMsg,
  setIsLogsModalOpen,
  logs,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
    <div className="w-full max-w-sm bg-[#11131c] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-gold-400" />
          <h3 className="font-bold text-sm text-white">
            {isElectron ? 'Windows Thermal Printer' : 'Thermal Printer Setup'}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setIsPrinterModalOpen(false)}
          className="p-1 rounded-full text-sand-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Print Engine Status */}
      <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-sand-400">Print Engine:</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isElectron
                ? 'bg-emerald-500/20 text-emerald-300'
                : BluetoothPrinter.isNativeAndroidAvailable()
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {isElectron
              ? '● Windows Silent Background'
              : BluetoothPrinter.isNativeAndroidAvailable()
              ? '● Native Android Bridge'
              : '● Browser Mode'}
          </span>
        </div>

        {/* Printers List */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-white flex items-center gap-1">
              <span>{isElectron ? 'Installed Windows Printers:' : 'Paired Bluetooth Printers:'}</span>
            </span>
            <button
              type="button"
              onClick={isElectron ? refreshWindowsPrinters : refreshPairedDevices}
              className="p-1 rounded text-sand-400 hover:text-white flex items-center gap-1 text-[10px]"
              title="Refresh printers"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Scan</span>
            </button>
          </div>

          {isElectron ? (
            windowsPrinters.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => handleSelectWindowsPrinter('')}
                  className={`w-full p-2 rounded-xl text-left text-xs border transition-all flex items-center justify-between ${
                    !selectedWindowsPrinter
                      ? 'bg-amber-400/20 border-amber-400 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <div className="font-medium">System Default Printer</div>
                    <div className="text-[9px] font-mono text-sand-400">Windows default device</div>
                  </div>
                  {!selectedWindowsPrinter && <Check className="w-4 h-4 text-amber-400" />}
                </button>

                {windowsPrinters.map((p) => {
                  const isSelected = selectedWindowsPrinter === p.name;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleSelectWindowsPrinter(p.name)}
                      className={`w-full p-2 rounded-xl text-left text-xs border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-400/20 border-amber-400 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium truncate">{p.displayName || p.name}</div>
                        <div className="text-[9px] font-mono text-sand-400">
                          {p.isDefault ? 'Default Device' : 'Windows Thermal/USB/Bluetooth'}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-sand-400 bg-white/5 p-2 rounded-xl">
                Scanning Windows printers... Connect your USB or Bluetooth thermal printer.
              </div>
            )
          ) : (
            pairedPrinters.length > 0 ? (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {pairedPrinters.map((dev) => {
                  const isSelected = selectedPrinterAddress === dev.address;
                  return (
                    <button
                      key={dev.address}
                      type="button"
                      onClick={() => handleSelectPrinter(dev)}
                      className={`w-full p-2 rounded-xl text-left text-xs border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-400/20 border-amber-400 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{dev.name}</div>
                        <div className="text-[9px] font-mono text-sand-400">{dev.address}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-sand-400 bg-white/5 p-2 rounded-xl">
                No Bluetooth printers paired in Android Settings yet. Pair your printer once in phone settings.
              </div>
            )
          )}
        </div>
      </div>

      {/* Quick Guide */}
      <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 text-[11px] text-sand-300 space-y-1.5">
        <div className="font-bold text-white">
          {isElectron ? '💻 Windows Counter Setup:' : '📱 Pairing Steps:'}
        </div>
        {isElectron ? (
          <ol className="list-decimal pl-4 space-y-1 text-sand-400">
            <li>Pair Bluetooth thermal printer or plug via USB cable.</li>
            <li>Windows installs driver or Generic Text printer.</li>
            <li>Select printer above (or leave Default).</li>
            <li>Tap <strong>Print Test Slip</strong> to test silent print!</li>
          </ol>
        ) : (
          <ol className="list-decimal pl-4 space-y-1 text-sand-400">
            <li>Turn ON your 58mm Bluetooth printer.</li>
            <li>Go to phone's <strong>Android Bluetooth Settings</strong>.</li>
            <li>Pair with printer (PIN is <code>0000</code> or <code>1234</code>).</li>
            <li>Return here & tap <strong>Print Test Slip</strong>.</li>
          </ol>
        )}
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={async () => {
            triggerHaptic(40);
            setPrintSuccessMsg('Printing test slip...');
            try {
              const res = await BluetoothPrinter.printTestReceipt();
              setPrintSuccessMsg(`✅ Test slip sent (${res.method})!`);
              setTimeout(() => setPrintSuccessMsg(null), 4000);
            } catch (err: any) {
              setPrintSuccessMsg(`❌ Test failed: ${err?.message}`);
              setTimeout(() => setPrintSuccessMsg(null), 4000);
            }
          }}
          className="w-full py-2.5 rounded-xl bg-gold-400 hover:bg-gold-300 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print Test Slip (58mm)</span>
        </button>

        {isElectron && (
          <button
            type="button"
            onClick={() => BluetoothPrinter.openWindowsLogsFolder()}
            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sand-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Open Windows Logs Folder</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setIsPrinterModalOpen(false);
            setIsLogsModalOpen(true);
          }}
          className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sand-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
        >
          <Bug className="w-4 h-4 text-amber-400" />
          <span>View Live Debug Logs ({logs.length})</span>
        </button>
      </div>
    </div>
  </div>
);
