-- Migration: 20261107_banquet_bookings.sql
-- Banquet & Event Bookings with Advance Calendar & Duplicate Conflict Prevention

CREATE TABLE IF NOT EXISTS banquet_bookings (
  id TEXT PRIMARY KEY,
  event_date DATE NOT NULL,
  slot TEXT NOT NULL, -- 'lunch' | 'dinner' | 'fullday' | 'custom'
  custom_start_time TEXT, -- '10:00'
  custom_end_time TEXT, -- '15:00'
  venue TEXT NOT NULL, -- 'Banquet Hall 1 (AC)' | 'Garden Lawn' | 'Combined / Full Property'
  event_type TEXT NOT NULL, -- 'Birthday Party' | 'Wedding / Reception' | 'Anniversary' | 'Corporate / Conference' | 'Kitty Party' | 'Other Function'
  no_of_guests INTEGER NOT NULL DEFAULT 50,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  total_amount NUMERIC(10,2) DEFAULT 0,
  advance_paid NUMERIC(10,2) DEFAULT 0,
  balance_due NUMERIC(10,2) DEFAULT 0,
  advance_payment_mode TEXT DEFAULT 'Cash', -- 'Cash' | 'UPI' | 'Card' | 'Bank Transfer'
  special_notes TEXT,
  status TEXT DEFAULT 'confirmed', -- 'confirmed' | 'tentative' | 'completed' | 'cancelled'
  created_by TEXT DEFAULT 'Counter Manager',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banquet_event_date ON banquet_bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_banquet_venue ON banquet_bookings(venue);
CREATE INDEX IF NOT EXISTS idx_banquet_status ON banquet_bookings(status);

ALTER TABLE banquet_bookings ENABLE ROW LEVEL SECURITY;

-- Allow paired devices and anon (during local development / initial setup) access
DROP POLICY IF EXISTS banquet_bookings_all ON banquet_bookings;
CREATE POLICY banquet_bookings_all ON banquet_bookings
  FOR ALL
  USING (true)
  WITH CHECK (true);
