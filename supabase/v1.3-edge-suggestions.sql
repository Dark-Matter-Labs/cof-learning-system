-- supabase/v1.3-edge-suggestions.sql
-- Phase 3, slice 3: semantic edge resolution. Stores mid-confidence semantic
-- connection matches for human confirm/dismiss in the Review inbox. Inserted by
-- src/lib/agents/semanticEdges.ts (service-role). Run in the Supabase SQL editor.
-- Depends on v1.1-embeddings.sql (match_nodes RPC).

create table if not exists edge_suggestions (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid not null references nodes(id) on delete cascade,
  target_id   uuid not null references nodes(id) on delete cascade,  -- semantically matched node
  edge_type   text not null references edge_types(id),
  rationale   text,                              -- LLM's reason, shown in review
  similarity  float not null,
  status      text not null default 'open',      -- open | accepted | dismissed
  created_at  timestamptz not null default now(),
  unique (source_id, target_id, edge_type)
);

create index if not exists edge_suggestions_status on edge_suggestions(status);

alter table edge_suggestions enable row level security;

drop policy if exists "auth read edge suggestions" on edge_suggestions;
create policy "auth read edge suggestions" on edge_suggestions
  for select to authenticated using (true);

drop policy if exists "auth update edge suggestions" on edge_suggestions;
create policy "auth update edge suggestions" on edge_suggestions
  for update to authenticated using (true) with check (true);

-- Inserts (detection) happen via the service-role key, which bypasses RLS.
