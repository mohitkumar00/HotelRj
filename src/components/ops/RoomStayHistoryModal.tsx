import React, { useMemo, useState } from 'react';
import { History, Printer, Share2, X } from 'lucide-react';
import { RoomStayRecord } from '../../types/roomStay';
import {
  generateRoomBillThermalHtml,
  generateRoomBillWhatsAppText,
} from '../../utils/roomBilling';
import { BluetoothPrinter } from '../../utils/thermalPrinter';
import { HOTEL_INFO } from '../../data/hotelData';

interface RoomStayHistoryModalProps {
  stays: RoomStayRecord[];
  onClose: () => void;
}

export const RoomStayHistoryModal: React.FC<RoomStayHistoryModalProps> = ({
  stays,
  onClose,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'checked_out'>('all');

  const filtered = useMemo(() => {
    return stays.filter((s) => (filter === 'all' ? true : s.status === filter));
  }, [stays, filter]);

  const totalEarned = useMemo(
    () =>
      stays
        .filter((s) => s.status === 'checked_out')
        .reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0),
    [stays]
  );

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <span>Room Guest Stay Register & Bills</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Total Checked-Out Room Revenue: <strong className="text-emerald-400">₹{totalEarned.toLocaleString('en-IN')}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-slate-800 flex gap-2 text-xs bg-slate-900/60">
          {(['all', 'active', 'checked_out'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-bold capitalize ${
                filter === f ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {f === 'checked_out' ? 'Checked Out' : f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-xs">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              No room stays recorded yet. Use <strong>Check In Guest</strong> on any vacant room.
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white">{s.guestName}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold">
                      {s.roomName || s.roomId}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        s.stayType === 'short_stay'
                          ? 'bg-sky-500/15 text-sky-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {s.stayType === 'short_stay' ? 'Short Stay' : `${s.nights}N`}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        s.status === 'checked_out'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : s.status === 'active'
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    In: {s.checkInDate}
                    {s.checkOutDate ? ` → Out: ${s.checkOutDate}` : ''}
                    {s.billNumber ? ` • Bill #${s.billNumber}` : ''}
                    {s.paymentMethod ? ` • ${s.paymentMethod.toUpperCase()}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-emerald-400 mr-1">
                    ₹{s.totalAmount.toLocaleString('en-IN')}
                  </span>
                  {s.status === 'checked_out' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          BluetoothPrinter.printRawHtmlReceipt(
                            generateRoomBillThermalHtml(s, s.billNumber || s.id, HOTEL_INFO.name),
                            `RoomBill_${s.roomId}`
                          )
                        }
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                        title="Reprint 58mm Bill"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const text = encodeURIComponent(
                            generateRoomBillWhatsAppText(s, s.billNumber || s.id, HOTEL_INFO.name)
                          );
                          const cleanPhone = (s.guestPhone || '').replace(/\D/g, '');
                          const url = cleanPhone
                            ? `https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}?text=${text}`
                            : `https://wa.me/?text=${text}`;
                          window.open(url, '_blank');
                        }}
                        className="p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400"
                        title="Share Bill on WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
