import React, { useMemo, useState } from 'react';
import { Edit2, Phone, Plus, Search, Trash2, UserCheck, X } from 'lucide-react';
import {
  StaffDepartment,
  StaffMember,
  StaffPayType,
  StaffRole,
  StaffShift,
  StaffStatus,
} from '../../types/staff';
import { localDateString } from '../../utils/dates';

interface StaffDirectoryTabProps {
  staff: StaffMember[];
  onSaveStaff: (member: Partial<StaffMember>) => Promise<boolean>;
  onDeleteStaff: (staff: StaffMember) => Promise<void>;
}

const ROLES: StaffRole[] = [
  'Waiter',
  'Captain',
  'Chef / Kitchen',
  'Housekeeping',
  'Front Desk',
  'Banquet Helper',
  'Security / Maintenance',
  'Manager',
];

const DEPARTMENTS: { id: StaffDepartment; label: string }[] = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'banquet', label: 'Banquet' },
  { id: 'general', label: 'General' },
];

const SHIFTS: { id: StaffShift; label: string }[] = [
  { id: 'full_day', label: 'Full Day' },
  { id: 'morning', label: 'Morning' },
  { id: 'evening', label: 'Evening' },
  { id: 'night', label: 'Night' },
];

export const StaffDirectoryTab: React.FC<StaffDirectoryTabProps> = ({
  staff,
  onSaveStaff,
  onDeleteStaff,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | 'all'>('active');
  const [deptFilter, setDeptFilter] = useState<StaffDepartment | 'all'>('all');
  const [editing, setEditing] = useState<Partial<StaffMember> | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (deptFilter !== 'all' && s.department !== deptFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.role.toLowerCase().includes(q) && !s.phone.includes(q)) {
        return false;
      }
      return true;
    });
  }, [staff, search, statusFilter, deptFilter]);

  const openNew = () => {
    setEditing({
      name: '',
      phone: '',
      emergencyContact: '',
      role: 'Waiter',
      department: 'restaurant',
      shift: 'full_day',
      payType: 'monthly',
      baseSalary: 12000,
      overtimeRate: 0,
      joinDate: localDateString(),
      idProofNote: '',
      showInPos: true,
      status: 'active',
      notes: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name?.trim()) return;
    setSaving(true);
    const ok = await onSaveStaff(editing);
    setSaving(false);
    if (ok) setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role, phone..."
              className="w-full pl-9 pr-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-gold-400"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value as StaffDepartment | 'all')}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-gold-400"
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StaffStatus | 'all')}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-gold-400"
          >
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive / Exited</option>
            <option value="all">All Statuses</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-stone-950/60 border border-stone-800 rounded-2xl p-8 text-center text-stone-400 text-sm">
          No staff members match the current filter. Click <strong>Add Staff Member</strong> to build your team roster.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bg-stone-950/70 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-white text-sm">{s.name}</h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        s.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : s.status === 'on_leave'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-stone-800 text-stone-400 border border-stone-700'
                      }`}
                    >
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gold-300 font-medium mt-0.5">
                    {s.role} • {s.department.toUpperCase()}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300"
                    title="Edit staff member"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteStaff(s)}
                    className="p-1.5 rounded-lg bg-stone-900 hover:bg-rose-500/20 text-stone-400 hover:text-rose-400"
                    title="Delete staff member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-xs text-stone-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-stone-500" />
                    {s.phone || 'No phone'}
                  </span>
                  <span className="text-stone-300 font-semibold">
                    ₹{s.baseSalary.toLocaleString('en-IN')}/{s.payType === 'daily' ? 'day' : 'mo'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Shift: {s.shift.replace('_', ' ')}</span>
                  {s.showInPos && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <UserCheck className="w-3 h-3" /> POS Quick-Pick
                    </span>
                  )}
                </div>
                {s.idProofNote && (
                  <p className="text-[11px] text-stone-500 truncate">KYC: {s.idProofNote}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-xl bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-gold-200">
                {editing.id ? 'Edit Staff Member' : 'Add Staff Member'}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Full Name *</label>
                <input
                  required
                  type="text"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Phone Number *</label>
                <input
                  required
                  type="tel"
                  value={editing.phone || ''}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                  placeholder="10-digit mobile"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Role</label>
                <select
                  value={editing.role || 'Waiter'}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Department</label>
                <select
                  value={editing.department || 'restaurant'}
                  onChange={(e) => setEditing({ ...editing, department: e.target.value as StaffDepartment })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Pay Type</label>
                <select
                  value={editing.payType || 'monthly'}
                  onChange={(e) => setEditing({ ...editing, payType: e.target.value as StaffPayType })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                >
                  <option value="monthly">Monthly Fixed Salary</option>
                  <option value="daily">Daily Wage</option>
                </select>
              </div>
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">
                  {editing.payType === 'daily' ? 'Daily Wage (₹)' : 'Monthly Salary (₹)'}
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  value={editing.baseSalary ?? 0}
                  onChange={(e) => setEditing({ ...editing, baseSalary: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Overtime Rate (₹/hr)</label>
                <input
                  type="number"
                  min={0}
                  value={editing.overtimeRate ?? 0}
                  onChange={(e) => setEditing({ ...editing, overtimeRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                />
              </div>
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Shift</label>
                <select
                  value={editing.shift || 'full_day'}
                  onChange={(e) => setEditing({ ...editing, shift: e.target.value as StaffShift })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                >
                  {SHIFTS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Joining Date</label>
                <input
                  type="date"
                  value={editing.joinDate || localDateString()}
                  onChange={(e) => setEditing({ ...editing, joinDate: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                />
              </div>
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Status</label>
                <select
                  value={editing.status || 'active'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as StaffStatus })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                >
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive / Exited</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Emergency Contact</label>
                <input
                  type="tel"
                  value={editing.emergencyContact || ''}
                  onChange={(e) => setEditing({ ...editing, emergencyContact: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                  placeholder="Optional family contact"
                />
              </div>
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Masked ID / KYC Note</label>
                <input
                  type="text"
                  value={editing.idProofNote || ''}
                  onChange={(e) => setEditing({ ...editing, idProofNote: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white focus:outline-none focus:border-gold-400"
                  placeholder="e.g. Aadhaar last 4: 4321"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.showInPos !== false}
                onChange={(e) => setEditing({ ...editing, showInPos: e.target.checked })}
                className="rounded border-stone-700 accent-amber-500"
              />
              <span>Show in Waiter POS server quick-pick list</span>
            </label>

            <div>
              <label className="block text-xs text-stone-400 mb-1 font-semibold">Notes</label>
              <input
                type="text"
                value={editing.notes || ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-gold-400"
                placeholder="Optional manager remarks"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-bold text-xs disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Staff'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
