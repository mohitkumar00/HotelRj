import React, { useState } from 'react';
import { Calendar, Users, Search, ChevronDown } from 'lucide-react';
import { RoomTier } from '../types';

interface BookingBarProps {
  onSearch: (details: { checkIn: string; checkOut: string; guests: number; tier: RoomTier | 'all' }) => void;
}

export const BookingBar: React.FC<BookingBarProps> = ({ onSearch }) => {
  const today = new Date();
  const defaultCheckIn = new Date(today.setDate(today.getDate() + 1)).toISOString().split('T')[0];
  const defaultCheckOut = new Date(today.setDate(today.getDate() + 2)).toISOString().split('T')[0];

  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [guests, setGuests] = useState(2);
  const [tier, setTier] = useState<RoomTier | 'all'>('all');
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ checkIn, checkOut, guests, tier });
  };

  return (
    <div className="relative -mt-10 z-30 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="glass-panel rounded-2xl md:rounded-full p-3 sm:p-4 shadow-2xl border border-white/15 bg-[#0e1017]/95">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-2 items-center">
          {/* Check In */}
          <div className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl md:rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
            <Calendar className="w-4 h-4 text-gold-400 shrink-0" />
            <div className="flex flex-col text-left w-full">
              <label htmlFor="check-in-date" className="text-[10px] uppercase tracking-wider text-sand-400 font-medium">Check-In</label>
              <input
                id="check-in-date"
                type="date"
                value={checkIn}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setCheckIn(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-medium text-white focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Check Out */}
          <div className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl md:rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
            <Calendar className="w-4 h-4 text-gold-400 shrink-0" />
            <div className="flex flex-col text-left w-full">
              <label htmlFor="check-out-date" className="text-[10px] uppercase tracking-wider text-sand-400 font-medium">Check-Out</label>
              <input
                id="check-out-date"
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-medium text-white focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Guests & Room Class */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setGuestDropdownOpen(!guestDropdownOpen)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl md:rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 text-left"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-gold-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-sand-400 font-medium">Guests & Room Option</span>
                  <span className="text-xs sm:text-sm font-medium text-white">
                    {guests} {guests === 1 ? 'Guest' : 'Guests'} • {tier === 'all' ? 'All Options' : tier === 'deluxe' ? 'King Bed (₹1600)' : 'Family Suite (₹3000)'}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-sand-400" />
            </button>

            {/* Dropdown for guests and tier */}
            {guestDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 p-4 glass-dropdown rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-medium text-white">Number of Guests</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGuests(Math.max(1, guests - 1))}
                      className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="font-mono text-sm font-bold text-gold-400 w-5 text-center">{guests}</span>
                    <button
                      type="button"
                      onClick={() => setGuests(Math.min(6, guests + 1))}
                      className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="pt-3">
                  <label htmlFor="preferred-room-tier" className="text-[11px] uppercase tracking-wider text-sand-400 font-medium block mb-2">
                    Room Option
                  </label>
                  <select
                    id="preferred-room-tier"
                    value={tier}
                    onChange={(e) => setTier(e.target.value as any)}
                    className="w-full bg-[#181a22] text-xs text-white p-2.5 rounded-lg border border-white/10 focus:outline-none focus:border-gold-400"
                  >
                    <option value="all">Both Room Options</option>
                    <option value="deluxe">Deluxe King Room (1 King Bed • 2 Guests • ₹1,600 + GST)</option>
                    <option value="family">Executive Family Suite (2 Beds • 4 Guests • ₹3,000 + GST)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setGuestDropdownOpen(false)}
                  className="mt-3 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold uppercase tracking-wider text-sand-200"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* Submit Search Button */}
          <div className="md:px-2">
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl md:rounded-full bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-black font-semibold text-xs tracking-[0.18em] uppercase flex items-center justify-center gap-2 shadow-lg shadow-gold-500/25 active:scale-95 transition-all duration-200"
            >
              <Search className="w-4 h-4" />
              <span>Check Tariff</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
