const fs = require('fs');
const path = require('path');
const { DEFAULT_MENU_CATEGORIES, DEFAULT_ROOMS, DEFAULT_TABLES_CONFIG } = require('../electron/defaultHotelData.cjs');

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

let sql = `-- ==============================================================================
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
`;

const roomValues = DEFAULT_ROOMS.map((r) => {
  return `  (${escapeSql(r.id)}, ${escapeSql(r.name)}, ${escapeSql(r.tier)}, ${Number(r.pricePerNight) || 1600}, ${escapeSql(r.status || 'available')}, ${Number(r.maxGuests) || 2}, ${escapeSql(r.bedType || '1 King Bed')})`;
}).join(',\n');

sql += roomValues;
sql += `
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
`;

const tableValues = DEFAULT_TABLES_CONFIG.map((t) => {
  return `  (${escapeSql(t.id)}, ${escapeSql(t.name)}, ${escapeSql(t.section || 'dining')}, ${Number(t.capacity) || 4}, ${t.isActive !== false ? 'true' : 'false'}, ${Number(t.sortOrder) || 1})`;
}).join(',\n');

sql += tableValues;
sql += `
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
`;

const menuValues = [];
for (const cat of DEFAULT_MENU_CATEGORIES) {
  if (Array.isArray(cat.items)) {
    for (const item of cat.items) {
      menuValues.push(
        `  (${escapeSql(item.id)}, ${escapeSql(cat.id)}, ${escapeSql(cat.title)}, ${escapeSql(item.name)}, ${escapeSql(item.hindiName || null)}, ${Number(item.price) || 0}, ${escapeSql(item.dietary || 'veg')}, ${item.isAvailable !== false ? 'true' : 'false'}, ${item.popular ? 'true' : 'false'}, ${escapeSql(item.description || null)})`
      );
    }
  }
}

sql += menuValues.join(',\n');
sql += `
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
`;

const targetPath = path.resolve(__dirname, '../supabase_schema.sql');
fs.writeFileSync(targetPath, sql, 'utf8');
console.log('Successfully wrote comprehensive schema and seed data to supabase_schema.sql');
