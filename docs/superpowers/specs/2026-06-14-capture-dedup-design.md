# Capture-time dedup (Phase 3, slice 2)

**Date:** 2026-06-14
**Status:** Approved

## Goal

When a node is promoted, detect whether it near-duplicates an existing vetted
node (reusing slice 1's embeddings + `match_nodes`), and surface it in the
Review inbox as a "Possible duplicate" the team can dismiss or archive. Capture
stays instant — detection is async, on embed.

## Detection (on embed)

- `upsertNodeEmbedding` now **returns** `number[] | null` (the embedding it
  computed, or `null` when skipped/unavailable).
- New `src/lib/llm/dedup.ts`:
  - `DUP_SIMILARITY_THRESHOLD = 0.88` (named, tunable).
  - `findAndRecordDuplicate(admin, nodeId, embedding): Promise<void>` —
    `rpc('match_nodes', { query_embedding: embedding, match_count: 5 })`, drop
    the node itself, take the top remaining; if `similarity >= threshold`,
    upsert a `duplicate_candidates` row `(node_id = nodeId, similar_node_id =
    match.id, similarity, status 'open')`. Non-fatal.
- `indexNode(admin, node)` (in `embedNode.ts`): `const emb = await
  upsertNodeEmbedding(...); if (emb) await findAndRecordDuplicate(...)`. The two
  promote hooks (`/api/nodes/[id]` PATCH, `capture/process` single auto-promote)
  call `indexNode` instead of `upsertNodeEmbedding`.

`node_id` is the newly-promoted (likely duplicate); `similar_node_id` is the
existing vetted match (the original). Skipping on unchanged content means
no repeat detection on re-embeds.

## Schema — `supabase/v1.2-duplicate-candidates.sql` (SQL editor)

```sql
create table if not exists duplicate_candidates (
  id              uuid primary key default gen_random_uuid(),
  node_id         uuid not null references nodes(id) on delete cascade,
  similar_node_id uuid not null references nodes(id) on delete cascade,
  similarity      float not null,
  status          text not null default 'open',  -- open | dismissed | resolved
  created_at      timestamptz not null default now(),
  unique (node_id, similar_node_id)
);
create index if not exists duplicate_candidates_status on duplicate_candidates(status);
alter table duplicate_candidates enable row level security;
create policy "auth read dupes"   on duplicate_candidates for select to authenticated using (true);
create policy "auth update dupes" on duplicate_candidates for update to authenticated using (true) with check (true);
-- inserts (detection) happen via the service-role key (bypasses RLS).
```

## Resolve — `PATCH /api/duplicates/[id]` (withAuth)

Body `{ status: 'dismissed' | 'resolved' }`, validated. Updates the candidate
row. "Not a duplicate" → `dismissed`. "Archive as duplicate" is a client
two-step: archive the new node via the existing `PATCH /api/nodes/[id]`
(`status: 'archived'`) **and** `PATCH /api/duplicates/[id]` → `resolved`. The
row preserves the dup→original link; no content-merge.

## Inbox UI

- `src/app/review/page.tsx`: fetch `duplicate_candidates` where `status='open'`,
  plus the `id, title` of every `node_id`/`similar_node_id` (one `in(...)`
  lookup). Pass `duplicates: ReviewDuplicate[]` (each: id, similarity, the two
  node summaries) to `SystemHealthClient`.
- `SystemHealthClient`: a "Possible duplicates" section above the queue,
  rendering a new `DuplicateItem` per candidate (new ↔ existing + similarity,
  **Not a duplicate** / **Archive as duplicate**, optimistic remove on action).

## Tests

- `dedup.findAndRecordDuplicate`: records when top non-self ≥ threshold; nothing
  when below; nothing when only self returned (mock rpc + upsert).
- `embedNode`: `upsertNodeEmbedding` returns the embedding on success / null on
  skip; `indexNode` calls detect only when an embedding came back.
- `DuplicateItem`: renders both titles + similarity; Dismiss and
  Archive-as-duplicate fire the right callbacks.
- `review/page` data shaping (open candidates → ReviewDuplicate with titles).
- tsc 0, lint 0, full suite green.

## Rollout (you)

Run `supabase/v1.2-duplicate-candidates.sql` in the Supabase SQL editor. No new
key — reuses Voyage embeddings from slice 1.

## Out of scope

Content-merge (distillation already does LLM merge); dedup of non-promoted/raw
captures; cross-author clustering (a later slice).
