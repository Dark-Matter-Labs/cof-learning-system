-- supabase/v1.4-match-nodes-type-filter.sql
-- Phase 3 hardening: node-type-scoped matching. Adds an optional allowed_types
-- filter to match_nodes so dedup (same-type) and semantic edges (knowledge
-- types) can restrict candidates. Backward compatible: allowed_types defaults
-- to null = unfiltered (query retrieval is unchanged). Run in the SQL editor.

create or replace function match_nodes(
  query_embedding vector(1024),
  match_count int default 30,
  allowed_types text[] default null
)
returns table (id uuid, similarity float)
language sql
stable
security definer
set search_path = public
as $$
  select e.node_id as id,
         1 - (e.embedding <=> query_embedding) as similarity
  from node_embeddings e
  join nodes n on n.id = e.node_id
  where n.status in ('promoted', 'human_reviewed')
    and (allowed_types is null or n.node_type = any(allowed_types))
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
