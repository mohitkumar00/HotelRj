-- =============================================================================
-- Migration: 20261127_room_stays.sql
-- Hotel RJ — Room Check-In, Short-Stay Custom Pricing & Checkout Billing
-- Prerequisite: supabase/migrations/20261106a_device_pairing_tables.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS room_stays (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  room_name TEXT NOT NULL,
  stay_type TEXT NOT NULL DEFAULT 'nightly',
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  num_guests INTEGER NOT NULL DEFAULT 1,
  id_proof_note TEXT,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_date TEXT NOT NULL,
  expected_check_out_date TEXT,
  check_out_at TIMESTAMPTZ,
  check_out_date TEXT,
  nightly_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  nights INTEGER NOT NULL DEFAULT 1,
  custom_stay_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  extra_charges JSONB NOT NULL DEFAULT '[]'::jsonb,
  advance_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  advance_payment_mode TEXT DEFAULT 'Cash',
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  bill_id TEXT,
  bill_number BIGINT,
  payment_method TEXT,
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
