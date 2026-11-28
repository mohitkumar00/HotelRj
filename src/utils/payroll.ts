import {
  PayrollCalculationResult,
  StaffAdvanceRecord,
  StaffAttendanceRecord,
  StaffMember,
  StaffPayrollRecord,
} from '../types/staff';
import { daysInMonth } from './dates';

/** Escape HTML special characters when building thermal receipt HTML. */
function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Computes deterministic monthly payroll for a staff member from attendance & advance ledgers.
 * Monthly staff are prorated by actual calendar days in `monthStr`, with paid week-offs & leaves.
 */
export function calculateMonthlyPayroll(
  member: StaffMember,
  monthStr: string,
  attendanceRecords: StaffAttendanceRecord[],
  advanceRecords: StaffAdvanceRecord[],
  existingPayroll?: StaffPayrollRecord | null
): PayrollCalculationResult {
  const totalDays = daysInMonth(monthStr);
  const monthAttendance = attendanceRecords.filter(
    (a) => a.staffId === member.id && a.dateStr.startsWith(monthStr)
  );
  const monthAdvances = advanceRecords.filter(
    (adv) => adv.staffId === member.id && adv.dateStr.startsWith(monthStr)
  );

  let presentDays = 0;
  let halfDays = 0;
  let paidLeavesAndOffs = 0;
  let absentDays = 0;
  let overtimeHours = 0;
  const markedDates = new Set<string>();

  for (const rec of monthAttendance) {
    markedDates.add(rec.dateStr);
    overtimeHours += Number(rec.overtimeHours) || 0;
    if (rec.status === 'present') presentDays += 1;
    else if (rec.status === 'half_day') halfDays += 1;
    else if (rec.status === 'paid_leave' || rec.status === 'week_off') paidLeavesAndOffs += 1;
    else if (rec.status === 'absent') absentDays += 1;
  }

  const paidDayUnits = presentDays + paidLeavesAndOffs + halfDays * 0.5;
  const dailyRate =
    member.payType === 'daily' ? Number(member.baseSalary) || 0 : (Number(member.baseSalary) || 0) / totalDays;

  const earnedBasePay = Math.round(paidDayUnits * dailyRate);
  const overtimePay = Math.round(overtimeHours * (Number(member.overtimeRate) || 0));

  let bonuses = 0;
  let advancesDeducted = 0;
  let otherDeductions = 0;

  for (const adv of monthAdvances) {
    const amt = Number(adv.amount) || 0;
    if (adv.entryType === 'bonus') bonuses += amt;
    else if (adv.entryType === 'advance') advancesDeducted += amt;
    else if (adv.entryType === 'deduction') otherDeductions += amt;
  }

  const netPayable = Math.round(earnedBasePay + overtimePay + bonuses - advancesDeducted - otherDeductions);
  const unmarkedDaysCount = Math.max(0, totalDays - markedDates.size);

  return {
    id: `${member.id}_${monthStr}`,
    staffId: member.id,
    monthStr,
    payType: member.payType,
    baseSalary: Number(member.baseSalary) || 0,
    daysInMonth: totalDays,
    presentDays,
    halfDays,
    paidLeavesAndOffs,
    absentDays,
    overtimeHours: Number(overtimeHours.toFixed(2)),
    earnedBasePay,
    overtimePay,
    bonuses: Math.round(bonuses),
    advancesDeducted: Math.round(advancesDeducted),
    otherDeductions: Math.round(otherDeductions),
    netPayable,
    status: existingPayroll?.status || 'draft',
    paymentMode: existingPayroll?.paymentMode,
    paidAt: existingPayroll?.paidAt,
    paidBy: existingPayroll?.paidBy,
    linkedExpenseId: existingPayroll?.linkedExpenseId,
    notes: existingPayroll?.notes,
    updatedAt: existingPayroll?.updatedAt,
    paidDayUnits,
    dailyRate,
    unmarkedDaysCount,
  };
}

/**
 * Computes earned balance up to `asOfDateStr` (inclusive) within that date's month
 * so managers see a warning if a new advance exceeds earned salary to date.
 */
export function calculateEarnedToDate(
  member: StaffMember,
  asOfDateStr: string,
  attendanceRecords: StaffAttendanceRecord[],
  advanceRecords: StaffAdvanceRecord[]
): {
  earnedToDate: number;
  advancesTaken: number;
  remainingBalance: number;
} {
  const monthStr = asOfDateStr.slice(0, 7);
  const scopedAttendance = attendanceRecords.filter(
    (a) => a.staffId === member.id && a.dateStr.startsWith(monthStr) && a.dateStr <= asOfDateStr
  );
  const scopedAdvances = advanceRecords.filter(
    (adv) => adv.staffId === member.id && adv.dateStr.startsWith(monthStr) && adv.dateStr <= asOfDateStr
  );

  const summary = calculateMonthlyPayroll(member, monthStr, scopedAttendance, scopedAdvances);
  const grossToDate = summary.earnedBasePay + summary.overtimePay + summary.bonuses;
  const advancesTaken = summary.advancesDeducted + summary.otherDeductions;

  return {
    earnedToDate: grossToDate,
    advancesTaken,
    remainingBalance: grossToDate - advancesTaken,
  };
}

