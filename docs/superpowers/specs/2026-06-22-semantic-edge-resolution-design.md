# Semantic Edge Resolution — Design

**Date:** 2026-06-22
**Phase:** 3, slice 3
**Status:** Approved (brainstorming)

## Problem

`resolveConnections` (`src/lib/agents/connectionResolver.ts`) turns the LLM's
`suggested_connections` (`{ target_title, edge_type, rationale }`) into graph
edges by matching `target_title` against existing node titles with a
case-insensitive **exact** `ilike`. Any suggestion whose title does not match a
real node exactly is **silently dropped**. The LLM paraphrases titles
constantly, so most suggested edges are lost and the graph is under-connected.

## Goal

Recover dropped suggestions by matching them **semantically** against the
existing vetted graph, reusing the slice-1 embedding spine (`embedText` +
`match_nodes`). Preserve capture-time speed and the "never block the request
path / embeddings are async + non-fatal" principle.

## Decisions (user-approved)

- **Tiered handling** of semantic matches: auto-create above a high similarity,
  surface a middle band in the Review inbox for confirm/dismiss, drop below.
- **Forward-only** — applies to nodes processed from now on. No backfill pass.
  (Suggestions remain stored in each node's `llm_extraction`, so a backfill
  endpoint could be added later.)
- **Exact-first, async semantic fallback** — the exact `ilike` path is unchanged
  and stays inline; only the misses go through the async semantic step.

## Architecture & flow

```
capture/process (inline — unchanged speed)
  └─ resolveConnections(source, suggestions) -> { created, unresolved }
       ├─ exact ilike match → insert edge now            (as today)
       └─ no exact match    → collect into `unresolved`, return it
            │
            └─ after(() => resolveSemantically(unresolved))   [async, non-fatal]
                 for each unresolved suggestion:
                   embedText(target_title, 'query') → match_nodes(vec, 5)
                   top non-self vetted hit, similarity s:
                     s ≥ EDGE_AUTO_THRESHOLD      → insert edge (weight = s)
                     EDGE_REVIEW ≤ s < EDGE_AUTO  → insert edge_suggestions (open)
                     s < EDGE_REVIEW              → drop
```

- The exact path is untouched: same behavior, same speed, still inline.
- The semantic path runs in `after()`, is wrapped in try/catch, and no-ops when
  `VOYAGE_API_KEY` is unset — a failure never breaks capture.
- `match_nodes` searches only **promoted / human_reviewed** nodes (the ones with
  embeddings) — the right bar for an auto/suggested edge.
- The existing duplicate-edge check plus `UNIQUE(source_id, target_id, edge_type)`
  prevent double edges across the exact and semantic paths.

## Schema

New table (mirrors `duplicate_candidates`). Pending edges deliberately do **not**
go in `edges`, so the graph never renders unconfirmed connections.

```sql
-- supabase/v1.3-edge-suggestions.sql  (run in the Supabase SQL editor)
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
```

## Thresholds

Constants in `src/lib/agents/semanticEdges.ts`, tunable:

- `EDGE_AUTO_THRESHOLD = 0.80` — create the edge automatically.
- `EDGE_REVIEW_THRESHOLD = 0.65` — between this and auto → review; below → drop.

These are **starting values**. The match is asymmetric — a bare `target_title`
(query) against `title + description` (document) — so real matches score lower
than the symmetric doc-to-doc dedup case (0.88), and the band is intentionally
looser to catch paraphrased titles with a conservative auto bar. A debug log of
`(target_title, matched title, similarity, tier)` is emitted so the first real
captures can be eyeballed and the thresholds tuned. Auto-created semantic edges
use `weight = similarity` (exact edges keep `weight = 1`) so the graph reflects
confidence.

## Components

- **`connectionResolver.ts` (modified)** — return `{ created, unresolved }`
  instead of `number`; collect misses into `unresolved` rather than dropping.
- **`semanticEdges.ts` (new)** — `resolveSemantically(sourceId, suggestions,
  supabase, userId)`: embed each `target_title`, `match_nodes`, tier the top hit
  into an `edges` insert (auto) or `edge_suggestions` insert (review); skip if an
  edge already exists; fully non-fatal; no-op without embeddings.
- **`PATCH /api/edge-suggestions/[id]` (new)** — `withAuth` + `ok/fail`.
  `{ action: 'accept' }` inserts the real `edges` row then marks the suggestion
  `accepted`; `{ action: 'dismiss' }` marks it `dismissed` (no edge). Invalid
  action → `fail`.
- **`SuggestedConnectionItem.tsx` (new)** — renders
  `{source} —[edge_type]→ {target}`, the rationale, `{pct}% match`, and
  **Add connection** / **Dismiss** buttons (optimistic, like `DuplicateItem`).
- **`SystemHealthClient.tsx` (modified)** — new "Suggested connections" section
  rendering the items; optimistic accept/dismiss calling the new endpoint.
- **`review/page.tsx` (modified)** — 5th parallel query for `open`
  `edge_suggestions`; fold the source/target node ids into the existing title
  lookup; pass resolved suggestions to the client.
- **Caller wiring** — both `resolveConnections` call sites in
  `capture/process/route.ts` consume `unresolved` and schedule
  `resolveSemantically` via `after()`.

## Error handling

- Semantic step is wrapped in try/catch and runs in `after()` — never blocks or
  fails the capture response.
- `embedText` returns null without `VOYAGE_API_KEY`; `resolveSemantically`
  no-ops on null embeddings.
- `match_nodes` rpc errors are logged and swallowed.
- Accept/dismiss endpoint validates the action and returns the standard envelope.

## Testing

- `semanticEdges` — tiering (auto / review / drop), self-filter, existing-edge
  skip, non-fatal on rpc error, no-op without embedding.
- `connectionResolver` — returns unresolved misses; still auto-creates exact
  matches; respects edge-type validation and existing-edge skip.
- `edge-suggestions` route — accept inserts edge + marks accepted; dismiss marks
  dismissed; invalid action → fail.
- `SuggestedConnectionItem` — renders pair + rationale + percent; fires
  add/dismiss callbacks.
- `ReviewPage` — stays green with the new 5th query.
- Gate: clean `tsc --noEmit` (0), `eslint .` (0), `vitest run` (green).

## Rollout

1. Run `supabase/v1.3-edge-suggestions.sql` in the Supabase SQL editor.
2. `VOYAGE_API_KEY` already set (slice 1). Depends on `match_nodes`
   (`v1.1-embeddings.sql`) and the embedding backfill being in place.

## Out of scope

- Backfill of historically-dropped suggestions (forward-only for v1).
- Content-merge or edge re-typing in review (accept/dismiss only).
- Changing the exact-match path's behavior or status filter.
- Graph-view affordances for suggested (pending) edges — they live only in the
  review inbox until accepted.
