-- COF OS v0.3 — Dual-Model Interface migration
-- Run against your Supabase project in the SQL editor or via CLI

-- ─────────────────────────────────────────────────────────────
-- New node types
-- ─────────────────────────────────────────────────────────────
INSERT INTO node_types (id, label, description, color, sort_order) VALUES
  ('intervention', 'Intervention', 'An action that simultaneously consumes commitment resources AND tests assumptions — the bridge between both models', '#534AB7', 11),
  ('signal',       'Signal',       'Feedback from reality that must update both context understanding and allocation decisions', '#A32D2D', 12),
  ('goal_space',   'Goal space',   'A resource-addressable outcome field — broader than a single commitment, may contain multiple commitments', '#0F6E56', 13)
ON CONFLICT (id) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  color       = EXCLUDED.color,
  sort_order  = EXCLUDED.sort_order;

-- ─────────────────────────────────────────────────────────────
-- New edge types
-- ─────────────────────────────────────────────────────────────
INSERT INTO edge_types (id, label, is_directional, description) VALUES
  ('serves_commitment',     'Serves commitment',      true,  'This node contributes to delivering a commitment'),
  ('tests_assumption',      'Tests assumption',       true,  'This intervention or test probes whether an assumption holds'),
  ('challenges_assumption', 'Challenges assumption',  true,  'This signal or learning contradicts an existing assumption'),
  ('informs_reallocation',  'Informs reallocation',   true,  'This signal suggests resources should be moved'),
  ('belongs_to_goalspace',  'Belongs to goal space',  true,  'This commitment exists within this goal space'),
  ('consumes_resource',     'Consumes resource',      true,  'This intervention draws from commitment resources')
ON CONFLICT (id) DO UPDATE SET
  label          = EXCLUDED.label,
  description    = EXCLUDED.description,
  is_directional = EXCLUDED.is_directional;

-- ─────────────────────────────────────────────────────────────
-- Tension alerts table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tension_alerts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                    TEXT NOT NULL CHECK (type IN (
                            'assumption_challenged',
                            'test_diverged',
                            'signal_contradicts',
                            'commitment_stalled',
                            'assumption_unsupported'
                          )),
  severity                TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  description             TEXT NOT NULL,
  affected_assumption_id  UUID REFERENCES nodes(id) ON DELETE SET NULL,
  affected_commitment_ids UUID[] DEFAULT '{}',
  source_node_id          UUID REFERENCES nodes(id) ON DELETE SET NULL,
  status                  TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  resolved_by             UUID REFERENCES auth.users(id),
  resolved_action         TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  resolved_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tension_alerts_status     ON tension_alerts(status);
CREATE INDEX IF NOT EXISTS idx_tension_alerts_commitment ON tension_alerts USING GIN(affected_commitment_ids);
CREATE INDEX IF NOT EXISTS idx_tension_alerts_created    ON tension_alerts(created_at DESC);

ALTER TABLE tension_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tension_alerts"
  ON tension_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage tension_alerts"
  ON tension_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for live tension alerts
ALTER PUBLICATION supabase_realtime ADD TABLE tension_alerts;
