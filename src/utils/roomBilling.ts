import {
  RoomPaymentMode,
  RoomStayRecord,
  RoomStayTotals,
} from '../types/roomStay';

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Calculates calendar nights between two YYYY-MM-DD strings (minimum 1). */
export function calculateStayNights(checkInDate: string, checkOutDate: string): number {
  if (!checkInDate || !checkOutDate) return 1;
  const [y1, m1, d1] = checkInDate.split('-').map(Number);
  const [y2, m2, d2] = checkOutDate.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 1;
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, diffDays);
}

/** Computes itemized stay totals (no GST by default unless gstPercent > 0). */
export function calculateRoomStayTotals(
  stay: Pick<
    RoomStayRecord,
    | 'stayType'
    | 'nightlyRate'
    | 'nights'
    | 'customStayPrice'
    | 'extraCharges'
    | 'discount'
    | 'gstPercent'
    | 'advancePaid'
  >
): RoomStayTotals {
  const roomCharge =
    stay.stayType === 'short_stay'
      ? Math.max(0, Number(stay.customStayPrice) || 0)
      : Math.max(1, Number(stay.nights) || 1) * Math.max(0, Number(stay.nightlyRate) || 0);

  const extrasTotal = (stay.extraCharges || []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.amount) || 0),
    0
  );

  const subtotal = Math.round(roomCharge + extrasTotal);
  const discount = Math.min(subtotal, Math.max(0, Number(stay.discount) || 0));
  const taxable = Math.max(0, subtotal - discount);
  const gstPercent = Math.max(0, Number(stay.gstPercent) || 0);
  const taxAmount = gstPercent > 0 ? Math.round((taxable * gstPercent) / 100) : 0;
  const totalAmount = Math.round(taxable + taxAmount);
  const advancePaid = Math.max(0, Number(stay.advancePaid) || 0);
  const balanceDue = Math.max(0, totalAmount - advancePaid);

  return {
    roomCharge: Math.round(roomCharge),
    extrasTotal: Math.round(extrasTotal),
    subtotal,
    discount: Math.round(discount),
    gstPercent,
    taxAmount,
    totalAmount,
    advancePaid: Math.round(advancePaid),
    balanceDue,
  };
}

/**
 * Combines check-in advance payment mode and checkout balance payment mode into
 * an accurate `bills.payment_method` + `payment_details` breakdown for OwnerInsights.
 */
export function combineAdvanceAndCheckoutPayment(
  advancePaid: number,
  advanceMode: RoomPaymentMode,
  balanceDue: number,
  checkoutMethod: 'cash' | 'upi' | 'card' | 'split',
  splitAmounts: { cashAmount?: number; upiAmount?: number; cardAmount?: number } = {}
): {
  paymentMethod: 'cash' | 'upi' | 'card' | 'split';
  paymentDetails: { cashAmount: number; upiAmount: number; cardAmount: number };
} {
  let cash = 0;
  let upi = 0;
  let card = 0;

  const adv = Math.max(0, Number(advancePaid) || 0);
  if (adv > 0) {
    if (advanceMode === 'UPI') upi += adv;
    else if (advanceMode === 'Card') card += adv;
    else cash += adv;
  }

  const bal = Math.max(0, Number(balanceDue) || 0);
  if (bal > 0) {
    if (checkoutMethod === 'split') {
      cash += Math.max(0, Number(splitAmounts.cashAmount) || 0);
      upi += Math.max(0, Number(splitAmounts.upiAmount) || 0);
      card += Math.max(0, Number(splitAmounts.cardAmount) || 0);
    } else if (checkoutMethod === 'upi') {
      upi += bal;
    } else if (checkoutMethod === 'card') {
      card += bal;
    } else {
      cash += bal;
    }
  }

  cash = Math.round(cash * 100) / 100;
  upi = Math.round(upi * 100) / 100;
  card = Math.round(card * 100) / 100;

  const nonZeroModes = [cash > 0 ? 'cash' : null, upi > 0 ? 'upi' : null, card > 0 ? 'card' : null].filter(
    Boolean
  ) as Array<'cash' | 'upi' | 'card'>;

  const paymentMethod: 'cash' | 'upi' | 'card' | 'split' =
    nonZeroModes.length > 1 ? 'split' : nonZeroModes[0] || 'cash';

  return {
    paymentMethod,
    paymentDetails: { cashAmount: cash, upiAmount: upi, cardAmount: card },
  };
}

