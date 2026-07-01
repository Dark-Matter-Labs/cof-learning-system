# Node-Type-Scoped Embedding Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope embedding-based dedup and semantic edge matching to knowledge node types (and same-type for dedup), so entity nodes like `person`/`site` stop producing false-positive duplicate/edge suggestions.

**Architecture:** A new per-type `isSemanticMatchable` flag in the capture-type config (single source of truth) + a `getSemanticMatchableTypes()` helper. The `match_nodes` RPC gains an optional `allowed_types` filter (null = unfiltered, so query retrieval is untouched). Dedup skips non-matchable source nodes and matches same-type only; semantic edges restrict candidates to the matchable set. Embedding coverage is unchanged.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (pgvector + `match_nodes` RPC), Voyage embeddings, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-23-node-type-scoped-matching-design.md`

**Worktree/branch:** `.claude/worktrees/phase-1`, branch `phase-3-type-scoping` (off `main`).

**Verification binaries** (avoid npx/rtk; clear `.tsbuildinfo` before tsc):
- tsc: `node ./node_modules/typescript/bin/tsc --noEmit`
- vitest: `node ./node_modules/vitest/vitest.mjs run <paths> --reporter=dot`
- eslint: `node ./node_modules/eslint/bin/eslint.js . -f json -o /tmp/lint.json`

**Matchable set (canonical):** `hunch`, `assumption_background`, `assumption_foreground`, `learning`, `signal`, `option`.

---

## File Structure

- **Modify** `src/lib/config/captureTypes.ts` — add `isSemanticMatchable` to interface + 11 type entries; add `getSemanticMatchableTypes()`.
- **Create** `src/lib/config/__tests__/captureTypes.test.ts` — assert the helper's set (create; if the file already exists, append the `describe` block).
- **Create** `supabase/v1.4-match-nodes-type-filter.sql` — `match_nodes` gains `allowed_types`.
- **Modify** `src/lib/llm/dedup.ts` — `findAndRecordDuplicate` takes a node object, skips non-matchable, same-type match.
- **Modify** `src/lib/llm/__tests__/dedup.test.ts` — new signature + scoping tests.
- **Modify** `src/lib/llm/embedNode.ts` — `EmbeddableNode.node_type`; `indexNode` forwards it.
- **Modify** `src/lib/llm/__tests__/embedNode.test.ts` — add `node_type` to literals; update indexNode assertion.
- **Modify** `src/app/api/capture/process/route.ts`, `src/app/api/nodes/[id]/route.ts`, `src/app/api/embeddings/backfill/route.ts` — pass `node_type` into `indexNode`/`upsertNodeEmbedding`.
- **Modify** `src/lib/agents/semanticEdges.ts` — pass `allowed_types: getSemanticMatchableTypes()`.
- **Modify** `src/lib/agents/__tests__/semanticEdges.test.ts` — assert `allowed_types` passed.

---

## Task 1: Config flag + helper

**Files:**
- Modify: `src/lib/config/captureTypes.ts`
- Test: `src/lib/config/__tests__/captureTypes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/config/__tests__/captureTypes.test.ts` (if it already exists, append only the `describe` block below):

```ts
import { describe, it, expect } from 'vitest';
import { getSemanticMatchableTypes } from '../captureTypes';

