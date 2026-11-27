# Hotel RJ — Product Requirements Document (PRD)

**Version:** 2.0  
**Last Updated:** 2026-11-26  
**Product:** Hotel RJ (Website, Digital QR Menu, Windows Counter POS, Android Waiter POS & Owner Management Suite)

---

## 1. Product Vision & Overview

Hotel RJ is an integrated hospitality platform built for a multi-department hotel, restaurant, and banquet property. It unifies guest-facing discovery and QR ordering with an **offline-first** Counter POS (Windows), handheld Waiter POS (Android), and remote Owner Insights dashboard.

### Deployment Surfaces
1. **Public Hotel Website (`/`):** Showcase of rooms/suites, amenities, dining venues, neighborhood guide, guest reviews, and reservation request drawer (`src/App.tsx`).
2. **Digital QR Menu (`/?view=menu`):** Contactless mobile menu synced in real time with Kitchen 86 (sold-out) availability, dietary filters, dish photos, cart, and WhatsApp/PDF order sharing (`src/pages/DigitalMenuPage.tsx`).
3. **Counter POS (Windows Electron Desktop):** Primary register running local persistence (`hotel-rj-data.json`), a LAN Wi-Fi sync server (`:5050`), silent USB/Bluetooth thermal printing, and 2-way Supabase cloud sync.
4. **Waiter POS (Android Capacitor APK / LAN Browser / `?mode=pos`):** Fast table, parcel, room-service, and banquet order entry with incremental KOT printing, QR/deep-link LAN pairing (`hotelrj://`), and cellular Supabase fallback.

---

## 2. User Personas

| Persona | Primary Environment | Core Needs |
|---|---|---|
| **Hotel / Restaurant Guest** | Mobile browser (`?view=menu`, `/`) | Browse rooms and live menu with prices/availability; build a quick order summary. |
| **Waiter / Captain** | Android APK or LAN browser | Zero-login fast table selection, quick dish search, KOT firing, room-service entry without seeing sensitive revenue/payroll data. |
| **Counter Cashier / Manager** | Windows Counter POS (Electron) | Settle bills (Cash/UPI/Card/Split/Room Folio), print thermal KOTs/bills, manage Kitchen 86, room check-in/out, banquet calendar, daily expenses, and daily staff attendance/advances. |
| **Hotel Owner** | Remote browser (`?mode=pos` -> Owner Insights) or Counter PC | Track daily/monthly/yearly revenue and net profit by department, review anti-theft audit logs, manage rooms/menu/tables, pair/revoke devices, and oversee staff attendance & payroll. |

---

## 3. Existing Core Modules (Summary)

### 3.1 Restaurant & Banquet POS (`WaiterPOS`)
- Visual floor map grouped by **Dining**, **Takeaway/Parcel**, **Room Service**, and **Banquet** (`tables_config`).
- Live table status (`vacant`, `active`, `kot-fired`, `billed`) with high-watermark `mergeTables()` conflict resolution across concurrent devices.
- Incremental KOT printing (fires only unfired items), custom cooking charges/notes, item voiding (requires Manager PIN + reason), optional bill discounts, and bill cancellation with audit trail.
- Bluetooth SPP & Android `PrintManager` printing on Android; silent 58mm/80mm printing on Windows Electron.

### 3.2 Hotel Operations (`HotelOperationsModal`) & Rooms
- **Menu & Kitchen 86:** Add/edit/delete dishes, prices, dietary tags (`veg`, `non-veg`, `egg`), and real-time Sold-Out toggles reflected on the Digital QR Menu.
- **Rooms & Housekeeping:** Manage rooms (`available`, `occupied`, `dirty`, `maintenance`), guest check-in/out dates, and restaurant-to-room folio transfers.
- **Tables & Outlets:** Add, edit, sort, and activate/deactivate dining tables and parcel counters.

### 3.3 Banquet & Event Calendar (`BanquetCalendarModal`)
- Advance event bookings across `Banquet Hall 1 (AC)`, `Garden Lawn`, and `Combined / Full Property` with slot overlap conflict detection (`lunch`, `dinner`, `fullday`, `custom`), advance tracking, and WhatsApp confirmation generation.

### 3.4 Owner Insights & Anti-Theft (`OwnerInsights`)
- PIN-gated analytics for **Today / Yesterday / Last 7 Days / Month / Year / All Time** across **Restaurant / Rooms / Banquet**.
- Payment split (`Cash`, `UPI`, `Card`, `Room Folio`), petty cash expenses (`expenses`), Net Profit calculation (`Gross Revenue - Expenses`), and anti-theft logs (`ITEM_VOID`, `BILL_CANCEL`, `KITCHEN_86`).
- Excel CSV & JSON backup export, WhatsApp daily report share, device pairing (`PairDeviceModal`), and device revocation (`PairedDevicesPanel`).

