import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  MapPin,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Trash2,
  Edit2,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Search,
} from 'lucide-react';
import {
  BanquetBooking,
  BanquetVenue,
  BanquetSlot,
  BANQUET_VENUES,
  BANQUET_SLOTS,
  BANQUET_EVENT_TYPES,
  checkBanquetBookingConflict,
  generateBanquetWhatsAppMessage,
} from '../types/banquet';
import {
  fetchBanquetBookings,
  saveBanquetBooking,
  deleteBanquetBooking,
} from '../utils/banquetApi';

interface BanquetCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName?: string;
}

export const BanquetCalendarModal: React.FC<BanquetCalendarModalProps> = ({
  isOpen,
  onClose,
  serverName = 'Manager',
}) => {
  const [bookings, setBookings] = useState<BanquetBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'add'>('calendar');

  // Month navigation (Defaults to current month)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());

  // Selected date for day view
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Venue filter
  const [venueFilter, setVenueFilter] = useState<'all' | BanquetVenue>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State for Add / Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formVenue, setFormVenue] = useState<BanquetVenue>('Banquet Hall 1 (AC)');
  const [formSlot, setFormSlot] = useState<BanquetSlot>('dinner');
  const [formCustomStart, setFormCustomStart] = useState<string>('11:00');
  const [formCustomEnd, setFormCustomEnd] = useState<string>('16:00');
  const [formEventType, setFormEventType] = useState<string>('Birthday Party');
  const [formGuests, setFormGuests] = useState<number>(60);
  const [formCustomerName, setFormCustomerName] = useState<string>('');
  const [formCustomerPhone, setFormCustomerPhone] = useState<string>('');
  const [formTotalAmount, setFormTotalAmount] = useState<string>('30000');
  const [formAdvancePaid, setFormAdvancePaid] = useState<string>('10000');
  const [formPaymentMode, setFormPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer'>('UPI');
  const [formSpecialNotes, setFormSpecialNotes] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'confirmed' | 'tentative'>('confirmed');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Load Bookings
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchBanquetBookings();
      setBookings(data);
    } catch (e) {
      console.warn('Failed to load banquet bookings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Calendar calculations
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  const monthName = currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // First day of month and total days
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Prev / Next month handlers
  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };
  const handleTodayJump = () => {
    const now = new Date();
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateStr(now.toISOString().split('T')[0]);
  };

  // Open Add modal with selected date
  const handleOpenAddForDate = (dateStr: string) => {
    setEditingId(null);
    setFormDate(dateStr);
    setFormVenue('Banquet Hall 1 (AC)');
    setFormSlot('dinner');
    setFormCustomStart('11:00');
    setFormCustomEnd('16:00');
    setFormEventType('Birthday Party');
    setFormGuests(60);
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormTotalAmount('30000');
    setFormAdvancePaid('10000');
    setFormPaymentMode('UPI');
    setFormSpecialNotes('');
    setFormStatus('confirmed');
    setSaveSuccessMsg(null);
    setViewMode('add');
  };

  // Open Edit
  const handleOpenEdit = (booking: BanquetBooking) => {
    setEditingId(booking.id);
    setFormDate(booking.eventDate);
    setFormVenue(booking.venue);
    setFormSlot(booking.slot);
    setFormCustomStart(booking.customStartTime || '11:00');
    setFormCustomEnd(booking.customEndTime || '16:00');
    setFormEventType(booking.eventType);
    setFormGuests(booking.noOfGuests);
    setFormCustomerName(booking.customerName);
    setFormCustomerPhone(booking.customerPhone);
    setFormTotalAmount(String(booking.totalAmount));
    setFormAdvancePaid(String(booking.advancePaid));
    setFormPaymentMode(booking.advancePaymentMode);
    setFormSpecialNotes(booking.specialNotes || '');
    setFormStatus(booking.status === 'tentative' ? 'tentative' : 'confirmed');
    setSaveSuccessMsg(null);
    setViewMode('add');
  };

  // Conflict Check in Real-Time
  const conflictResult = useMemo(() => {
    return checkBanquetBookingConflict(
      {
        eventDate: formDate,
        venue: formVenue,
        slot: formSlot,
        customStartTime: formCustomStart,
        customEndTime: formCustomEnd,
      },
      bookings,
      editingId || undefined
    );
  }, [formDate, formVenue, formSlot, formCustomStart, formCustomEnd, bookings, editingId]);

  // Auto calculate balance due
  const formTotalNum = Math.max(0, parseFloat(formTotalAmount) || 0);
  const formAdvanceNum = Math.max(0, parseFloat(formAdvancePaid) || 0);
  const formBalanceDue = Math.max(0, formTotalNum - formAdvanceNum);

  // Save Booking Handler
  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      alert('Please enter customer name');
      return;
    }
    if (conflictResult.hasConflict) {
      alert(`Cannot save: ${conflictResult.reason}`);
      return;
    }

    const newBooking: BanquetBooking = {
      id: editingId || `bnq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      eventDate: formDate,
      venue: formVenue,
      slot: formSlot,
      customStartTime: formSlot === 'custom' ? formCustomStart : undefined,
      customEndTime: formSlot === 'custom' ? formCustomEnd : undefined,
      eventType: formEventType,
      noOfGuests: formGuests,
      customerName: formCustomerName.trim(),
      customerPhone: formCustomerPhone.trim(),
      totalAmount: formTotalNum,
      advancePaid: formAdvanceNum,
      balanceDue: formBalanceDue,
      advancePaymentMode: formPaymentMode,
      specialNotes: formSpecialNotes.trim(),
      status: formStatus,
      createdBy: serverName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setLoading(true);
    await saveBanquetBooking(newBooking);
    await loadData();
    setLoading(false);
    setSaveSuccessMsg('Booking confirmed and saved successfully!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setViewMode('calendar');
      setSelectedDateStr(formDate);
    }, 1200);
  };

  // Delete Booking Handler
  const handleDeleteBooking = async (id: string, customer: string) => {
    if (!window.confirm(`Are you sure you want to cancel and delete the booking for "${customer}"?`)) {
      return;
    }
    setLoading(true);
    await deleteBanquetBooking(id);
    await loadData();
    setLoading(false);
  };

  // Filtered Bookings for the current month / venue
  const monthBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (venueFilter !== 'all' && b.venue !== venueFilter && b.venue !== 'Combined / Full Property') {
        return false;
      }
      return true;
    });
  }, [bookings, venueFilter]);

  // Bookings map by date string "YYYY-MM-DD"
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BanquetBooking[]>();
    monthBookings.forEach((b) => {
      if (b.status === 'cancelled') return;
      const list = map.get(b.eventDate) || [];
      list.push(b);
      map.set(b.eventDate, list);
    });
    return map;
  }, [monthBookings]);

  // Selected date bookings
  const selectedDateBookings = useMemo(() => {
    return bookingsByDate.get(selectedDateStr) || [];
  }, [bookingsByDate, selectedDateStr]);

  // Upcoming chronological list
  const upcomingBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        if (b.status === 'cancelled') return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            b.customerName.toLowerCase().includes(q) ||
            b.customerPhone.includes(q) ||
            b.eventType.toLowerCase().includes(q) ||
            b.venue.toLowerCase().includes(q) ||
            b.eventDate.includes(q);
          if (!match) return false;
        }
        if (venueFilter !== 'all' && b.venue !== venueFilter && b.venue !== 'Combined / Full Property') {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [bookings, searchQuery, venueFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Banquet & Lawn Event Calendar</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Anti-Duplicate Guard Active
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Book weddings, birthdays & parties months in advance without double-booking risk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Tabs */}
            <div className="bg-zinc-900 p-1 rounded-xl border border-zinc-800 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                📅 Calendar View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                📋 Bookings List ({upcomingBookings.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAddForDate(selectedDateStr)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Book Event</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Venue Filter Bar */}
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-850 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-zinc-400 font-semibold mr-1">Filter Venue:</span>
            <button
              type="button"
              onClick={() => setVenueFilter('all')}
              className={`px-3 py-1 rounded-full font-bold transition-all ${
                venueFilter === 'all'
                  ? 'bg-amber-400 text-black'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              All Venues
            </button>
            {BANQUET_VENUES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVenueFilter(v)}
                className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
                  venueFilter === v
                    ? 'bg-amber-400 text-black'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {v === 'Banquet Hall 1 (AC)'
                  ? '🏛️ Hall 1 (AC)'
                  : v === 'Garden Lawn'
                  ? '🌿 Garden Lawn'
                  : '🏰 Full Property'}
              </button>
            ))}
          </div>

          {/* Month Jump Controls (When in Calendar mode) */}
          {viewMode === 'calendar' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-white text-sm min-w-36 text-center">
                {monthName}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleTodayJump}
                className="px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 text-xs font-semibold"
              >
                Today
              </button>
            </div>
          )}
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* VIEW 1: CALENDAR VIEW */}
          {viewMode === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left 2 Cols: Monthly Calendar Grid */}
              <div className="lg:col-span-2 space-y-3">
                {/* Days of week header */}
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-zinc-400 uppercase tracking-wider py-1 border-b border-zinc-800">
                  <span className="text-rose-400">Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span className="text-amber-400">Sat</span>
                </div>

                {/* Calendar Days Matrix */}
                <div className="grid grid-cols-7 gap-1.5">
                  {/* Prev month padding days */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => {
                    const prevDay = daysInPrevMonth - firstDayOfWeek + i + 1;
                    return (
                      <div
                        key={`prev-${i}`}
                        className="min-h-[72px] sm:min-h-[88px] rounded-xl bg-zinc-950/40 border border-zinc-900/60 p-1.5 text-zinc-600 opacity-40 select-none"
                      >
                        <span className="text-xs font-mono">{prevDay}</span>
                      </div>
                    );
                  })}

                  {/* Current month days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const dayBookings = bookingsByDate.get(dateStr) || [];
                    const isToday =
                      new Date().toISOString().split('T')[0] === dateStr;
                    const isSelected = selectedDateStr === dateStr;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedDateStr(dateStr)}
                        className={`min-h-[72px] sm:min-h-[88px] rounded-xl p-1.5 text-left flex flex-col justify-between transition-all border ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                            : isToday
                            ? 'bg-zinc-900 border-amber-500/40'
                            : dayBookings.length > 0
                            ? 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                            : 'bg-zinc-900/40 border-zinc-900 hover:bg-zinc-900/70 hover:border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-md ${
                              isToday
                                ? 'bg-amber-400 text-black'
                                : isSelected
                                ? 'bg-amber-500/30 text-amber-300'
                                : 'text-zinc-300'
                            }`}
                          >
                            {dayNum}
                          </span>
                          {dayBookings.length > 0 && (
                            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-400/20 text-amber-300">
                              {dayBookings.length} Booked
                            </span>
                          )}
                        </div>

                        {/* Event badges preview */}
                        <div className="space-y-1 w-full my-1 overflow-hidden">
                          {dayBookings.slice(0, 2).map((bk) => {
                            const isHall = bk.venue.includes('Hall');
                            const isLawn = bk.venue.includes('Lawn');
                            return (
                              <div
                                key={bk.id}
                                className={`text-[9px] font-semibold px-1 py-0.5 rounded truncate flex items-center gap-1 ${
                                  isHall
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : isLawn
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                }`}
                                title={`${bk.eventType} (${bk.venue}) - ${bk.customerName}`}
                              >
                                <span className="shrink-0">
                                  {bk.eventType.includes('Birthday')
                                    ? '🎂'
                                    : bk.eventType.includes('Wedding')
                                    ? '💍'
                                    : bk.eventType.includes('Anniversary')
                                    ? '🥂'
                                    : bk.eventType.includes('Corporate')
                                    ? '💼'
                                    : '🎊'}
                                </span>
                                <span className="truncate">{bk.customerName}</span>
                              </div>
                            );
                          })}
                          {dayBookings.length > 2 && (
                            <div className="text-[8px] text-zinc-400 text-center font-mono">
                              +{dayBookings.length - 2} more
                            </div>
                          )}
                        </div>

                        {/* Vacant indicator */}
                        {dayBookings.length === 0 && (
                          <div className="text-[9px] text-zinc-600 font-medium">Available</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Col: Selected Date Schedule & Action Pane */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-850">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                        Day Schedule
                      </span>
                      <h3 className="text-base font-black text-white">
                        {new Date(selectedDateStr).toLocaleDateString('default', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddForDate(selectedDateStr)}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow"
                    >
                      <Plus className="w-3.5 h-3.5" /> Book
                    </button>
                  </div>

                  {/* List of bookings on this date */}
                  <div className="mt-3 space-y-2.5 max-h-[460px] overflow-y-auto no-scrollbar">
                    {selectedDateBookings.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500">
                        <Sparkles className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                        <p className="text-xs font-semibold">No bookings for this date.</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          Banquet Hall 1, Garden Lawn & Full Property are completely vacant.
                        </p>
                      </div>
                    ) : (
                      selectedDateBookings.map((b) => (
                        <div
                          key={b.id}
                          className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2 shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-black text-white">{b.eventType}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-400/15 text-amber-300">
                                  {b.slot.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-zinc-300 mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-amber-400" />
                                {b.venue}
                              </p>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              {b.noOfGuests} Guests
                            </span>
                          </div>

                          <div className="text-xs text-zinc-400 space-y-0.5 pt-1 border-t border-zinc-900">
                            <div className="flex items-center justify-between">
                              <span>Customer:</span>
                              <span className="font-semibold text-white">{b.customerName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Phone:</span>
                              <span className="font-mono text-zinc-300">{b.customerPhone}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Total / Adv:</span>
                              <span className="font-mono font-bold text-amber-300">
                                ₹{b.totalAmount.toLocaleString('en-IN')} (Adv: ₹{b.advancePaid.toLocaleString('en-IN')})
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Balance Due:</span>
                              <span className="font-mono font-black text-rose-400">
                                ₹{b.balanceDue.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>

                          {/* Quick Actions: WhatsApp Share, Edit, Cancel */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-900">
                            <a
                              href={`https://wa.me/91${b.customerPhone}?text=${encodeURIComponent(
                                generateBanquetWhatsAppMessage(b)
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-1 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center justify-center gap-1"
                            >
                              <Share2 className="w-3 h-3" /> WhatsApp
                            </a>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(b)}
                              className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                              title="Edit Booking"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBooking(b.id, b.customerName)}
                              className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400"
                              title="Cancel Booking"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Conflict Status Footer */}
                <div className="pt-2 border-t border-zinc-850 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>Double Booking Protection</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: UPCOMING BOOKINGS LIST */}
          {viewMode === 'list' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customer name, phone, event or date..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-850 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Bookings Table / Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingBookings.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-zinc-500">
                    <CalendarIcon className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                    <p className="text-sm font-semibold">No bookings match the search criteria.</p>
                  </div>
                ) : (
                  upcomingBookings.map((b) => (
                    <div
                      key={b.id}
                      className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-3 hover:border-zinc-700 transition-all shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-mono font-bold text-amber-400">
                            {b.eventDate}
                          </div>
                          <h4 className="text-sm font-black text-white mt-0.5">{b.eventType}</h4>
                          <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-amber-400" /> {b.venue}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-amber-300">
                          {b.slot === 'custom'
                            ? `${b.customStartTime || ''} - ${b.customEndTime || ''}`
                            : b.slot.toUpperCase()}
                        </span>
                      </div>

                      <div className="bg-zinc-950/70 rounded-xl p-2.5 text-xs text-zinc-300 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Customer:</span>
                          <span className="font-semibold text-white">{b.customerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Phone:</span>
                          <span className="font-mono">{b.customerPhone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Guests:</span>
                          <span className="font-mono font-semibold">{b.noOfGuests}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-zinc-900">
                          <span className="text-zinc-500">Quotation / Adv:</span>
                          <span className="font-mono text-amber-300 font-bold">
                            ₹{b.totalAmount.toLocaleString('en-IN')} (Adv: ₹{b.advancePaid.toLocaleString('en-IN')})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Balance Due:</span>
                          <span className="font-mono text-rose-400 font-black">
                            ₹{b.balanceDue.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {b.specialNotes && (
                        <p className="text-[11px] text-zinc-400 italic line-clamp-2">
                          "{b.specialNotes}"
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-zinc-850">
                        <a
                          href={`https://wa.me/91${b.customerPhone}?text=${encodeURIComponent(
                            generateBanquetWhatsAppMessage(b)
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <Share2 className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(b)}
                          className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBooking(b.id, b.customerName)}
                          className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400"
                          title="Cancel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: ADD / EDIT BOOKING FORM */}
          {viewMode === 'add' && (
            <form onSubmit={handleSaveBooking} className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-base font-black text-white">
                  {editingId ? 'Edit Banquet Reservation' : 'New Advance Banquet Reservation'}
                </h3>
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  ← Back to Calendar
                </button>
              </div>

              {/* CONFLICT WARNING BANNER */}
              {conflictResult.hasConflict && (
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-start gap-2.5 animate-in slide-in-from-top-2 duration-200">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-black text-rose-200 uppercase tracking-wide">
                      Duplicate Booking Blocked!
                    </p>
                    <p className="mt-0.5">{conflictResult.reason}</p>
                    <p className="text-[11px] text-rose-300/80 mt-1">
                      💡 Choose a different venue, slot, or date to proceed.
                    </p>
                  </div>
                </div>
              )}

              {saveSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold">{saveSuccessMsg}</span>
                </div>
              )}

              {/* Row 1: Event Date & Event Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1">
                    📅 Event Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1">
                    🎊 Event Type
                  </label>
                  <select
                    value={formEventType}
                    onChange={(e) => setFormEventType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  >
                    {BANQUET_EVENT_TYPES.map((et) => (
                      <option key={et.type} value={et.type}>
                        {et.emoji} {et.type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Venue Selection (3 Confirmed Options) */}
              <div>
                <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1.5">
                  🏛️ Select Venue (Confirmed Options)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {BANQUET_VENUES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFormVenue(v)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        formVenue === v
                          ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-bold">
                        {v === 'Banquet Hall 1 (AC)'
                          ? '🏛️ Hall 1 (AC)'
                          : v === 'Garden Lawn'
                          ? '🌿 Garden Lawn'
                          : '🏰 Full Property'}
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-1">
                        {v === 'Banquet Hall 1 (AC)'
                          ? 'Indoor AC (Cap: 150)'
                          : v === 'Garden Lawn'
                          ? 'Outdoor Green (Cap: 400)'
                          : 'Both Hall + Lawn'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3: Slot Timing (Lunch, Dinner, Full Day, Custom Hours) */}
              <div>
                <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1.5">
                  ⏰ Function Slot & Timing
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BANQUET_SLOTS.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setFormSlot(slot.id)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        formSlot === slot.id
                          ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1 font-bold text-xs">
                        <span>{slot.emoji}</span>
                        <span>{slot.label}</span>
                      </div>
                      <div className="text-[9px] text-zinc-500 mt-0.5">{slot.timeRange}</div>
                    </button>
                  ))}
                </div>

                {/* If Custom Hours chosen, show Start and End Time inputs */}
                {formSlot === 'custom' && (
                  <div className="mt-2.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 grid grid-cols-2 gap-3 animate-in fade-in duration-200">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formCustomStart}
                        onChange={(e) => setFormCustomStart(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formCustomEnd}
                        onChange={(e) => setFormCustomEnd(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Row 4: Guest Count & Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1">
                    👥 Expected Guests
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formGuests}
                    onChange={(e) => setFormGuests(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1">
                    👤 Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Sharma"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1">
                    📱 Mobile Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit phone for WhatsApp"
                    value={formCustomerPhone}
                    onChange={(e) => setFormCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Row 5: Financials & Advance Payment */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-850 space-y-3">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  💰 Financials & Advance Deposit
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Total Quotation (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formTotalAmount}
                      onChange={(e) => setFormTotalAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Advance Paid (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formAdvancePaid}
                      onChange={(e) => setFormAdvancePaid(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={formPaymentMode}
                      onChange={(e) => setFormPaymentMode(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-400"
                    >
                      <option value="UPI">UPI / QR Code</option>
                      <option value="Cash">Cash in Drawer</option>
                      <option value="Card">Card / EDC POS</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT)</option>
                    </select>
                  </div>

                  <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 flex flex-col justify-center">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold">
                      Balance Due:
                    </span>
                    <span className="text-base font-black text-rose-400 font-mono">
                      ₹{formBalanceDue.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 6: Special Catering Notes & Status */}
              <div>
                <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1">
                  📝 Special Notes / Menu & DJ Preferences
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paneer Tikka starters, Desi chicken buffet, DJ required till 10 PM..."
                  value={formSpecialNotes}
                  onChange={(e) => setFormSpecialNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={conflictResult.hasConflict || loading}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all ${
                    conflictResult.hasConflict || loading
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black active:scale-95'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingId ? 'Update Reservation' : 'Confirm & Save Booking'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
