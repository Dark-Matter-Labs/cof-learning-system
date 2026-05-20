-- supabase/v0.11-folk-contacts.sql
-- Folk CRM contact sync tables
-- Run in Supabase SQL Editor

-- ─────────────────────────────────────────────
-- folk_contacts — synced Folk contact records
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.folk_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folk_id      TEXT NOT NULL,
  name         TEXT,
  email        TEXT,
  company      TEXT,
  folk_payload JSONB,
  synced_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_folk_contacts_user_folk_id
    UNIQUE (user_id, folk_id)
);

CREATE INDEX IF NOT EXISTS idx_folk_contacts_user_id
  ON public.folk_contacts (user_id);

CREATE INDEX IF NOT EXISTS idx_folk_contacts_folk_id
  ON public.folk_contacts (folk_id);

ALTER TABLE public.folk_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own folk_contacts"
  ON public.folk_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folk_contacts"
  ON public.folk_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folk_contacts"
  ON public.folk_contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folk_contacts"
  ON public.folk_contacts FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- folk_contact_node_links — M:M contact ↔ node
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.folk_contact_node_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folk_contact_id uuid NOT NULL REFERENCES public.folk_contacts(id) ON DELETE CASCADE,
  node_id         uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  link_type       VARCHAR(50) NOT NULL DEFAULT 'participant',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_folk_contact_node_link
    UNIQUE (folk_contact_id, node_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_folk_contact_node_links_user_id
  ON public.folk_contact_node_links (user_id);

CREATE INDEX IF NOT EXISTS idx_folk_contact_node_links_node_id
  ON public.folk_contact_node_links (node_id);

CREATE INDEX IF NOT EXISTS idx_folk_contact_node_links_contact_id
  ON public.folk_contact_node_links (folk_contact_id);

ALTER TABLE public.folk_contact_node_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own folk_contact_node_links"
  ON public.folk_contact_node_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folk_contact_node_links"
  ON public.folk_contact_node_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folk_contact_node_links"
  ON public.folk_contact_node_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folk_contact_node_links"
  ON public.folk_contact_node_links FOR DELETE
  USING (auth.uid() = user_id);
