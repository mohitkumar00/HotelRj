import React, { useMemo, useState } from 'react';
import { AlertTriangle, PlusCircle, Trash2 } from 'lucide-react';
import {
  AdvanceEntryType,
  StaffAdvanceRecord,
  StaffAttendanceRecord,
  StaffMember,
  StaffPaymentMode,
} from '../../types/staff';
import { localDateString } from '../../utils/dates';
import { calculateEarnedToDate } from '../../utils/payroll';

interface AdvancesLedgerTabProps {
  staff: StaffMember[];
  attendance: StaffAttendanceRecord[];
  advances: StaffAdvanceRecord[];
  selectedMonth: string;
  onChangeMonth: (monthStr: string) => void;
  onSaveAdvance: (
    entry: Partial<StaffAdvanceRecord>,
    options: { recordInExpenses: boolean; staffName: string }
  ) => Promise<boolean>;
  onDeleteAdvance: (advance: StaffAdvanceRecord) => Promise<void>;
}

export const AdvancesLedgerTab: React.FC<AdvancesLedgerTabProps> = ({
  staff,
  attendance,
  advances,
  selectedMonth,
  onChangeMonth,
  onSaveAdvance,
  onDeleteAdvance,
}) => {
  const activeStaff = useMemo(() => staff.filter((s) => s.status !== 'inactive'), [staff]);
  const [staffId, setStaffId] = useState<string>(() => activeStaff[0]?.id || '');
  const [entryType, setEntryType] = useState<AdvanceEntryType>('advance');
  const [dateStr, setDateStr] = useState<string>(() => localDateString());
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<StaffPaymentMode>('Cash');
  const [notes, setNotes] = useState<string>('');
  const [recordInExpenses, setRecordInExpenses] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const selectedMember = useMemo(
    () => staff.find((s) => s.id === (staffId || activeStaff[0]?.id)) || activeStaff[0] || null,
    [staff, activeStaff, staffId]
  );

  const earnedPreview = useMemo(() => {
    if (!selectedMember) return null;
    return calculateEarnedToDate(selectedMember, dateStr, attendance, advances);
  }, [selectedMember, dateStr, attendance, advances]);

  const numericAmount = Number(amount) || 0;
  const exceedsEarned =
    entryType === 'advance' &&
    earnedPreview !== null &&
    numericAmount > 0 &&
    numericAmount > earnedPreview.remainingBalance;

  const staffNameMap = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || numericAmount <= 0) return;
    setSubmitting(true);
    const ok = await onSaveAdvance(
      {
        staffId: selectedMember.id,
        dateStr,
        entryType,
        amount: numericAmount,
        paymentMode,
        notes,
        recordedBy: 'Manager',
      },
      {
        recordInExpenses: recordInExpenses && entryType !== 'deduction' && paymentMode !== 'Adjustment',
        staffName: selectedMember.name,
      }
    );
    setSubmitting(false);
    if (ok) {
      setAmount('');
      setNotes('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left: Record Advance / Deduction / Bonus */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-2 bg-stone-950/70 border border-stone-800 rounded-2xl p-4 space-y-3 h-fit"
      >
        <h4 className="text-sm font-bold text-gold-200 flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-gold-400" />
          <span>Record Advance / Bonus / Deduction</span>
        </h4>

        <div className="space-y-2.5 text-xs">
          <div>
            <label className="block text-stone-400 mb-1 font-semibold">Staff Member</label>
            <select
              value={selectedMember?.id || ''}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-white"
            >
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-stone-400 mb-1 font-semibold">Entry Type</label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as AdvanceEntryType)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-white"
              >
                <option value="advance">Advance (Kharchi)</option>
                <option value="bonus">Bonus / Incentive</option>
                <option value="deduction">Deduction / Fine</option>
              </select>
            </div>
            <div>
              <label className="block text-stone-400 mb-1 font-semibold">Date</label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-stone-400 mb-1 font-semibold">Amount (₹)</label>
              <input
                required
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-stone-400 mb-1 font-semibold">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as StaffPaymentMode)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-white"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Adjustment">Adjustment (Non-Cash)</option>
              </select>
            </div>
          </div>

          {earnedPreview && selectedMember && (
            <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 text-[11px] flex justify-between">
              <span className="text-stone-400">Earned to {dateStr}:</span>
              <span className="font-semibold text-stone-200">
                ₹{earnedPreview.earnedToDate.toLocaleString('en-IN')} (Bal: ₹
                {earnedPreview.remainingBalance.toLocaleString('en-IN')})
              </span>
            </div>
          )}

          {exceedsEarned && earnedPreview && (
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Advance exceeds earned balance to date (₹
                {earnedPreview.remainingBalance.toLocaleString('en-IN')}) by ₹
                {(numericAmount - Math.max(0, earnedPreview.remainingBalance)).toLocaleString('en-IN')}.
              </span>
            </div>
          )}

          <div>
            <label className="block text-stone-400 mb-1 font-semibold">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Mid-month kharchi / Banquet bonus"
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-white"
            />
          </div>

          {entryType !== 'deduction' && paymentMode !== 'Adjustment' && (
            <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={recordInExpenses}
                onChange={(e) => setRecordInExpenses(e.target.checked)}
                className="rounded border-stone-700 accent-amber-500"
              />
              <span>Also record in Daily Expenses (for Cash/Profit sync)</span>
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedMember || numericAmount <= 0}
          className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-bold text-xs disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Entry'}
        </button>
      </form>

      {/* Right: Ledger History */}
      <div className="lg:col-span-3 bg-stone-950/70 border border-stone-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-white">Ledger History</h4>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => onChangeMonth(e.target.value)}
            className="px-3 py-1.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-white"
          />
        </div>

        {advances.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            No advances, bonuses, or deductions recorded for {selectedMonth}.
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {advances.map((adv) => (
              <div
                key={adv.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-900/70 border border-stone-800 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">
                      {staffNameMap.get(adv.staffId) || adv.staffId}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        adv.entryType === 'bonus'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : adv.entryType === 'deduction'
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {adv.entryType}
                    </span>
                    {adv.linkedExpenseId && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300">
                        Synced to Expenses
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {adv.dateStr} • {adv.paymentMode}
                    {adv.notes ? ` • ${adv.notes}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-sm text-white">
                    ₹{adv.amount.toLocaleString('en-IN')}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteAdvance(adv)}
                    className="p-1.5 rounded-lg bg-stone-950 hover:bg-rose-500/20 text-stone-400 hover:text-rose-400"
                    title="Delete entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