describe('getSemanticMatchableTypes', () => {
  it('returns exactly the knowledge/claim types', () => {
    expect([...getSemanticMatchableTypes()].sort()).toEqual(
      ['assumption_background', 'assumption_foreground', 'hunch', 'learning', 'option', 'signal'].sort(),
    );
  });

  it('excludes entity/structural and action types', () => {
    const set = getSemanticMatchableTypes();
    for (const t of ['test', 'commitment', 'goal_space', 'trigger_outcome', 'meeting_notes']) {
      expect(set).not.toContain(t);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/config/__tests__/captureTypes.test.ts --reporter=dot`
Expected: FAIL — `getSemanticMatchableTypes` is not exported.

- [ ] **Step 3: Add the flag to the interface**

In `src/lib/config/captureTypes.ts`, in `interface CaptureTypeConfig`, immediately after the line `readonly isDistillable: boolean;` add:

```ts
  readonly isSemanticMatchable: boolean;
```

- [ ] **Step 4: Set the flag on every type entry**

Each of the 11 entries in `CAPTURE_TYPES` currently ends with `isDistillable: <bool>,`. Add an `isSemanticMatchable:` line right after each type's `isDistillable:` line, with these values:

- `hunch` → `isSemanticMatchable: true,`
- `assumption_background` → `isSemanticMatchable: true,`
- `assumption_foreground` → `isSemanticMatchable: true,`
- `test` → `isSemanticMatchable: false,`
- `learning` → `isSemanticMatchable: true,`
- `option` → `isSemanticMatchable: true,`
- `commitment` → `isSemanticMatchable: false,`
- `signal` → `isSemanticMatchable: true,`
- `goal_space` → `isSemanticMatchable: false,`
- `trigger_outcome` → `isSemanticMatchable: false,`
- `meeting_notes` → `isSemanticMatchable: false,`

- [ ] **Step 5: Add the helper**

At the end of the "Derived config helpers" section (right after the `getDistillableTypes()` function), add:

```ts
/** Node types eligible for embedding-based dedup / semantic edge matching. */
export function getSemanticMatchableTypes(): readonly string[] {
  return CAPTURE_TYPES
    .filter(t => t.isSemanticMatchable)
    .map(t => t.id);
}
```

- [ ] **Step 6: Run the test + tsc**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/config/__tests__/captureTypes.test.ts --reporter=dot` → expect 2 passed.
Run (clear `.tsbuildinfo` first): `node ./node_modules/typescript/bin/tsc --noEmit` → expect 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/config/captureTypes.ts src/lib/config/__tests__/captureTypes.test.ts
git commit -m "feat(config): isSemanticMatchable flag + getSemanticMatchableTypes()"
```

---

## Task 2: `match_nodes` RPC gains `allowed_types`

**Files:**
- Create: `supabase/v1.4-match-nodes-type-filter.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/v1.4-match-nodes-type-filter.sql`:

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/v1.4-match-nodes-type-filter.sql
git commit -m "feat(db): match_nodes optional allowed_types filter"
```

---

## Task 3: Dedup — skip non-matchable, same-type match

**Files:**
- Modify: `src/lib/llm/dedup.ts`
- Test: `src/lib/llm/__tests__/dedup.test.ts`

- [ ] **Step 1: Rewrite the test**

Replace the ENTIRE contents of `src/lib/llm/__tests__/dedup.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findAndRecordDuplicate, DUP_SIMILARITY_THRESHOLD } from '../dedup';

type Match = { id: string; similarity: number };

function makeSupabase(matches: Match[], rpcError: { message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const supabase = {
    rpc: vi.fn().mockResolvedValue({ data: matches, error: rpcError }),
    from: vi.fn(() => ({ upsert })),
    _upsert: upsert,
  };
  return supabase;
}

// 'learning' is in the matchable set; 'person' is not.
const LEARNING = { id: 'self', node_type: 'learning' };

describe('findAndRecordDuplicate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('records the top non-self match when above threshold', async () => {
    const supabase = makeSupabase([
      { id: 'self', similarity: 1 },
      { id: 'other', similarity: 0.92 },
    ]);
    await findAndRecordDuplicate(supabase as never, LEARNING, [0.1, 0.2]);
    expect(supabase._upsert).toHaveBeenCalledWith(
      expect.objectContaining({ node_id: 'self', similar_node_id: 'other', status: 'open' }),
      expect.objectContaining({ onConflict: 'node_id,similar_node_id' }),
    );
  });

  it('scopes the match to the same node_type via allowed_types', async () => {
    const supabase = makeSupabase([{ id: 'self', similarity: 1 }, { id: 'other', similarity: 0.92 }]);
    await findAndRecordDuplicate(supabase as never, LEARNING, [0.1]);
    expect(supabase.rpc).toHaveBeenCalledWith('match_nodes', expect.objectContaining({
      allowed_types: ['learning'],
    }));
  });

  it('skips entirely (no rpc) when the source node_type is not matchable', async () => {
    const supabase = makeSupabase([{ id: 'self', similarity: 1 }, { id: 'other', similarity: 0.99 }]);
    await findAndRecordDuplicate(supabase as never, { id: 'self', node_type: 'person' }, [0.1]);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('records nothing when the best non-self match is below threshold', async () => {
    const supabase = makeSupabase([{ id: 'self', similarity: 1 }, { id: 'other', similarity: 0.5 }]);
    await findAndRecordDuplicate(supabase as never, LEARNING, [0.1]);
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('records nothing when only the node itself comes back', async () => {
    const supabase = makeSupabase([{ id: 'self', similarity: 1 }]);
    await findAndRecordDuplicate(supabase as never, LEARNING, [0.1]);
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('is non-fatal on an rpc error', async () => {
    const supabase = makeSupabase([], { message: 'boom' });
    await expect(findAndRecordDuplicate(supabase as never, LEARNING, [0.1])).resolves.toBeUndefined();
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('uses a threshold strictly below 1 (real near-dupes, not just identical)', () => {
    expect(DUP_SIMILARITY_THRESHOLD).toBeGreaterThan(0.5);
    expect(DUP_SIMILARITY_THRESHOLD).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/llm/__tests__/dedup.test.ts --reporter=dot`
Expected: FAIL — `findAndRecordDuplicate` currently takes a string `nodeId`, and the scoping/skip behavior doesn't exist.

- [ ] **Step 3: Rewrite `dedup.ts`**

Replace the ENTIRE contents of `src/lib/llm/dedup.ts` with:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSemanticMatchableTypes } from '@/lib/config/captureTypes';

/**
 * Cosine-similarity bar for treating two nodes as possible duplicates. Voyage
 * embeddings put genuine near-duplicates well above this; tune as needed.
 */
export const DUP_SIMILARITY_THRESHOLD = 0.88;

interface MatchRow {
  readonly id: string;
  readonly similarity: number;
}

export interface DedupNode {
  readonly id: string;
  readonly node_type: string;
}

/**
 * Given a freshly-embedded node, finds its nearest *same-type* vetted node via
 * the match_nodes RPC and, if similar enough, records an open
 * `duplicate_candidates` row. Only runs for knowledge/claim node types
 * (getSemanticMatchableTypes) — entity/structural nodes (person, site, …) embed
 * near-identically and would produce false positives. Non-fatal — never throws.
 */
export async function findAndRecordDuplicate(
  supabase: SupabaseClient,
  node: DedupNode,
  embedding: number[],
): Promise<void> {
  try {
    if (!getSemanticMatchableTypes().includes(node.node_type)) return;

    const { data, error } = await supabase.rpc('match_nodes', {
      query_embedding: embedding,
      match_count: 5,
      allowed_types: [node.node_type],
    });
    if (error) {
      console.error('[dedup] match_nodes failed:', error.message);
      return;
    }

    const top = ((data ?? []) as MatchRow[])
      .filter(m => m.id !== node.id)
      .sort((a, b) => b.similarity - a.similarity)[0];

    if (!top || top.similarity < DUP_SIMILARITY_THRESHOLD) return;

    await supabase.from('duplicate_candidates').upsert(
      {
        node_id: node.id,
        similar_node_id: top.id,
        similarity: top.similarity,
        status: 'open',
      },
      { onConflict: 'node_id,similar_node_id' },
    );
  } catch (err) {
    console.error('[dedup] detection failed for', node.id, err);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/llm/__tests__/dedup.test.ts --reporter=dot`
Expected: PASS (7 tests).

NOTE: `tsc` will now report an error in `src/lib/llm/embedNode.ts` (its `indexNode` still calls `findAndRecordDuplicate(supabase, node.id, embedding)` — a string where a `DedupNode` is expected). This is EXPECTED and fixed in Task 4. Do not fix `embedNode.ts` here.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/dedup.ts src/lib/llm/__tests__/dedup.test.ts
git commit -m "feat(dedup): scope to matchable types + same-type match"
```

---

## Task 4: Thread `node_type` through `embedNode`

**Files:**
- Modify: `src/lib/llm/embedNode.ts`
- Test: `src/lib/llm/__tests__/embedNode.test.ts`

- [ ] **Step 1: Update the test**

In `src/lib/llm/__tests__/embedNode.test.ts`, make these edits:

(a) Add `node_type` to every node literal so they satisfy the (now-required) `EmbeddableNode.node_type`. Replace each literal as follows:
- Line ~35: `const node = { id: 'n1', title: 'T', description: 'd' };` → `const node = { id: 'n1', title: 'T', description: 'd', node_type: 'learning' };`
- Line ~44: `const node = { id: 'n1', title: 'T', description: 'new' };` → `const node = { id: 'n1', title: 'T', description: 'new', node_type: 'learning' };`
- Line ~57: `const node = { id: 'n1', title: 'T', description: 'd' };` → `const node = { id: 'n1', title: 'T', description: 'd', node_type: 'learning' };`
- Line ~65: `{ id: 'n1', title: 'T', description: 'd' }` → `{ id: 'n1', title: 'T', description: 'd', node_type: 'learning' }`
- Line ~71: `{ id: 'n1', title: '', description: null }` → `{ id: 'n1', title: '', description: null, node_type: 'learning' }`
- Line ~83: `{ id: 'n1', title: 'T', description: 'd' }` → `{ id: 'n1', title: 'T', description: 'd', node_type: 'learning' }`
- Line ~98: `const node = { id: 'n1', title: 'T', description: 'd' };` → `const node = { id: 'n1', title: 'T', description: 'd', node_type: 'learning' };`

(b) In the indexNode test "runs dedup detection when a fresh embedding was produced" (line ~93-94), replace:
```ts
    await indexNode(supabase as never, { id: 'n1', title: 'T', description: 'new' });
    expect(mockFindDup).toHaveBeenCalledWith(supabase, 'n1', [0.5, 0.6]);
```
with:
```ts
    await indexNode(supabase as never, { id: 'n1', title: 'T', description: 'new', node_type: 'learning' });
    expect(mockFindDup).toHaveBeenCalledWith(supabase, { id: 'n1', node_type: 'learning' }, [0.5, 0.6]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/llm/__tests__/embedNode.test.ts --reporter=dot`
Expected: FAIL — indexNode still calls `findAndRecordDuplicate(supabase, node.id, embedding)`, so the assertion `toHaveBeenCalledWith(supabase, { id, node_type }, …)` fails.

- [ ] **Step 3: Update `embedNode.ts`**

(a) Add `node_type` to `EmbeddableNode`:
```ts
export interface EmbeddableNode {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly node_type: string;
}
```

(b) In `indexNode`, change the dedup call. Replace:
```ts
  const embedding = await upsertNodeEmbedding(supabase, node);
  if (embedding) {
    await findAndRecordDuplicate(supabase, node.id, embedding);
  }
```
with:
```ts
  const embedding = await upsertNodeEmbedding(supabase, node);
  if (embedding) {
    await findAndRecordDuplicate(supabase, { id: node.id, node_type: node.node_type }, embedding);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/llm/__tests__/embedNode.test.ts --reporter=dot`
Expected: PASS.

NOTE: `tsc` will now report errors at the three `EmbeddableNode` construction sites (they don't pass `node_type` yet): `src/app/api/capture/process/route.ts`, `src/app/api/nodes/[id]/route.ts`, `src/app/api/embeddings/backfill/route.ts`. EXPECTED — fixed in Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/embedNode.ts src/lib/llm/__tests__/embedNode.test.ts
git commit -m "feat(embed): thread node_type into indexNode/dedup"
```

---

## Task 5: Pass `node_type` at all three call sites

**Files:**
- Modify: `src/app/api/capture/process/route.ts`
- Modify: `src/app/api/nodes/[id]/route.ts`
- Modify: `src/app/api/embeddings/backfill/route.ts`

- [ ] **Step 1: capture/process hook**

In `src/app/api/capture/process/route.ts`, find the single-node index hook (~line 324):
```ts
        after(() => indexNode(createAdminClient(), {
          id: node_id, title: finalTitle, description: node.description ?? null,
        }));
```
Replace with (add `node_type: classifiedNodeType` — the variable computed just above from the extraction):
```ts
        after(() => indexNode(createAdminClient(), {
          id: node_id, title: finalTitle, description: node.description ?? null, node_type: classifiedNodeType,
        }));
```

- [ ] **Step 2: nodes/[id] PATCH hook**

In `src/app/api/nodes/[id]/route.ts`, find (~line 107):
```ts
  const node = data as { id: string; title: string; description: string | null; status: NodeStatus };
  if (node.status === 'promoted' || node.status === 'human_reviewed') {
    after(() => indexNode(createAdminClient(), {
      id: node.id, title: node.title, description: node.description,
    }));
  }
```
Replace with (add `node_type` to the cast and the payload — the PATCH uses `.select()` which returns all columns, so `node_type` is present):
```ts
  const node = data as { id: string; title: string; description: string | null; status: NodeStatus; node_type: string };
  if (node.status === 'promoted' || node.status === 'human_reviewed') {
    after(() => indexNode(createAdminClient(), {
      id: node.id, title: node.title, description: node.description, node_type: node.node_type,
    }));
  }
```

- [ ] **Step 3: backfill route**

In `src/app/api/embeddings/backfill/route.ts`:

(a) Add `node_type` to the node select. Replace:
```ts
      .from('nodes')
      .select('id, title, description')
      .in('status', ['promoted', 'human_reviewed']),
```
with:
```ts
      .from('nodes')
      .select('id, title, description, node_type')
      .in('status', ['promoted', 'human_reviewed']),
```

(b) Pass `node_type` into `upsertNodeEmbedding`. Replace:
```ts
    await upsertNodeEmbedding(admin, {
      id: n.id as string,
      title: n.title as string,
      description: (n.description ?? null) as string | null,
    });
```
with:
```ts
    await upsertNodeEmbedding(admin, {
      id: n.id as string,
      title: n.title as string,
      description: (n.description ?? null) as string | null,
      node_type: n.node_type as string,
    });
```

- [ ] **Step 4: Verify tsc is clean**

Run (clear `.tsbuildinfo` first): `node ./node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors (all three `EmbeddableNode` sites now provide `node_type`).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/capture/process/route.ts "src/app/api/nodes/[id]/route.ts" src/app/api/embeddings/backfill/route.ts
git commit -m "feat(embed): supply node_type at all indexNode/backfill call sites"
```

---

## Task 6: Scope semantic edges to matchable types

**Files:**
- Modify: `src/lib/agents/semanticEdges.ts`
- Test: `src/lib/agents/__tests__/semanticEdges.test.ts`

- [ ] **Step 1: Add the failing assertion**

In `src/lib/agents/__tests__/semanticEdges.test.ts`:

(a) Add an import at the top (after the existing imports):
```ts
import { getSemanticMatchableTypes } from '@/lib/config/captureTypes';
```
(b) In the test `'auto-creates an edge when the top match is at/above the auto threshold'`, add this assertion at the end of the test body (after the existing `expect(...)` calls):
```ts
    expect(supabase.rpc).toHaveBeenCalledWith('match_nodes', expect.objectContaining({
      allowed_types: getSemanticMatchableTypes(),
    }));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/agents/__tests__/semanticEdges.test.ts --reporter=dot`
Expected: FAIL — the rpc is currently called without `allowed_types`.

- [ ] **Step 3: Update `semanticEdges.ts`**

(a) Add the import (after `import { embedText } from '@/lib/llm/embeddings';`):
```ts
import { getSemanticMatchableTypes } from '@/lib/config/captureTypes';
```
(b) In `resolveSemantically`, update the rpc call. Replace:
```ts
      const { data, error } = await supabase.rpc('match_nodes', {
        query_embedding: embedding,
        match_count: 5,
      });
```
with:
```ts
      const { data, error } = await supabase.rpc('match_nodes', {
        query_embedding: embedding,
        match_count: 5,
        allowed_types: getSemanticMatchableTypes(),
      });
```

- [ ] **Step 4: Run the test + tsc**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/agents/__tests__/semanticEdges.test.ts --reporter=dot` → expect all pass.
Run (clear `.tsbuildinfo`): `node ./node_modules/typescript/bin/tsc --noEmit` → expect 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/semanticEdges.ts src/lib/agents/__tests__/semanticEdges.test.ts
git commit -m "feat(edges): scope semantic edge candidates to matchable types"
```

---

## Task 7: Full verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Clear tsbuildinfo and run tsc**

```bash
cd /Users/gurden/Documents/code/cof-learning-system/.claude/worktrees/phase-1
rm -f *.tsbuildinfo
node ./node_modules/typescript/bin/tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
node ./node_modules/eslint/bin/eslint.js . -f json -o /tmp/lint.json
node -e "const r=require('/tmp/lint.json');console.log('errors:',r.flatMap(f=>f.messages.filter(m=>m.severity===2)).length)"
```
Expected: `errors: 0`.

- [ ] **Step 3: Full test suite**

```bash
node ./node_modules/vitest/vitest.mjs run --reporter=dot
```
Expected: all pass (existing suites + updated dedup/embedNode/semanticEdges + new captureTypes test).

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin phase-3-type-scoping
```
Then open a PR (base `main`) summarizing: `isSemanticMatchable` config flag; `match_nodes` `allowed_types`; same-type scoped dedup; matchable-scoped semantic edges; embedding coverage unchanged. Include the rollout steps below.

---

## Rollout (after merge)

1. Run `supabase/v1.4-match-nodes-type-filter.sql` in the Supabase SQL editor.
2. Clean up the stale false-positive `duplicate_candidates` created during the shakedown, and re-detect with the fixed same-type logic. This is a one-off ops script (NOT committed) that reads creds from the main-repo `.env` and requires the v1.4 migration to be applied first. It: (a) deletes all `open` duplicate_candidates, (b) for each vetted node of a matchable type, calls `match_nodes(embedding, 5, [node_type])` and re-records candidates ≥ 0.88.

```js
// cleanup-dupes.mjs (throwaway; run once from the worktree: node cleanup-dupes.mjs)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('/Users/gurden/Documents/code/cof-learning-system/.env','utf8')
  .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const MATCHABLE = ['hunch','assumption_background','assumption_foreground','learning','signal','option'];
await sb.from('duplicate_candidates').delete().eq('status','open');
const { data: nodes } = await sb.from('nodes').select('id, node_type').in('status',['promoted','human_reviewed']).in('node_type', MATCHABLE);
let dupes = 0;
for (const n of nodes ?? []) {
  const { data: emb } = await sb.from('node_embeddings').select('embedding').eq('node_id', n.id).maybeSingle();
  if (!emb) continue;
  const vec = typeof emb.embedding === 'string' ? JSON.parse(emb.embedding) : emb.embedding;
  const { data: m, error } = await sb.rpc('match_nodes', { query_embedding: vec, match_count: 5, allowed_types: [n.node_type] });
  if (error) { console.warn(error.message); continue; }
  const top = (m ?? []).filter(x => x.id !== n.id).sort((a,b)=>b.similarity-a.similarity)[0];
  if (top && top.similarity >= 0.88) {
    const { error: e } = await sb.from('duplicate_candidates').upsert({ node_id: n.id, similar_node_id: top.id, similarity: top.similarity, status: 'open' }, { onConflict: 'node_id,similar_node_id' });
    if (!e) dupes++;
  }
}
console.log(`re-detected ${dupes} same-type duplicate candidate(s)`);
process.exit(0);
```

---

## Self-Review (completed)

- **Spec coverage:** config flag+helper → Task 1; `match_nodes` allowed_types → Task 2; dedup skip+same-type → Task 3; `node_type` threading → Tasks 4–5; semantic edge scoping → Task 6; rollout cleanup → Rollout section; testing list → Tasks 1,3,4,6 + Task 7 gate. No gaps.
- **Type consistency:** `DedupNode { id, node_type }` (Task 3) is what `indexNode` constructs (Task 4); `EmbeddableNode.node_type` (Task 4) supplied at all three sites (Task 5); `getSemanticMatchableTypes()` name consistent across Tasks 1, 3 (via dedup import), 6; `allowed_types` param name consistent across Tasks 2, 3, 6.
- **Placeholder scan:** none — every code step has full content.
- **Cross-task tsc breakage** is called out explicitly (Task 3 → embedNode; Task 4 → three call sites) and resolves at Task 5; unit tests pass per-task via mocks.
