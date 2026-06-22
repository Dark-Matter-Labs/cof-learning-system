# Embedding spine + semantic query retrieval (Phase 3, slice 1)

**Date:** 2026-06-14
**Status:** Approved

## Goal

Stand up a vector-search foundation (Voyage `voyage-3.5`, 1024-dim, via
pgvector) and wire the first consumer: semantic top-k retrieval for the
Ask/Query path, replacing today's lexical substring match. Graceful fallback so
nothing breaks before the backfill runs or if the key is unset.

## Provider decision

- Voyage `voyage-3.5`, output dimension **1024**. New env var `VOYAGE_API_KEY`
  (local + Vercel). Anthropic's recommended embeddings partner.
- Asymmetric input types: `input_type: "document"` for stored nodes,
  `"query"` for the search string.
- The exact request/response shape will be confirmed against Voyage's API docs
  at build time (WebFetch) rather than guessed.

## Schema — `supabase/v1.1-embeddings.sql` (applied in the SQL editor)

A **separate table**, not a column on `nodes` (which is `select('*')`-ed
everywhere; a 1024-float column would bloat every payload):

```sql
create extension if not exists vector;

create table if not exists node_embeddings (
  node_id uuid primary key references nodes(id) on delete cascade,
  embedding vector(1024) not null,
  model text not null default 'voyage-3.5',
  content_hash text not null,
  updated_at timestamptz not null default now()
);
create index if not exists node_embeddings_hnsw
  on node_embeddings using hnsw (embedding vector_cosine_ops);

alter table node_embeddings enable row level security;
-- permissive read for authenticated (mirrors project RLS); writes are
-- service-role (bypass RLS).
create policy "authenticated read embeddings" on node_embeddings
  for select to authenticated using (true);
```

`match_nodes` — SECURITY DEFINER RPC returning top-k vetted nodes by cosine
similarity:

```sql
create or replace function match_nodes(
  query_embedding vector(1024),
  match_count int default 30
) returns table (id uuid, similarity float)
language sql stable security definer set search_path = public as $$
  select e.node_id, 1 - (e.embedding <=> query_embedding) as similarity
  from node_embeddings e
  join nodes n on n.id = e.node_id
  where n.status in ('promoted', 'human_reviewed')
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
```

## Components

### `src/lib/llm/embeddings.ts`
- `embedText(text, inputType?): Promise<number[] | null>` and
  `embedTexts(texts, inputType?): Promise<(number[] | null)[]>`.
- Calls Voyage; returns `null`/no-op when `VOYAGE_API_KEY` is unset (dev-safe,
  mirrors the LLM stub provider). All failures caught and logged — never throw
  to callers.
- `contentHashForNode(title, description): string` — sha256 of the embedded
  text, used to skip re-embedding unchanged content.

### `src/lib/llm/embedNode.ts`
- `upsertNodeEmbedding(supabase, node): Promise<void>` — computes the hash;
  if the stored `content_hash` matches, no-op; else embed
  (`title + "\n" + description`, `input_type: "document"`) and upsert. Fully
  non-fatal (try/catch, logs).
- Called fire-and-forget where a node becomes vetted:
  - `PATCH /api/nodes/[id]` when `status` → `promoted`/`human_reviewed`, and on
    title/description edits (re-embed).
  - `capture/process` single-node path when it auto-promotes, and each
    confident child that auto-promotes.

### `POST /api/embeddings/backfill` (withAuth)
- Selects `promoted`/`human_reviewed` nodes with no current embedding (left
  join / not-in), embeds in batches via `embedTexts`, upserts. Returns
  `{ embedded, skipped }`. Idempotent; run once after setup, re-runnable.

### `src/app/api/query/route.ts` — semantic retrieval
- Embed the query (`input_type: "query"`). If an embedding comes back, call
  `supabase.rpc('match_nodes', { query_embedding, match_count: 30 })` → use the
  returned ids as `matchingIds` (replacing the lexical substring pass). Keep the
  existing 1-hop edge expansion and serialization.
- **Fallback:** if the key is unset, the embedding fails, or `match_nodes`
  returns empty (e.g. backfill not run), fall back to the current lexical
  `matchingIds`. Behaviour is identical to today until embeddings exist.

## Rollout (you)

1. Run `supabase/v1.1-embeddings.sql` in the Supabase SQL editor (enables
   `vector`, creates table/index/RLS/RPC).
2. Add `VOYAGE_API_KEY` to `.env.local` and Vercel.
3. `POST /api/embeddings/backfill` once (a button can come later) to embed
   existing promoted nodes.

## Testing

- `embeddings.ts`: mocked fetch — request shape, batch, no-key no-op, error →
  null; `contentHashForNode` stable + sensitive to changes.
- `embedNode.ts`: skips when hash unchanged; embeds + upserts when changed;
  never throws on embed failure.
- query retrieval-selection (pure helper): given match ids, context restricts to
  them + 1-hop; given empty matches, falls back to lexical.
- tsc 0, lint 0, full suite green.

## Out of scope (later Phase 3 slices)

Capture-time dedup, semantic edge resolution, cross-author distillation — all
reuse `match_nodes` + the embed util.
