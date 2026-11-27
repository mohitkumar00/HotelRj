# Hotel RJ — System Requirements & Technical Design Document (SRD)

**Version:** 2.0  
**Last Updated:** 2026-11-26  
**Scope:** Full Hotel RJ Hybrid Platform + Staff Management, Attendance & Payroll Architecture

---

## 1. System Architecture & Topology

Hotel RJ uses a **4-tier hybrid architecture** prioritizing zero-latency local operations on the restaurant LAN while maintaining eventual consistency with Supabase PostgreSQL for remote Owner Insights and the public Digital QR Menu.

```
[Public Guest Browser] ──HTTPS REST (anon: menu_items SELECT only)──> [Supabase Cloud]
                                                                            ▲
[Waiter Android APK / Mobile Browser]                                       │ 60s 2-Way Sync
   │                                                                        │ (DPAPI session)
   ├──LAN Wi-Fi HTTP :5050 (X-Sync-Token)──> [Counter PC Electron] ─────────┘
   │                                            ├── electron/main.cjs (IPC)
   └──4G/5G Fallback HTTPS──────────────────>   ├── electron/syncServer.cjs (:5050)
                                                ├── electron/database.cjs (JSON + .backup)
                                                └── electron/cloudSync.cjs (pull -> push)
```

### Key Runtime Components
- **Frontend Entry (`src/App.tsx`):** Routes based on `Capacitor.isNativePlatform()`, `window.ElectronAPI?.isElectron`, `?mode=pos`, and `?view=menu`. Lazy-loads `WaiterPOS` and `DigitalMenuPage`.
- **Transport Abstraction (`src/utils/syncBase.ts`, `src/utils/syncAuth.ts`):**
  - `getApiBaseUrl()` resolves Counter PC LAN URL (`STORAGE_KEYS.syncUrl` -> `:5050` same-origin -> `127.0.0.1:5050` on HTTP).
  - `installSyncAuth()` in `src/main.tsx` intercepts `fetch` to inject `X-Sync-Token` on `:5050` / `/api/*` requests.
- **API Routing Order (`src/utils/*Api.ts`):**
  1. `window.ElectronAPI` (Electron IPC on Counter PC)
  2. Counter LAN HTTP `:5050` (Waiter Android / LAN browser)
  3. Supabase REST API (Remote Owner on 4G/5G or fallback)
  4. `localStorage` cache / bundled defaults

---

## 2. Security & Authorization Model

1. **Device Pairing (`src/utils/deviceAuth.ts`):**
   - Staff never log in with personal accounts.
   - Owner pairs each trusted device once via a shared Supabase pairing account (`pairWithCode` or `verifyPairingOtp`).
   - Session `session_id` is registered in `paired_devices`; Electron stores tokens using Windows DPAPI (`safeStorage` in `electron/cloudSync.cjs`) and owns refresh-token rotation.
   - Supabase RLS enforces `public.is_paired_device()` for all operational tables; `anon` is restricted to `SELECT` on `menu_items` after running `supabase/migrations/20261106b_lockdown_rls.sql`.
2. **LAN Sync Token (`electron/syncServer.cjs`):**
   - Counter PC generates an 8-character pairing token (`hotel-rj-sync-token.txt`).
   - Requests to `/api/*` (except `/api/status` and loopback without web `Origin`) require `X-Sync-Token`. 10 invalid attempts trigger a 5-minute IP lockout (`429`).
3. **Manager PIN (`src/utils/pin.ts`):**
   - Salted PBKDF2-SHA256 (`150,000` iterations), stored in `app_settings` (`key = 'manager_pin'`), Counter PC JSON DB, and `localStorage` (`STORAGE_KEYS.pinHash`).
   - Exponential lockout after 5 failed attempts (`MAX_FAILURES = 5`).
   - Legacy PINs (`1234`, `8888`) are accepted only until the first PIN is configured.
   - **Staff & Payroll Access:** Gated by `verifyManagerPin()`. Architecture allows introducing a separate `owner_pin` key in `app_settings` later without altering staff/payroll tables.

---

## 3. Database Schema (Existing + New Staff & Payroll Tables)

