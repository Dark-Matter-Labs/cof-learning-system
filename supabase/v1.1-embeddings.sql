-- supabase/v1.1-embeddings.sql
-- Phase 3, slice 1: vector-search foundation (pgvector + Voyage voyage-3.5, 1024-dim).
-- Run in the Supabase SQL editor.

-- 1. pgvector extension
create extension if not exists vector;

-- 2. Embeddings live in their own table — NOT a column on `nodes`, which is
--    select('*')-ed across the app (the graph loads every node); a 1024-float
--    column would bloat every payload.
create table if not exists node_embeddings (
  node_id      uuid primary key references nodes(id) on delete cascade,
  embedding    vector(1024) not null,
  model        text not null default 'voyage-3.5',
  content_hash text not null,
  updated_at   timestamptz not null default now()
);

-- 3. Approximate-nearest-neighbour index (cosine).
create index if not exists node_embeddings_hnsw
  on node_embeddings using hnsw (embedding vector_cosine_ops);

-- 4. RLS: authenticated users may read; writes happen server-side with the
--    service-role key (which bypasses RLS).
alter table node_embeddings enable row level security;

drop policy if exists "authenticated read embeddings" on node_embeddings;
create policy "authenticated read embeddings" on node_embeddings
  for select to authenticated using (true);

-- 5. Top-k similarity search over *vetted* nodes. SECURITY DEFINER so the
--    similarity scan can read embeddings; it only ever returns promoted /
--    human_reviewed nodes.
create or replace function match_nodes(
  query_embedding vector(1024),
  match_count int default 30
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
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