---

## 4. New Feature PRD: Staff Management, Attendance & Payroll

### 4.1 Problem Statement
Currently, the Counter Manager and Owner track daily sales, petty cash expenses, and restaurant voids, but staff records, daily attendance, mid-month cash advances (*kharchi*), and monthly salary settlements are managed manually on paper registers. This creates friction during month-end payroll, leads to disputes over absences or advances, disconnects staff payouts from `OwnerInsights` net profit/cash drawer tracking, and leaves `serverName` in the POS as unvalidated free text.

### 4.2 Goals & Success Criteria
- **1-Minute Daily Attendance:** Manager can mark a full shift's attendance in under 60 seconds using bulk defaults and single-tap overrides.
- **Zero-Dispute Payroll:** Automatic, transparent salary computation based on actual calendar days, half-days, paid week-offs, overtime, advances, and bonuses.
- **Accurate Cash & Profit Accounting:** Opt-in (default-on) syncing of staff advances and salary payouts to `expenses` so `OwnerInsights` Net Profit reflects real labor outflows without double entry.
- **Offline-First & Multi-Device:** Works seamlessly on the Counter PC without internet and syncs across paired owner devices via `:5050` LAN API and Supabase Cloud.
- **Strict Privacy:** Waiters never see colleague profiles, attendance, or salary data; all staff and payroll views are gated behind the Manager PIN.

### 4.3 Access Control & Permissions
- **Single Manager PIN Gate (Phase 1):** Uses the existing PBKDF2-hashed Manager PIN (`verifyManagerPin` in `src/utils/pin.ts`) for both Attendance and Payroll/Salary management.
- **Future Extensibility:** Data/permission checks are structured so an optional separate **Owner PIN** (e.g., for salary edits/payouts vs. manager attendance marking) can be enabled later via `app_settings` without schema breaking changes.
- **UI Entry Points:**
  1. **Owner Insights -> Staff & Payroll:** Full directory, attendance calendar, advances ledger, monthly payroll run, and labor cost summary.
  2. **Hotel Operations -> Staff / Attendance Tab (or Quick Action):** Fast daily muster roll shortcut for the Counter Manager during morning/evening shift handovers.

### 4.4 Functional Requirements

#### FR-1: Staff Directory & Profiles
- Create, edit, archive/deactivate (`active`, `on_leave`, `inactive`) staff profiles.
- Fields:
  - `Full Name` (required), `Phone` (required for WhatsApp payslip), `Emergency Contact` (optional)
  - `Role` (`Waiter`, `Captain`, `Chef / Kitchen`, `Housekeeping`, `Front Desk`, `Banquet Helper`, `Security / Maintenance`, `Manager`)
  - `Department` (`restaurant`, `rooms`, `banquet`, `general`)
  - `Shift` (`morning`, `evening`, `full_day`, `night`)
  - `Joining Date` (`YYYY-MM-DD`)
  - `Pay Type`: `monthly` (fixed monthly salary) or `daily` (per-day wage for casual/banquet staff)
  - `Base Salary / Daily Rate` (INR), `Overtime Hourly Rate` (optional INR/hr, default `0`)
  - `ID / KYC Verification Note` (e.g., `"Aadhaar verified - xxxx 4321"`, stored as masked reference—no raw sensitive IDs or document uploads required in Phase 1)
  - `POS Waiter Alias` (`pos_alias` / `show_in_pos` flag) to surface active dining staff in `WaiterPOS`

#### FR-2: Waiter POS Server Selection Integration
- In `WaiterPOS`, tapping the Server Name badge presents a **quick-pick dropdown/list of active POS staff** (`show_in_pos = true` and `status = 'active'`) plus a **"Custom Name"** fallback option.
- Existing `localStorage` (`hotel_rj_server_name`) continues to work seamlessly if no staff directory entries exist or when a custom name is chosen.

#### FR-3: Daily Attendance Muster Roll & Monthly View
- **Manager-Marked Muster Roll:** Default workflow optimized for Counter PC / Manager mobile.
- **Attendance Statuses:**
  - `present` (1.0 paid day)
  - `half_day` (0.5 paid day)
  - `absent` (0.0 paid day)
  - `paid_leave` (1.0 paid day)
  - `week_off` (1.0 paid day)