### 3.1 Existing Tables (`supabase_schema.sql` & `supabase/migrations/`)
- `bills` — Settled and cancelled invoices (`restaurant | rooms | banquet`), JSONB `items`, `payment_method`, `payment_details`.
- `audit_logs` — Anti-theft trail (`ITEM_VOID`, `BILL_CANCEL`, `KITCHEN_86`, `KOT_CANCEL`, `MANUAL_DISCOUNT`, `TABLE_RESET`).
- `expenses` — Daily petty cash / kharcha (`id`, `title`, `category`, `amount`, `paid_by`, `notes`, `recorded_by`, `date_str`).
- `menu_items` — Dishes, pricing, dietary, and `is_available` (Kitchen 86).
- `rooms` — Room inventory, occupancy (`available | occupied | dirty | maintenance`), guest info, `folio_amount`.
- `tables_config` — Dining, parcel, lawn, and banquet outlets.
- `banquet_bookings` — Event calendar bookings with slot/venue conflict prevention.
- `paired_devices` — Approved device sessions (`session_id`, `label`, `revoked`).
- `app_settings` — JSONB key/value store (`manager_pin`).

### 3.2 New Tables for Staff, Attendance & Payroll (Migration `20261126_staff_payroll.sql`)

```sql
-- 1. STAFF DIRECTORY
CREATE TABLE IF NOT EXISTS staff_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  emergency_contact TEXT,
  role TEXT NOT NULL DEFAULT 'Waiter',          -- Waiter | Captain | Chef / Kitchen | Housekeeping | Front Desk | Banquet Helper | Security / Maintenance | Manager
  department TEXT NOT NULL DEFAULT 'restaurant',-- restaurant | rooms | banquet | general
  shift TEXT NOT NULL DEFAULT 'full_day',       -- morning | evening | full_day | night
  pay_type TEXT NOT NULL DEFAULT 'monthly',     -- monthly | daily
  base_salary NUMERIC(10, 2) NOT NULL DEFAULT 0,
  overtime_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  join_date DATE NOT NULL,
  id_proof_note TEXT,                           -- Masked KYC reference only (no raw Aadhaar)
  show_in_pos BOOLEAN NOT NULL DEFAULT true,    -- Surface in WaiterPOS server quick-pick
  status TEXT NOT NULL DEFAULT 'active',        -- active | on_leave | inactive
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_members_status ON staff_members(status);
CREATE INDEX IF NOT EXISTS idx_staff_members_dept ON staff_members(department);

-- 2. DAILY ATTENDANCE MUSTER ROLL
CREATE TABLE IF NOT EXISTS staff_attendance (
  id TEXT PRIMARY KEY,                          -- Deterministic: `${staff_id}_${date_str}`
  staff_id TEXT NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  date_str TEXT NOT NULL,                       -- Local YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'present',       -- present | half_day | absent | paid_leave | week_off
  check_in TEXT,                                -- Optional HH:mm
  check_out TEXT,                               -- Optional HH:mm
  overtime_hours NUMERIC(5, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  marked_by TEXT DEFAULT 'Manager',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, date_str)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date_str);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(staff_id, date_str);

-- 3. STAFF ADVANCES (KHARCHI), DEDUCTIONS & BONUSES
CREATE TABLE IF NOT EXISTS staff_advances (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  date_str TEXT NOT NULL,                       -- Local YYYY-MM-DD
  entry_type TEXT NOT NULL DEFAULT 'advance',   -- advance | deduction | bonus
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',    -- Cash | UPI | Bank Transfer | Adjustment
  notes TEXT,
  linked_expense_id TEXT,                       -- Optional FK-by-ID to expenses.id
  recorded_by TEXT DEFAULT 'Manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_advances_staff_date ON staff_advances(staff_id, date_str);

-- 4. MONTHLY PAYROLL SNAPSHOTS
CREATE TABLE IF NOT EXISTS staff_payroll (
  id TEXT PRIMARY KEY,                          -- Deterministic: `${staff_id}_${month_str}`
  staff_id TEXT NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  month_str TEXT NOT NULL,                      -- YYYY-MM
  pay_type TEXT NOT NULL,                       -- Snapshot of monthly | daily
  base_salary NUMERIC(10, 2) NOT NULL DEFAULT 0,
  days_in_month INTEGER NOT NULL,
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
  status TEXT NOT NULL DEFAULT 'draft',         -- draft | paid
  payment_mode TEXT,                            -- Cash | UPI | Bank Transfer
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  linked_expense_id TEXT,                       -- Optional link to expenses.id
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, month_str)
);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_month ON staff_payroll(month_str);

-- 5. ROW LEVEL SECURITY (Strict Paired-Device Lockdown)
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
```

