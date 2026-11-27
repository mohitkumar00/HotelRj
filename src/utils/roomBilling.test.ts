import { describe, expect, it } from 'vitest';
import {
  calculateRoomStayTotals,
  calculateStayNights,
  combineAdvanceAndCheckoutPayment,
  generateRoomBillThermalHtml,
  generateRoomBillWhatsAppText,
} from './roomBilling';
import { RoomStayRecord } from '../types/roomStay';

const sampleStay: RoomStayRecord = {
  id: 'STAY-1',
  roomId: 'Room 101',
  roomName: 'Room 101 (Deluxe King)',
  stayType: 'nightly',
  guestName: 'Rajesh Sharma',
  guestPhone: '9829012345',
  numGuests: 2,
  checkInAt: '2026-11-25T12:00:00Z',
  checkInDate: '2026-11-25',
  nightlyRate: 1600,
  nights: 2,
  customStayPrice: 0,
  extraCharges: [{ id: 'ex-1', label: 'Extra Bed', amount: 300 }],
  advancePaid: 1000,
  advancePaymentMode: 'Cash',
  discount: 100,
  gstPercent: 0,
  taxAmount: 0,
  totalAmount: 3400,
  status: 'active',
};

describe('roomBilling', () => {
  it('computes calendar nights with minimum of 1 night', () => {
    expect(calculateStayNights('2026-11-27', '2026-11-27')).toBe(1);
    expect(calculateStayNights('2026-11-25', '2026-11-27')).toBe(2);
    expect(calculateStayNights('2026-11-29', '2026-12-02')).toBe(3);
  });

  it('calculates nightly stay totals with no GST by default and subtracts advance', () => {
    const totals = calculateRoomStayTotals(sampleStay);
    expect(totals.roomCharge).toBe(3200);
    expect(totals.extrasTotal).toBe(300);
    expect(totals.subtotal).toBe(3500);
    expect(totals.discount).toBe(100);
    expect(totals.taxAmount).toBe(0);
    expect(totals.totalAmount).toBe(3400);
    expect(totals.balanceDue).toBe(2400);
  });

  it('supports short-stay (2-3 hrs) custom pricing and optional GST', () => {
    const totals = calculateRoomStayTotals({
      ...sampleStay,
      stayType: 'short_stay',
      customStayPrice: 700,
      extraCharges: [],
      discount: 0,
      gstPercent: 12,
      advancePaid: 200,
    });
    expect(totals.roomCharge).toBe(700);
    expect(totals.taxAmount).toBe(84);
    expect(totals.totalAmount).toBe(784);
    expect(totals.balanceDue).toBe(584);
  });

  it('combines advance mode and checkout balance mode into accurate split payment details', () => {
    const sameMode = combineAdvanceAndCheckoutPayment(1000, 'Cash', 2400, 'cash');
    expect(sameMode.paymentMethod).toBe('cash');
    expect(sameMode.paymentDetails).toEqual({ cashAmount: 3400, upiAmount: 0, cardAmount: 0 });

    const crossMode = combineAdvanceAndCheckoutPayment(1000, 'Cash', 2400, 'upi');
    expect(crossMode.paymentMethod).toBe('split');
    expect(crossMode.paymentDetails).toEqual({ cashAmount: 1000, upiAmount: 2400, cardAmount: 0 });

    const checkoutSplit = combineAdvanceAndCheckoutPayment(500, 'UPI', 1500, 'split', {
      cashAmount: 1000,
      upiAmount: 500,
    });
    expect(checkoutSplit.paymentMethod).toBe('split');
    expect(checkoutSplit.paymentDetails).toEqual({ cashAmount: 1000, upiAmount: 1000, cardAmount: 0 });
  });

  it('formats escaped 58mm thermal HTML and WhatsApp bill text', () => {
    const checkedOut: RoomStayRecord = {
      ...sampleStay,
      stayType: 'short_stay',
      customStayPrice: 800,
      extraCharges: [],
      discount: 0,
      guestName: 'Amit <VIP>',
      paymentMethod: 'upi',
      checkOutDate: '2026-11-27',
    };
    const html = generateRoomBillThermalHtml(checkedOut, 1042, 'Hotel RJ');
    const wa = generateRoomBillWhatsAppText(checkedOut, 1042, 'Hotel RJ');

    expect(html).toContain('ROOM STAY INVOICE');
    expect(html).toContain('Amit &lt;VIP&gt;');
    expect(wa).toContain('Short Stay / Day Use');
    expect(wa).toContain('Bill #:* 1042');
  });
});