- **Optional Time & Overtime Fields:** Each daily entry optionally accepts `checkIn` (`HH:mm`), `checkOut` (`HH:mm`), `overtimeHours` (decimal, e.g., `1.5`), and `notes` (e.g., `"Covered banquet dinner"`).
- **Bulk Action:** **"Mark All Unmarked as Present"** button for the selected date (never overwrites already-marked statuses like `absent` or `week_off`).
- **Date Integrity:** Always defaults to local hotel date (`localDateString()`), preventing late-night UTC date rollovers.
- **Monthly Attendance Grid:** Interactive `Staff × Day (1..N)` matrix showing color-coded status indicators, monthly summary counts (`P`, `HD`, `A`, `WO/L`, `OT hrs`), and click-to-edit per cell.
- **Payroll Lock Guard:** Attendance for a staff member in a month whose payroll is already marked `paid` cannot be modified without unlocking payroll (requires Manager PIN confirmation + writes an `audit_logs` entry).

#### FR-4: Salary Advances (*Kharchi*), Deductions & Bonuses
- Record ledger entries per staff member with:
  - `Entry Type`: `advance` (deducted from salary), `deduction` (breakage/fine/mess, deducted from salary), or `bonus` (banquet incentive/festival bonus/tips, added to salary)
  - `Date` (`YYYY-MM-DD`), `Amount` (INR > 0), `Payment Mode` (`Cash`, `UPI`, `Bank Transfer`), `Notes`
- **Over-Advance Safeguard:** While entering an `advance`, display the employee's **Earned Salary to Date** minus **Advances Already Taken This Month**, and show a non-blocking warning banner if the new advance exceeds earned balance.
- **Daily Expense Integration (Opt-In, Default ON):**
  - The Advance modal includes a checkbox **"Also record in Daily Expenses"** (**checked by default** when `entryType === 'advance'` or `'bonus'` paid out).
  - When checked, saves a corresponding record in `expenses` (Category: `"Staff Advance"` or `"Staff Bonus"`) and stores `linked_expense_id` on the advance record.
  - Deleting/voiding an advance that has a `linked_expense_id` offers/performs cleanup of the linked expense so `OwnerInsights` Net Profit stays consistent.

#### FR-5: Monthly Payroll Calculation, Settlement & Payslips
- **Calculation Rules (Confirmed):**
  - Let $D_{\text{month}}$ = actual number of calendar days in the target `YYYY-MM` (28, 29, 30, or 31).
  - For **Monthly Fixed Staff**:
    - $\text{Daily Rate} = \text{base\_salary} / D_{\text{month}}$
    - $\text{Paid Days} = \text{count}(\text{present}) + \text{count}(\text{paid\_leave}) + \text{count}(\text{week\_off}) + 0.5 \times \text{count}(\text{half\_day})$
    - *(Note: Days in the month with no attendance record are treated as `0` paid days in strict calculation, or clearly highlighted as "Unmarked days remaining" in the UI so the manager marks them before settling.)*
    - $\text{Earned Base Pay} = \text{round}(\text{Paid Days} \times \text{Daily Rate})$
  - For **Daily Wage Staff**:
    - $\text{Daily Rate} = \text{base\_salary}$
    - $\text{Worked Units} = \text{count}(\text{present}) + 0.5 \times \text{count}(\text{half\_day}) + \text{count}(\text{paid\_leave}) + \text{count}(\text{week\_off})$
    - $\text{Earned Base Pay} = \text{round}(\text{Worked Units} \times \text{Daily Rate})$
  - **Overtime & Net Payable:**
    - $\text{Overtime Pay} = \text{round}(\sum \text{overtime\_hours} \times \text{overtime\_rate})$
    - $\text{Net Payable} = \text{Earned Base Pay} + \text{Overtime Pay} + \text{Bonuses} - \text{Advances} - \text{Deductions}$
- **Payroll Settlement:**
  - Review all active staff for the selected month in a single Payroll Sheet table.
  - Manager can settle individually or confirm payment (`Cash`, `UPI`, `Bank Transfer`) with payment date.
  - Includes **"Also record in Daily Expenses"** checkbox (**checked by default**; Category: `"Staff Salary"`, Amount: `Net Payable` paid out) linked via `linked_expense_id`.
  - Settling marks `staff_payroll.status = 'paid'`, freezes the calculation snapshot, and logs an audit entry.
- **Payslip Export & Sharing:**
  - **WhatsApp Share:** Formatted itemized payslip text (Days Worked, Base Earned, OT, Bonuses, Advances Deducted, Net Paid, Payment Mode) opened via `wa.me`.
  - **58mm Thermal Receipt Print:** Compact staff salary voucher printable from the Counter PC or Android Bluetooth printer.

