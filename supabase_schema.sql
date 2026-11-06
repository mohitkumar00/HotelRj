-- ==============================================================================
-- HOTEL RJ — SUPABASE SCHEMA & INITIAL SEED DATA
-- Copy and paste this script directly into the Supabase SQL Editor:
-- https://app.supabase.com/project/_/sql
-- ==============================================================================

-- 1. BILLS TABLE (Dine-in, Takeaway, Room Folios, Banquet Events)
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  bill_number BIGINT,
  status TEXT NOT NULL DEFAULT 'settled', -- 'settled' | 'cancelled'
  cancel_reason TEXT,
  cancelled_by TEXT,
  cancelled_at TIMESTAMPTZ,
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

-- Ensure columns exist if table was already created
ALTER TABLE bills ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'settled';
ALTER TABLE bills ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bills_date_str ON bills(date_str);
CREATE INDEX IF NOT EXISTS idx_bills_department ON bills(department);
CREATE INDEX IF NOT EXISTS idx_bills_timestamp ON bills(timestamp DESC);

-- 2. ANTI-THEFT AUDIT LOGS TABLE (KOT cancellations, voids, discounts, Kitchen 86 sold out)
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

-- 4. LIVE MENU ITEMS TABLE (Dishes, Pricing & Kitchen 86 Sold-Out Status)
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  category_title TEXT,
  name TEXT NOT NULL,
  hindi_name TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  dietary TEXT DEFAULT 'veg', -- 'veg' | 'non-veg' | 'egg'
  is_available BOOLEAN DEFAULT true,
  popular BOOLEAN DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

-- 5. HOTEL ROOMS TABLE (Live Housekeeping & Occupancy Status)
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT DEFAULT 'deluxe', -- 'deluxe' | 'executive' | 'family'
  price_per_night NUMERIC(10, 2) NOT NULL DEFAULT 1600,
  status TEXT DEFAULT 'available', -- 'available' | 'occupied' | 'dirty' | 'maintenance'
  max_guests INTEGER DEFAULT 2,
  bed_type TEXT,
  guest_name TEXT,
  check_in_date TEXT,
  check_out_date TEXT,
  folio_amount NUMERIC(10, 2) DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- 6. TABLES & OUTLETS CONFIGURATION (Dining Tables, Parcel Slots, Banquet)
