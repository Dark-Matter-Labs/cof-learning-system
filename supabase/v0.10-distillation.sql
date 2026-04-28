-- v0.10: Distillation candidates — stores LLM-suggested node merges pending human review
CREATE TABLE distillation_candidates (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  node_ids       UUID[]      NOT NULL,
  merged_title   TEXT        NOT NULL,
  merged_summary TEXT        NOT NULL,
  merged_node_type TEXT      NOT NULL,
  rationale      TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_by     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ,
  resolved_node_id UUID      REFERENCES nodes(id) ON DELETE SET NULL
);

ALTER TABLE distillation_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own distillation candidates"
  ON distillation_candidates FOR ALL TO authenticated
  USING  (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