---

## 4. Local Database & 2-Way Sync Specification

### 4.1 Electron JSON DB (`electron/database.cjs`)
Extend `this.data` defaults and `load()` parser with:
- `staffMembers: []`
- `staffAttendance: []`
- `staffAdvances: []`
- `staffPayroll: []`

Deletion tracking uses existing `recordPendingDeletion(table, id)`, `isPendingDeletion(table, id)`, and `removePendingDeletion(table, id)` for `staff_members`, `staff_attendance`, `staff_advances`, and `staff_payroll`.

### 4.2 Cloud Sync (`electron/cloudSync.cjs`)
- **`pullFromCloud()`:** Pulls `staff_members`, `staff_attendance` (last 120 days or current/previous year), `staff_advances`, and `staff_payroll`. Merges using `updated_at` / `isLocalNew` / `pendingDeletions` rules consistent with `rooms` and `banquet_bookings`.
  - **Conflict rule for `staff_attendance`:** Deterministic ID `${staffId}_${dateStr}`; newest `updated_at` wins, except if a `staff_payroll` record for `(staff_id, month_str)` is `status === 'paid'`, the paid payroll snapshot remains authoritative until explicitly unlocked.
- **`pushToCloud()`:** Processes pending deletions first, then batch-upserts (`Prefer: resolution=merge-duplicates`) all four staff tables using exact snake_case SQL column names.

### 4.3 Local Date Handling (IST Safety)
- All attendance `date_str` (`YYYY-MM-DD`) and default month filters (`YYYY-MM`) **must** use local time (`localDateString()` in `src/utils/dates.ts` and local `Date` getters in `electron/database.cjs`), never `new Date().toISOString().split('T')[0]`, to avoid off-by-one date bugs after 18:30 UTC (midnight IST).

---

## 5. Payroll & Expense Integration Logic

### 5.1 Deterministic Payroll Calculation (`src/utils/payroll.ts`)
Shared pure TypeScript module (unit-tested with Vitest) and mirrored in `electron/database.cjs`:
1. Compute `daysInMonth = new Date(year, monthIndex + 1, 0).getDate()`.
2. Filter `staff_attendance` where `staffId === member.id && dateStr.startsWith(monthStr)`.
3. Count:
   - `presentDays`: `status === 'present'`
   - `halfDays`: `status === 'half_day'`
   - `paidLeavesAndOffs`: `status === 'paid_leave' || status === 'week_off'`
   - `absentDays`: `status === 'absent'`
   - `overtimeHours`: sum of `overtimeHours`
4. Compute `paidDayUnits = presentDays + paidLeavesAndOffs + halfDays * 0.5`.
5. Compute `dailyRate = member.payType === 'daily' ? member.baseSalary : member.baseSalary / daysInMonth`.
6. `earnedBasePay = Math.round(paidDayUnits * dailyRate)`.
7. `overtimePay = Math.round(overtimeHours * (member.overtimeRate || 0))`.
8. Filter `staff_advances` where `staffId === member.id && dateStr.startsWith(monthStr)`:
   - `bonuses = sum(entryType === 'bonus')`
   - `advancesDeducted = sum(entryType === 'advance')`
   - `otherDeductions = sum(entryType === 'deduction')`
9. `netPayable = Math.round(earnedBasePay + overtimePay + bonuses - advancesDeducted - otherDeductions)`.

### 5.2 Over-Advance Guard
When adding an advance in month `YYYY-MM`, compute `earnedToDate` using attendance from day 1 through `today` minus existing advances in `YYYY-MM`. If `newAdvance > earnedToDate - existingAdvances`, display a clear warning badge (`Exceeds earned salary to date by ₹X`) while still allowing Manager override.

### 5.3 Linked Expense Synchronization
- When `recordInExpenses === true` (UI checkbox **checked by default** for `advance`, `bonus` cash payouts, and `staff_payroll` settlement):
  - Create an `expenses` entry (`category: 'Staff Advance' | 'Staff Bonus' | 'Staff Salary'`, `title: '${staffName} - ${label}'`, `amount`, `paidBy`, `dateStr`, `recordedBy`).
  - Store its ID in `linked_expense_id`.
