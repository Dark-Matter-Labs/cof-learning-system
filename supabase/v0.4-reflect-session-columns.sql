-- COF OS v0.4 — Reflection Session columns for /reflect page
-- Adds human_responses, decisions, convergence_snapshot, participants to existing table
-- MUST use IF NOT EXISTS — existing Phase 6 rows must survive

ALTER TABLE reflection_sessions
  ADD COLUMN IF NOT EXISTS human_responses      JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decisions            JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS convergence_snapshot JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS participants         JSONB NOT NULL DEFAULT '[]';
