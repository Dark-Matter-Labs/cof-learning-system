-- supabase/v0.10-feedback.sql
-- Feedback loop tables
-- Run in Supabase SQL Editor

-- 1. Add node_refs to newsletters (tracks which nodes contributed to each newsletter)
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS node_refs UUID[] DEFAULT '{}';

-- 2. Persist query context so feedback can reference contributing nodes
CREATE TABLE IF NOT EXISTS query_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  response   TEXT NOT NULL,
  node_refs  UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_sessions_author ON query_sessions(author_id);

ALTER TABLE query_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own query sessions" ON query_sessions
  FOR ALL USING (author_id = auth.uid());

-- 3. Feedback records (one per user-submitted correction)
CREATE TABLE IF NOT EXISTS feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type   TEXT NOT NULL CHECK (source_type IN ('reflection', 'query', 'newsletter')),
  source_id     UUID NOT NULL,
  feedback_text TEXT NOT NULL,
  applied_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_author ON feedback(author_id);
CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(source_type, source_id);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own feedback" ON feedback
  FOR ALL USING (author_id = auth.uid());
