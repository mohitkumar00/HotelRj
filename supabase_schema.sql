-- ==============================================================================
-- HOTEL RJ — SUPABASE DATABASE SCHEMA SETUP
-- Run this script in the Supabase SQL Editor (https://app.supabase.com)
-- ==============================================================================

-- 1. BILLS TABLE (Dine-in, Takeaway, Room Folios, Banquet Events)
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  bill_number BIGINT,
  department TEXT NOT NULL DEFAULT 'restaurant', -- 'restaurant' | 'rooms' | 'banquet'
  table_id TEXT,
  order_type TEXT DEFAULT 'dine-in',
  room_number TEXT,
  server_name TEXT,
  settled_by TEXT DEFAULT 'Cashier',
  customer_phone TEXT,
  customer_name TEXT,
  subtotal NUMERIC(10, 2) DEFAULT 0,
  tax NUMERIC(10, 2) DEFAULT 0,
  discount NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash', -- 'cash' | 'upi' | 'card' | 'room-folio' | 'split'
  items JSONB DEFAULT '[]'::jsonb,
  date_str TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast daily/monthly queries
CREATE INDEX IF NOT EXISTS idx_bills_date_str ON bills(date_str);
CREATE INDEX IF NOT EXISTS idx_bills_department ON bills(department);
CREATE INDEX IF NOT EXISTS idx_bills_timestamp ON bills(timestamp DESC);

-- 2. ANTI-THEFT AUDIT LOGS TABLE (KOT cancellations, voids, discounts)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'ITEM_VOID',
  table_id TEXT,
  staff_name TEXT,
  item_name TEXT,
  item_price NUMERIC(10, 2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  reason TEXT,
  date_str TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- 3. PETTY CASH EXPENSES TABLE (Daily Kharacha)
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  paid_by TEXT DEFAULT 'Cash Drawer',
  notes TEXT,
  recorded_by TEXT DEFAULT 'Cashier',
  date_str TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date_str ON expenses(date_str);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- Allows desktop app and mobile clients to read/write using anon public key
-- ==============================================================================

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Allow read and write via anon key
CREATE POLICY "Allow public read-write access to bills" ON bills
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read-write access to audit_logs" ON audit_logs
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read-write access to expenses" ON expenses
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Done! Your Supabase database is now configured for Hotel RJ POS.
