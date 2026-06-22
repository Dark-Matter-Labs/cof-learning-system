-- supabase/v1.2-duplicate-candidates.sql
-- Phase 3, slice 2: capture-time dedup. Records near-duplicate pairs detected
-- when a node is embedded on promote (see src/lib/llm/dedup.ts). Run in the
-- Supabase SQL editor. Depends on v1.1-embeddings.sql (match_nodes RPC).

create table if not exists duplicate_candidates (
  id              uuid primary key default gen_random_uuid(),
  node_id         uuid not null references nodes(id) on delete cascade,  -- the likely duplicate (newer)
  similar_node_id uuid not null references nodes(id) on delete cascade,  -- the existing original
  similarity      float not null,
  status          text not null default 'open',  -- open | dismissed | resolved
  created_at      timestamptz not null default now(),
  unique (node_id, similar_node_id)
);

create index if not exists duplicate_candidates_status on duplicate_candidates(status);

alter table duplicate_candidates enable row level security;

drop policy if exists "auth read dupes" on duplicate_candidates;
create policy "auth read dupes" on duplicate_candidates
  for select to authenticated using (true);

drop policy if exists "auth update dupes" on duplicate_candidates;
create policy "auth update dupes" on duplicate_candidates
  for update to authenticated using (true) with check (true);

-- Inserts (detection) happen via the service-role key, which bypasses RLS.