- When an advance is deleted or a paid payroll record is unlocked/reversed:
  - If `linked_expense_id` exists and user confirms expense reversal, delete the linked `expenses` record (and record pending deletion for cloud sync).

---

## 6. IPC, LAN HTTP & Client API Contracts

### 6.1 Electron IPC (`electron/main.cjs` & `electron/preload.cjs`)
- `get-staff` / `save-staff` / `delete-staff`
- `get-staff-attendance` (by `{ monthStr, dateStr }`) / `save-staff-attendance` (single or bulk array)
- `get-staff-advances` (by `{ monthStr, staffId }`) / `save-staff-advance` / `delete-staff-advance`
- `get-staff-payroll` (by `{ monthStr }`) / `settle-staff-payroll` / `unlock-staff-payroll`

### 6.2 Counter LAN Sync Server (`electron/syncServer.cjs`, port `5050`, `X-Sync-Token` required)
- `GET /api/staff`, `POST /api/staff`, `POST /api/staff/delete`
- `GET /api/staff/attendance?month=YYYY-MM&date=YYYY-MM-DD`, `POST /api/staff/attendance`
- `GET /api/staff/advances?month=YYYY-MM`, `POST /api/staff/advances`, `POST /api/staff/advances/delete`
- `GET /api/staff/payroll?month=YYYY-MM`, `POST /api/staff/payroll/settle`, `POST /api/staff/payroll/unlock`

### 6.3 Frontend API Bridge (`src/utils/staffApi.ts`) & Types (`src/types/staff.ts`)
Follows the 3-tier routing pattern of `src/utils/banquetApi.ts` and `src/utils/hotelDataApi.ts` with `localStorage` offline fallback keys (`hotel_rj_staff_*`).

---

## 7. Audit Trail Events

New `audit_logs.type` values logged automatically:
- `STAFF_PAYROLL_PAID`: Logs staff name, month, net paid amount, and payment mode.
- `STAFF_PAYROLL_UNLOCKED`: Logs manager unlocking a settled month for corrections (with reason).
- `STAFF_ADVANCE_RECORDED` / `STAFF_ADVANCE_DELETED`: Logs advance/deduction mutations.
- `STAFF_ATTENDANCE_BACKDATED`: Logs edits to attendance older than 3 days.

---

## 8. Planned UI Components & Testing

### 8.1 UI Components
- `src/components/staff/StaffManagementModal.tsx` (or tabbed container opened from `OwnerInsights` & `HotelOperationsModal`) with 4 focused sub-views:
  1. `StaffDirectoryTab.tsx` — Add/edit staff modal, role/department filters, POS alias toggle.
  2. `AttendanceMusterTab.tsx` — Daily muster roll (bulk "Mark Remaining Present", check-in/out/OT) + Monthly matrix grid.
  3. `AdvancesLedgerTab.tsx` — Kharchi/deduction/bonus entry with earned-to-date warning & "Record in Daily Expenses" toggle.
  4. `PayrollRunTab.tsx` — Monthly payroll table, settle flow, unlock flow, 58mm thermal slip (`thermalPrinter.ts`), and WhatsApp share helper.
- `src/components/WaiterPOS.tsx` — Upgrade the inline server name editor to offer quick-pick pills/dropdown of active POS staff alongside custom text entry.

### 8.2 Verification & Test Plan
- **Vitest (`src/utils/payroll.test.ts`):**
  - Actual-days-in-month proration across 28, 29 (leap), 30, and 31-day months.
  - Paid `week_off` and `paid_leave`, `0.5` `half_day`, `0` `absent`, and daily-wage calculation.
  - Overtime, bonuses, advances, deductions, and negative/zero net-payable clamping/display.
  - Over-advance warning threshold calculation.
  - Local date formatting boundaries (late-night IST).
- **Typecheck & Build:** `npm run typecheck && npm run lint && npm test && npm run build`.

---

## 9. Room Check-In, Custom/Short-Stay & Checkout Billing Design

