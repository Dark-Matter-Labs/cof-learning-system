-- COF OS v0.4 — Reflection Sessions migration
-- Stores LLM reflection analysis results
-- Run against your Supabase project in the SQL editor or via CLI

-- ─────────────────────────────────────────────────────────────
-- reflection_sessions table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reflection_sessions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_reflection        JSONB NOT NULL DEFAULT '{}',
  node_count_at_reflection  INT NOT NULL DEFAULT 0,
  triggered_by              TEXT DEFAULT 'on_demand' CHECK (triggered_by IN ('on_demand', 'threshold')),
  run_by                    UUID REFERENCES auth.users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: latest reflection sessions (report listing, Phase 6)
CREATE INDEX IF NOT EXISTS idx_reflection_sessions_created
  ON reflection_sessions(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security (permissive model — matches all other tables)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE reflection_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reflection_sessions"
  ON reflection_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage reflection_sessions"
  ON reflection_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
