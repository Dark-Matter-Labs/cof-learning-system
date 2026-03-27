-- COF OS v0.4 — Goal Hierarchy migration
-- Adds trigger_outcome node type and goal-hierarchy edge types
-- Run against your Supabase project in the SQL editor or via CLI

-- ─────────────────────────────────────────────────────────────
-- Add trigger_outcome node type and update goal_space description
-- ─────────────────────────────────────────────────────────────
INSERT INTO node_types (id, label, description, color, sort_order) VALUES
  ('trigger_outcome', 'Trigger outcome', 'A specific measurable outcome that indicates progress toward a goal space', '#085041', 15)
ON CONFLICT (id) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  color       = EXCLUDED.color,
  sort_order  = EXCLUDED.sort_order;

UPDATE node_types
SET description = 'A resource-addressable outcome field containing trigger outcomes and commitments'
WHERE id = 'goal_space';

-- ─────────────────────────────────────────────────────────────
-- Add four new edge types for the goal hierarchy
-- ─────────────────────────────────────────────────────────────
INSERT INTO edge_types (id, label, is_directional, description) VALUES
  ('advances_goal',       'Advances goal',       true, 'This trigger outcome advances progress toward a goal space'),
  ('targets_outcome',     'Targets outcome',     true, 'This hunch or intervention targets a specific trigger outcome'),
  ('indicates_progress',  'Indicates progress',  true, 'This signal indicates progress toward a trigger outcome'),
  ('assigned_to_outcome', 'Assigned to outcome', true, 'This commitment is assigned to deliver a specific trigger outcome')
ON CONFLICT (id) DO UPDATE SET
  label          = EXCLUDED.label,
  description    = EXCLUDED.description,
  is_directional = EXCLUDED.is_directional;
