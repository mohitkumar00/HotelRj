/**
 * Hotel RJ - Banquet & Event Booking Types and Conflict Detection Engine
 */

export type BanquetVenue =
  | 'Banquet Hall 1 (AC)'
  | 'Garden Lawn'
  | 'Combined / Full Property';

export type BanquetSlot = 'lunch' | 'dinner' | 'fullday' | 'custom';

export type BanquetEventType =
  | 'Birthday Party'
  | 'Wedding / Reception'
  | 'Anniversary'
  | 'Corporate / Conference'
  | 'Kitty Party'
  | 'Other Function';

export type BanquetStatus = 'confirmed' | 'tentative' | 'completed' | 'cancelled';

export interface BanquetBooking {
  id: string;
  eventDate: string; // YYYY-MM-DD
  slot: BanquetSlot;
  customStartTime?: string; // HH:mm (e.g. '10:00')
  customEndTime?: string; // HH:mm (e.g. '15:00')
  venue: BanquetVenue;
  eventType: BanquetEventType | string;
  noOfGuests: number;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
  advancePaymentMode: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
  specialNotes?: string;
  status: BanquetStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const BANQUET_VENUES: BanquetVenue[] = [
  'Banquet Hall 1 (AC)',
  'Garden Lawn',
  'Combined / Full Property',
];

export const BANQUET_EVENT_TYPES: { type: BanquetEventType; emoji: string }[] = [
  { type: 'Birthday Party', emoji: '🎂' },
  { type: 'Wedding / Reception', emoji: '💍' },
  { type: 'Anniversary', emoji: '🥂' },
  { type: 'Corporate / Conference', emoji: '💼' },
  { type: 'Kitty Party', emoji: '🎊' },
  { type: 'Other Function', emoji: '🎯' },
];

export const BANQUET_SLOTS: {
  id: BanquetSlot;
  label: string;
  timeRange: string;
  emoji: string;
}[] = [
  { id: 'lunch', label: 'Lunch', timeRange: '11:00 AM – 4:00 PM', emoji: '☀️' },
  { id: 'dinner', label: 'Dinner', timeRange: '6:30 PM – 11:30 PM', emoji: '🌙' },
  { id: 'fullday', label: 'Full Day', timeRange: 'Entire Day (10:00 AM – 11:30 PM)', emoji: '👑' },
  { id: 'custom', label: 'Custom Hours', timeRange: 'Custom Defined Hours', emoji: '⏱️' },
];

// Helper: Convert time string 'HH:mm' to minutes from midnight
function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

// Get numeric start and end minutes for a slot
export function getSlotTimeRange(
  slot: BanquetSlot,
  customStart?: string,
  customEnd?: string
): { startMin: number; endMin: number } {
  switch (slot) {
    case 'lunch':
      return { startMin: 11 * 60, endMin: 16 * 60 }; // 11:00 to 16:00
    case 'dinner':
      return { startMin: 18 * 60 + 30, endMin: 23 * 60 + 30 }; // 18:30 to 23:30
    case 'fullday':
      return { startMin: 0, endMin: 24 * 60 }; // Entire day
    case 'custom': {
      const s = timeToMinutes(customStart || '10:00');
      let e = timeToMinutes(customEnd || '16:00');
      if (e <= s) e = s + 120; // fallback minimum 2 hours
      return { startMin: s, endMin: e };
    }
  }
}

/**
 * Check if two venues have a spatial collision:
 * - 'Combined / Full Property' conflicts with any booking on that slot.
 * - Same venue conflicts with each other.
 */
export function areVenuesConflicting(venueA: BanquetVenue, venueB: BanquetVenue): boolean {
  if (venueA === 'Combined / Full Property' || venueB === 'Combined / Full Property') {
    return true;
  }
  return venueA === venueB;
}

/**
 * Check if two time ranges overlap
 */
export function areSlotsConflicting(
  slotA: BanquetSlot,
  startA?: string,
  endA?: string,
  slotB: BanquetSlot = 'lunch',
  startB?: string,
  endB?: string
): boolean {
  // If either is full day, guaranteed overlap
  if (slotA === 'fullday' || slotB === 'fullday') {
    return true;
  }

  const rangeA = getSlotTimeRange(slotA, startA, endA);
  const rangeB = getSlotTimeRange(slotB, startB, endB);

  // Overlap condition: startA < endB && endA > startB
  return rangeA.startMin < rangeB.endMin && rangeA.endMin > rangeB.startMin;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingBooking?: BanquetBooking;
  reason?: string;
}

/**
 * Robust duplicate / conflict detector:
 * Prevents manager from accidentally taking duplicate bookings for the same date & venue & time.
 */
export function checkBanquetBookingConflict(
  candidate: {
    eventDate: string;
    venue: BanquetVenue;
    slot: BanquetSlot;
    customStartTime?: string;
    customEndTime?: string;
  },
  existingBookings: BanquetBooking[],
  excludeBookingId?: string
): ConflictCheckResult {
  if (!candidate.eventDate || !candidate.venue || !candidate.slot) {
    return { hasConflict: false };
  }

  const activeBookings = existingBookings.filter(
    (b) => b.id !== excludeBookingId && b.status !== 'cancelled' && b.eventDate === candidate.eventDate
  );

  for (const existing of activeBookings) {
    // 1. Check venue collision
    if (!areVenuesConflicting(candidate.venue, existing.venue)) {
      continue;
    }

    // 2. Check time collision
    if (
      areSlotsConflicting(
        candidate.slot,
        candidate.customStartTime,
        candidate.customEndTime,
        existing.slot,
        existing.customStartTime,
        existing.customEndTime
      )
    ) {
      const slotDesc =
        existing.slot === 'custom'
          ? `${existing.customStartTime || '10:00'} - ${existing.customEndTime || '16:00'}`
          : BANQUET_SLOTS.find((s) => s.id === existing.slot)?.label || existing.slot;

      return {
        hasConflict: true,
        conflictingBooking: existing,
        reason: `Slot conflict: "${existing.venue}" is already booked for "${existing.eventType}" (${slotDesc}) by ${existing.customerName} on ${candidate.eventDate}.`,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Generate a WhatsApp booking confirmation message
 */
export function generateBanquetWhatsAppMessage(booking: BanquetBooking): string {
  const slotName =
    booking.slot === 'custom'
      ? `Custom Hours (${booking.customStartTime || ''} to ${booking.customEndTime || ''})`
      : BANQUET_SLOTS.find((s) => s.id === booking.slot)?.label || booking.slot;

  return `🎉 *HOTEL RJ — BANQUET & EVENT RESERVATION CONFIRMATION*
━━━━━━━━━━━━━━━━━━━━━━
Namaste *${booking.customerName}* Ji! Your event booking at Hotel RJ is confirmed.

📅 *Event Date:* ${booking.eventDate}
⏰ *Time / Slot:* ${slotName}
🏛️ *Venue:* ${booking.venue}
🎊 *Event Type:* ${booking.eventType}
👥 *Expected Guests:* ${booking.noOfGuests} Guests

💰 *Quotation & Billing:*
• Total Quotation: ₹${booking.totalAmount.toLocaleString('en-IN')}
• Advance Received: ₹${booking.advancePaid.toLocaleString('en-IN')} (${booking.advancePaymentMode})
• *Balance Due:* *₹${booking.balanceDue.toLocaleString('en-IN')}*

${booking.specialNotes ? `📝 *Special Notes / Catering:* ${booking.specialNotes}\n` : ''}
📍 *Venue Address:* Hotel RJ, National Highway
📞 *Manager Contact:* +91 94140 XXXXX
━━━━━━━━━━━━━━━━━━━━━━
Thank you for choosing Hotel RJ to celebrate your special moments!`;
}
