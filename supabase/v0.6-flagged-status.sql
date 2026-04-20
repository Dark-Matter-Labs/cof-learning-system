-- Add 'flagged_for_review' to nodes status enum
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_status_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_status_check CHECK (
  status IN (
    'raw', 'processing', 'llm_reviewed', 'human_reviewed',
    'promoted', 'error', 'archived', 'falsified', 'suspended',
    'flagged_for_review'
  )
);
