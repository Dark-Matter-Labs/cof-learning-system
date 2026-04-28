-- v0.9: Add mentioned_in edge type for person-mention connections from LLM extraction
INSERT INTO edge_types (id, label, is_directional) VALUES
  ('mentioned_in', 'Mentioned in', true)
ON CONFLICT (id) DO NOTHING;
