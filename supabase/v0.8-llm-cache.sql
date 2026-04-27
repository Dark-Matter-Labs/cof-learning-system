-- supabase/v0.8-llm-cache.sql
-- LLM response cache to avoid duplicate calls
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS llm_cache (
  cache_key    TEXT PRIMARY KEY,
  agent        TEXT NOT NULL,
  model        TEXT NOT NULL,
  response     JSONB NOT NULL,
  input_tokens INT,
  output_tokens INT,
  expires_at   TIMESTAMPTZ,
  hit_count    INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_cache_agent ON llm_cache(agent);
CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON llm_cache(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE llm_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read llm_cache"
  ON llm_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage llm_cache"
  ON llm_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);
