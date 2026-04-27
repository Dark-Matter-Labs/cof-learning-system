-- supabase/v0.8-llm-usage.sql
-- Per-call LLM usage log for cost monitoring
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS llm_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent         TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cached        BOOLEAN NOT NULL DEFAULT false,
  user_id       UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_agent ON llm_usage(agent);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user ON llm_usage(user_id);

ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read llm_usage"
  ON llm_usage FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert llm_usage"
  ON llm_usage FOR INSERT TO authenticated WITH CHECK (true);
