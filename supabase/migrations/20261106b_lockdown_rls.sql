-- =============================================================================
-- Hotel RJ - STEP 2 of 2: LOCK DOWN the database
-- =============================================================================
-- Run this ONLY AFTER: step 1 is applied, the new app build is on every device,
-- and EVERY device (counter PC, each waiter phone, the owner's phone/browser) is paired.
-- AFTER it runs:
--   * anon (public website, unpaired devices) can only READ menu_items.
--   * Everything else requires a paired, non-revoked device.
--   * Unpaired devices lose cloud access (the local Wi-Fi sync keeps working).
-- EMERGENCY ROLLBACK is at the bottom of this file.
-- =============================================================================

-- 4. Remove the old wide-open policies -----------------------------------------
DROP POLICY IF EXISTS "Allow public read-write access to bills" ON bills;
DROP POLICY IF EXISTS "Allow public read-write access to audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow public read-write access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow public read-write access to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Allow public read-write access to rooms" ON rooms;
DROP POLICY IF EXISTS "Allow public read-write access to tables_config" ON tables_config;

-- 5. Public (guest QR menu): read-only menu ------------------------------------
DROP POLICY IF EXISTS "public read menu_items" ON menu_items;
CREATE POLICY "public read menu_items" ON menu_items FOR SELECT TO anon, authenticated USING (true);

-- ROLLBACK (emergency only, re-opens the database):
--   CREATE POLICY "Allow public read-write access to bills" ON bills FOR ALL TO anon USING (true) WITH CHECK (true);
--   ...repeat for audit_logs, expenses, menu_items, rooms, tables_config
