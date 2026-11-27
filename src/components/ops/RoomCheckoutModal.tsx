import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Moon,
  Plus,
  Printer,
  Receipt,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import {
  RoomExtraCharge,
  RoomStayRecord,
  RoomStayType,
} from '../../types/roomStay';
import { localDateString } from '../../utils/dates';
import {
  calculateRoomStayTotals,
  calculateStayNights,
  combineAdvanceAndCheckoutPayment,
  generateRoomBillThermalHtml,
  generateRoomBillWhatsAppText,
} from '../../utils/roomBilling';
import { CheckoutStayPayload } from '../../utils/roomStayApi';
import { BluetoothPrinter } from '../../utils/thermalPrinter';
import { HOTEL_INFO } from '../../data/hotelData';

interface RoomCheckoutModalProps {
  stay: RoomStayRecord;
  mode: 'manage' | 'checkout';
  onClose: () => void;
  onSaveStay: (updated: RoomStayRecord) => Promise<boolean>;
  onCheckoutStay: (
    stay: RoomStayRecord,
    payload: CheckoutStayPayload
  ) => Promise<{ success: boolean; stay?: RoomStayRecord; billNumber?: number }>;
}

const EXTRA_PRESETS = [
  { label: 'Extra Bed / Mattress', amount: 300 },
  { label: 'Late Check-Out', amount: 400 },
  { label: 'Laundry Service', amount: 150 },
];

