-- Add insight_date column to nodes table
-- Nullable: existing nodes keep NULL (timeline falls back to created_at)
-- Defaults to NULL (capture form sets it explicitly)
ALTER TABLE nodes ADD COLUMN insight_date TIMESTAMPTZ DEFAULT NULL;

-- Index for timeline ordering queries
CREATE INDEX idx_nodes_insight_date ON nodes(insight_date DESC NULLS LAST);
