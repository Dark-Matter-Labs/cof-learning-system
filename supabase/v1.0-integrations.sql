-- supabase/v1.0-integrations.sql
-- Slack, Notion, Folk integration infrastructure
-- Run in Supabase SQL Editor

-- ─── 1. Extend nodes table with source tracking columns ─────────────────────

ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS source       TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_ref   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_payload JSONB  DEFAULT NULL;

-- Dedup index: (source, source_ref) prevents the same external item being
-- captured twice (e.g. same Slack message shortcut clicked twice).
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_source_ref
  ON nodes(source, source_ref)
  WHERE source IS NOT NULL AND source_ref IS NOT NULL;

-- General lookup index for filtering nodes by source
CREATE INDEX IF NOT EXISTS idx_nodes_source
  ON nodes(source)
  WHERE source IS NOT NULL;

-- ─── 2. source_integrations — per-user OAuth tokens ─────────────────────────
-- Tokens are encrypted in the application layer (AES-256-GCM) before storage.
-- The token_iv column holds the base64-encoded IV used for each row's ciphertext.

CREATE TABLE IF NOT EXISTS source_integrations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT        NOT NULL CHECK (provider IN ('slack', 'notion', 'folk')),
  access_token  TEXT        NOT NULL,   -- AES-256-GCM ciphertext
  refresh_token TEXT,                   -- nullable, AES-256-GCM ciphertext
  token_iv      TEXT        NOT NULL,   -- base64 IV
  scope         TEXT,
  team_id       TEXT,       -- Slack workspace ID / Notion workspace ID / null for folk
  team_name     TEXT,       -- human-readable workspace name
  bot_user_id   TEXT,       -- Slack: bot user ID; null for others
  raw_response  JSONB       DEFAULT '{}',  -- encrypted-at-app-layer full OAuth response
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One token row per (user, provider, workspace). For folk (no workspaces)
  -- team_id should be set to the constant 'default'.
  UNIQUE (user_id, provider, team_id)
);

CREATE INDEX IF NOT EXISTS idx_source_integrations_user
  ON source_integrations(user_id);

CREATE INDEX IF NOT EXISTS idx_source_integrations_provider
  ON source_integrations(provider);

ALTER TABLE source_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own tokens
CREATE POLICY "Users manage own integrations"
  ON source_integrations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- updated_at trigger (reuse existing function from schema.sql)
CREATE TRIGGER source_integrations_updated_at
  BEFORE UPDATE ON source_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. folk_contacts — mirror of Folk contact records ───────────────────────

CREATE TABLE IF NOT EXISTS folk_contacts (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  folk_id        TEXT    NOT NULL UNIQUE,   -- Folk's own stable ID
  name           TEXT    NOT NULL,
  email          TEXT,
  company        TEXT,
  role           TEXT,
  folk_groups    TEXT[]  NOT NULL DEFAULT '{}',
  raw_data       JSONB   NOT NULL DEFAULT '{}',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folk_contacts_folk_id
  ON folk_contacts(folk_id);

CREATE INDEX IF NOT EXISTS idx_folk_contacts_email
  ON folk_contacts(email)
  WHERE email IS NOT NULL;

ALTER TABLE folk_contacts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read/manage contacts (shared team CRM mirror)
CREATE POLICY "Authenticated users can read folk_contacts"
  ON folk_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage folk_contacts"
  ON folk_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 4. folk_contact_node_links — join table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS folk_contact_node_links (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  folk_contact_id UUID    NOT NULL REFERENCES folk_contacts(id) ON DELETE CASCADE,
  node_id         UUID    NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  link_type       TEXT    NOT NULL DEFAULT 'mentioned'
                          CHECK (link_type IN ('mentioned', 'authored', 'participant')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (folk_contact_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_folk_links_contact
  ON folk_contact_node_links(folk_contact_id);

CREATE INDEX IF NOT EXISTS idx_folk_links_node
  ON folk_contact_node_links(node_id);

ALTER TABLE folk_contact_node_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read folk_contact_node_links"
  ON folk_contact_node_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage folk_contact_node_links"
  ON folk_contact_node_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