export const RoomCheckoutModal: React.FC<RoomCheckoutModalProps> = ({
  stay,
  mode,
  onClose,
  onSaveStay,
  onCheckoutStay,
}) => {
  const [activeMode, setActiveMode] = useState<'manage' | 'checkout'>(mode);
  const [stayType, setStayType] = useState<RoomStayType>(stay.stayType || 'nightly');
  const [checkOutDate, setCheckOutDate] = useState<string>(() => localDateString());
  const [nightlyRate, setNightlyRate] = useState<number>(stay.nightlyRate || 0);
  const [nights, setNights] = useState<number>(() =>
    stay.stayType === 'short_stay'
      ? 1
      : calculateStayNights(stay.checkInDate, localDateString())
  );
  const [customStayPrice, setCustomStayPrice] = useState<number>(
    stay.customStayPrice || Math.round((stay.nightlyRate || 0) * 0.5)
  );
  const [extraCharges, setExtraCharges] = useState<RoomExtraCharge[]>(stay.extraCharges || []);
  const [newExtraLabel, setNewExtraLabel] = useState('');
  const [newExtraAmount, setNewExtraAmount] = useState('');

  const [discount, setDiscount] = useState<number>(stay.discount || 0);
  const [applyGst, setApplyGst] = useState<boolean>((stay.gstPercent || 0) > 0);
  const [gstPercent, setGstPercent] = useState<number>(stay.gstPercent || 12);
  const [notes, setNotes] = useState<string>(stay.notes || '');

  const [checkoutMethod, setCheckoutMethod] = useState<'cash' | 'upi' | 'card' | 'split'>('cash');
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [settledResult, setSettledResult] = useState<{
    stay: RoomStayRecord;
    billNumber: number;
  } | null>(null);

  const totals = useMemo(
    () =>
      calculateRoomStayTotals({
        stayType,
        nightlyRate,
        nights,
        customStayPrice,
        extraCharges,
        discount,
        gstPercent: applyGst ? gstPercent : 0,
        advancePaid: stay.advancePaid || 0,
      }),
    [stayType, nightlyRate, nights, customStayPrice, extraCharges, discount, applyGst, gstPercent, stay.advancePaid]
  );

  const addExtra = (label: string, amount: number) => {
    if (!label.trim() || !(amount > 0)) return;
    setExtraCharges((prev) => [
      ...prev,
      { id: `EX-${Date.now()}-${Math.floor(Math.random() * 100)}`, label: label.trim(), amount },
    ]);
  };

  const handleSaveManage = async () => {
    setSubmitting(true);
    const ok = await onSaveStay({
      ...stay,
      stayType,
      nightlyRate,
      nights,
      customStayPrice,
      extraCharges,
      discount,
      gstPercent: applyGst ? gstPercent : 0,
      notes,
    });
    setSubmitting(false);
    if (ok) onClose();
  };

  const handleConfirmCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutMethod === 'split' && totals.balanceDue > 0) {
      const sum = (Number(splitCash) || 0) + (Number(splitUpi) || 0);
      if (Math.abs(sum - totals.balanceDue) > 1) {
        alert(`Split amounts (₹${sum}) must equal Balance Due (₹${totals.balanceDue}).`);
        return;
      }
    }

    const combined = combineAdvanceAndCheckoutPayment(
      stay.advancePaid || 0,
      stay.advancePaymentMode || 'Cash',
      totals.balanceDue,
      checkoutMethod,
      { cashAmount: Number(splitCash) || 0, upiAmount: Number(splitUpi) || 0 }
    );

    setSubmitting(true);
    const res = await onCheckoutStay(stay, {
      stayId: stay.id,
      stayType,
      nightlyRate,
      nights,
      customStayPrice,
      extraCharges,
      discount,
      gstPercent: applyGst ? gstPercent : 0,
      checkOutDate,
      paymentMethod: combined.paymentMethod,
      paymentDetails: combined.paymentDetails,
      settledBy: 'Manager',
      notes,
    });
    setSubmitting(false);

    if (res.success && res.stay) {
      setSettledResult({
        stay: res.stay,
        billNumber: res.billNumber || res.stay.billNumber || 0,
      });
    }
  };

  if (settledResult) {
    const handlePrint = async () => {
      const html = generateRoomBillThermalHtml(settledResult.stay, settledResult.billNumber, HOTEL_INFO.name);
      await BluetoothPrinter.printRawHtmlReceipt(html, `RoomBill_${settledResult.stay.roomId}`);
    };
    const handleWhatsApp = () => {
      const text = encodeURIComponent(
        generateRoomBillWhatsAppText(settledResult.stay, settledResult.billNumber, HOTEL_INFO.name)
      );
      const cleanPhone = (settledResult.stay.guestPhone || '').replace(/\D/g, '');
      const url = cleanPhone
        ? `https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}?text=${text}`
        : `https://wa.me/?text=${text}`;
      window.open(url, '_blank');
    };

    return (
      <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4 text-white">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Room Checked Out & Bill Settled!</h3>
            <p className="text-xs text-slate-400 mt-1">
              {settledResult.stay.roomName} • Bill #{settledResult.billNumber} • Recorded in Owner Insights (Rooms)
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-amber-300">
            Total Billed: ₹{settledResult.stay.totalAmount.toLocaleString('en-IN')}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print 58mm Bill
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-4 h-4" /> WhatsApp Bill
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
          >
            Done (Room Marked Dirty for Housekeeping)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleConfirmCheckout}
        className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-slate-100 text-xs"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              <span>{activeMode === 'checkout' ? 'Check Out & Bill' : 'Manage Stay'} — {stay.roomName}</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Guest: <strong className="text-white">{stay.guestName}</strong> • Check-In: {stay.checkInDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMode(activeMode === 'checkout' ? 'manage' : 'checkout')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 text-amber-300 font-semibold"
            >
              {activeMode === 'checkout' ? 'Edit Mode' : 'Go to Checkout'}
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stay Pricing Mode (Nightly vs Short Stay 2-3 hrs) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStayType('nightly')}
            className={`p-2 rounded-xl border font-bold flex items-center justify-center gap-1.5 ${
              stayType === 'nightly'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <Moon className="w-3.5 h-3.5" /> Nightly Tariff
          </button>
          <button
            type="button"
            onClick={() => setStayType('short_stay')}
            className={`p-2 rounded-xl border font-bold flex items-center justify-center gap-1.5 ${
              stayType === 'short_stay'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Short Stay (2–3 hrs / Custom)
          </button>
        </div>

        {stayType === 'nightly' ? (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-400 mb-1">Check-Out Date</label>
              <input
                type="date"
                value={checkOutDate}
                onChange={(e) => {
                  setCheckOutDate(e.target.value);
                  setNights(calculateStayNights(stay.checkInDate, e.target.value));
                }}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Nights (Editable)</label>
              <input
                type="number"
                min={1}
                value={nights}
                onChange={(e) => setNights(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Rate / Night (₹)</label>
              <input
                type="number"
                min={0}
                value={nightlyRate}
                onChange={(e) => setNightlyRate(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 mb-1">Check-Out Date</label>
              <input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-sky-300 font-semibold mb-1">Custom Short-Stay Price (₹)</label>
              <input
                type="number"
                min={0}
                value={customStayPrice}
                onChange={(e) => setCustomStayPrice(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-2 bg-slate-950 border border-sky-500/50 rounded-xl text-white font-mono font-bold"
              />
            </div>
          </div>
        )}

        {/* Extra Room Charges */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">Extra Room Charges (Bed, Laundry, etc.)</span>
            <div className="flex gap-1 flex-wrap">
              {EXTRA_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => addExtra(p.label, p.amount)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-300"
                >
                  + {p.label} (₹{p.amount})
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newExtraLabel}
              onChange={(e) => setNewExtraLabel(e.target.value)}
              placeholder="Custom charge label"
              className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
            />
            <input
              type="number"
              min={1}
              value={newExtraAmount}
              onChange={(e) => setNewExtraAmount(e.target.value)}
              placeholder="₹"
              className="w-24 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
            />
            <button
              type="button"
              onClick={() => {
                addExtra(newExtraLabel, Number(newExtraAmount) || 0);
                setNewExtraLabel('');
                setNewExtraAmount('');
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {extraCharges.length > 0 && (
            <div className="space-y-1 pt-1">
              {extraCharges.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-lg">
                  <span>{ex.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-300">₹{ex.amount}</span>
                    <button
                      type="button"
                      onClick={() => setExtraCharges((prev) => prev.filter((i) => i.id !== ex.id))}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discount & Optional GST (Default OFF) */}
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-slate-400 mb-1">Discount (₹)</label>
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
            />
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={applyGst}
                onChange={(e) => setApplyGst(e.target.checked)}
                className="accent-amber-500"
              />
              <span>Add GST (Optional)</span>
            </label>
            {applyGst && (
              <select
                value={gstPercent}
                onChange={(e) => setGstPercent(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
              >
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
              </select>
            )}
          </div>
        </div>

        {/* Bill Summary */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>Room Charge</span>
            <span className="font-mono text-white">₹{totals.roomCharge.toLocaleString('en-IN')}</span>
          </div>
          {totals.extrasTotal > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Extra Charges</span>
              <span className="font-mono text-white">+₹{totals.extrasTotal.toLocaleString('en-IN')}</span>
            </div>
          )}
          {totals.discount > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Discount</span>
              <span className="font-mono">-₹{totals.discount.toLocaleString('en-IN')}</span>
            </div>
          )}
          {totals.taxAmount > 0 && (
            <div className="flex justify-between text-amber-300">
              <span>GST ({totals.gstPercent}%)</span>
              <span className="font-mono">+₹{totals.taxAmount.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm pt-1.5 border-t border-slate-800">
            <span>Total Room Bill</span>
            <span className="font-mono text-amber-300">₹{totals.totalAmount.toLocaleString('en-IN')}</span>
          </div>
          {totals.advancePaid > 0 && (
            <>
              <div className="flex justify-between text-slate-400">
                <span>Advance Paid ({stay.advancePaymentMode})</span>
                <span className="font-mono">-₹{totals.advancePaid.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-base text-emerald-400">
                <span>Balance Due Now</span>
                <span className="font-mono">₹{totals.balanceDue.toLocaleString('en-IN')}</span>
              </div>
            </>
          )}
        </div>

        {activeMode === 'checkout' && totals.balanceDue > 0 && (
          <div className="space-y-2">
            <label className="block text-slate-400 font-semibold">Balance Payment Mode</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['cash', 'upi', 'card', 'split'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCheckoutMethod(m)}
                  className={`py-2 rounded-xl font-bold uppercase border ${
                    checkoutMethod === m
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {checkoutMethod === 'split' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  placeholder="Cash ₹"
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
                <input
                  type="number"
                  min={0}
                  value={splitUpi}
                  onChange={(e) => setSplitUpi(e.target.value)}
                  placeholder="UPI ₹"
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-slate-400 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional stay/bill notes"
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
            type="button"
            disabled={submitting}
            onClick={handleSaveManage}
            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold"
          >
            Save Stay Updates
          </button>
          {activeMode === 'checkout' && (
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {submitting ? 'Settling...' : `Check Out & Settle ₹${totals.totalAmount.toLocaleString('en-IN')}`}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
