import { localDateString, addDaysToDateString } from '../utils/dates';
import React, { useState, useMemo } from 'react';
import { Room, BookingDetails } from '../types';
import { X, Users, ShieldCheck, CheckCircle2, ArrowRight, Phone, MessageSquare, Mail, AlertCircle } from 'lucide-react';
import { HOTEL_INFO } from '../data/hotelData';

interface ReservationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  initialBookingDetails?: BookingDetails;
}

/** Mounts the drawer only while open so its hooks never run conditionally (state resets on close, as before). */
export const ReservationDrawer: React.FC<ReservationDrawerProps> = (props) =>
  props.isOpen ? <ReservationDrawerContent {...props} /> : null;

const ReservationDrawerContent: React.FC<ReservationDrawerProps> = ({
  onClose,
  rooms,
  initialBookingDetails,
}) => {

  const defaultCheckIn = initialBookingDetails?.checkIn || localDateString();
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  
  const nextDate = addDaysToDateString(defaultCheckIn, 1);
  const [checkOut, setCheckOut] = useState(initialBookingDetails?.checkOut || nextDate);
  const [guests, setGuests] = useState(initialBookingDetails?.guests || 2);

  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    initialBookingDetails?.selectedRoomId || rooms[0]?.id || ''
  );

  // Add-ons
  const [addOnTransfer, setAddOnTransfer] = useState(false);
  const [addOnDinnerThali, setAddOnDinnerThali] = useState(false);
  const [addOnExtraBed, setAddOnExtraBed] = useState(false);

  // Contact form
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [emailDelivered, setEmailDelivered] = useState<boolean | null>(null);
  const [reservationCode, setReservationCode] = useState('');

  // Calculations
  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) || rooms[0],
    [rooms, selectedRoomId]
  );

  const nights = useMemo(() => {
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return isNaN(diff) || diff < 1 ? 1 : diff;
  }, [checkIn, checkOut]);

  const roomSubtotal = selectedRoom ? selectedRoom.pricePerNight * nights : 0;
  const transferFee = addOnTransfer ? 350 : 0;
  const dinnerFee = addOnDinnerThali ? 450 : 0;
  const extraBedFee = addOnExtraBed ? 300 : 0;
  const addOnsTotal = transferFee + dinnerFee + extraBedFee;

  const taxesAndFees = Math.round((roomSubtotal + addOnsTotal) * 0.12);
  const grandTotal = roomSubtotal + addOnsTotal + taxesAndFees;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const code = `RJ-${Math.floor(100000 + Math.random() * 900000)}`;
    setReservationCode(code);

    let sentOk = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Max 5s timeout, never hang

    try {
      const web3Key =
        (HOTEL_INFO as Record<string, unknown>).web3formsAccessKey ||
        (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WEB3FORMS_ACCESS_KEY;

      if (web3Key && typeof web3Key === 'string' && web3Key.trim()) {
        // Send via Web3Forms using FormData (Official recommended format, zero CORS/redirect issues)
        const formData = new FormData();
        formData.append('access_key', web3Key.trim());
        formData.append('subject', `🏨 New Booking Request: ${guestName} - ${selectedRoom?.name || 'Room'} (Ref: ${code})`);
        formData.append('from_name', 'Hotel RJ Web Reservation');
        formData.append('Booking Reference', code);
        formData.append('Guest Name', guestName);
        formData.append('Guest Phone / Mobile', guestPhone);
        formData.append('Guest Email', guestEmail || 'Not provided');
        formData.append('Selected Room', selectedRoom?.name || 'Room');
        formData.append('Room Rate (Per Night)', `₹${selectedRoom?.pricePerNight.toLocaleString()}`);
        formData.append('Check-In Date', checkIn);
        formData.append('Check-Out Date', checkOut);
        formData.append('Total Nights', `${nights} ${nights === 1 ? 'Night' : 'Nights'}`);
        formData.append('Number of Guests', String(guests));
        formData.append('Add-on Station Transfer', addOnTransfer ? 'Yes (₹350)' : 'No');
        formData.append('Add-on Dinner Thali', addOnDinnerThali ? 'Yes (₹450)' : 'No');
        formData.append('Add-on Extra Bed', addOnExtraBed ? 'Yes (₹300)' : 'No');
        formData.append('Estimated Total Tariff', `₹${grandTotal.toLocaleString()}`);
        formData.append('Special Requests', specialRequests.trim() || 'None');
        formData.append('Submission Timestamp', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        const data = await response.json();
        sentOk = response.ok && data.success === true;
      } else {
        // Attempt FormSubmit with 5s timeout & detection
        const response = await fetch('https://formsubmit.co/ajax/hotelrj.info@gmail.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            _subject: `🏨 New Booking Request: ${guestName} - ${selectedRoom?.name || 'Room'} (Ref: ${code})`,
            _template: 'table',
            _captcha: 'false',
            'Booking Reference': code,
            'Guest Name': guestName,
            'Guest Phone / Mobile': guestPhone,
            'Guest Email': guestEmail || 'Not provided',
            'Selected Room': selectedRoom?.name,
            'Room Rate (Per Night)': `₹${selectedRoom?.pricePerNight.toLocaleString()}`,
            'Check-In Date': checkIn,
            'Check-Out Date': checkOut,
            'Total Nights': `${nights} ${nights === 1 ? 'Night' : 'Nights'}`,
            'Number of Guests': guests,
            'Add-on Station Transfer': addOnTransfer ? 'Yes (₹350)' : 'No',
            'Add-on Dinner Thali': addOnDinnerThali ? 'Yes (₹450)' : 'No',
            'Add-on Extra Bed': addOnExtraBed ? 'Yes (₹300)' : 'No',
            'Estimated Total Tariff': `₹${grandTotal.toLocaleString()}`,
            'Special Requests': specialRequests.trim() || 'None',
            'Submission Timestamp': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          }),
          signal: controller.signal,
        });

        sentOk = response.ok;
      }
    } catch (err) {
      console.warn('Booking dispatch notification warning (handled gracefully):', err);
      sentOk = false;
    } finally {
      clearTimeout(timeoutId);
      setEmailDelivered(sentOk);
      setIsSubmitted(true);
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setEmailDelivered(null);
    onClose();
  };

  const bookingSummaryText = `*Hotel RJ Booking Request*
Ref: ${reservationCode}
Guest: ${guestName}
Phone: ${guestPhone}
Email: ${guestEmail || 'N/A'}
Room: ${selectedRoom?.name || 'Room'}
Check-In: ${checkIn}
Check-Out: ${checkOut} (${nights} ${nights === 1 ? 'Night' : 'Nights'})
Guests: ${guests}
Estimated Total: ₹${grandTotal.toLocaleString()}
Special Requests: ${specialRequests.trim() || 'None'}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0e1017] border-l border-white/10 h-full overflow-y-auto flex flex-col justify-between shadow-2xl p-6 sm:p-8">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img
                src="./icons/hotel-rj-emblem.png"
                alt="Hotel RJ Emblem"
                className="w-10 h-10 object-contain"
              />
              <div>
                <h2 className="font-serif text-lg font-semibold text-white">Direct Room Reservation</h2>
                <p className="text-[10px] uppercase tracking-wider text-sand-400">Best Rate Guarantee • Instant Confirmation</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-sand-300 hover:text-white transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isSubmitted ? (
            /* Success / Confirmation State */
            <div className="py-8 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="text-xs uppercase tracking-widest text-gold-400 font-semibold block mb-1">
                Booking Request Generated
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl text-white font-medium">
                We Look Forward to Welcoming You
              </h3>

              {emailDelivered ? (
                <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 max-w-md mx-auto">
                  ✓ An automated reservation notification has been dispatched to Hotel RJ front desk at <strong className="text-white">hotelrj.info@gmail.com</strong>.
                </div>
              ) : (
                <div className="mt-3 p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-200/90 max-w-md mx-auto text-left flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-300">Instant Front Desk Dispatch</p>
                    <p className="text-[11px] text-amber-200/80 leading-relaxed mt-0.5">
                      Your booking reference is generated. Tap <strong>WhatsApp</strong> or <strong>Email</strong> below to send this directly to the reception team for instant confirmation.
                    </p>
                  </div>
                </div>
              )}

              {/* Confirmation Code Card */}
              <div className="my-5 p-5 rounded-2xl bg-zinc-900 border border-white/10 max-w-sm mx-auto text-center">
                <span className="text-[10px] uppercase tracking-widest text-sand-400 block mb-1">Booking Reference</span>
                <span className="font-mono text-2xl font-bold text-gold-300 tracking-wider">{reservationCode}</span>
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-sand-300 space-y-1">
                  <p><strong className="text-white">{guestName}</strong> • {guestPhone}</p>
                  <p>{nights} Night(s) • {selectedRoom?.name}</p>
                  <p className="font-semibold text-gold-400">Estimated Total: ₹{grandTotal.toLocaleString()}</p>
                </div>
              </div>

              {/* Direct Call / WhatsApp / Email Actions */}
              <div className="space-y-2.5 max-w-sm mx-auto mb-6">
                <a
                  href={`https://wa.me/917004865824?text=${encodeURIComponent(bookingSummaryText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Send Booking on WhatsApp (Instant)</span>
                </a>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`mailto:hotelrj.info@gmail.com?subject=${encodeURIComponent(
                      `Hotel RJ Booking Ref ${reservationCode} - ${guestName}`
                    )}&body=${encodeURIComponent(
                      `Hello Hotel RJ Front Desk,\n\nI would like to confirm my room booking:\n\n• Reference: ${reservationCode}\n• Guest Name: ${guestName}\n• Phone: ${guestPhone}\n• Email: ${guestEmail || 'N/A'}\n• Room: ${selectedRoom?.name}\n• Check-In: ${checkIn}\n• Check-Out: ${checkOut} (${nights} nights)\n• Estimated Total: ₹${grandTotal.toLocaleString()}\n• Special Requests: ${specialRequests.trim() || 'None'}\n\nPlease confirm room availability.\nThank you!`
                    )}`}
                    className="py-2.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Mail className="w-4 h-4 text-blue-300" />
                    <span>Send via Email</span>
                  </a>

                  <a
                    href={`tel:${HOTEL_INFO.phone}`}
                    className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Phone className="w-4 h-4 text-gold-400" />
                    <span>Call Reception</span>
                  </a>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="px-8 py-2.5 rounded-full bg-gold-400 text-black text-xs font-semibold uppercase tracking-wider shadow-lg hover:bg-gold-300 transition-colors"
              >
                Close & Return
              </button>
            </div>
          ) : (
            /* Reservation Form */
            <form onSubmit={handleSubmit} className="py-6 space-y-6">
              {/* Date Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/10">
                  <label htmlFor="drawer-check-in" className="text-[10px] uppercase tracking-wider text-sand-400 font-medium block mb-1">
                    Check-In Date
                  </label>
                  <input
                    id="drawer-check-in"
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full bg-transparent text-xs sm:text-sm font-medium text-white focus:outline-none [color-scheme:dark]"
                    required
                  />
                </div>

                <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/10">
                  <label htmlFor="drawer-check-out" className="text-[10px] uppercase tracking-wider text-sand-400 font-medium block mb-1">
                    Check-Out Date
                  </label>
                  <input
                    id="drawer-check-out"
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full bg-transparent text-xs sm:text-sm font-medium text-white focus:outline-none [color-scheme:dark]"
                    required
                  />
                </div>
              </div>

              {/* Guest count */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/80 border border-white/10">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-gold-400" />
                  <div>
                    <p className="text-xs font-medium text-white">Number of Guests</p>
                    <p className="text-[10px] text-sand-400">Adults & Children</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGuests(Math.max(1, guests - 1))}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs"
                  >
                    -
                  </button>
                  <span className="font-mono text-sm font-bold text-white w-6 text-center">{guests}</span>
                  <button
                    type="button"
                    onClick={() => setGuests(Math.min(6, guests + 1))}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Room Selection */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-sand-400 font-semibold block mb-3">
                  Select Room Type
                </label>
                <div className="space-y-2.5">
                  {rooms.map((room) => {
                    const isSelected = selectedRoomId === room.id;
                    return (
                      <div
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-zinc-800/90 border-gold-400/80 shadow-md ring-1 ring-gold-400/30'
                            : 'bg-zinc-900/50 border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={room.heroImage}
                            alt={room.name}
                            className="w-12 h-12 rounded-xl object-cover shrink-0"
                          />
                          <div>
                            <p className="text-xs font-semibold text-white">{room.name}</p>
                            <p className="text-[10px] text-sand-400">{room.bedType} • {room.sizeSqFt} sq ft</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-xs font-bold text-gold-300">
                            ₹{room.pricePerNight.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-sand-400 block">/ night</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Helpful Add-Ons */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-sand-400 font-semibold block mb-3">
                  Additional Services (Optional)
                </label>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5 cursor-pointer hover:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={addOnTransfer}
                        onChange={(e) => setAddOnTransfer(e.target.checked)}
                        className="rounded border-white/20 text-gold-400 focus:ring-0 bg-zinc-800"
                      />
                      <span className="text-xs text-sand-200">Suriya Station / GT Road Pickup Assistance</span>
                    </div>
                    <span className="font-mono text-xs text-gold-300">+₹350</span>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5 cursor-pointer hover:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={addOnDinnerThali}
                        onChange={(e) => setAddOnDinnerThali(e.target.checked)}
                        className="rounded border-white/20 text-gold-400 focus:ring-0 bg-zinc-800"
                      />
                      <span className="text-xs text-sand-200">Special Multi-Cuisine Family Dinner Thali</span>
                    </div>
                    <span className="font-mono text-xs text-gold-300">+₹450</span>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5 cursor-pointer hover:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={addOnExtraBed}
                        onChange={(e) => setAddOnExtraBed(e.target.checked)}
                        className="rounded border-white/20 text-gold-400 focus:ring-0 bg-zinc-800"
                      />
                      <span className="text-xs text-sand-200">Extra Mattress / Bedding Set</span>
                    </div>
                    <span className="font-mono text-xs text-gold-300">+₹300</span>
                  </label>
                </div>
              </div>

              {/* Guest Details */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <label className="text-[11px] uppercase tracking-wider text-sand-400 font-semibold block">
                  Guest Contact Details
                </label>
                <div>
                  <input
                    type="text"
                    placeholder="Guest Full Name *"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                    className="w-full bg-zinc-900 text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="tel"
                    placeholder="Mobile Number (e.g. 7004865824) *"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    required
                    className="w-full bg-zinc-900 text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400"
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="w-full bg-zinc-900 text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400"
                  />
                </div>
                <div>
                  <textarea
                    rows={2}
                    placeholder="Special requests, arrival time, or dietary preferences"
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className="w-full bg-zinc-900 text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400 resize-none"
                  />
                </div>
              </div>

              {/* Price Breakdown Calculation Card */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2 text-xs">
                <div className="flex justify-between text-sand-300">
                  <span>₹{selectedRoom?.pricePerNight.toLocaleString()} × {nights} {nights === 1 ? 'Night' : 'Nights'}</span>
                  <span className="font-mono">₹{roomSubtotal.toLocaleString()}</span>
                </div>

                {addOnsTotal > 0 && (
                  <div className="flex justify-between text-sand-300">
                    <span>Selected Add-ons</span>
                    <span className="font-mono">+₹{addOnsTotal.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-sand-400 text-[11px]">
                  <span>GST & Service Charges (12%)</span>
                  <span className="font-mono">₹{taxesAndFees.toLocaleString()}</span>
                </div>

                <div className="pt-2 border-t border-white/10 flex justify-between items-baseline text-sm font-semibold text-white">
                  <span>Estimated Total Tariff</span>
                  <span className="font-mono text-xl text-gold-300 font-bold">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-full bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-300 disabled:opacity-75 text-black font-semibold text-xs tracking-[0.2em] uppercase shadow-xl shadow-gold-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Sending Request to Hotel RJ...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Room Reservation</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-sand-400/80 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
                <span>Pay at Hotel Available • Free cancellation up to 24 hrs prior</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
