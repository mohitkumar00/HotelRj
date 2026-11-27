-- =============================================================================
-- Migration: 20261126_staff_payroll.sql
-- Hotel RJ — Staff Directory, Daily Attendance, Advances (Kharchi) & Payroll
-- Prerequisite: supabase/migrations/20261106a_device_pairing_tables.sql
-- =============================================================================

-- Ensure expenses.title exists so linked Staff Advance / Salary payouts sync cleanly
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS title TEXT;

-- 1. STAFF DIRECTORY ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  emergency_contact TEXT,
  role TEXT NOT NULL DEFAULT 'Waiter',
  department TEXT NOT NULL DEFAULT 'restaurant',
  shift TEXT NOT NULL DEFAULT 'full_day',
  pay_type TEXT NOT NULL DEFAULT 'monthly',
  base_salary NUMERIC(10, 2) NOT NULL DEFAULT 0,
  overtime_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  id_proof_note TEXT,
  show_in_pos BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_members_status ON staff_members(status);
CREATE INDEX IF NOT EXISTS idx_staff_members_dept ON staff_members(department);

-- 2. DAILY ATTENDANCE MUSTER ROLL ---------------------------------------------
CREATE TABLE IF NOT EXISTS staff_attendance (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  date_str TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  check_in TEXT,
  check_out TEXT,
  overtime_hours NUMERIC(5, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  marked_by TEXT DEFAULT 'Manager',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, date_str)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date_str);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(staff_id, date_str);

-- 3. STAFF ADVANCES (KHARCHI), DEDUCTIONS & BONUSES ---------------------------
CREATE TABLE IF NOT EXISTS staff_advances (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  date_str TEXT NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'advance',
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  notes TEXT,
  linked_expense_id TEXT,
  recorded_by TEXT DEFAULT 'Manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_advances_staff_date ON staff_advances(staff_id, date_str);

-- 4. MONTHLY PAYROLL SNAPSHOTS ------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_payroll (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  month_str TEXT NOT NULL,
  pay_type TEXT NOT NULL DEFAULT 'monthly',
  base_salary NUMERIC(10, 2) NOT NULL DEFAULT 0,
  days_in_month INTEGER NOT NULL DEFAULT 30,
  present_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  half_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  paid_leaves_and_offs NUMERIC(5, 1) NOT NULL DEFAULT 0,
  absent_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  earned_base_pay NUMERIC(10, 2) NOT NULL DEFAULT 0,
  overtime_pay NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bonuses NUMERIC(10, 2) NOT NULL DEFAULT 0,
  advances_deducted NUMERIC(10, 2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(10, 2) NOT NULL DEFAULT 0,
  net_payable NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  payment_mode TEXT,
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  linked_expense_id TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, month_str)
);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_month ON staff_payroll(month_str);

-- 5. ROW LEVEL SECURITY (Paired Devices Only; anon has zero access) -----------
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payroll ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff_members','staff_attendance','staff_advances','staff_payroll']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "paired devices full access" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "paired devices full access" ON %I FOR ALL TO authenticated USING (public.is_paired_device()) WITH CHECK (public.is_paired_device())',
      t
    );
  END LOOP;
END $$;
