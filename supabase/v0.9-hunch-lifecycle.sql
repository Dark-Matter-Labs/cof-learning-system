-- supabase/v0.9-hunch-lifecycle.sql
-- HUNCH lifecycle rename + add 'holding' stage
-- Run in Supabase SQL Editor (or via supabase db push)

-- Step 1: Widen constraint to accept both old and new values temporarily
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_lifecycle_stage_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_lifecycle_stage_check
  CHECK (lifecycle_stage IN (
    'hypothesis','uncertainty','navigation','coherence','holding','archived',
    'divergence','attractor','convergence','execution'
  ));

-- Step 2: Migrate existing data to new names
UPDATE nodes SET lifecycle_stage = 'hypothesis'  WHERE lifecycle_stage = 'divergence';
UPDATE nodes SET lifecycle_stage = 'uncertainty' WHERE lifecycle_stage = 'attractor';
UPDATE nodes SET lifecycle_stage = 'navigation'  WHERE lifecycle_stage = 'convergence';
UPDATE nodes SET lifecycle_stage = 'coherence'   WHERE lifecycle_stage = 'execution';

-- Step 3: Update column default
ALTER TABLE nodes ALTER COLUMN lifecycle_stage SET DEFAULT 'hypothesis';

-- Step 4: Tighten constraint to new values only
ALTER TABLE nodes DROP CONSTRAINT nodes_lifecycle_stage_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_lifecycle_stage_check
  CHECK (lifecycle_stage IN ('hypothesis','uncertainty','navigation','coherence','holding','archived'));