### 9.1 Database Schema (`supabase/migrations/20261127_room_stays.sql`)
```sql
CREATE TABLE IF NOT EXISTS room_stays (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  room_name TEXT NOT NULL,
  stay_type TEXT NOT NULL DEFAULT 'nightly',    -- nightly | short_stay
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  num_guests INTEGER NOT NULL DEFAULT 1,
  id_proof_note TEXT,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_date TEXT NOT NULL,                  -- Local YYYY-MM-DD
  expected_check_out_date TEXT,
  check_out_at TIMESTAMPTZ,
  check_out_date TEXT,
  nightly_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  nights INTEGER NOT NULL DEFAULT 1,
  custom_stay_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  extra_charges JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ id, label, amount }]
  advance_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  advance_payment_mode TEXT DEFAULT 'Cash',     -- Cash | UPI | Card
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0, -- 0 by default
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',        -- active | checked_out | cancelled
  bill_id TEXT,
  notes TEXT,
  created_by TEXT DEFAULT 'Manager',
  settled_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_stays_room_status ON room_stays(room_id, status);
CREATE INDEX IF NOT EXISTS idx_room_stays_check_in_date ON room_stays(check_in_date);

ALTER TABLE room_stays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "paired devices full access" ON room_stays;
CREATE POLICY "paired devices full access" ON room_stays
  FOR ALL TO authenticated
  USING (public.is_paired_device())
  WITH CHECK (public.is_paired_device());
```

### 9.2 Stay Calculation & Checkout Settlement Rules
1. **Nights Calculation (`src/utils/roomBilling.ts`):**
   - For `stayType === 'nightly'`: `nights = Math.max(1, diffCalendarDays(checkInDate, checkOutDate))`, editable by manager. `roomCharge = nights * nightlyRate`.
   - For `stayType === 'short_stay'`: `roomCharge = customStayPrice` (e.g., 2–3 hour custom tariff).
2. **Checkout Totals:**
   - `extrasTotal = sum(extraCharges.map(c => c.amount))`
   - `subtotal = roomCharge + extrasTotal`
   - `taxable = Math.max(0, subtotal - discount)`
   - `taxAmount = gstPercent > 0 ? Math.round(taxable * gstPercent) / 100 : 0` (default `gstPercent = 0`)
   - `totalAmount = Math.round(taxable + taxAmount)`
   - `balanceDue = Math.max(0, totalAmount - advancePaid)`
3. **Payment Split Combination at Checkout:**
   - Full stay revenue (`totalAmount`) is recorded as a single `bills` row with `department: 'rooms'`, `orderType: 'room-stay'`, `tableId: roomId`, `roomNumber: roomId`.
   - When `advancePaid > 0`, payment method totals combine `advancePaid` (under `advancePaymentMode`) and `balanceDue` (under the checkout payment mode/split), automatically setting `paymentMethod = 'split'` with `paymentDetails: { cashAmount, upiAmount, cardAmount }` whenever two different modes are involved so `OwnerInsights` cash/UPI/card totals stay exact.
4. **Post-Checkout State Transition:**
   - Marks `room_stays.status = 'checked_out'`, sets `billId`, `checkOutAt`, `checkOutDate`.
   - Updates `rooms` record to `status: 'dirty'`, clears `guestName`, `checkInDate`, `checkOutDate`, `folioAmount = 0`, `notes = ''`.

### 9.3 Electron IPC, LAN `:5050` & Cloud Sync
- **Electron DB (`electron/database.cjs`):** `roomStays: []` collection + `getRoomStays`, `checkInRoomStay`, `saveRoomStay`, `checkoutRoomStay` (atomically saves `bills` entry, updates `room_stays`, sets `rooms` to `'dirty'`, and records audit log `ROOM_CHECKOUT` / `ROOM_CHECKIN`), `cancelRoomStay`.
- **Cloud Sync (`electron/cloudSync.cjs`):** 2-way pull/push for `room_stays` via `_pullMergeCollection` / `_pushCollection`.
- **LAN API (`electron/syncServer.cjs`):** `GET /api/room-stays`, `POST /api/room-stays/check-in`, `POST /api/room-stays/save`, `POST /api/room-stays/checkout`, `POST /api/room-stays/cancel`.
- **Frontend API (`src/utils/roomStayApi.ts`):** 4-tier routing (Electron IPC -> LAN `:5050` -> Supabase REST -> `localStorage`).
