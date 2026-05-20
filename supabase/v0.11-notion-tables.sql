-- supabase/v0.11-notion-tables.sql
-- Notion integration tables: tracks synced pages and block references
-- Run in Supabase SQL Editor

-- ─────────────────────────────────────────────
-- notion_page_syncs — tracks which Notion pages have been imported
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notion_page_syncs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notion_page_id  TEXT NOT NULL,
  notion_page_url TEXT,
  title           TEXT,
  last_edited_at  TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ,
  node_id         uuid REFERENCES public.nodes(id) ON DELETE SET NULL,
  sync_status     VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_notion_page_syncs_user_page
    UNIQUE (user_id, notion_page_id)
);

CREATE INDEX IF NOT EXISTS idx_notion_page_syncs_user_id
  ON public.notion_page_syncs (user_id);

CREATE INDEX IF NOT EXISTS idx_notion_page_syncs_node_id
  ON public.notion_page_syncs (node_id)
  WHERE node_id IS NOT NULL;

ALTER TABLE public.notion_page_syncs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notion_page_syncs"
  ON public.notion_page_syncs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notion_page_syncs"
  ON public.notion_page_syncs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notion_page_syncs"
  ON public.notion_page_syncs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notion_page_syncs"
  ON public.notion_page_syncs FOR DELETE
  USING (auth.uid() = user_id);
