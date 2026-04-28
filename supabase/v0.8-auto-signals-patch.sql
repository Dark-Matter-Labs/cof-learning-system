-- supabase/v0.8-auto-signals-patch.sql
-- Atomic quota increment to prevent race conditions
-- Run in Supabase SQL Editor AFTER v0.8-auto-signals.sql

CREATE OR REPLACE FUNCTION increment_signal_quota(p_count INT, p_cap INT DEFAULT 20)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_new INT;
BEGIN
  -- Upsert with atomic increment, capped at p_cap
  INSERT INTO auto_signal_quota (quota_date, signals_created)
    VALUES (v_today, LEAST(p_count, p_cap))
  ON CONFLICT (quota_date) DO UPDATE
    SET signals_created = LEAST(
      auto_signal_quota.signals_created + p_count,
      p_cap
    )
  RETURNING signals_created INTO v_new;

  RETURN v_new;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION increment_signal_quota(INT, INT) TO authenticated;

-- Restrict auto_signal_quota to SELECT only for authenticated (writes via RPC only)
DROP POLICY IF EXISTS "Authenticated users can manage auto_signal_quota" ON auto_signal_quota;
CREATE POLICY "Authenticated users can read auto_signal_quota"
  ON auto_signal_quota FOR SELECT TO authenticated USING (true);

-- Fix auto_signal_sources RLS to scope to owner
DROP POLICY IF EXISTS "Authenticated users can manage auto_signal_sources" ON auto_signal_sources;
CREATE POLICY "Users can manage their own signal sources"
  ON auto_signal_sources FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
