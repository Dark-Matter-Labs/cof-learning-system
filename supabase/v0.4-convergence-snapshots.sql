-- COF OS v0.4 — Convergence Snapshots migration
-- Stores convergence score time-series per goal space
-- Run against your Supabase project in the SQL editor or via CLI

-- ─────────────────────────────────────────────────────────────
-- convergence_snapshots table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS convergence_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_space_id         UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  score                 FLOAT NOT NULL,
  factor_breakdown      JSONB NOT NULL DEFAULT '{}',
  node_count_at_snapshot INT NOT NULL DEFAULT 0,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: latest snapshot for a goal space (trajectory badge, Phase 5)
CREATE INDEX IF NOT EXISTS idx_convergence_snapshots_goal_space_computed
  ON convergence_snapshots(goal_space_id, computed_at DESC);

-- Index: all snapshots by computed_at (sparkline queries, Phase 5)
CREATE INDEX IF NOT EXISTS idx_convergence_snapshots_computed
  ON convergence_snapshots(computed_at DESC);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security (permissive model — matches all other tables)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE convergence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read convergence_snapshots"
  ON convergence_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage convergence_snapshots"
  ON convergence_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
