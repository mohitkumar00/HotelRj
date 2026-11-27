import React, { useMemo, useState } from 'react';
import { CheckCircle2, Lock, Printer, Share2, Unlock, X } from 'lucide-react';
import {
  PayrollCalculationResult,
  StaffAdvanceRecord,
  StaffAttendanceRecord,
  StaffMember,
  StaffPaymentMode,
  StaffPayrollRecord,
} from '../../types/staff';
import { localDateString } from '../../utils/dates';
import {
  calculateMonthlyPayroll,
  generatePayslipThermalHtml,
  generatePayslipWhatsAppText,
} from '../../utils/payroll';
import { BluetoothPrinter } from '../../utils/thermalPrinter';
import { HOTEL_INFO } from '../../data/hotelData';

interface PayrollRunTabProps {
  staff: StaffMember[];
  attendance: StaffAttendanceRecord[];
  advances: StaffAdvanceRecord[];
  payrollRecords: StaffPayrollRecord[];
  selectedMonth: string;
  onChangeMonth: (monthStr: string) => void;
  onSettlePayroll: (
    record: StaffPayrollRecord,
    options: { recordInExpenses: boolean; paidDateStr: string; staffName: string }
  ) => Promise<boolean>;
  onUnlockPayroll: (
    payroll: StaffPayrollRecord,
    options: { reason: string; deleteLinkedExpense: boolean }
  ) => Promise<boolean>;
}

