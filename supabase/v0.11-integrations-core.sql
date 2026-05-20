-- supabase/v0.11-integrations-core.sql
-- Integrations core: extend nodes table + source_integrations for OAuth tokens
-- Run in Supabase SQL Editor

-- ─────────────────────────────────────────────
-- Extend nodes with source tracking columns
-- ─────────────────────────────────────────────

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_ref TEXT,
  ADD COLUMN IF NOT EXISTS source_payload JSONB;

-- Dedup index: prevents the same external object being captured twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_source_ref
  ON public.nodes (source, source_ref)
  WHERE source IS NOT NULL AND source_ref IS NOT NULL;

-- Lookup index for filtering by source
CREATE INDEX IF NOT EXISTS idx_nodes_source
  ON public.nodes (source)
  WHERE source IS NOT NULL;

-- ─────────────────────────────────────────────
-- source_integrations — OAuth tokens per user
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.source_integrations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source           VARCHAR(50) NOT NULL,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  workspace_id     TEXT,
  workspace_name   TEXT,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_source_integrations_user_source_workspace
    UNIQUE (user_id, source, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_source_integrations_user_id
  ON public.source_integrations (user_id);

CREATE INDEX IF NOT EXISTS idx_source_integrations_source
  ON public.source_integrations (source);

ALTER TABLE public.source_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own source_integrations"
  ON public.source_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own source_integrations"
  ON public.source_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own source_integrations"
  ON public.source_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own source_integrations"
  ON public.source_integrations FOR DELETE
  USING (auth.uid() = user_id);
