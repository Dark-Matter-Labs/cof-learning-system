-- supabase/v0.9-portfolios.sql
-- Portfolio Engineering tables
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  status TEXT DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'complete', 'paused', 'archived')),
  current_step INT DEFAULT 1 CHECK (current_step BETWEEN 1 AND 13),
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  step_number INT NOT NULL CHECK (step_number BETWEEN 1 AND 13),
  step_name TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  ai_suggestions JSONB,
  human_input TEXT,
  status TEXT DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'ai_drafted', 'in_review', 'complete')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_steps_portfolio ON portfolio_steps(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_author ON portfolios(author_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_status ON portfolios(status);

-- Row level security
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own portfolios" ON portfolios
  FOR ALL USING (author_id = auth.uid());

CREATE POLICY "Users manage own portfolio steps" ON portfolio_steps
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM portfolios WHERE author_id = auth.uid())
  );
