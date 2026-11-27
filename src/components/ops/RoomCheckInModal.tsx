import React, { useMemo, useState } from 'react';
import { Clock, Moon, UserPlus, X } from 'lucide-react';
import { HotelRoomRecord } from '../../types';
import { RoomPaymentMode, RoomStayRecord, RoomStayType } from '../../types/roomStay';
import { addDaysToDateString, localDateString } from '../../utils/dates';
import { calculateStayNights } from '../../utils/roomBilling';

interface RoomCheckInModalProps {
  room: HotelRoomRecord;
  onClose: () => void;
  onConfirmCheckIn: (stay: Partial<RoomStayRecord>) => Promise<boolean>;
}

export const RoomCheckInModal: React.FC<RoomCheckInModalProps> = ({
  room,
  onClose,
  onConfirmCheckIn,
}) => {
  const [stayType, setStayType] = useState<RoomStayType>('nightly');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [numGuests, setNumGuests] = useState(1);
  const [idProofNote, setIdProofNote] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => localDateString());
  const [expectedCheckOutDate, setExpectedCheckOutDate] = useState(() => addDaysToDateString(localDateString(), 1));
  const [nightlyRate, setNightlyRate] = useState(Number(room.pricePerNight) || 1600);
  const [customStayPrice, setCustomStayPrice] = useState(Math.round((Number(room.pricePerNight) || 1600) * 0.5));
  const [advancePaid, setAdvancePaid] = useState('');
  const [advancePaymentMode, setAdvancePaymentMode] = useState<RoomPaymentMode>('Cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const estimatedNights = useMemo(
    () => (stayType === 'short_stay' ? 1 : calculateStayNights(checkInDate, expectedCheckOutDate)),
    [stayType, checkInDate, expectedCheckOutDate]
  );

  const estimatedTotal =
    stayType === 'short_stay' ? Number(customStayPrice) || 0 : estimatedNights * (Number(nightlyRate) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    setSubmitting(true);
    const ok = await onConfirmCheckIn({
      roomId: room.id,
      roomName: room.name,
      stayType,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      numGuests,
      idProofNote: idProofNote.trim(),
      checkInDate,
      expectedCheckOutDate: stayType === 'short_stay' ? checkInDate : expectedCheckOutDate,
      nightlyRate: Number(nightlyRate) || 0,
      nights: estimatedNights,
      customStayPrice: stayType === 'short_stay' ? Number(customStayPrice) || 0 : 0,
      advancePaid: Number(advancePaid) || 0,
      advancePaymentMode,
      notes: notes.trim(),
      createdBy: 'Manager',
    });
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-slate-100 text-xs"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Check In — {room.name}</span>
            </h3>
            <p className="text-[11px] text-slate-400 capitalize">
              {room.tier} • Default Tariff: ₹{room.pricePerNight}/night
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stay Type Toggle */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1.5">Stay Pricing Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStayType('nightly')}
              className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition ${
                stayType === 'nightly'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Nightly Stay</span>
            </button>
            <button
              type="button"
              onClick={() => setStayType('short_stay')}
              className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition ${
                stayType === 'short_stay'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Short Stay (2–3 hrs / Custom)</span>
            </button>
          </div>
        </div>

        {/* Guest Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Guest Full Name *</label>
            <input
              required
              autoFocus
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="e.g. Rajesh Sharma"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Phone Number (for WhatsApp Bill)</label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="10-digit mobile"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Number of Guests</label>
            <input
              type="number"
              min={1}
              max={10}
              value={numGuests}
              onChange={(e) => setNumGuests(Number(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">ID / KYC Reference Note</label>
            <input
              type="text"
              value={idProofNote}
              onChange={(e) => setIdProofNote(e.target.value)}
              placeholder="e.g. Aadhaar xxxx 4321"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Dates & Tariff */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Check-In Date</label>
            <input
              type="date"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
            />
          </div>
          {stayType === 'nightly' ? (
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Expected Check-Out</label>
              <input
                type="date"
                value={expectedCheckOutDate}
                onChange={(e) => setExpectedCheckOutDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sky-300 font-semibold mb-1">Custom Short-Stay Price (₹) *</label>
              <input
                required
                type="number"
                min={0}
                value={customStayPrice}
                onChange={(e) => setCustomStayPrice(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-sky-500/50 rounded-xl text-white font-mono font-bold"
              />
            </div>
          )}
        </div>

        {stayType === 'nightly' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Nightly Rate (₹) (Editable)</label>
              <input
                type="number"
                min={0}
                value={nightlyRate}
                onChange={(e) => setNightlyRate(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400">Estimated Stay ({estimatedNights}N)</span>
              <span className="text-sm font-bold text-amber-300 font-mono">
                ₹{estimatedTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}

        {/* Advance Paid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Advance Paid Now (₹)</label>
            <input
              type="number"
              min={0}
              value={advancePaid}
              onChange={(e) => setAdvancePaid(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Advance Mode</label>
            <select
              value={advancePaymentMode}
              onChange={(e) => setAdvancePaymentMode(e.target.value as RoomPaymentMode)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 2-3 hours day use / Extra pillow requested"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !guestName.trim()}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50"
          >
            {submitting ? 'Checking In...' : 'Confirm Check-In'}
          </button>
        </div>
      </form>
    </div>
  );
};