/** Formats a 58mm thermal checkout receipt for a room stay. */
export function generateRoomBillThermalHtml(
  stay: RoomStayRecord,
  billNumber: string | number,
  hotelName = 'HOTEL RJ'
): string {
  const totals = calculateRoomStayTotals(stay);
  const stayDesc =
    stay.stayType === 'short_stay'
      ? 'Short Stay / Day Use'
      : `${stay.nights} Night${stay.nights === 1 ? '' : 's'} @ Rs.${stay.nightlyRate}`;

  const extrasHtml = (stay.extraCharges || [])
    .map(
      (ex) =>
        `<div style="display:flex; justify-content:space-between;"><span>${escapeHtml(ex.label)}</span><span>Rs.${Math.round(ex.amount)}</span></div>`
    )
    .join('');

  return `
    <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:6px; margin-bottom:6px;">
      <div style="font-weight:bold; font-size:14px;">${escapeHtml(hotelName)}</div>
      <div style="font-size:11px; font-weight:bold;">ROOM STAY INVOICE</div>
      <div style="font-size:10px;">Bill #${escapeHtml(String(billNumber))} • ${escapeHtml(stay.roomName || stay.roomId)}</div>
    </div>
    <div style="font-size:11px; margin-bottom:6px;">
      <div><strong>Guest:</strong> ${escapeHtml(stay.guestName)}</div>
      ${stay.guestPhone ? `<div><strong>Phone:</strong> ${escapeHtml(stay.guestPhone)}</div>` : ''}
      <div><strong>Check-In:</strong> ${escapeHtml(stay.checkInDate)}</div>
      ${stay.checkOutDate ? `<div><strong>Check-Out:</strong> ${escapeHtml(stay.checkOutDate)}</div>` : ''}
    </div>
    <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:4px 0; font-size:11px;">
      <div style="display:flex; justify-content:space-between;">
        <span>${escapeHtml(stayDesc)}</span>
        <span>Rs.${totals.roomCharge}</span>
      </div>
      ${extrasHtml}
      ${totals.discount > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Discount</span><span>-Rs.${totals.discount}</span></div>` : ''}
      ${totals.taxAmount > 0 ? `<div style="display:flex; justify-content:space-between;"><span>GST (${totals.gstPercent}%)</span><span>Rs.${totals.taxAmount}</span></div>` : ''}
    </div>
    <div style="padding-top:5px; font-weight:bold; font-size:13px; display:flex; justify-content:space-between;">
      <span>TOTAL BILL</span>
      <span>Rs.${totals.totalAmount}</span>
    </div>
    ${
      totals.advancePaid > 0
        ? `<div style="font-size:11px; display:flex; justify-content:space-between; margin-top:3px;"><span>Advance Paid (${escapeHtml(stay.advancePaymentMode)})</span><span>-Rs.${totals.advancePaid}</span></div>
           <div style="font-size:12px; font-weight:bold; display:flex; justify-content:space-between; margin-top:2px;"><span>BALANCE PAID</span><span>Rs.${totals.balanceDue}</span></div>`
        : ''
    }
    <div style="margin-top:8px; font-size:10px; text-align:center;">
      <div>Payment: ${escapeHtml((stay.paymentMethod || 'cash').toUpperCase())}</div>
      <div style="margin-top:4px;">Thank you for staying with us!</div>
    </div>
  `;
}

/** Formats a WhatsApp-friendly Room Stay Checkout Bill message. */
export function generateRoomBillWhatsAppText(
  stay: RoomStayRecord,
  billNumber: string | number,
  hotelName = 'Hotel RJ'
): string {
  const totals = calculateRoomStayTotals(stay);
  const stayLabel =
    stay.stayType === 'short_stay'
      ? 'Short Stay / Day Use (Custom Tariff)'
      : `${stay.nights} Night(s) × ₹${stay.nightlyRate.toLocaleString('en-IN')}`;
  const extrasLines = (stay.extraCharges || [])
    .map((ex) => `• ${ex.label}: ₹${Math.round(ex.amount).toLocaleString('en-IN')}`)
    .join('\n');

  return `🏨 *${hotelName.toUpperCase()} — ROOM CHECKOUT BILL*
━━━━━━━━━━━━━━━━━━━━━━
🧾 *Bill #:* ${billNumber}
🛏️ *Room:* ${stay.roomName || stay.roomId}
👤 *Guest:* ${stay.guestName}
📅 *Check-In:* ${stay.checkInDate}${stay.checkOutDate ? ` → *Check-Out:* ${stay.checkOutDate}` : ''}

💰 *Charges:*
• ${stayLabel}: ₹${totals.roomCharge.toLocaleString('en-IN')}
${extrasLines ? `${extrasLines}\n` : ''}${totals.discount > 0 ? `• Discount: -₹${totals.discount.toLocaleString('en-IN')}\n` : ''}${totals.taxAmount > 0 ? `• GST (${totals.gstPercent}%): ₹${totals.taxAmount.toLocaleString('en-IN')}\n` : ''}
💵 *TOTAL STAY BILL: ₹${totals.totalAmount.toLocaleString('en-IN')}*
${totals.advancePaid > 0 ? `• Advance Paid (${stay.advancePaymentMode}): ₹${totals.advancePaid.toLocaleString('en-IN')}\n• Balance Settled: ₹${totals.balanceDue.toLocaleString('en-IN')}\n` : ''}✅ *Payment Mode:* ${(stay.paymentMethod || 'cash').toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━
Thank you for staying at ${hotelName}!`;
}
