export type RoomStayType = 'nightly' | 'short_stay';

export type RoomStayStatus = 'active' | 'checked_out' | 'cancelled';

export type RoomPaymentMode = 'Cash' | 'UPI' | 'Card';

export interface RoomExtraCharge {
  id: string;
  label: string;
  amount: number;
}

export interface RoomStayRecord {
  id: string;
  roomId: string;
  roomName: string;
  stayType: RoomStayType;
  guestName: string;
  guestPhone?: string;
  numGuests: number;
  idProofNote?: string;
  checkInAt: string;
  checkInDate: string; // Local YYYY-MM-DD
  expectedCheckOutDate?: string;
  checkOutAt?: string;
  checkOutDate?: string;
  nightlyRate: number;
  nights: number;
  customStayPrice: number;
  extraCharges: RoomExtraCharge[];
  advancePaid: number;
  advancePaymentMode: RoomPaymentMode;
  discount: number;
  gstPercent: number; // Default 0
  taxAmount: number;
  totalAmount: number;
  status: RoomStayStatus;
  billId?: string;
  billNumber?: number;
  paymentMethod?: 'cash' | 'upi' | 'card' | 'split';
  notes?: string;
  createdBy?: string;
  settledBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomStayTotals {
  roomCharge: number;
  extrasTotal: number;
  subtotal: number;
  discount: number;
  gstPercent: number;
  taxAmount: number;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
}