CREATE TABLE IF NOT EXISTS tables_config (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  section TEXT DEFAULT 'dining', -- 'dining' | 'parcel' | 'lawn' | 'banquet'
  capacity INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tables_config_section ON tables_config(section);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read-write access to bills') THEN
    CREATE POLICY "Allow public read-write access to bills" ON bills FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read-write access to audit_logs') THEN
    CREATE POLICY "Allow public read-write access to audit_logs" ON audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read-write access to expenses') THEN
    CREATE POLICY "Allow public read-write access to expenses" ON expenses FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read-write access to menu_items') THEN
    CREATE POLICY "Allow public read-write access to menu_items" ON menu_items FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read-write access to rooms') THEN
    CREATE POLICY "Allow public read-write access to rooms" ON rooms FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read-write access to tables_config') THEN
    CREATE POLICY "Allow public read-write access to tables_config" ON tables_config FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ==============================================================================
-- 8. INITIAL SEED DATA: ROOMS (10 Rooms)
-- ==============================================================================
INSERT INTO rooms (id, name, tier, price_per_night, status, max_guests, bed_type)
VALUES
  ('room-101', 'Room 101 (Deluxe King)', 'deluxe', 1600, 'available', 2, '1 King Bed'),
  ('room-102', 'Room 102 (Deluxe King)', 'deluxe', 1600, 'available', 2, '1 King Bed'),
  ('room-103', 'Room 103 (Deluxe King)', 'deluxe', 1600, 'available', 2, '1 King Bed'),
  ('room-201', 'Room 201 (Super Deluxe)', 'executive', 2200, 'available', 2, '1 King Bed'),
  ('room-202', 'Room 202 (Super Deluxe)', 'executive', 2200, 'available', 2, '1 King Bed'),
  ('room-203', 'Room 203 (Super Deluxe)', 'executive', 2200, 'available', 2, '1 King Bed'),
  ('room-204', 'Room 204 (Super Deluxe)', 'executive', 2200, 'available', 2, '1 King Bed'),
  ('room-301', 'Room 301 (Family Suite)', 'family', 3000, 'available', 4, '2 Double Beds'),
  ('room-302', 'Room 302 (Family Suite)', 'family', 3000, 'available', 4, '2 Double Beds'),
  ('room-305', 'Room 305 (Family Suite)', 'family', 3000, 'available', 4, '2 Double Beds')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tier = EXCLUDED.tier,
  price_per_night = EXCLUDED.price_per_night,
  status = EXCLUDED.status,
  max_guests = EXCLUDED.max_guests,
  bed_type = EXCLUDED.bed_type;

-- ==============================================================================
-- 9. INITIAL SEED DATA: TABLES & OUTLETS (19 Slots)
-- ==============================================================================
INSERT INTO tables_config (id, name, section, capacity, is_active, sort_order)
VALUES
  ('T-1', 'Table 1', 'dining', 4, true, 1),
  ('T-2', 'Table 2', 'dining', 4, true, 2),
  ('T-3', 'Table 3', 'dining', 4, true, 3),
  ('T-4', 'Table 4', 'dining', 4, true, 4),
  ('T-5', 'Table 5', 'dining', 4, true, 5),
  ('T-6', 'Table 6', 'dining', 4, true, 6),
  ('T-7', 'Table 7', 'dining', 6, true, 7),
  ('T-8', 'Table 8', 'dining', 6, true, 8),
  ('T-9', 'Table 9', 'dining', 6, true, 9),
  ('T-10', 'Table 10', 'dining', 8, true, 10),
  ('T-11', 'Table 11', 'dining', 8, true, 11),
  ('T-12', 'Table 12', 'dining', 8, true, 12),
  ('Parcel 1', 'Parcel 1', 'parcel', 1, true, 13),
  ('Parcel 2', 'Parcel 2', 'parcel', 1, true, 14),
  ('Parcel 3', 'Parcel 3', 'parcel', 1, true, 15),
  ('Parcel 4', 'Parcel 4', 'parcel', 1, true, 16),
  ('Takeaway Counter', 'Takeaway Counter', 'parcel', 1, true, 17),
  ('Lawn 1', 'Lawn Table 1', 'lawn', 6, true, 18),
  ('Banquet Hall', 'Banquet Hall 1', 'banquet', 50, true, 19)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  section = EXCLUDED.section,
  capacity = EXCLUDED.capacity,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- ==============================================================================
-- 10. INITIAL SEED DATA: DISHES & MENU ITEMS (300+ Dishes)
-- ==============================================================================
INSERT INTO menu_items (id, category_id, category_title, name, hindi_name, price, dietary, is_available, popular, description)
VALUES
  ('vs-1', 'veg-starters', 'Veg Starters & Snacks', 'Veg Manchurian Dry', NULL, 180, 'veg', true, false, NULL),
  ('vs-2', 'veg-starters', 'Veg Starters & Snacks', 'Veg Manchurian Gravy', NULL, 200, 'veg', true, false, NULL),
  ('vs-3', 'veg-starters', 'Veg Starters & Snacks', 'Gobi Manchurian', NULL, 180, 'veg', true, false, NULL),
  ('vs-4', 'veg-starters', 'Veg Starters & Snacks', 'Paneer 65', NULL, 220, 'veg', true, true, NULL),
  ('vs-5', 'veg-starters', 'Veg Starters & Snacks', 'Chilli Paneer Dry', NULL, 230, 'veg', true, true, NULL),
  ('vs-6', 'veg-starters', 'Veg Starters & Snacks', 'Chilli Paneer Gravy', NULL, 250, 'veg', true, false, NULL),
  ('vs-7', 'veg-starters', 'Veg Starters & Snacks', 'Paneer Tikka', NULL, 260, 'veg', true, true, NULL),
  ('vs-8', 'veg-starters', 'Veg Starters & Snacks', 'Achari Paneer Tikka', NULL, 280, 'veg', true, false, NULL),
  ('vs-9', 'veg-starters', 'Veg Starters & Snacks', 'Malai Paneer Tikka', NULL, 280, 'veg', true, false, NULL),
  ('vs-10', 'veg-starters', 'Veg Starters & Snacks', 'Hara Bhara Kebab', NULL, 180, 'veg', true, true, NULL),
  ('vs-11', 'veg-starters', 'Veg Starters & Snacks', 'Veg Seekh Kebab', NULL, 200, 'veg', true, false, NULL),
  ('vs-12', 'veg-starters', 'Veg Starters & Snacks', 'Crispy Corn', NULL, 180, 'veg', true, true, NULL),
  ('vs-13', 'veg-starters', 'Veg Starters & Snacks', 'Honey Chilli Potato', NULL, 180, 'veg', true, false, NULL),
  ('vs-14', 'veg-starters', 'Veg Starters & Snacks', 'French Fries', NULL, 120, 'veg', true, false, NULL),
  ('vs-15', 'veg-starters', 'Veg Starters & Snacks', 'Peri Peri Fries', NULL, 150, 'veg', true, false, NULL),
  ('vs-16', 'veg-starters', 'Veg Starters & Snacks', 'Cheese Balls', NULL, 180, 'veg', true, false, NULL),
  ('vs-17', 'veg-starters', 'Veg Starters & Snacks', 'Veg Cutlet', NULL, 120, 'veg', true, false, NULL),
  ('vs-18', 'veg-starters', 'Veg Starters & Snacks', 'Aloo Tikki', NULL, 100, 'veg', true, false, NULL),
  ('vs-19', 'veg-starters', 'Veg Starters & Snacks', 'Paneer Pakoda', NULL, 180, 'veg', true, false, NULL),
  ('vs-20', 'veg-starters', 'Veg Starters & Snacks', 'Onion Pakoda', NULL, 100, 'veg', true, false, NULL),
  ('vs-21', 'veg-starters', 'Veg Starters & Snacks', 'Mix Veg Pakoda', NULL, 120, 'veg', true, false, NULL),
  ('vs-22', 'veg-starters', 'Veg Starters & Snacks', 'Crispy Baby Corn', NULL, 200, 'veg', true, false, NULL),
  ('vs-23', 'veg-starters', 'Veg Starters & Snacks', 'Mushroom Tikka', NULL, 250, 'veg', true, false, NULL),
  ('vs-24', 'veg-starters', 'Veg Starters & Snacks', 'Stuffed Mushroom', NULL, 280, 'veg', true, false, NULL),
  ('vs-25', 'veg-starters', 'Veg Starters & Snacks', 'Dahi Ke Kebab', NULL, 220, 'veg', true, true, NULL),
  ('vs-26', 'veg-starters', 'Veg Starters & Snacks', 'Peanut Masala', NULL, 100, 'veg', true, false, NULL),
  ('vs-27', 'veg-starters', 'Veg Starters & Snacks', 'Masala Papad', NULL, 60, 'veg', true, false, NULL),
  ('vs-28', 'veg-starters', 'Veg Starters & Snacks', 'Roasted Papad', NULL, 30, 'veg', true, false, NULL),
  ('vs-29', 'veg-starters', 'Veg Starters & Snacks', 'Green Salad', NULL, 80, 'veg', true, false, NULL),
  ('vs-30', 'veg-starters', 'Veg Starters & Snacks', 'Russian Salad', NULL, 150, 'veg', true, false, NULL),
  ('nvs-1', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Tikka', NULL, 280, 'non-veg', true, true, NULL),
  ('nvs-2', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Malai Tikka', NULL, 300, 'non-veg', true, false, NULL),
  ('nvs-3', 'non-veg-starters', 'Non-Veg Starters', 'Tandoori Chicken - Half', NULL, 300, 'non-veg', true, false, NULL),
  ('nvs-4', 'non-veg-starters', 'Non-Veg Starters', 'Tandoori Chicken - Full', NULL, 550, 'non-veg', true, true, NULL),
  ('nvs-5', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Tangdi Kebab (2 pcs)', NULL, 280, 'non-veg', true, false, NULL),
  ('nvs-6', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Seekh Kebab', NULL, 280, 'non-veg', true, false, NULL),
  ('nvs-7', 'non-veg-starters', 'Non-Veg Starters', 'Mutton Seekh Kebab', NULL, 350, 'non-veg', true, true, NULL),
  ('nvs-8', 'non-veg-starters', 'Non-Veg Starters', 'Chicken 65', NULL, 250, 'non-veg', true, false, NULL),
  ('nvs-9', 'non-veg-starters', 'Non-Veg Starters', 'Chilli Chicken Dry', NULL, 260, 'non-veg', true, true, NULL),
  ('nvs-10', 'non-veg-starters', 'Non-Veg Starters', 'Chilli Chicken Gravy', NULL, 280, 'non-veg', true, false, NULL),
  ('nvs-11', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Manchurian', NULL, 260, 'non-veg', true, false, NULL),
  ('nvs-12', 'non-veg-starters', 'Non-Veg Starters', 'Crispy Chicken', NULL, 280, 'non-veg', true, false, NULL),
  ('nvs-13', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Lollipop (6 pcs)', NULL, 280, 'non-veg', true, true, NULL),
  ('nvs-14', 'non-veg-starters', 'Non-Veg Starters', 'Garlic Chicken', NULL, 280, 'non-veg', true, false, NULL),
  ('nvs-15', 'non-veg-starters', 'Non-Veg Starters', 'Lemon Chicken', NULL, 280, 'non-veg', true, false, NULL),
  ('nvs-16', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Pakoda', NULL, 220, 'non-veg', true, false, NULL),
  ('nvs-17', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Reshmi Kebab', NULL, 300, 'non-veg', true, false, NULL),
  ('nvs-18', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Afghani Kebab', NULL, 320, 'non-veg', true, false, NULL),
  ('nvs-19', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Hariyali Kebab', NULL, 300, 'non-veg', true, false, NULL),
  ('nvs-20', 'non-veg-starters', 'Non-Veg Starters', 'Chicken Wings', NULL, 280, 'non-veg', true, false, NULL),
  ('nvs-21', 'non-veg-starters', 'Non-Veg Starters', 'Fish Finger', NULL, 300, 'non-veg', true, false, NULL),
  ('nvs-22', 'non-veg-starters', 'Non-Veg Starters', 'Fish Fry', NULL, 280, 'non-veg', true, true, NULL),
  ('nvs-23', 'non-veg-starters', 'Non-Veg Starters', 'Fish Tikka', NULL, 320, 'non-veg', true, false, NULL),
  ('nvs-24', 'non-veg-starters', 'Non-Veg Starters', 'Prawn Fry', NULL, 380, 'non-veg', true, false, NULL),
  ('nvs-25', 'non-veg-starters', 'Non-Veg Starters', 'Prawn Koliwada', NULL, 400, 'non-veg', true, true, NULL),
  ('vm-1', 'veg-main-course', 'Veg Indian Main Course', 'Paneer Butter Masala', NULL, 260, 'veg', true, true, NULL),
  ('vm-2', 'veg-main-course', 'Veg Indian Main Course', 'Shahi Paneer', NULL, 260, 'veg', true, false, NULL),
  ('vm-3', 'veg-main-course', 'Veg Indian Main Course', 'Kadai Paneer', NULL, 250, 'veg', true, true, NULL),
  ('vm-4', 'veg-main-course', 'Veg Indian Main Course', 'Paneer Lababdar', NULL, 270, 'veg', true, false, NULL),
  ('vm-5', 'veg-main-course', 'Veg Indian Main Course', 'Palak Paneer', NULL, 240, 'veg', true, false, NULL),
  ('vm-6', 'veg-main-course', 'Veg Indian Main Course', 'Matar Paneer', NULL, 230, 'veg', true, false, NULL),
  ('vm-7', 'veg-main-course', 'Veg Indian Main Course', 'Chilli Paneer Gravy', NULL, 250, 'veg', true, false, NULL),
  ('vm-8', 'veg-main-course', 'Veg Indian Main Course', 'Paneer Do Pyaza', NULL, 250, 'veg', true, false, NULL),
  ('vm-9', 'veg-main-course', 'Veg Indian Main Course', 'Paneer Bhurji', NULL, 240, 'veg', true, false, NULL),
  ('vm-10', 'veg-main-course', 'Veg Indian Main Course', 'Paneer Tikka Masala', NULL, 280, 'veg', true, true, NULL),
  ('vm-11', 'veg-main-course', 'Veg Indian Main Course', 'Malai Kofta', NULL, 260, 'veg', true, true, NULL),
  ('vm-12', 'veg-main-course', 'Veg Indian Main Course', 'Veg Kofta Curry', NULL, 220, 'veg', true, false, NULL),
  ('vm-13', 'veg-main-course', 'Veg Indian Main Course', 'Mix Veg', NULL, 200, 'veg', true, false, NULL),
  ('vm-14', 'veg-main-course', 'Veg Indian Main Course', 'Veg Jalfrezi', NULL, 220, 'veg', true, false, NULL),
  ('vm-15', 'veg-main-course', 'Veg Indian Main Course', 'Kadai Vegetable', NULL, 220, 'veg', true, false, NULL),
  ('vm-16', 'veg-main-course', 'Veg Indian Main Course', 'Dal Makhani', NULL, 220, 'veg', true, true, NULL),
  ('vm-17', 'veg-main-course', 'Veg Indian Main Course', 'Dal Tadka', NULL, 160, 'veg', true, true, NULL),
  ('vm-18', 'veg-main-course', 'Veg Indian Main Course', 'Dal Fry', NULL, 150, 'veg', true, false, NULL),
  ('vm-19', 'veg-main-course', 'Veg Indian Main Course', 'Yellow Dal', NULL, 140, 'veg', true, false, NULL),
  ('vm-20', 'veg-main-course', 'Veg Indian Main Course', 'Chana Masala', NULL, 180, 'veg', true, false, NULL),
  ('vm-21', 'veg-main-course', 'Veg Indian Main Course', 'Rajma Masala', NULL, 180, 'veg', true, false, NULL),
  ('vm-22', 'veg-main-course', 'Veg Indian Main Course', 'Dum Aloo', NULL, 200, 'veg', true, false, NULL),
  ('vm-23', 'veg-main-course', 'Veg Indian Main Course', 'Aloo Gobi', NULL, 170, 'veg', true, false, NULL),
  ('vm-24', 'veg-main-course', 'Veg Indian Main Course', 'Aloo Jeera', NULL, 150, 'veg', true, false, NULL),
  ('vm-25', 'veg-main-course', 'Veg Indian Main Course', 'Bhindi Masala', NULL, 180, 'veg', true, false, NULL),
  ('vm-26', 'veg-main-course', 'Veg Indian Main Course', 'Baingan Bharta', NULL, 180, 'veg', true, false, NULL),
  ('vm-27', 'veg-main-course', 'Veg Indian Main Course', 'Mushroom Masala', NULL, 240, 'veg', true, false, NULL),
  ('vm-28', 'veg-main-course', 'Veg Indian Main Course', 'Kadai Mushroom', NULL, 250, 'veg', true, false, NULL),
  ('vm-29', 'veg-main-course', 'Veg Indian Main Course', 'Mushroom Do Pyaza', NULL, 250, 'veg', true, false, NULL),
  ('vm-30', 'veg-main-course', 'Veg Indian Main Course', 'Palak Corn', NULL, 220, 'veg', true, false, NULL),
  ('nvm-1', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Butter Chicken', NULL, 300, 'non-veg', true, true, NULL),
  ('nvm-2', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Curry', NULL, 260, 'non-veg', true, false, NULL),
  ('nvm-3', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Masala', NULL, 280, 'non-veg', true, false, NULL),
  ('nvm-4', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Kadai Chicken', NULL, 300, 'non-veg', true, true, NULL),
  ('nvm-5', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Handi - Half', NULL, 350, 'non-veg', true, false, NULL),
  ('nvm-6', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Handi - Full', NULL, 600, 'non-veg', true, true, NULL),
  ('nvm-7', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Do Pyaza', NULL, 280, 'non-veg', true, false, NULL),
  ('nvm-8', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Lababdar', NULL, 320, 'non-veg', true, false, NULL),
  ('nvm-9', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Tikka Masala', NULL, 320, 'non-veg', true, true, NULL),
  ('nvm-10', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Changezi', NULL, 320, 'non-veg', true, false, NULL),
  ('nvm-11', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Korma', NULL, 300, 'non-veg', true, false, NULL),
  ('nvm-12', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Bharta', NULL, 300, 'non-veg', true, false, NULL),
  ('nvm-13', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Saagwala', NULL, 280, 'non-veg', true, false, NULL),
  ('nvm-14', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Rara', NULL, 350, 'non-veg', true, false, NULL),
  ('nvm-15', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Chicken Chettinad', NULL, 320, 'non-veg', true, false, NULL),
  ('nvm-16', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Mutton Curry', NULL, 380, 'non-veg', true, true, NULL),
  ('nvm-17', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Mutton Rogan Josh', NULL, 400, 'non-veg', true, true, NULL),
  ('nvm-18', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Mutton Masala', NULL, 390, 'non-veg', true, false, NULL),
  ('nvm-19', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Mutton Handi', NULL, 450, 'non-veg', true, false, NULL),
  ('nvm-20', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Mutton Korma', NULL, 400, 'non-veg', true, false, NULL),
  ('nvm-21', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Mutton Saagwala', NULL, 380, 'non-veg', true, false, NULL),
  ('nvm-22', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Mutton Keema Masala', NULL, 350, 'non-veg', true, false, NULL),
  ('nvm-23', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Mutton Rara', NULL, 420, 'non-veg', true, false, NULL),
  ('nvm-24', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Egg Curry', NULL, 160, 'egg', true, true, NULL),
  ('nvm-25', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Egg Masala', NULL, 180, 'egg', true, false, NULL),
  ('nvm-26', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Egg Bhurji', NULL, 120, 'egg', true, false, NULL),
  ('nvm-27', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Egg Do Pyaza', NULL, 170, 'egg', true, false, NULL),
  ('nvm-28', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Fish Curry', NULL, 280, 'non-veg', true, true, NULL),
  ('nvm-29', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Fish Masala', NULL, 300, 'non-veg', true, false, NULL),
  ('nvm-30', 'non-veg-main-course', 'Non-Veg Indian Main Course', 'Fish Kalia', NULL, 320, 'non-veg', true, false, NULL),
  ('rb-1', 'rice-biryani', 'Rice, Biryani & Pulao', 'Plain Steamed Rice', NULL, 100, 'veg', true, false, NULL),
  ('rb-2', 'rice-biryani', 'Rice, Biryani & Pulao', 'Jeera Rice', NULL, 140, 'veg', true, false, NULL),
  ('rb-3', 'rice-biryani', 'Rice, Biryani & Pulao', 'Ghee Rice', NULL, 160, 'veg', true, false, NULL),
  ('rb-4', 'rice-biryani', 'Rice, Biryani & Pulao', 'Peas Pulao', NULL, 160, 'veg', true, false, NULL),
  ('rb-5', 'rice-biryani', 'Rice, Biryani & Pulao', 'Veg Pulao', NULL, 170, 'veg', true, false, NULL),
  ('rb-6', 'rice-biryani', 'Rice, Biryani & Pulao', 'Kashmiri Pulao', NULL, 220, 'veg', true, false, NULL),
  ('rb-7', 'rice-biryani', 'Rice, Biryani & Pulao', 'Veg Biryani', NULL, 200, 'veg', true, true, NULL),
  ('rb-8', 'rice-biryani', 'Rice, Biryani & Pulao', 'Paneer Biryani', NULL, 230, 'veg', true, false, NULL),
  ('rb-9', 'rice-biryani', 'Rice, Biryani & Pulao', 'Mushroom Biryani', NULL, 220, 'veg', true, false, NULL),
  ('rb-10', 'rice-biryani', 'Rice, Biryani & Pulao', 'Hyderabadi Veg Biryani', NULL, 230, 'veg', true, false, NULL),
  ('rb-11', 'rice-biryani', 'Rice, Biryani & Pulao', 'Chicken Biryani', NULL, 250, 'non-veg', true, true, NULL),
  ('rb-12', 'rice-biryani', 'Rice, Biryani & Pulao', 'Chicken Dum Biryani', NULL, 280, 'non-veg', true, true, NULL),
  ('rb-13', 'rice-biryani', 'Rice, Biryani & Pulao', 'Chicken Hyderabadi Biryani', NULL, 280, 'non-veg', true, false, NULL),
  ('rb-14', 'rice-biryani', 'Rice, Biryani & Pulao', 'Chicken Kolkata Biryani', NULL, 280, 'non-veg', true, false, NULL),
  ('rb-15', 'rice-biryani', 'Rice, Biryani & Pulao', 'Mutton Biryani', NULL, 350, 'non-veg', true, true, NULL),
  ('rb-16', 'rice-biryani', 'Rice, Biryani & Pulao', 'Mutton Dum Biryani', NULL, 380, 'non-veg', true, true, NULL),
  ('rb-17', 'rice-biryani', 'Rice, Biryani & Pulao', 'Kolkata Mutton Biryani', NULL, 380, 'non-veg', true, false, NULL),
  ('rb-18', 'rice-biryani', 'Rice, Biryani & Pulao', 'Egg Biryani', NULL, 180, 'egg', true, false, NULL),
  ('rb-19', 'rice-biryani', 'Rice, Biryani & Pulao', 'Fish Biryani', NULL, 300, 'non-veg', true, false, NULL),
  ('rb-20', 'rice-biryani', 'Rice, Biryani & Pulao', 'Prawn Biryani', NULL, 380, 'non-veg', true, false, NULL),
  ('rb-21', 'rice-biryani', 'Rice, Biryani & Pulao', 'Chicken Fried Rice', NULL, 220, 'non-veg', true, true, NULL),
  ('rb-22', 'rice-biryani', 'Rice, Biryani & Pulao', 'Veg Fried Rice', NULL, 170, 'veg', true, false, NULL),
  ('rb-23', 'rice-biryani', 'Rice, Biryani & Pulao', 'Egg Fried Rice', NULL, 190, 'egg', true, false, NULL),
  ('rb-24', 'rice-biryani', 'Rice, Biryani & Pulao', 'Mixed Non-Veg Fried Rice', NULL, 280, 'non-veg', true, false, NULL),
  ('rb-25', 'rice-biryani', 'Rice, Biryani & Pulao', 'Curd Rice', NULL, 130, 'veg', true, false, NULL),
  ('br-1', 'breads', 'Roti, Naan & Indian Breads', 'Tandoori Roti', NULL, 20, 'veg', true, false, NULL),
  ('br-2', 'breads', 'Roti, Naan & Indian Breads', 'Butter Tandoori Roti', NULL, 25, 'veg', true, false, NULL),
  ('br-3', 'breads', 'Roti, Naan & Indian Breads', 'Plain Roti', NULL, 15, 'veg', true, false, NULL),
  ('br-4', 'breads', 'Roti, Naan & Indian Breads', 'Chapati', NULL, 15, 'veg', true, false, NULL),
  ('br-5', 'breads', 'Roti, Naan & Indian Breads', 'Lachha Paratha', NULL, 50, 'veg', true, true, NULL),
  ('br-6', 'breads', 'Roti, Naan & Indian Breads', 'Plain Paratha', NULL, 40, 'veg', true, false, NULL),
  ('br-7', 'breads', 'Roti, Naan & Indian Breads', 'Aloo Paratha', NULL, 70, 'veg', true, false, NULL),
  ('br-8', 'breads', 'Roti, Naan & Indian Breads', 'Gobi Paratha', NULL, 70, 'veg', true, false, NULL),
  ('br-9', 'breads', 'Roti, Naan & Indian Breads', 'Paneer Paratha', NULL, 100, 'veg', true, true, NULL),
  ('br-10', 'breads', 'Roti, Naan & Indian Breads', 'Plain Naan', NULL, 40, 'veg', true, false, NULL),
  ('br-11', 'breads', 'Roti, Naan & Indian Breads', 'Butter Naan', NULL, 50, 'veg', true, true, NULL),
  ('br-12', 'breads', 'Roti, Naan & Indian Breads', 'Garlic Naan', NULL, 70, 'veg', true, true, NULL),
  ('br-13', 'breads', 'Roti, Naan & Indian Breads', 'Cheese Naan', NULL, 100, 'veg', true, false, NULL),
  ('br-14', 'breads', 'Roti, Naan & Indian Breads', 'Cheese Garlic Naan', NULL, 120, 'veg', true, true, NULL),
  ('br-15', 'breads', 'Roti, Naan & Indian Breads', 'Peshawari Naan', NULL, 100, 'veg', true, false, NULL),
  ('br-16', 'breads', 'Roti, Naan & Indian Breads', 'Kulcha', NULL, 40, 'veg', true, false, NULL),
  ('br-17', 'breads', 'Roti, Naan & Indian Breads', 'Butter Kulcha', NULL, 50, 'veg', true, false, NULL),
  ('br-18', 'breads', 'Roti, Naan & Indian Breads', 'Onion Kulcha', NULL, 60, 'veg', true, false, NULL),
  ('br-19', 'breads', 'Roti, Naan & Indian Breads', 'Missi Roti', NULL, 40, 'veg', true, false, NULL),
  ('br-20', 'breads', 'Roti, Naan & Indian Breads', 'Roomali Roti', NULL, 35, 'veg', true, false, NULL),
  ('cv-1', 'chinese-veg', 'Chinese Veg', 'Veg Hakka Noodles', NULL, 170, 'veg', true, true, NULL),
  ('cv-2', 'chinese-veg', 'Chinese Veg', 'Schezwan Noodles', NULL, 190, 'veg', true, false, NULL),
  ('cv-3', 'chinese-veg', 'Chinese Veg', 'Chilli Garlic Noodles', NULL, 190, 'veg', true, false, NULL),
  ('cv-4', 'chinese-veg', 'Chinese Veg', 'Singapore Noodles', NULL, 210, 'veg', true, false, NULL),
  ('cv-5', 'chinese-veg', 'Chinese Veg', 'Veg Chowmein', NULL, 160, 'veg', true, false, NULL),
  ('cv-6', 'chinese-veg', 'Chinese Veg', 'Veg American Chopsuey', NULL, 220, 'veg', true, false, NULL),
  ('cv-7', 'chinese-veg', 'Chinese Veg', 'Veg Fried Rice', NULL, 170, 'veg', true, false, NULL),
  ('cv-8', 'chinese-veg', 'Chinese Veg', 'Schezwan Fried Rice', NULL, 190, 'veg', true, false, NULL),
  ('cv-9', 'chinese-veg', 'Chinese Veg', 'Garlic Fried Rice', NULL, 190, 'veg', true, false, NULL),
  ('cv-10', 'chinese-veg', 'Chinese Veg', 'Burnt Garlic Rice', NULL, 200, 'veg', true, false, NULL),
  ('cv-11', 'chinese-veg', 'Chinese Veg', 'Chilli Paneer', NULL, 230, 'veg', true, true, NULL),
  ('cv-12', 'chinese-veg', 'Chinese Veg', 'Veg Manchurian', NULL, 180, 'veg', true, true, NULL),
  ('cv-13', 'chinese-veg', 'Chinese Veg', 'Mushroom Chilli', NULL, 240, 'veg', true, false, NULL),
  ('cv-14', 'chinese-veg', 'Chinese Veg', 'Baby Corn Chilli', NULL, 220, 'veg', true, false, NULL),
  ('cv-15', 'chinese-veg', 'Chinese Veg', 'Crispy Veg', NULL, 200, 'veg', true, false, NULL),
  ('cv-16', 'chinese-veg', 'Chinese Veg', 'Veg Spring Roll', NULL, 160, 'veg', true, true, NULL),
  ('cv-17', 'chinese-veg', 'Chinese Veg', 'Paneer Spring Roll', NULL, 190, 'veg', true, false, NULL),
  ('cv-18', 'chinese-veg', 'Chinese Veg', 'Veg Momos (Steamed)', NULL, 120, 'veg', true, true, NULL),
  ('cv-19', 'chinese-veg', 'Chinese Veg', 'Veg Momos (Fried)', NULL, 140, 'veg', true, false, NULL),
  ('cv-20', 'chinese-veg', 'Chinese Veg', 'Veg Momos (Tandoori)', NULL, 180, 'veg', true, true, NULL),
  ('cv-21', 'chinese-veg', 'Chinese Veg', 'Paneer Momos', NULL, 160, 'veg', true, false, NULL),
  ('cv-22', 'chinese-veg', 'Chinese Veg', 'Chilli Garlic Potato', NULL, 180, 'veg', true, false, NULL),
  ('cv-23', 'chinese-veg', 'Chinese Veg', 'Honey Chilli Cauliflower', NULL, 200, 'veg', true, false, NULL),
  ('cv-24', 'chinese-veg', 'Chinese Veg', 'Veg Wonton', NULL, 180, 'veg', true, false, NULL),
  ('cv-25', 'chinese-veg', 'Chinese Veg', 'Veg Hot Garlic Sauce', NULL, 200, 'veg', true, false, NULL),
  ('cv-26', 'chinese-veg', 'Chinese Veg', 'Veg Triple Schezwan Rice', NULL, 230, 'veg', true, false, NULL),
  ('cv-27', 'chinese-veg', 'Chinese Veg', 'Veg Hong Kong Noodles', NULL, 210, 'veg', true, false, NULL),
  ('cv-28', 'chinese-veg', 'Chinese Veg', 'Chilli Mushroom Dry', NULL, 240, 'veg', true, false, NULL),
  ('cv-29', 'chinese-veg', 'Chinese Veg', 'Corn Salt & Pepper', NULL, 180, 'veg', true, false, NULL),
  ('cv-30', 'chinese-veg', 'Chinese Veg', 'Veg Manchow Soup', NULL, 120, 'veg', true, false, NULL),
  ('cnv-1', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Hakka Noodles', NULL, 220, 'non-veg', true, true, NULL),
  ('cnv-2', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Schezwan Noodles', NULL, 240, 'non-veg', true, false, NULL),
  ('cnv-3', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Chowmein', NULL, 220, 'non-veg', true, false, NULL),
  ('cnv-4', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Garlic Noodles', NULL, 240, 'non-veg', true, false, NULL),
  ('cnv-5', 'chinese-non-veg', 'Chinese Non-Veg', 'Egg Hakka Noodles', NULL, 190, 'egg', true, false, NULL),
  ('cnv-6', 'chinese-non-veg', 'Chinese Non-Veg', 'Egg Chowmein', NULL, 180, 'egg', true, false, NULL),
  ('cnv-7', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Fried Rice', NULL, 220, 'non-veg', true, true, NULL),
  ('cnv-8', 'chinese-non-veg', 'Chinese Non-Veg', 'Egg Fried Rice', NULL, 190, 'egg', true, false, NULL),
  ('cnv-9', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Schezwan Rice', NULL, 240, 'non-veg', true, false, NULL),
  ('cnv-10', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Triple Rice', NULL, 280, 'non-veg', true, false, NULL),
  ('cnv-11', 'chinese-non-veg', 'Chinese Non-Veg', 'Chilli Chicken Dry', NULL, 260, 'non-veg', true, true, NULL),
  ('cnv-12', 'chinese-non-veg', 'Chinese Non-Veg', 'Chilli Chicken Gravy', NULL, 280, 'non-veg', true, false, NULL),
  ('cnv-13', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Manchurian', NULL, 260, 'non-veg', true, false, NULL),
  ('cnv-14', 'chinese-non-veg', 'Chinese Non-Veg', 'Garlic Chicken', NULL, 280, 'non-veg', true, false, NULL),
  ('cnv-15', 'chinese-non-veg', 'Chinese Non-Veg', 'Lemon Chicken', NULL, 280, 'non-veg', true, false, NULL),
  ('cnv-16', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Hong Kong Style', NULL, 300, 'non-veg', true, false, NULL),
  ('cnv-17', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Hot Garlic Sauce', NULL, 300, 'non-veg', true, false, NULL),
  ('cnv-18', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Lollipop', NULL, 280, 'non-veg', true, true, NULL),
  ('cnv-19', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Spring Roll', NULL, 220, 'non-veg', true, false, NULL),
  ('cnv-20', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Momos (Steamed)', NULL, 160, 'non-veg', true, true, NULL),
  ('cnv-21', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Momos (Fried)', NULL, 180, 'non-veg', true, false, NULL),
  ('cnv-22', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Momos (Tandoori)', NULL, 220, 'non-veg', true, true, NULL),
  ('cnv-23', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Wonton', NULL, 220, 'non-veg', true, false, NULL),
  ('cnv-24', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Salt & Pepper', NULL, 280, 'non-veg', true, false, NULL),
  ('cnv-25', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken American Chopsuey', NULL, 280, 'non-veg', true, false, NULL),
  ('cnv-26', 'chinese-non-veg', 'Chinese Non-Veg', 'Mixed Non-Veg Noodles', NULL, 280, 'non-veg', true, false, NULL),
  ('cnv-27', 'chinese-non-veg', 'Chinese Non-Veg', 'Prawn Hakka Noodles', NULL, 300, 'non-veg', true, false, NULL),
  ('cnv-28', 'chinese-non-veg', 'Chinese Non-Veg', 'Prawn Fried Rice', NULL, 300, 'non-veg', true, false, NULL),
  ('cnv-29', 'chinese-non-veg', 'Chinese Non-Veg', 'Fish Chilli', NULL, 300, 'non-veg', true, false, NULL),
  ('cnv-30', 'chinese-non-veg', 'Chinese Non-Veg', 'Chicken Manchow Soup', NULL, 150, 'non-veg', true, false, NULL),
  ('sp-1', 'soups', 'Hot Soups', 'Tomato Soup', NULL, 100, 'veg', true, true, NULL),
  ('sp-2', 'soups', 'Hot Soups', 'Sweet Corn Veg Soup', NULL, 120, 'veg', true, false, NULL),
  ('sp-3', 'soups', 'Hot Soups', 'Hot & Sour Veg Soup', NULL, 120, 'veg', true, false, NULL),
  ('sp-4', 'soups', 'Hot Soups', 'Clear Veg Soup', NULL, 100, 'veg', true, false, NULL),
  ('sp-5', 'soups', 'Hot Soups', 'Cream of Mushroom Soup', NULL, 140, 'veg', true, false, NULL),
  ('sp-6', 'soups', 'Hot Soups', 'Lemon Coriander Soup', NULL, 120, 'veg', true, false, NULL),
  ('sp-7', 'soups', 'Hot Soups', 'Veg Manchow Soup', NULL, 120, 'veg', true, true, NULL),
  ('sp-8', 'soups', 'Hot Soups', 'Chicken Sweet Corn Soup', NULL, 150, 'non-veg', true, false, NULL),
  ('sp-9', 'soups', 'Hot Soups', 'Chicken Hot & Sour Soup', NULL, 150, 'non-veg', true, false, NULL),
  ('sp-10', 'soups', 'Hot Soups', 'Chicken Clear Soup', NULL, 130, 'non-veg', true, false, NULL),
  ('sp-11', 'soups', 'Hot Soups', 'Chicken Manchow Soup', NULL, 150, 'non-veg', true, true, NULL),
  ('sp-12', 'soups', 'Hot Soups', 'Cream of Chicken Soup', NULL, 170, 'non-veg', true, false, NULL),
  ('sp-13', 'soups', 'Hot Soups', 'Lemon Coriander Chicken Soup', NULL, 150, 'non-veg', true, false, NULL),
  ('sp-14', 'soups', 'Hot Soups', 'Seafood Soup', NULL, 200, 'non-veg', true, false, NULL),
  ('dr-1', 'beverages', 'Drinks, Shakes & Juices', 'Mineral Water (1 Ltr)', NULL, 40, 'veg', true, false, NULL),
  ('dr-1-half', 'beverages', 'Drinks, Shakes & Juices', 'Mineral Water (500ml)', NULL, 20, 'veg', true, false, NULL),
  ('dr-2', 'beverages', 'Drinks, Shakes & Juices', 'Soda', NULL, 30, 'veg', true, false, NULL),
  ('dr-3', 'beverages', 'Drinks, Shakes & Juices', 'Soft Drink (Bottle / 600ml)', NULL, 60, 'veg', true, false, NULL),
  ('dr-3-can', 'beverages', 'Drinks, Shakes & Juices', 'Soft Drink (Can / 250ml)', NULL, 40, 'veg', true, false, NULL),
  ('dr-4', 'beverages', 'Drinks, Shakes & Juices', 'Fresh Lime Water', NULL, 50, 'veg', true, false, NULL),
  ('dr-5', 'beverages', 'Drinks, Shakes & Juices', 'Fresh Lime Soda', NULL, 60, 'veg', true, false, NULL),
  ('dr-6', 'beverages', 'Drinks, Shakes & Juices', 'Sweet Lassi', NULL, 80, 'veg', true, true, NULL),
  ('dr-7', 'beverages', 'Drinks, Shakes & Juices', 'Salted Lassi', NULL, 70, 'veg', true, false, NULL),
  ('dr-8', 'beverages', 'Drinks, Shakes & Juices', 'Mango Lassi', NULL, 100, 'veg', true, true, NULL),
  ('dr-9', 'beverages', 'Drinks, Shakes & Juices', 'Plain Buttermilk', NULL, 40, 'veg', true, false, NULL),
  ('dr-10', 'beverages', 'Drinks, Shakes & Juices', 'Masala Chaas', NULL, 50, 'veg', true, false, NULL),
  ('dr-11', 'beverages', 'Drinks, Shakes & Juices', 'Cold Coffee', NULL, 100, 'veg', true, true, NULL),
  ('dr-12', 'beverages', 'Drinks, Shakes & Juices', 'Cold Coffee with Ice Cream', NULL, 140, 'veg', true, true, NULL),
  ('dr-13', 'beverages', 'Drinks, Shakes & Juices', 'Chocolate Milkshake', NULL, 120, 'veg', true, false, NULL),
  ('dr-14', 'beverages', 'Drinks, Shakes & Juices', 'Vanilla Milkshake', NULL, 100, 'veg', true, false, NULL),
  ('dr-15', 'beverages', 'Drinks, Shakes & Juices', 'Strawberry Milkshake', NULL, 120, 'veg', true, false, NULL),
  ('dr-16', 'beverages', 'Drinks, Shakes & Juices', 'Mango Milkshake', NULL, 120, 'veg', true, false, NULL),
  ('dr-17', 'beverages', 'Drinks, Shakes & Juices', 'Oreo Milkshake', NULL, 150, 'veg', true, true, NULL),
  ('dr-18', 'beverages', 'Drinks, Shakes & Juices', 'KitKat Milkshake', NULL, 150, 'veg', true, false, NULL),
  ('dr-19', 'beverages', 'Drinks, Shakes & Juices', 'Banana Shake', NULL, 100, 'veg', true, false, NULL),
  ('dr-20', 'beverages', 'Drinks, Shakes & Juices', 'Dry Fruit Shake', NULL, 180, 'veg', true, true, NULL),
  ('dr-21', 'beverages', 'Drinks, Shakes & Juices', 'Rose Milk', NULL, 80, 'veg', true, false, NULL),
  ('dr-22', 'beverages', 'Drinks, Shakes & Juices', 'Badam Milk', NULL, 100, 'veg', true, false, NULL),
  ('dr-23', 'beverages', 'Drinks, Shakes & Juices', 'Hot Tea', NULL, 20, 'veg', true, false, NULL),
  ('dr-24', 'beverages', 'Drinks, Shakes & Juices', 'Masala Tea', NULL, 30, 'veg', true, true, NULL),
  ('dr-25', 'beverages', 'Drinks, Shakes & Juices', 'Green Tea', NULL, 40, 'veg', true, false, NULL),
  ('dr-26', 'beverages', 'Drinks, Shakes & Juices', 'Black Coffee', NULL, 40, 'veg', true, false, NULL),
  ('dr-27', 'beverages', 'Drinks, Shakes & Juices', 'Cappuccino', NULL, 100, 'veg', true, false, NULL),
  ('dr-28', 'beverages', 'Drinks, Shakes & Juices', 'Espresso', NULL, 80, 'veg', true, false, NULL),
  ('dr-29', 'beverages', 'Drinks, Shakes & Juices', 'Hot Chocolate', NULL, 120, 'veg', true, false, NULL),
  ('dr-30', 'beverages', 'Drinks, Shakes & Juices', 'Fresh Orange Juice', NULL, 100, 'veg', true, false, NULL),
  ('dr-31', 'beverages', 'Drinks, Shakes & Juices', 'Sweet Lime Juice', NULL, 100, 'veg', true, false, NULL),
  ('dr-32', 'beverages', 'Drinks, Shakes & Juices', 'Watermelon Juice', NULL, 80, 'veg', true, false, NULL),
  ('dr-33', 'beverages', 'Drinks, Shakes & Juices', 'Pineapple Juice', NULL, 100, 'veg', true, false, NULL),
  ('dr-34', 'beverages', 'Drinks, Shakes & Juices', 'Apple Juice', NULL, 120, 'veg', true, false, NULL),
  ('dr-35', 'beverages', 'Drinks, Shakes & Juices', 'Mixed Fruit Juice', NULL, 120, 'veg', true, false, NULL),
  ('mc-1', 'mocktails', 'Signature Mocktails', 'Virgin Mojito', NULL, 120, 'veg', true, true, NULL),
  ('mc-2', 'mocktails', 'Signature Mocktails', 'Mint Mojito', NULL, 130, 'veg', true, false, NULL),
  ('mc-3', 'mocktails', 'Signature Mocktails', 'Blue Lagoon', NULL, 140, 'veg', true, true, NULL),
  ('mc-4', 'mocktails', 'Signature Mocktails', 'Green Apple Mojito', NULL, 140, 'veg', true, false, NULL),
  ('mc-5', 'mocktails', 'Signature Mocktails', 'Strawberry Mojito', NULL, 150, 'veg', true, false, NULL),
  ('mc-6', 'mocktails', 'Signature Mocktails', 'Watermelon Mojito', NULL, 130, 'veg', true, false, NULL),
  ('mc-7', 'mocktails', 'Signature Mocktails', 'Orange Mojito', NULL, 130, 'veg', true, false, NULL),
  ('mc-8', 'mocktails', 'Signature Mocktails', 'Virgin Pina Colada', NULL, 160, 'veg', true, true, NULL),
  ('mc-9', 'mocktails', 'Signature Mocktails', 'Strawberry Cooler', NULL, 140, 'veg', true, false, NULL),
  ('mc-10', 'mocktails', 'Signature Mocktails', 'Mango Cooler', NULL, 140, 'veg', true, false, NULL),
  ('mc-11', 'mocktails', 'Signature Mocktails', 'Kiwi Cooler', NULL, 150, 'veg', true, false, NULL),
  ('mc-12', 'mocktails', 'Signature Mocktails', 'Lemon Iced Tea', NULL, 100, 'veg', true, false, NULL),
  ('mc-13', 'mocktails', 'Signature Mocktails', 'Peach Iced Tea', NULL, 120, 'veg', true, false, NULL),
  ('mc-14', 'mocktails', 'Signature Mocktails', 'Blueberry Iced Tea', NULL, 140, 'veg', true, false, NULL),
  ('mc-15', 'mocktails', 'Signature Mocktails', 'Classic Lemonade', NULL, 90, 'veg', true, false, NULL),
  ('mc-16', 'mocktails', 'Signature Mocktails', 'Masala Lemonade', NULL, 100, 'veg', true, false, NULL),
  ('mc-17', 'mocktails', 'Signature Mocktails', 'Passion Fruit Cooler', NULL, 150, 'veg', true, false, NULL),
  ('mc-18', 'mocktails', 'Signature Mocktails', 'Cranberry Cooler', NULL, 150, 'veg', true, false, NULL),
  ('mc-19', 'mocktails', 'Signature Mocktails', 'Sunrise Mocktail', NULL, 140, 'veg', true, false, NULL),
  ('mc-20', 'mocktails', 'Signature Mocktails', 'Rainbow Mocktail', NULL, 180, 'veg', true, false, NULL),
  ('mc-21', 'mocktails', 'Signature Mocktails', 'Fruit Punch', NULL, 160, 'veg', true, true, NULL),
  ('mc-22', 'mocktails', 'Signature Mocktails', 'Tropical Delight', NULL, 160, 'veg', true, false, NULL),
  ('mc-23', 'mocktails', 'Signature Mocktails', 'Shirley Temple (Non-Alcoholic)', NULL, 150, 'veg', true, false, NULL),
  ('mc-24', 'mocktails', 'Signature Mocktails', 'Cucumber Mint Cooler', NULL, 120, 'veg', true, false, NULL),
  ('mc-25', 'mocktails', 'Signature Mocktails', 'Lychee Cooler', NULL, 150, 'veg', true, false, NULL),
  ('mc-26', 'mocktails', 'Signature Mocktails', 'Blue Curacao Fizz (Non-Alcoholic)', NULL, 150, 'veg', true, true, NULL),
  ('mc-27', 'mocktails', 'Signature Mocktails', 'Virgin Sangria', NULL, 180, 'veg', true, false, NULL),
  ('mc-28', 'mocktails', 'Signature Mocktails', 'Ginger Lemon Fizz', NULL, 120, 'veg', true, false, NULL),
  ('mc-29', 'mocktails', 'Signature Mocktails', 'Kiwi Lemonade', NULL, 140, 'veg', true, false, NULL),
  ('mc-30', 'mocktails', 'Signature Mocktails', 'Special House Mocktail', NULL, 180, 'veg', true, true, NULL),
  ('cst-chicken', 'custom-services', 'Custom & Hotel Services', 'Chicken Making Charge (Per Kg)', NULL, 200, 'non-veg', true, false, 'Cooking customer raw chicken (Handi / Kadhai / Curry)'),
  ('cst-desi-chicken', 'custom-services', 'Custom & Hotel Services', 'Desi Chicken Making Charge', NULL, 250, 'non-veg', true, false, 'Desi fowl preparation with special Indian spices'),
  ('cst-mutton', 'custom-services', 'Custom & Hotel Services', 'Mutton Making Charge (Per Kg)', NULL, 300, 'non-veg', true, false, 'Cooking customer raw mutton in Champaran / Handi style'),
  ('cst-fish', 'custom-services', 'Custom & Hotel Services', 'Fish Making / Fry Charge', NULL, 180, 'non-veg', true, false, 'Cleaning, marinating and frying/curry of customer fish'),
  ('cst-ice', 'custom-services', 'Custom & Hotel Services', 'Ice Cube Bucket / Glass Service', NULL, 50, 'veg', true, false, 'Cold ice bucket with glasses and fresh cut lemon'),
  ('cst-packing', 'custom-services', 'Custom & Hotel Services', 'Takeaway Packing & Container Charge', NULL, 30, 'veg', true, false, 'Leak-proof food grade packaging containers')
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  category_title = EXCLUDED.category_title,
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  price = EXCLUDED.price,
  dietary = EXCLUDED.dietary,
  is_available = EXCLUDED.is_available,
  popular = EXCLUDED.popular,
  description = EXCLUDED.description;

-- ==============================================================================
-- SETUP COMPLETE: Hotel RJ database is ready in Supabase!
-- ==============================================================================
