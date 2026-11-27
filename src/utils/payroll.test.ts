import { describe, expect, it } from 'vitest';
import {
  calculateEarnedToDate,
  calculateMonthlyPayroll,
  generatePayslipThermalHtml,
  generatePayslipWhatsAppText,
} from './payroll';
import { StaffAdvanceRecord, StaffAttendanceRecord, StaffMember } from '../types/staff';

const baseMonthlyStaff: StaffMember = {
  id: 'STAFF-1',
  name: 'Ramesh Kumar',
  phone: '9829012345',
  role: 'Waiter',
  department: 'restaurant',
  shift: 'full_day',
  payType: 'monthly',
  baseSalary: 15000,
  overtimeRate: 100,
  joinDate: '2026-01-01',
  showInPos: true,
  status: 'active',
};

const dailyStaff: StaffMember = {
  ...baseMonthlyStaff,
  id: 'STAFF-2',
  name: 'Suresh Helper',
  role: 'Banquet Helper',
  department: 'banquet',
  payType: 'daily',
  baseSalary: 600,
  overtimeRate: 75,
};

describe('payroll calculation engine', () => {
  it('prorates monthly salary by actual calendar days with paid week-offs and half-days', () => {
    // November 2026 has 30 days => dailyRate = 15000 / 30 = 500
    const attendance: StaffAttendanceRecord[] = [
      { id: '1', staffId: 'STAFF-1', dateStr: '2026-11-01', status: 'present', overtimeHours: 2 },
      { id: '2', staffId: 'STAFF-1', dateStr: '2026-11-02', status: 'half_day', overtimeHours: 0 },
      { id: '3', staffId: 'STAFF-1', dateStr: '2026-11-03', status: 'week_off', overtimeHours: 0 },
      { id: '4', staffId: 'STAFF-1', dateStr: '2026-11-04', status: 'paid_leave', overtimeHours: 0 },
      { id: '5', staffId: 'STAFF-1', dateStr: '2026-11-05', status: 'absent', overtimeHours: 0 },
    ];
    const advances: StaffAdvanceRecord[] = [
      { id: 'A1', staffId: 'STAFF-1', dateStr: '2026-11-03', entryType: 'advance', amount: 500, paymentMode: 'Cash' },
      { id: 'A2', staffId: 'STAFF-1', dateStr: '2026-11-04', entryType: 'bonus', amount: 300, paymentMode: 'UPI' },
      { id: 'A3', staffId: 'STAFF-1', dateStr: '2026-11-05', entryType: 'deduction', amount: 100, paymentMode: 'Adjustment' },
    ];

    const res = calculateMonthlyPayroll(baseMonthlyStaff, '2026-11', attendance, advances);

    expect(res.daysInMonth).toBe(30);
    expect(res.paidDayUnits).toBe(3.5); // 1 present + 1 week_off + 1 paid_leave + 0.5 half_day
    expect(res.earnedBasePay).toBe(1750); // 3.5 * 500
    expect(res.overtimePay).toBe(200); // 2 * 100
    expect(res.bonuses).toBe(300);
    expect(res.advancesDeducted).toBe(500);
    expect(res.otherDeductions).toBe(100);
    expect(res.netPayable).toBe(1650); // 1750 + 200 + 300 - 500 - 100
    expect(res.unmarkedDaysCount).toBe(25);
  });

  it('uses actual days in 28-day and 29-day leap February months', () => {
    const febNonLeap: StaffAttendanceRecord[] = Array.from({ length: 28 }, (_, i) => ({
      id: `nl-${i}`,
      staffId: 'STAFF-1',
      dateStr: `2026-02-${String(i + 1).padStart(2, '0')}`,
      status: 'present',
      overtimeHours: 0,
    }));
    const febLeap: StaffAttendanceRecord[] = Array.from({ length: 29 }, (_, i) => ({
      id: `lp-${i}`,
      staffId: 'STAFF-1',
      dateStr: `2028-02-${String(i + 1).padStart(2, '0')}`,
      status: 'present',
      overtimeHours: 0,
    }));

    const r1 = calculateMonthlyPayroll(baseMonthlyStaff, '2026-02', febNonLeap, []);
    const r2 = calculateMonthlyPayroll(baseMonthlyStaff, '2028-02', febLeap, []);

    expect(r1.daysInMonth).toBe(28);
    expect(r1.earnedBasePay).toBe(15000);
    expect(r2.daysInMonth).toBe(29);
    expect(r2.earnedBasePay).toBe(15000);
  });

  it('computes daily wage staff accurately', () => {
    const attendance: StaffAttendanceRecord[] = [
      { id: 'd1', staffId: 'STAFF-2', dateStr: '2026-11-10', status: 'present', overtimeHours: 4 },
      { id: 'd2', staffId: 'STAFF-2', dateStr: '2026-11-11', status: 'half_day', overtimeHours: 0 },
    ];
    const res = calculateMonthlyPayroll(dailyStaff, '2026-11', attendance, []);
    expect(res.dailyRate).toBe(600);
    expect(res.earnedBasePay).toBe(900); // 1.5 * 600
    expect(res.overtimePay).toBe(300); // 4 * 75
    expect(res.netPayable).toBe(1200);
  });

  it('computes earned-to-date balance for over-advance warnings', () => {
    const attendance: StaffAttendanceRecord[] = [
      { id: '1', staffId: 'STAFF-1', dateStr: '2026-11-01', status: 'present', overtimeHours: 0 },
      { id: '2', staffId: 'STAFF-1', dateStr: '2026-11-02', status: 'present', overtimeHours: 0 },
      { id: '3', staffId: 'STAFF-1', dateStr: '2026-11-10', status: 'present', overtimeHours: 0 }, // after asOfDate
    ];
    const advances: StaffAdvanceRecord[] = [
      { id: 'A1', staffId: 'STAFF-1', dateStr: '2026-11-02', entryType: 'advance', amount: 400, paymentMode: 'Cash' },
    ];
    const preview = calculateEarnedToDate(baseMonthlyStaff, '2026-11-05', attendance, advances);
    expect(preview.earnedToDate).toBe(1000);
    expect(preview.advancesTaken).toBe(400);
    expect(preview.remainingBalance).toBe(600);
  });

  it('formats WhatsApp and escaped 58mm thermal payslip outputs', () => {
    const calc = calculateMonthlyPayroll(
      { ...baseMonthlyStaff, name: 'Ramesh <Chef>' },
      '2026-11',
      [{ id: '1', staffId: 'STAFF-1', dateStr: '2026-11-01', status: 'present', overtimeHours: 0 }],
      []
    );
    const wa = generatePayslipWhatsAppText(baseMonthlyStaff, calc, 'Hotel RJ');
    const html = generatePayslipThermalHtml({ ...baseMonthlyStaff, name: 'Ramesh <Chef>' }, calc, 'Hotel RJ');

    expect(wa).toContain('HOTEL RJ — SALARY SLIP (2026-11)');
    expect(wa).toContain('NET PAYABLE');
    expect(html).toContain('Ramesh &lt;Chef&gt;');
    expect(html).toContain('STAFF SALARY SLIP');
  });
});
