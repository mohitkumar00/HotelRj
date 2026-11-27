import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarCheck,
  IndianRupee,
  Lock,
  RefreshCw,
  Unlock,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  StaffAdvanceRecord,
  StaffAttendanceRecord,
  StaffMember,
  StaffPayrollRecord,
} from '../../types/staff';
import { localMonthString } from '../../utils/dates';
import { formatLock, verifyManagerPin } from '../../utils/pin';
import {
  deleteAdvanceApi,
  deleteStaffApi,
  fetchAdvancesApi,
  fetchAttendanceApi,
  fetchPayrollApi,
  fetchStaffApi,
  saveAdvanceApi,
  saveAttendanceApi,
  saveStaffApi,
  settlePayrollApi,
  unlockPayrollApi,
} from '../../utils/staffApi';
import { StaffDirectoryTab } from './StaffDirectoryTab';
import { AttendanceMusterTab } from './AttendanceMusterTab';
import { AdvancesLedgerTab } from './AdvancesLedgerTab';
import { PayrollRunTab } from './PayrollRunTab';

export type StaffModalTab = 'attendance' | 'directory' | 'advances' | 'payroll';

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: StaffModalTab;
  skipPinGate?: boolean;
  onDataChanged?: () => void;
}

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'attendance',
  skipPinGate = false,
  onDataChanged,
}) => {
  const [activeTab, setActiveTab] = useState<StaffModalTab>(initialTab);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => localMonthString());
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return skipPinGate || sessionStorage.getItem('hotel_rj_owner_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendanceRecord[]>([]);
  const [advances, setAdvances] = useState<StaffAdvanceRecord[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<StaffPayrollRecord[]>([]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (skipPinGate || sessionStorage.getItem('hotel_rj_owner_auth') === 'true') {
        setIsUnlocked(true);
      }
    }
  }, [isOpen, initialTab, skipPinGate]);

  const notify = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 3000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [staffList, attList, advList, payList] = await Promise.all([
        fetchStaffApi(),
        fetchAttendanceApi({ monthStr: selectedMonth }),
        fetchAdvancesApi({ monthStr: selectedMonth }),
        fetchPayrollApi(selectedMonth),
      ]);
      setStaff(staffList);
      setAttendance(attList);
      setAdvances(advList);
      setPayrollRecords(payList);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (isOpen && isUnlocked) {
      loadAll();
    }
  }, [isOpen, isUnlocked, loadAll]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await verifyManagerPin(pinInput);
    if (res.ok) {
      sessionStorage.setItem('hotel_rj_owner_auth', 'true');
      setIsUnlocked(true);
      setPinError(null);
      setPinInput('');
    } else if (res.reason === 'locked') {
      setPinError(`Too many attempts. Locked for ${formatLock(res.remainingMs || 0)}.`);
    } else {
      setPinError(`Incorrect Manager PIN (${res.attemptsLeft} attempts left).`);
    }
  };

  if (!isOpen) return null;

  const tabs: { id: StaffModalTab; label: string; icon: React.ReactNode }[] = [
    { id: 'attendance', label: 'Daily Attendance', icon: <CalendarCheck className="w-4 h-4" /> },
    { id: 'directory', label: 'Staff Directory', icon: <Users className="w-4 h-4" /> },
    { id: 'advances', label: 'Advances & Kharchi', icon: <Wallet className="w-4 h-4" /> },
    { id: 'payroll', label: 'Monthly Payroll', icon: <IndianRupee className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-6xl h-[92vh] bg-stone-900 border border-stone-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="px-5 py-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold font-serif text-gold-200 flex items-center gap-2">
              <Users className="w-5 h-5 text-gold-400" />
              <span>Staff, Attendance & Payroll</span>
            </h2>
            <p className="text-[11px] text-stone-400">
              Manager Muster Roll • Advances (Kharchi) • Monthly Salary & Payslips
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isUnlocked && (
              <button
                type="button"
                onClick={loadAll}
                disabled={loading}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300"
                title="Refresh staff data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gold-400' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {banner && (
          <div className="px-5 py-2 bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            {banner}
          </div>
        )}

        {!isUnlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400 mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Manager PIN Required</h3>
            <p className="text-xs text-stone-400 max-w-sm mb-5">
              Enter the Manager PIN to manage staff profiles, daily attendance, advances, and salaries.
            </p>
            <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-3">
              <input
                type="password"
                maxLength={6}
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(null);
                }}
                placeholder="Enter PIN"
                className="w-full text-center tracking-[0.5em] text-xl font-mono py-3 px-4 rounded-xl bg-stone-950 border border-stone-700 text-white focus:outline-none focus:border-gold-400"
              />
              {pinError && <p className="text-xs text-rose-400">{pinError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                <span>Unlock Staff & Payroll</span>
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="px-5 pt-3 bg-stone-950/60 border-b border-stone-800 flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all shrink-0 ${
                    activeTab === tab.id
                      ? 'border-gold-400 text-gold-300 bg-stone-900'
                      : 'border-transparent text-stone-400 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {activeTab === 'attendance' && (
                <AttendanceMusterTab
                  staff={staff}
                  attendance={attendance}
                  payrollRecords={payrollRecords}
                  selectedMonth={selectedMonth}
                  onChangeMonth={setSelectedMonth}
                  onSaveAttendance={async (payload) => {
                    const res = await saveAttendanceApi(payload);
                    if (!res.success) {
                      alert(res.error || 'Could not update attendance.');
                      return false;
                    }
                    await loadAll();
                    onDataChanged?.();
                    notify('Attendance updated');
                    return true;
                  }}
                />
              )}

              {activeTab === 'directory' && (
                <StaffDirectoryTab
                  staff={staff}
                  onSaveStaff={async (member) => {
                    const res = await saveStaffApi(member);
                    if (!res.success) {
                      alert(res.error || 'Could not save staff member.');
                      return false;
                    }
                    await loadAll();
                    onDataChanged?.();
                    notify('Staff profile saved');
                    return true;
                  }}
                  onDeleteStaff={async (member) => {
                    if (!window.confirm(`Remove "${member.name}" from staff directory?`)) return;
                    const res = await deleteStaffApi(member.id);
                    if (res.success) {
                      await loadAll();
                      onDataChanged?.();
                      notify(`Removed ${member.name}`);
                    }
                  }}
                />
              )}

              {activeTab === 'advances' && (
                <AdvancesLedgerTab
                  staff={staff}
                  attendance={attendance}
                  advances={advances}
                  selectedMonth={selectedMonth}
                  onChangeMonth={setSelectedMonth}
                  onSaveAdvance={async (entry, options) => {
                    const res = await saveAdvanceApi(entry, options);
                    if (!res.success) {
                      alert(res.error || 'Failed to save entry.');
                      return false;
                    }
                    await loadAll();
                    onDataChanged?.();
                    notify('Staff ledger entry saved');
                    return true;
                  }}
                  onDeleteAdvance={async (adv) => {
                    if (!window.confirm('Delete this ledger entry? Linked expense (if any) will also be reversed.')) {
                      return;
                    }
                    const res = await deleteAdvanceApi(adv, { deleteLinkedExpense: true });
                    if (res.success) {
                      await loadAll();
                      onDataChanged?.();
                      notify('Ledger entry deleted');
                    }
                  }}
                />
              )}

              {activeTab === 'payroll' && (
                <PayrollRunTab
                  staff={staff}
                  attendance={attendance}
                  advances={advances}
                  payrollRecords={payrollRecords}
                  selectedMonth={selectedMonth}
                  onChangeMonth={setSelectedMonth}
                  onSettlePayroll={async (record, options) => {
                    const res = await settlePayrollApi(record, options);
                    if (!res.success) {
                      alert(res.error || 'Could not settle payroll.');
                      return false;
                    }
                    await loadAll();
                    onDataChanged?.();
                    notify(`Settled payroll for ${options.staffName}`);
                    return true;
                  }}
                  onUnlockPayroll={async (payroll, options) => {
                    const res = await unlockPayrollApi(payroll, options);
                    if (!res.success) {
                      alert(res.error || 'Could not unlock payroll.');
                      return false;
                    }
                    await loadAll();
                    onDataChanged?.();
                    notify(`Unlocked ${payroll.monthStr} payroll`);
                    return true;
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
