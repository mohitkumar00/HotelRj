import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Grid3X3, List, Lock } from 'lucide-react';
import {
  AttendanceStatus,
  StaffAttendanceRecord,
  StaffMember,
  StaffPayrollRecord,
} from '../../types/staff';
import { localDateString, monthDatesList } from '../../utils/dates';

interface AttendanceMusterTabProps {
  staff: StaffMember[];
  attendance: StaffAttendanceRecord[];
  payrollRecords: StaffPayrollRecord[];
  selectedMonth: string;
  onChangeMonth: (monthStr: string) => void;
  onSaveAttendance: (records: StaffAttendanceRecord | StaffAttendanceRecord[]) => Promise<boolean>;
}

const STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; pill: string }
> = {
  present: {
    label: 'Present',
    short: 'P',
    pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  half_day: {
    label: 'Half-Day',
    short: 'H',
    pill: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  absent: {
    label: 'Absent',
    short: 'A',
    pill: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  paid_leave: {
    label: 'Paid Leave',
    short: 'L',
    pill: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  week_off: {
    label: 'Week-Off',
    short: 'W',
    pill: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  },
};

const STATUS_ORDER: AttendanceStatus[] = ['present', 'half_day', 'absent', 'week_off', 'paid_leave'];

export const AttendanceMusterTab: React.FC<AttendanceMusterTabProps> = ({
  staff,
  attendance,
  payrollRecords,
  selectedMonth,
  onChangeMonth,
  onSaveAttendance,
}) => {
  const [viewMode, setViewMode] = useState<'daily' | 'grid'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(() => localDateString());
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeStaff = useMemo(
    () => staff.filter((s) => s.status !== 'inactive'),
    [staff]
  );

  const attendanceMap = useMemo(() => {
    const map = new Map<string, StaffAttendanceRecord>();
    for (const rec of attendance) {
      map.set(`${rec.staffId}_${rec.dateStr}`, rec);
    }
    return map;
  }, [attendance]);

  const paidMonthStaffIds = useMemo(() => {
    const targetMonth = viewMode === 'daily' ? selectedDate.slice(0, 7) : selectedMonth;
    return new Set(
      payrollRecords
        .filter((p) => p.monthStr === targetMonth && p.status === 'paid')
        .map((p) => p.staffId)
    );
  }, [payrollRecords, viewMode, selectedDate, selectedMonth]);

  const handleMarkStatus = async (
    member: StaffMember,
    dateStr: string,
    status: AttendanceStatus,
    extra?: Partial<StaffAttendanceRecord>
  ) => {
    const existing = attendanceMap.get(`${member.id}_${dateStr}`);
    setSaving(true);
    await onSaveAttendance({
      id: `${member.id}_${dateStr}`,
      staffId: member.id,
      dateStr,
      status,
      checkIn: extra?.checkIn !== undefined ? extra.checkIn : existing?.checkIn || '',
      checkOut: extra?.checkOut !== undefined ? extra.checkOut : existing?.checkOut || '',
      overtimeHours:
        extra?.overtimeHours !== undefined ? extra.overtimeHours : existing?.overtimeHours || 0,
      notes: extra?.notes !== undefined ? extra.notes : existing?.notes || '',
      markedBy: 'Manager',
    });
    setSaving(false);
  };

  const handleMarkRemainingPresent = async () => {
    const toMark: StaffAttendanceRecord[] = [];
    for (const member of activeStaff) {
      if (paidMonthStaffIds.has(member.id)) continue;
      if (!attendanceMap.has(`${member.id}_${selectedDate}`)) {
        toMark.push({
          id: `${member.id}_${selectedDate}`,
          staffId: member.id,
          dateStr: selectedDate,
          status: 'present',
          overtimeHours: 0,
          markedBy: 'Manager',
        });
      }
    }
    if (toMark.length === 0) return;
    setSaving(true);
    await onSaveAttendance(toMark);
    setSaving(false);
  };

  const monthDates = useMemo(() => monthDatesList(selectedMonth), [selectedMonth]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 ${
                viewMode === 'daily' ? 'bg-gold-500 text-black' : 'text-stone-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Daily Muster Roll</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 ${
                viewMode === 'grid' ? 'bg-gold-500 text-black' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Monthly Matrix</span>
            </button>
          </div>

          {viewMode === 'daily' ? (
            <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-gold-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const next = e.target.value;
                  setSelectedDate(next);
                  if (next && next.slice(0, 7) !== selectedMonth) {
                    onChangeMonth(next.slice(0, 7));
                  }
                }}
                className="bg-transparent text-xs text-white focus:outline-none"
              />
            </div>
          ) : (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => onChangeMonth(e.target.value)}
              className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-gold-400"
            />
          )}
        </div>

        {viewMode === 'daily' && (
          <button
            type="button"
            disabled={saving || activeStaff.length === 0}
            onClick={handleMarkRemainingPresent}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark All Unmarked Present</span>
          </button>
        )}
      </div>

      {activeStaff.length === 0 ? (
        <div className="bg-stone-950/60 border border-stone-800 rounded-2xl p-8 text-center text-stone-400 text-sm">
          Add staff members in the <strong>Directory</strong> tab first to record daily attendance.
        </div>
      ) : viewMode === 'daily' ? (
        <div className="space-y-2.5">
          {activeStaff.map((member) => {
            const rec = attendanceMap.get(`${member.id}_${selectedDate}`);
            const isLocked = paidMonthStaffIds.has(member.id);
            const isExpanded = expandedStaffId === member.id;

            return (
              <div
                key={member.id}
                className="bg-stone-950/70 border border-stone-800 rounded-2xl p-3.5 space-y-2.5"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{member.name}</span>
                      <span className="text-[11px] text-gold-300">{member.role}</span>
                      {isLocked && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Payroll Paid
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-stone-400 flex items-center gap-3 mt-0.5">
                      <span>Shift: {member.shift.replace('_', ' ')}</span>
                      {rec?.checkIn && <span>In: {rec.checkIn}</span>}
                      {rec?.checkOut && <span>Out: {rec.checkOut}</span>}
                      {(rec?.overtimeHours || 0) > 0 && (
                        <span className="text-amber-300 font-semibold">OT: {rec?.overtimeHours}h</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {STATUS_ORDER.map((st) => {
                      const meta = STATUS_META[st];
                      const active = rec?.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          disabled={isLocked || saving}
                          onClick={() => handleMarkStatus(member, selectedDate, st)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-40 ${
                            active
                              ? meta.pill
                              : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-white'
                          }`}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setExpandedStaffId(isExpanded ? null : member.id)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] bg-stone-900 border border-stone-800 text-stone-300 hover:text-white flex items-center gap-1 disabled:opacity-40"
                      title="Time & Overtime details"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Time/OT</span>
                    </button>
                  </div>
                </div>

                {isExpanded && !isLocked && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-stone-800 text-xs">
                    <div>
                      <label className="block text-[10px] text-stone-400 mb-1">Check-In</label>
                      <input
                        type="time"
                        defaultValue={rec?.checkIn || ''}
                        onBlur={(e) =>
                          handleMarkStatus(member, selectedDate, rec?.status || 'present', {
                            checkIn: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1.5 bg-stone-900 border border-stone-800 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-400 mb-1">Check-Out</label>
                      <input
                        type="time"
                        defaultValue={rec?.checkOut || ''}
                        onBlur={(e) =>
                          handleMarkStatus(member, selectedDate, rec?.status || 'present', {
                            checkOut: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1.5 bg-stone-900 border border-stone-800 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-400 mb-1">Overtime (hrs)</label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        defaultValue={rec?.overtimeHours ?? 0}
                        onBlur={(e) =>
                          handleMarkStatus(member, selectedDate, rec?.status || 'present', {
                            overtimeHours: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2 py-1.5 bg-stone-900 border border-stone-800 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-400 mb-1">Notes</label>
                      <input
                        type="text"
                        defaultValue={rec?.notes || ''}
                        placeholder="Optional remark"
                        onBlur={(e) =>
                          handleMarkStatus(member, selectedDate, rec?.status || 'present', {
                            notes: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1.5 bg-stone-900 border border-stone-800 rounded-lg text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-stone-950/70 border border-stone-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-stone-800 text-stone-400">
                <th className="text-left p-2.5 sticky left-0 bg-stone-950 z-10 min-w-[140px]">Staff</th>
                {monthDates.map((d) => (
                  <th key={d} className="p-1.5 text-center font-mono min-w-[28px]">
                    {d.slice(-2)}
                  </th>
                ))}
                <th className="p-2 text-right min-w-[70px]">P/H/A</th>
              </tr>
            </thead>
            <tbody>
              {activeStaff.map((member) => {
                const isLocked = paidMonthStaffIds.has(member.id);
                let p = 0;
                let h = 0;
                let a = 0;
                return (
                  <tr key={member.id} className="border-b border-stone-900 hover:bg-stone-900/40">
                    <td className="p-2.5 font-semibold text-white sticky left-0 bg-stone-950 z-10">
                      {member.name}
                    </td>
                    {monthDates.map((d) => {
                      const rec = attendanceMap.get(`${member.id}_${d}`);
                      if (rec?.status === 'present' || rec?.status === 'paid_leave' || rec?.status === 'week_off') p++;
                      else if (rec?.status === 'half_day') h++;
                      else if (rec?.status === 'absent') a++;

                      const meta = rec ? STATUS_META[rec.status] : null;
                      return (
                        <td key={d} className="p-1 text-center">
                          <button
                            type="button"
                            disabled={isLocked || saving}
                            onClick={() => {
                              const currIdx = rec ? STATUS_ORDER.indexOf(rec.status) : -1;
                              const nextStatus = STATUS_ORDER[(currIdx + 1) % STATUS_ORDER.length];
                              handleMarkStatus(member, d, nextStatus);
                            }}
                            title={`${member.name} • ${d}: ${meta ? meta.label : 'Unmarked (click to cycle)'}`}
                            className={`w-6 h-6 rounded text-[10px] font-bold border ${
                              meta
                                ? meta.pill
                                : 'bg-stone-900/60 border-stone-800 text-stone-600 hover:border-stone-600'
                            }`}
                          >
                            {meta ? meta.short : '·'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-2 text-right font-mono text-stone-300">
                      <span className="text-emerald-400">{p}</span>/
                      <span className="text-amber-300">{h}</span>/
                      <span className="text-rose-400">{a}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
