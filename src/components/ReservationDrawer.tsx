import React, { useState, useMemo } from 'react';
import { Room, BookingDetails } from '../types';
import { X, Users, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

interface ReservationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  initialBookingDetails?: BookingDetails;
}

export const ReservationDrawer: React.FC<ReservationDrawerProps> = ({
  isOpen,
  onClose,
  rooms,
  initialBookingDetails,
}) => {
  if (!isOpen) return null;

  // State
  const defaultCheckIn = initialBookingDetails?.checkIn || new Date().toISOString().split('T')[0];
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  
  // Default checkout 3 days later
  const nextDate = new Date(new Date(defaultCheckIn).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [checkOut, setCheckOut] = useState(initialBookingDetails?.checkOut || nextDate);
  const [guests, setGuests] = useState(initialBookingDetails?.guests || 2);

  // Selected room
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    initialBookingDetails?.selectedRoomId || rooms[0]?.id || ''
  );

  // Add-ons
  const [addOnChauffeur, setAddOnChauffeur] = useState(false);
  const [addOnDinner, setAddOnDinner] = useState(false);
  const [addOnSpa, setAddOnSpa] = useState(false);

  // Contact form
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
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
  const chauffeurFee = addOnChauffeur ? 180 : 0;
  const dinnerFee = addOnDinner ? 320 : 0;
  const spaFee = addOnSpa ? 140 : 0;
  const addOnsTotal = chauffeurFee + dinnerFee + spaFee;

  const taxesAndFees = Math.round((roomSubtotal + addOnsTotal) * 0.14);
  const grandTotal = roomSubtotal + addOnsTotal + taxesAndFees;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = `RJ-${Math.floor(100000 + Math.random() * 900000)}`;
    setReservationCode(code);
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0e1017] border-l border-white/10 h-full overflow-y-auto flex flex-col justify-between shadow-2xl p-6 sm:p-8">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full border border-gold-400/40 bg-gold-400/10 flex items-center justify-center text-gold-300 font-serif font-bold text-sm">
                RJ
              </div>
              <div>
                <h2 className="font-serif text-lg font-semibold text-white">Direct Reservation</h2>
                <p className="text-[10px] uppercase tracking-wider text-sand-400">Best Rate Guarantee • Direct Concierge Service</p>
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
            <div className="py-16 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="text-xs uppercase tracking-widest text-gold-400 font-semibold block mb-2">
                Reservation Confirmed
              </span>
              <h3 className="font-serif text-3xl text-white font-medium">We Await Your Arrival</h3>
              <p className="mt-3 text-xs sm:text-sm text-sand-300 max-w-md mx-auto leading-relaxed">
                Thank you, <strong className="text-white">{guestName || 'Guest'}</strong>. A formal confirmation itinerary and concierge questionnaire have been dispatched to <strong className="text-white">{guestEmail || 'your email'}</strong>.
              </p>

              {/* Confirmation Code Card */}
              <div className="my-8 p-6 rounded-2xl bg-zinc-900 border border-white/10 max-w-sm mx-auto text-center">
                <span className="text-[10px] uppercase tracking-widest text-sand-400 block mb-1">Confirmation Reference</span>
                <span className="font-mono text-2xl font-bold text-gold-300 tracking-wider">{reservationCode}</span>
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-sand-400">
                  {nights} Nights • {selectedRoom?.name}
                </div>
              </div>

              <button
                onClick={handleReset}
                className="px-8 py-3 rounded-full bg-gold-400 text-black text-xs font-semibold uppercase tracking-wider shadow-lg hover:bg-gold-300 transition-colors"
              >
                Return to Sanctuary
              </button>
            </div>
          ) : (
            /* Reservation Form */
            <form onSubmit={handleSubmit} className="py-6 space-y-6">
              {/* Date & Guest Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/10">
                  <label htmlFor="drawer-check-in" className="text-[10px] uppercase tracking-wider text-sand-400 font-medium block mb-1">
                    Check-In
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
                    Check-Out
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
                    <p className="text-[10px] text-sand-400">Adults and children</p>
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

              {/* Residence Selection */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-sand-400 font-semibold block mb-3">
                  Select Residence
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
                            <p className="text-[10px] text-sand-400">{room.view} • {room.sizeSqFt} sq ft</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-xs font-bold text-gold-300">
                            ${room.pricePerNight.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-sand-400 block">/ night</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bespoke Add-Ons */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-sand-400 font-semibold block mb-3">
                  Enhance Your Stay (Optional)
                </label>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5 cursor-pointer hover:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={addOnChauffeur}
                        onChange={(e) => setAddOnChauffeur(e.target.checked)}
                        className="rounded border-white/20 text-gold-400 focus:ring-0 bg-zinc-800"
                      />
                      <span className="text-xs text-sand-200">Private Airport Chauffeur Transfer (Roundtrip)</span>
                    </div>
                    <span className="font-mono text-xs text-gold-300">+$180</span>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5 cursor-pointer hover:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={addOnDinner}
                        onChange={(e) => setAddOnDinner(e.target.checked)}
                        className="rounded border-white/20 text-gold-400 focus:ring-0 bg-zinc-800"
                      />
                      <span className="text-xs text-sand-200">Aura 8-Course Tasting Menu for Two</span>
                    </div>
                    <span className="font-mono text-xs text-gold-300">+$320</span>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5 cursor-pointer hover:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={addOnSpa}
                        onChange={(e) => setAddOnSpa(e.target.checked)}
                        className="rounded border-white/20 text-gold-400 focus:ring-0 bg-zinc-800"
                      />
                      <span className="text-xs text-sand-200">Sōma Hydrothermal Spa Circuit Passes</span>
                    </div>
                    <span className="font-mono text-xs text-gold-300">+$140</span>
                  </label>
                </div>
              </div>

              {/* Guest Details */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <label className="text-[11px] uppercase tracking-wider text-sand-400 font-semibold block">
                  Lead Guest Details
                </label>
                <div>
                  <input
                    type="text"
                    placeholder="Full Legal Name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                    className="w-full bg-zinc-900 text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    required
                    className="w-full bg-zinc-900 text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Phone"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    required
                    className="w-full bg-zinc-900 text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400"
                  />
                </div>
                <div>
                  <textarea
                    rows={2}
                    placeholder="Special requests, dietary preferences, or arrival notes"
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className="w-full bg-zinc-900 text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400 resize-none"
                  />
                </div>
              </div>

              {/* Price Breakdown Calculation Card */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2 text-xs">
                <div className="flex justify-between text-sand-300">
                  <span>${selectedRoom?.pricePerNight.toLocaleString()} × {nights} {nights === 1 ? 'Night' : 'Nights'}</span>
                  <span className="font-mono">${roomSubtotal.toLocaleString()}</span>
                </div>

                {addOnsTotal > 0 && (
                  <div className="flex justify-between text-sand-300">
                    <span>Curated Add-ons</span>
                    <span className="font-mono">+${addOnsTotal.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-sand-400 text-[11px]">
                  <span>Local Occupancy Taxes & Eco-Resort Fee (14%)</span>
                  <span className="font-mono">${taxesAndFees.toLocaleString()}</span>
                </div>

                <div className="pt-2 border-t border-white/10 flex justify-between items-baseline text-sm font-semibold text-white">
                  <span>Estimated Total Stay</span>
                  <span className="font-mono text-xl text-gold-300 font-bold">${grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="w-full py-4 rounded-full bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-300 text-black font-semibold text-xs tracking-[0.2em] uppercase shadow-xl shadow-gold-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>Confirm Direct Reservation</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-sand-400/70 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
                <span>Zero cancellation fees up to 48 hours before check-in.</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