export const PayrollRunTab: React.FC<PayrollRunTabProps> = ({
  staff,
  attendance,
  advances,
  payrollRecords,
  selectedMonth,
  onChangeMonth,
  onSettlePayroll,
  onUnlockPayroll,
}) => {
  const [settlingRow, setSettlingRow] = useState<{
    member: StaffMember;
    calc: PayrollCalculationResult;
  } | null>(null);
  const [paymentMode, setPaymentMode] = useState<StaffPaymentMode>('Cash');
  const [paidDateStr, setPaidDateStr] = useState<string>(() => localDateString());
  const [payNotes, setPayNotes] = useState<string>('');
  const [recordInExpenses, setRecordInExpenses] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [unlockingTarget, setUnlockingTarget] = useState<{
    member: StaffMember;
    payroll: StaffPayrollRecord;
  } | null>(null);
  const [unlockReason, setUnlockReason] = useState<string>('');
  const [deleteLinkedExpense, setDeleteLinkedExpense] = useState<boolean>(true);

  const payrollMap = useMemo(
    () => new Map(payrollRecords.map((p) => [p.staffId, p])),
    [payrollRecords]
  );

  const rows = useMemo(() => {
    return staff
      .filter((s) => s.status !== 'inactive' || payrollMap.has(s.id))
      .map((member) => {
        const existing = payrollMap.get(member.id) || null;
        const calc =
          existing && existing.status === 'paid'
            ? {
                ...existing,
                paidDayUnits:
                  existing.presentDays + existing.paidLeavesAndOffs + existing.halfDays * 0.5,
                dailyRate:
                  existing.payType === 'daily'
                    ? existing.baseSalary
                    : existing.baseSalary / (existing.daysInMonth || 30),
                unmarkedDaysCount: 0,
              }
            : calculateMonthlyPayroll(member, selectedMonth, attendance, advances, existing);
        return { member, calc };
      });
  }, [staff, payrollMap, selectedMonth, attendance, advances]);

  const totals = useMemo(() => {
    let totalNet = 0;
    let totalPaid = 0;
    let paidCount = 0;
    for (const r of rows) {
      totalNet += r.calc.netPayable;
      if (r.calc.status === 'paid') {
        totalPaid += r.calc.netPayable;
        paidCount += 1;
      }
    }
    return { totalNet, totalPaid, pending: totalNet - totalPaid, paidCount };
  }, [rows]);

  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingRow) return;
    setSubmitting(true);
    const ok = await onSettlePayroll(
      {
        ...settlingRow.calc,
        paymentMode,
        notes: payNotes.trim(),
        paidBy: 'Manager',
      },
      {
        recordInExpenses: recordInExpenses && paymentMode !== 'Adjustment',
        paidDateStr,
        staffName: settlingRow.member.name,
      }
    );
    setSubmitting(false);
    if (ok) {
      setSettlingRow(null);
      setPayNotes('');
    }
  };

  const handleConfirmUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockingTarget) return;
    setSubmitting(true);
    const ok = await onUnlockPayroll(unlockingTarget.payroll, {
      reason: unlockReason.trim() || 'Unlocked for attendance/payroll correction',
      deleteLinkedExpense,
    });
    setSubmitting(false);
    if (ok) {
      setUnlockingTarget(null);
      setUnlockReason('');
    }
  };

  const handlePrintSlip = async (member: StaffMember, calc: PayrollCalculationResult) => {
    const html = generatePayslipThermalHtml(member, calc, HOTEL_INFO.name);
    await BluetoothPrinter.printRawHtmlReceipt(html, `Payslip_${member.name}_${calc.monthStr}`);
  };

  const handleWhatsAppSlip = (member: StaffMember, calc: PayrollCalculationResult) => {
    const text = encodeURIComponent(generatePayslipWhatsAppText(member, calc, HOTEL_INFO.name));
    const cleanPhone = (member.phone || '').replace(/\D/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-400 font-semibold">Payroll Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => onChangeMonth(e.target.value)}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-gold-400"
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800">
            <span className="text-stone-400">Total Payroll: </span>
            <strong className="text-white">₹{totals.totalNet.toLocaleString('en-IN')}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            Paid ({totals.paidCount}/{rows.length}): <strong>₹{totals.totalPaid.toLocaleString('en-IN')}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
            Pending: <strong>₹{totals.pending.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-stone-950/60 border border-stone-800 rounded-2xl p-8 text-center text-stone-400 text-sm">
          No staff members available for payroll in {selectedMonth}.
        </div>
      ) : (
        <div className="bg-stone-950/70 border border-stone-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-800 text-stone-400 text-left">
                <th className="p-3">Staff</th>
                <th className="p-3">Days (P/H/W/A)</th>
                <th className="p-3 text-right">Earned + OT</th>
                <th className="p-3 text-right">Bonus / Adv</th>
                <th className="p-3 text-right">Net Payable</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, calc }) => (
                <tr key={member.id} className="border-b border-stone-900 hover:bg-stone-900/40">
                  <td className="p-3">
                    <div className="font-bold text-white">{member.name}</div>
                    <div className="text-[11px] text-stone-400">
                      {member.role} • ₹{calc.baseSalary.toLocaleString('en-IN')}/
                      {calc.payType === 'daily' ? 'd' : `${calc.daysInMonth}d`}
                    </div>
                  </td>
                  <td className="p-3 font-mono text-[11px]">
                    <span className="text-emerald-400">{calc.presentDays}P</span> /{' '}
                    <span className="text-amber-300">{calc.halfDays}H</span> /{' '}
                    <span className="text-violet-300">{calc.paidLeavesAndOffs}W</span> /{' '}
                    <span className="text-rose-400">{calc.absentDays}A</span>
                    {calc.unmarkedDaysCount > 0 && calc.status === 'draft' && (
                      <div className="text-[10px] text-amber-400">
                        {calc.unmarkedDaysCount} unmarked days
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono">
                    <div>₹{calc.earnedBasePay.toLocaleString('en-IN')}</div>
                    {calc.overtimePay > 0 && (
                      <div className="text-[10px] text-amber-300">
                        +₹{calc.overtimePay.toLocaleString('en-IN')} OT
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {calc.bonuses > 0 && (
                      <div className="text-emerald-400">+₹{calc.bonuses.toLocaleString('en-IN')}</div>
                    )}
                    {calc.advancesDeducted + calc.otherDeductions > 0 ? (
                      <div className="text-rose-400">
                        -₹{(calc.advancesDeducted + calc.otherDeductions).toLocaleString('en-IN')}
                      </div>
                    ) : (
                      calc.bonuses === 0 && <span className="text-stone-600">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold text-sm text-gold-200">
                    ₹{calc.netPayable.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-center">
                    {calc.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                        <Lock className="w-3 h-3" /> Paid ({calc.paymentMode})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 text-[10px] font-bold">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {calc.status === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMode('Cash');
                            setPaidDateStr(localDateString());
                            setRecordInExpenses(true);
                            setSettlingRow({ member, calc });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Settle</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteLinkedExpense(Boolean(calc.linkedExpenseId));
                            setUnlockingTarget({ member, payroll: calc });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-amber-500/20 text-amber-300 font-bold text-[11px] flex items-center gap-1"
                          title="Unlock paid month for edits"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Unlock</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePrintSlip(member, calc)}
                        className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300"
                        title="Print 58mm salary slip"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWhatsAppSlip(member, calc)}
                        className="p-1.5 rounded-lg bg-stone-900 hover:bg-emerald-500/20 text-emerald-400"
                        title="Share payslip via WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {settlingRow && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmSettle}
            className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-gold-200">
                Settle Salary — {settlingRow.member.name}
              </h3>
              <button type="button" onClick={() => setSettlingRow(null)} className="text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-400">Month</span>
                <span className="font-bold text-white">{settlingRow.calc.monthStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Net Payable</span>
                <span className="font-bold text-base text-emerald-400">
                  ₹{settlingRow.calc.netPayable.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as StaffPaymentMode)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Adjustment">Adjustment</option>
                </select>
              </div>
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Payout Date</label>
                <input
                  type="date"
                  value={paidDateStr}
                  onChange={(e) => setPaidDateStr(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-stone-400 mb-1 font-semibold">Notes</label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Optional settlement note"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white"
              />
            </div>

            {paymentMode !== 'Adjustment' && settlingRow.calc.netPayable > 0 && (
              <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordInExpenses}
                  onChange={(e) => setRecordInExpenses(e.target.checked)}
                  className="rounded border-stone-700 accent-amber-500"
                />
                <span>Also record in Daily Expenses (for Cash/Profit sync)</span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setSettlingRow(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-200 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50"
              >
                {submitting ? 'Settling...' : 'Confirm & Lock Month'}
              </button>
            </div>
          </form>
        </div>
      )}

      {unlockingTarget && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmUnlock}
            className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-amber-300">
                Unlock Payroll — {unlockingTarget.member.name}
              </h3>
              <button type="button" onClick={() => setUnlockingTarget(null)} className="text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-stone-300">
              Unlocking {unlockingTarget.payroll.monthStr} allows editing attendance again and logs an audit entry.
            </p>

            <div>
              <label className="block text-stone-400 mb-1 font-semibold">Reason *</label>
              <input
                required
                type="text"
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="e.g. Correcting missed overtime entry"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white"
              />
            </div>

            {unlockingTarget.payroll.linkedExpenseId && (
              <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteLinkedExpense}
                  onChange={(e) => setDeleteLinkedExpense(e.target.checked)}
                  className="rounded border-stone-700 accent-amber-500"
                />
                <span>Also remove linked salary expense entry from Daily Expenses</span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setUnlockingTarget(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-200 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-50"
              >
                {submitting ? 'Unlocking...' : 'Unlock Payroll'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
