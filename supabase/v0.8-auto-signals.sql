-- supabase/v0.8-auto-signals.sql
-- Automated signal ingestion infrastructure
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS auto_signal_sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type    TEXT NOT NULL CHECK (source_type IN ('web', 'slack', 'drive', 'notion', 'rss')),
  topic_node_id  UUID REFERENCES nodes(id) ON DELETE CASCADE,
  config         JSONB NOT NULL DEFAULT '{}',
  -- For web: { "search_query": "...", "keywords": ["..."] }
  -- For slack: { "channel_id": "...", "channel_name": "#..." }
  -- For drive: { "folder_id": "...", "folder_name": "..." }
  -- For notion: { "database_id": "...", "database_name": "..." }
  enabled        BOOLEAN NOT NULL DEFAULT true,
  last_run_at    TIMESTAMPTZ,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_signal_sources_topic ON auto_signal_sources(topic_node_id);
CREATE INDEX IF NOT EXISTS idx_auto_signal_sources_enabled ON auto_signal_sources(enabled) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS seen_external_urls (
  url             TEXT PRIMARY KEY,
  source_type     TEXT NOT NULL,
  topic_node_id   UUID REFERENCES nodes(id) ON DELETE SET NULL,
  signal_node_id  UUID REFERENCES nodes(id) ON DELETE SET NULL,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seen_urls_topic ON seen_external_urls(topic_node_id);

-- Daily auto-signal quota tracking
CREATE TABLE IF NOT EXISTS auto_signal_quota (
  quota_date     DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  signals_created INT NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE auto_signal_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE seen_external_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_signal_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage auto_signal_sources"
  ON auto_signal_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read seen_external_urls"
  ON seen_external_urls FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert seen_external_urls"
  ON seen_external_urls FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can manage auto_signal_quota"
  ON auto_signal_quota FOR ALL TO authenticated USING (true) WITH CHECK (true);
