export type StaffRole =
  | 'Waiter'
  | 'Captain'
  | 'Chef / Kitchen'
  | 'Housekeeping'
  | 'Front Desk'
  | 'Banquet Helper'
  | 'Security / Maintenance'
  | 'Manager';

export type StaffDepartment = 'restaurant' | 'rooms' | 'banquet' | 'general';

export type StaffShift = 'morning' | 'evening' | 'full_day' | 'night';

export type StaffPayType = 'monthly' | 'daily';

export type StaffStatus = 'active' | 'on_leave' | 'inactive';

export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'paid_leave' | 'week_off';

export type AdvanceEntryType = 'advance' | 'deduction' | 'bonus';

export type StaffPaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Adjustment';

export type PayrollStatus = 'draft' | 'paid';

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  emergencyContact?: string;
  role: StaffRole | string;
  department: StaffDepartment;
  shift: StaffShift;
  payType: StaffPayType;
  baseSalary: number;
  overtimeRate: number;
  joinDate: string; // YYYY-MM-DD
  idProofNote?: string;
  showInPos: boolean;
  status: StaffStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffAttendanceRecord {
  id: string; // `${staffId}_${dateStr}`
  staffId: string;
  dateStr: string; // Local YYYY-MM-DD
  status: AttendanceStatus;
  checkIn?: string; // HH:mm
  checkOut?: string; // HH:mm
  overtimeHours: number;
  notes?: string;
  markedBy?: string;
  updatedAt?: string;
}

export interface StaffAdvanceRecord {
  id: string;
  staffId: string;
  dateStr: string; // Local YYYY-MM-DD
  entryType: AdvanceEntryType;
  amount: number;
  paymentMode: StaffPaymentMode;
  notes?: string;
  linkedExpenseId?: string;
  recordedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffPayrollRecord {
  id: string; // `${staffId}_${monthStr}`
  staffId: string;
  monthStr: string; // YYYY-MM
  payType: StaffPayType;
  baseSalary: number;
  daysInMonth: number;
  presentDays: number;
  halfDays: number;
  paidLeavesAndOffs: number;
  absentDays: number;
  overtimeHours: number;
  earnedBasePay: number;
  overtimePay: number;
  bonuses: number;
  advancesDeducted: number;
  otherDeductions: number;
  netPayable: number;
  status: PayrollStatus;
  paymentMode?: StaffPaymentMode;
  paidAt?: string;
  paidBy?: string;
  linkedExpenseId?: string;
  notes?: string;
  updatedAt?: string;
}

export interface PayrollCalculationResult extends StaffPayrollRecord {
  paidDayUnits: number;
  dailyRate: number;
  unmarkedDaysCount: number;
}
