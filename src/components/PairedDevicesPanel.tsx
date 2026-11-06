import React, { useCallback, useEffect, useState } from 'react';
import { Smartphone, Ban } from 'lucide-react';
import { listPairedDevices, revokeDevice, type PairedDevice } from '../utils/deviceAuth';

/** Lists paired devices and lets the owner revoke a lost phone. */
export const PairedDevicesPanel: React.FC<{ onPair: () => void }> = ({ onPair }) => {
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const load = useCallback(async () => setDevices(await listPairedDevices()), []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gold-400 font-bold text-xs">
          <Smartphone className="w-3.5 h-3.5" /> Paired devices
        </div>
        <button type="button" onClick={onPair} className="text-[11px] text-emerald-400 hover:text-emerald-300 underline">
          Pair this device
        </button>
      </div>
      {devices.length === 0 && <p className="text-[11px] text-stone-500">No paired devices found (or this device is not paired yet).</p>}
      {devices.map((d) => (
        <div key={d.session_id} className="flex items-center justify-between text-[11px] text-stone-300">
          <span>
            {d.label} <span className="text-stone-500">· {new Date(d.paired_at).toLocaleDateString()}</span>
            {d.revoked && <span className="text-rose-400"> · revoked</span>}
          </span>
          {!d.revoked && (
            <button
              type="button"
              className="flex items-center gap-1 text-rose-400 hover:text-rose-300"
              onClick={async () => {
                if (window.confirm(`Revoke "${d.label}"? It will stop syncing immediately.`)) {
                  await revokeDevice(d.session_id);
                  load();
                }
              }}
            >
              <Ban className="w-3 h-3" /> Revoke
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