### 4.5 Non-Functional Requirements
- **Offline Availability:** 100% of Staff Directory, Attendance, Advances, and Payroll actions must succeed on the Counter PC when internet is down, persisting to local JSON DB and syncing to Supabase upon reconnection.
- **Auditability:** Payroll payouts, payroll unlocks/re-edits, and backdated attendance edits (> 3 days old) must write structured entries to `audit_logs`.
- **Deletion Integrity:** Soft-archiving (`status = 'inactive'`) is preferred for staff with historical attendance/payroll; hard deletes must use `pendingDeletions` to prevent cloud resurrection.
- **Performance:** Loading the monthly muster roll for up to 50 staff × 31 days must render instantaneously (< 100ms client-side computation).

---

## 5. New Feature PRD: Room Check-In, Custom/Short-Stay & Checkout Billing

### 5.1 Problem Statement
Currently, the Rooms tab in `HotelOperationsModal` only supports editing room tariffs and toggling housekeeping status (`available`, `occupied`, `dirty`, `maintenance`). Managers cannot formally check guests in, record short-stay (2–3 hour) custom room pricing, generate a room stay bill at check-out, or see actual room stay earnings in `OwnerInsights`.

### 5.2 Goals & Business Rules
- **Manager-Only Front Desk Flow:** Lives inside `HotelOperationsModal` → **Rooms & Housekeeping** tab (gated by the Manager PIN).
- **Support Both Nightly & Custom / Short-Stay (2–3 hrs) Pricing:** Managers can choose **Nightly Tariff** (auto-calculated from nights × room rate, editable for walk-in negotiations) or **Short Stay / Custom Price** (fixed custom price for 2–3 hour day-use or negotiated stays).
- **Separate from Restaurant Dining:** Food orders remain settled independently in `WaiterPOS` ("eat & pay separately"); room checkout bills cover room stay charges and room extras (e.g., extra bed, laundry, early check-in).
- **No GST by Default:** Tax defaults to `0%` (No GST), with an optional GST toggle (`5%` / `12%` / `18%`) when a guest requires a tax invoice.
- **Full Revenue Recorded at Checkout:** Advance payments taken at check-in are tracked on the stay to calculate *Balance Due*, and the full stay bill (`department: 'rooms'`) is saved into `bills` upon checkout so `OwnerInsights` and Excel backups accurately reflect room revenue.

### 5.3 Functional Requirements

#### FR-R1: Guest Check-In
- Available on any `available` (or `dirty` with confirmation) room via **"Check In"** button.
- Fields:
  - `Guest Name` (required), `Phone` (optional for WhatsApp bill), `No. of Guests`, `Masked ID / KYC Note` (optional)
  - `Stay Type`: `'nightly'` (default) or `'short_stay'` (2–3 Hours / Custom Price)
  - `Check-In Date & Time` (defaults to local current date/time), `Expected Check-Out Date`
  - `Nightly Rate (₹)` (pre-filled from `room.pricePerNight`, editable) or `Custom Stay Price (₹)` (for `'short_stay'`)
  - `Advance Paid (₹)` + `Advance Payment Mode` (`Cash` / `UPI` / `Card`)
  - `Notes`
- Transitions room status to `occupied`, populates guest summary on the room card, and creates an active `room_stays` record.

#### FR-R2: Active Stay Management & Extra Charges
- On an `occupied` room, manager can click **"Manage Stay / Extras"** to:
  - Add/remove extra room charges (e.g., *Extra Bed*, *Laundry*, *Late Checkout*, *Damage*).
  - Record additional mid-stay advance payments or switch between `'nightly'` and `'short_stay'` pricing.

#### FR-R3: Check-Out, Bill Settlement & Housekeeping Turnaround
- On an `occupied` room, manager clicks **"Check Out & Bill"**:
  - Displays itemized summary: Room Charge (`N nights × rate` or `Custom Short-Stay`), Extra Charges, Optional Discount, Optional GST (`0%` default), **Total Stay Amount**, minus **Advance Paid** = **Balance Due Now**.
  - Allows overriding nights or custom room price at checkout time.
  - Collects balance via `Cash`, `UPI`, `Card`, or `Split (Cash + UPI)`.
  - Saves a settled bill into `bills` with `department: 'rooms'`, `orderType: 'room-stay'`, and accurate Cash/UPI/Card payment split (combining advance mode + checkout balance mode).
  - Marks `room_stays.status = 'checked_out'`, links `bill_id`, clears active guest info on `rooms`, and sets `rooms.status = 'dirty'`.
  - Offers **1-Tap 58mm Thermal Room Bill Print** and **WhatsApp Bill Share**.

#### FR-R4: Stay History / Guest Register
- A **"Stay History"** view inside the Rooms tab displays checked-out stays with dates, stay type, guest details, total billed, and **Reprint / WhatsApp** actions.