/** Formats a WhatsApp-friendly salary slip message for an employee. */
export function generatePayslipWhatsAppText(
  member: StaffMember,
  payroll: StaffPayrollRecord,
  hotelName = 'Hotel RJ'
): string {
  const statusLine =
    payroll.status === 'paid'
      ? `✅ *Status:* PAID (${payroll.paymentMode || 'Cash'})`
      : '📝 *Status:* DRAFT / PENDING';

  return `🧾 *${hotelName.toUpperCase()} — SALARY SLIP (${payroll.monthStr})*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Staff:* ${member.name} (${member.role})
🏢 *Department:* ${member.department.toUpperCase()}
💼 *Pay Type:* ${payroll.payType === 'daily' ? `Daily Wage (₹${payroll.baseSalary}/day)` : `Monthly (₹${payroll.baseSalary.toLocaleString('en-IN')}/${payroll.daysInMonth}d)`}

📅 *Attendance Summary:*
• Present: ${payroll.presentDays} d | Half-Day: ${payroll.halfDays} d
• Paid Off/Leave: ${payroll.paidLeavesAndOffs} d | Absent: ${payroll.absentDays} d
${payroll.overtimeHours > 0 ? `• Overtime: ${payroll.overtimeHours} hrs\n` : ''}
💰 *Earnings & Deductions:*
• Earned Base Pay: ₹${payroll.earnedBasePay.toLocaleString('en-IN')}
${payroll.overtimePay > 0 ? `• Overtime Pay: +₹${payroll.overtimePay.toLocaleString('en-IN')}\n` : ''}${payroll.bonuses > 0 ? `• Bonuses / Tips: +₹${payroll.bonuses.toLocaleString('en-IN')}\n` : ''}${payroll.advancesDeducted > 0 ? `• Advances (Kharchi): -₹${payroll.advancesDeducted.toLocaleString('en-IN')}\n` : ''}${payroll.otherDeductions > 0 ? `• Other Deductions: -₹${payroll.otherDeductions.toLocaleString('en-IN')}\n` : ''}
💵 *NET PAYABLE: ₹${payroll.netPayable.toLocaleString('en-IN')}*
${statusLine}
${payroll.notes ? `📝 *Note:* ${payroll.notes}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━`;
}

/** Generates compact 58mm thermal receipt HTML for a staff salary voucher. */
export function generatePayslipThermalHtml(
  member: StaffMember,
  payroll: StaffPayrollRecord,
  hotelName = 'HOTEL RJ'
): string {
  return `
    <div style="text-align:center; border-bottom:1.5px dashed #000; padding-bottom:6px; margin-bottom:6px; font-weight:700; color:#000;">
      <div style="font-weight:900; font-size:15px;">${escapeHtml(hotelName)}</div>
      <div style="font-size:12px; font-weight:900;">STAFF SALARY SLIP</div>
      <div style="font-size:11px; font-weight:700;">Month: ${escapeHtml(payroll.monthStr)}</div>
    </div>
    <div style="font-size:11.5px; font-weight:700; margin-bottom:6px; color:#000;">
      <div><strong>Name:</strong> ${escapeHtml(member.name)}</div>
      <div><strong>Role:</strong> ${escapeHtml(member.role)} (${escapeHtml(member.department)})</div>
      <div><strong>Basis:</strong> ${payroll.payType === 'daily' ? `Daily ₹${payroll.baseSalary}` : `Monthly ₹${payroll.baseSalary}`}</div>
    </div>
    <div style="border-top:1.5px dashed #000; border-bottom:1.5px dashed #000; padding:4px 0; font-size:11.5px; font-weight:700; color:#000;">
      <div style="display:flex; justify-content:space-between;"><span>Present / Leave+WO:</span><span>${payroll.presentDays}d / ${payroll.paidLeavesAndOffs}d</span></div>
      <div style="display:flex; justify-content:space-between;"><span>Half-Day / Absent:</span><span>${payroll.halfDays}d / ${payroll.absentDays}d</span></div>
      ${payroll.overtimeHours > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Overtime:</span><span>${payroll.overtimeHours} hrs</span></div>` : ''}
    </div>
    <div style="padding:5px 0; font-size:11px;">
      <div style="display:flex; justify-content:space-between;"><span>Earned Base Pay</span><span>Rs.${payroll.earnedBasePay}</span></div>
      ${payroll.overtimePay > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Overtime Pay</span><span>+Rs.${payroll.overtimePay}</span></div>` : ''}
      ${payroll.bonuses > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Bonus / Tips</span><span>+Rs.${payroll.bonuses}</span></div>` : ''}
      ${payroll.advancesDeducted > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Advances (Kharchi)</span><span>-Rs.${payroll.advancesDeducted}</span></div>` : ''}
      ${payroll.otherDeductions > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Deductions</span><span>-Rs.${payroll.otherDeductions}</span></div>` : ''}
    </div>
    <div style="border-top:1px solid #000; padding-top:5px; font-weight:bold; font-size:13px; display:flex; justify-content:space-between;">
      <span>NET PAYABLE</span>
      <span>Rs.${payroll.netPayable}</span>
    </div>
    <div style="margin-top:6px; font-size:10px; text-align:center;">
      <div>Status: ${payroll.status.toUpperCase()}${payroll.paymentMode ? ` (${escapeHtml(payroll.paymentMode)})` : ''}</div>
      <div style="margin-top:14px; border-top:1px dotted #000; padding-top:3px;">Manager / Receiver Signature</div>
    </div>
  `;
}
