-- =============================================================================
-- Hotel RJ - STEP 1 of 2: device pairing tables + policies (SAFE, additive)
-- =============================================================================
-- Run this FIRST. It only ADDS things; the existing open policies stay, so every
-- current device keeps working exactly as before. After this you can pair devices.
-- Prerequisites: docs/SECURITY_SETUP.md (owner user + email OTP).
-- =============================================================================

-- 1. Paired devices registry ---------------------------------------------------
CREATE TABLE IF NOT EXISTS paired_devices (
  session_id UUID PRIMARY KEY,
  label TEXT NOT NULL DEFAULT 'Device',
  paired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked BOOLEAN NOT NULL DEFAULT false
);

-- 2. Shared app settings (holds the hashed manager PIN) ------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paired_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Helper: is the caller a paired, non-revoked device? -----------------------
CREATE OR REPLACE FUNCTION public.is_paired_device()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.paired_devices d
    WHERE d.session_id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
      AND d.revoked = false
  );
$$;
REVOKE ALL ON FUNCTION public.is_paired_device() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_paired_device() TO authenticated;

-- 6. Paired devices: full access to operational tables -------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bills','audit_logs','expenses','menu_items','rooms','tables_config','app_settings']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "paired devices full access" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "paired devices full access" ON %I FOR ALL TO authenticated USING (public.is_paired_device()) WITH CHECK (public.is_paired_device())',
      t
    );
  END LOOP;
END $$;

-- 7. Device registry policies ---------------------------------------------------
-- Any authenticated user may register itself (only the owner can authenticate,
-- because sign-ups are disabled). Only paired devices may list / revoke.
DROP POLICY IF EXISTS "register self" ON paired_devices;
CREATE POLICY "register self" ON paired_devices FOR INSERT TO authenticated
  WITH CHECK (session_id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid);

DROP POLICY IF EXISTS "update self" ON paired_devices;
CREATE POLICY "update self" ON paired_devices FOR UPDATE TO authenticated
  USING (session_id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid OR public.is_paired_device())
  WITH CHECK (true);

DROP POLICY IF EXISTS "paired read devices" ON paired_devices;
CREATE POLICY "paired read devices" ON paired_devices FOR SELECT TO authenticated
  USING (public.is_paired_device() OR session_id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid);
