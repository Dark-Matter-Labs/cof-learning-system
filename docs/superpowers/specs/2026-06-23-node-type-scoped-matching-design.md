# Node-Type-Scoped Embedding Matching — Design

**Date:** 2026-06-23
**Phase:** 3, hardening (follow-on to slices 1–3)
**Status:** Approved (brainstorming)

## Problem

A real-data shakedown (109 vetted nodes backfilled) showed capture-time dedup
produces mostly false positives. Of 9 unique flagged pairs, only 1 was a true
duplicate. The rest were **entity nodes** — `person`/`site` with short, similar
text that embeds near-identically (`"Robyn" ≈ "Michelle"` at 0.933) — plus junk
test nodes. The false positives score **higher** than the true positive (0.888),
so threshold tuning cannot separate them. Semantic edge matching (slice 3) has
the same latent flaw: matching a suggested `target_title` against the person
cluster would pick an arbitrary person.

## Goal

Scope embedding-based **matching** (dedup + semantic edge fallback) to
knowledge/claim node types, and require same-type for dedup — without touching
embedding coverage (keep embedding everything for future retrieval) or the
whole-graph query retrieval path.

## Decisions (user-approved)

- **New explicit `isSemanticMatchable` flag** per node type (not reusing
  `isDistillable`, which excludes `signal` — the one true dedup win — nor an
  exclude-list, which silently breaks when new entity types appear).
- **Matchable set:** `hunch`, `assumption_background`, `assumption_foreground`,
  `learning`, `signal`, `option`. Everything else — `test`, `commitment`,
  `goal_space`, `trigger_outcome`, `meeting_notes`, and types absent from the
  config (`person`, `site`) — is excluded.
- **Dedup requires same node_type**; skips entirely when the source node's type
  is not matchable.
- **Semantic edges** restrict candidates to the matchable set (cross-type within
  that set is allowed — that's what edges are for). Entity connections keep
  relying on exact-title matching.
- **Embeddings stay broad** — narrow matching only.
- **Clean up** the stale false-positive `duplicate_candidates` as part of rollout.

## Components

### 1. Config — `src/lib/config/captureTypes.ts`
- Add `readonly isSemanticMatchable: boolean` to `CaptureTypeConfig`.
- Set `true` for `hunch`, `assumption_background`, `assumption_foreground`,
  `learning`, `signal`, `option`; `false` for `test`, `commitment`,
  `goal_space`, `trigger_outcome`, `meeting_notes`.
- Add helper:
  ```ts
  /** Node types eligible for embedding-based dedup/edge matching. */
  export function getSemanticMatchableTypes(): readonly string[] {
    return CAPTURE_TYPES.filter(t => t.isSemanticMatchable).map(t => t.id);
  }
  ```
  `person`/`site` are not in `CAPTURE_TYPES`, so they are excluded automatically.

### 2. RPC — `supabase/v1.4-match-nodes-type-filter.sql`
`create or replace function match_nodes` gaining an optional param, run in the
SQL editor. Backward compatible: `allowed_types` defaults to `null` = no filter
(so `/api/query` retrieval is unchanged).
```sql
create or replace function match_nodes(
  query_embedding vector(1024),
  match_count int default 30,
  allowed_types text[] default null
)
returns table (id uuid, similarity float)
language sql stable security definer set search_path = public
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
```

### 3. Dedup — `src/lib/llm/dedup.ts` + `src/lib/llm/embedNode.ts`
- `EmbeddableNode` gains `readonly node_type: string`.
- `findAndRecordDuplicate(supabase, node, embedding)` — change the 2nd arg from
  `nodeId: string` to `node: { id: string; node_type: string }`.
  - If `!getSemanticMatchableTypes().includes(node.node_type)` → return early
    (no dedup for entity/structural nodes).
  - Else call `match_nodes` with `allowed_types: [node.node_type]` (same-type),
    keeping `match_count: 5` and the existing `DUP_SIMILARITY_THRESHOLD` (0.88)
    and `filter(m => m.id !== node.id)` logic. Record the `duplicate_candidates`
    row as today.
- `indexNode` passes the full node (now including `node_type`) to
  `findAndRecordDuplicate`.

### 4. Semantic edges — `src/lib/agents/semanticEdges.ts`
- Import `getSemanticMatchableTypes`.
- In `resolveSemantically`, call `match_nodes` with a third arg
  `getSemanticMatchableTypes()` so semantic edge candidates are restricted to
  knowledge types. Everything else (tiering, thresholds, existing-edge skip,
  non-fatal behavior) unchanged.

### 5. Hook call sites — pass `node_type` into `indexNode`
Both embed-on-promote hooks construct the `EmbeddableNode`; add `node_type`:
- `src/app/api/capture/process/route.ts` — single-node hook uses the classified
  node type; document-child hook uses the child's node type.
- `src/app/api/nodes/[id]/route.ts` — PATCH hook uses `node.node_type`.

### 6. Rollout cleanup (one-off, after migration)
Delete the current open `duplicate_candidates` (all created during the shakedown,
mostly entity false positives) and re-run dedup detection over the backfilled
embeddings with the fixed same-type logic, so the Review inbox starts clean.
A throwaway script (not committed) mirroring the prior backfill tool; reads creds
from the main-repo `.env`.

## Data flow

```
embed-on-promote (unchanged) → embeds every vetted node
  indexNode(node w/ node_type)
    upsertNodeEmbedding (unchanged, embeds all)
    findAndRecordDuplicate(node, embedding)
      node_type not matchable? → skip
      else match_nodes(emb, 5, [node_type])  → same-type candidates only
        top ≥ 0.88 → duplicate_candidates row

capture/process unresolved connections → resolveSemantically
  match_nodes(emb, 5, getSemanticMatchableTypes())  → knowledge candidates only
    tier → edge (≥0.80) | edge_suggestions (0.65–0.80) | drop
```

## Error handling
Unchanged from slices 2–3: dedup and semantic edges remain non-fatal
(try/catch, no-op without embeddings, rpc errors logged). The new
`allowed_types` param is additive and null-safe.

## Testing
- `captureTypes` — `getSemanticMatchableTypes()` returns exactly the 6 expected
  ids (and excludes `test`, `commitment`, `goal_space`, `trigger_outcome`,
  `meeting_notes`).
- `dedup` — skips (no rpc) when source `node_type` is not matchable; calls
  `match_nodes` with `allowed_types: [node_type]` when matchable; still records a
  same-type candidate above threshold; still non-fatal on rpc error.
- `semanticEdges` — passes `getSemanticMatchableTypes()` as `allowed_types`;
  existing tier/skip/non-fatal tests still pass.
- `embedNode` — `indexNode` forwards `node_type` to `findAndRecordDuplicate`.
- Gate: clean `tsc` (0), `eslint .` (0), `vitest run` (green).

## Rollout
1. Run `supabase/v1.4-match-nodes-type-filter.sql` in the SQL editor.
2. Run the one-off cleanup (delete stale open `duplicate_candidates`, re-detect).
3. No new key. Depends on slice 1–3 infra already in place.

## Out of scope
- Threshold changes (type-scoping is the fix, not the threshold).
- Re-embedding or narrowing embedding coverage.
- Exact-title edge matching behavior (correct for entities already).
- Voyage billing / rate-limit decision (separate ops call).
- Retrieval (`/api/query`) scoping — intentionally unchanged (`allowed_types`
  defaults to null there).
