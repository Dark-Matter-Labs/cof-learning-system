# Semantic Edge Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover LLM-suggested connections that fail exact-title matching by matching them semantically against the vetted graph, auto-creating high-confidence edges and surfacing mid-confidence ones in the Review inbox.

**Architecture:** The exact-title path in `resolveConnections` is unchanged and stays inline; it now *returns* the suggestions it could not place. The two capture/process call sites schedule an async `after()` step, `resolveSemantically`, which embeds each unplaced `target_title`, finds the nearest vetted node via the `match_nodes` RPC, and tiers the top hit into an auto-created `edges` row, an `open` `edge_suggestions` row (review), or a drop. A new review-inbox section and a `PATCH /api/edge-suggestions/[id]` endpoint let a human accept (insert the real edge) or dismiss.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (pgvector + `match_nodes` SECURITY DEFINER RPC), Voyage `voyage-3.5` embeddings (`embedText`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-22-semantic-edge-resolution-design.md`

**Worktree/branch:** `.claude/worktrees/phase-1`, branch `phase-3-semantic-edges` (off `main`, which has slice 1+2 embedding infra).

**Verification binaries** (avoid `npx`/rtk; clear `.tsbuildinfo` before tsc):
- tsc: `node ./node_modules/typescript/bin/tsc --noEmit`
- vitest: `node ./node_modules/vitest/vitest.mjs run <paths> --reporter=dot`
- eslint: `node ./node_modules/eslint/bin/eslint.js . -f json -o /tmp/lint.json`

---

## File Structure

- **Create** `supabase/v1.3-edge-suggestions.sql` — `edge_suggestions` table + RLS (run by hand in SQL editor).
- **Create** `src/lib/agents/semanticEdges.ts` — `resolveSemantically` + thresholds. One responsibility: turn unplaced suggestions into edges/review rows.
- **Create** `src/lib/agents/__tests__/semanticEdges.test.ts` — unit tests for the tiering.
- **Modify** `src/lib/agents/connectionResolver.ts` — return `{ created, unresolved }`; collect misses.
- **Modify** `src/lib/agents/__tests__/connectionResolver.test.ts` — adapt to the new return shape; add an unresolved test.
- **Modify** `src/app/api/capture/process/route.ts` — both call sites consume `unresolved` and schedule `resolveSemantically` via `after()`.
- **Create** `src/app/api/edge-suggestions/[id]/route.ts` — `PATCH` accept/dismiss.
- **Create** `src/app/api/edge-suggestions/__tests__/route.test.ts` — route tests.
- **Create** `src/components/review/SuggestedConnectionItem.tsx` — review-row component + `ReviewEdgeSuggestion` type.
- **Create** `src/components/review/__tests__/SuggestedConnectionItem.test.tsx` — component tests.
- **Modify** `src/app/review/SystemHealthClient.tsx` — "Suggested connections" section + accept/dismiss handlers.
- **Modify** `src/app/review/page.tsx` — 5th parallel query + title lookup + pass prop.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/v1.3-edge-suggestions.sql`

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/gurden/Documents/code/cof-learning-system/.claude/worktrees/phase-1
git add supabase/v1.3-edge-suggestions.sql
git commit -m "feat(edges): edge_suggestions table for semantic edge review"
```

---

## Task 2: `resolveSemantically` core module

**Files:**
- Create: `src/lib/agents/semanticEdges.ts`
- Test: `src/lib/agents/__tests__/semanticEdges.test.ts`

- [ ] **Step 1: Write the failing test**

Mirrors `src/lib/llm/__tests__/dedup.test.ts`. `embedText` is mocked; the supabase mock returns match rows via `.rpc`, reports no existing edge, and records `.insert`/`.upsert` calls.

```ts
// src/lib/agents/__tests__/semanticEdges.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmbedText = vi.fn();
vi.mock('@/lib/llm/embeddings', () => ({
  embedText: (...args: unknown[]) => mockEmbedText(...args),
}));

import {
  resolveSemantically,
  EDGE_AUTO_THRESHOLD,
  EDGE_REVIEW_THRESHOLD,
} from '../semanticEdges';
import type { SuggestedConnection } from '../connectionResolver';

type Match = { id: string; similarity: number };

function makeSupabase(matches: Match[], opts: { existingEdge?: boolean; rpcError?: { message: string } } = {}) {
  const edgeInsert = vi.fn().mockResolvedValue({ error: null });
  const suggestionUpsert = vi.fn().mockResolvedValue({ error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.existingEdge ? { id: 'e1' } : null });
  const supabase = {
    rpc: vi.fn().mockResolvedValue({ data: matches, error: opts.rpcError ?? null }),
    from: vi.fn((table: string) => {
      if (table === 'edges') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) })),
          insert: edgeInsert,
        };
      }
      return { upsert: suggestionUpsert };
    }),
    _edgeInsert: edgeInsert,
    _suggestionUpsert: suggestionUpsert,
  };
  return supabase;
}

const SUGGESTION: SuggestedConnection = {
  target_title: 'Formation capital strategy',
  edge_type: 'supports',
  rationale: 'Directly supports',
};

describe('resolveSemantically', () => {
  beforeEach(() => { vi.clearAllMocks(); mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]); });

  it('auto-creates an edge when the top match is at/above the auto threshold', async () => {
    const supabase = makeSupabase([{ id: 'target', similarity: 0.9 }]);
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase._edgeInsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: 'src', target_id: 'target', edge_type: 'supports', weight: 0.9 }),
    );
    expect(supabase._suggestionUpsert).not.toHaveBeenCalled();
  });

  it('records a review suggestion when the top match is in the review band', async () => {
    const supabase = makeSupabase([{ id: 'target', similarity: 0.72 }]);
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase._suggestionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: 'src', target_id: 'target', edge_type: 'supports', status: 'open' }),
      expect.objectContaining({ onConflict: 'source_id,target_id,edge_type' }),
    );
    expect(supabase._edgeInsert).not.toHaveBeenCalled();
  });

  it('drops the suggestion when the top match is below the review threshold', async () => {
    const supabase = makeSupabase([{ id: 'target', similarity: 0.4 }]);
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase._edgeInsert).not.toHaveBeenCalled();
    expect(supabase._suggestionUpsert).not.toHaveBeenCalled();
  });

  it('ignores the source node itself in the matches', async () => {
    const supabase = makeSupabase([{ id: 'src', similarity: 0.99 }]);
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase._edgeInsert).not.toHaveBeenCalled();
    expect(supabase._suggestionUpsert).not.toHaveBeenCalled();
  });

  it('skips when an edge for the pair+type already exists', async () => {
    const supabase = makeSupabase([{ id: 'target', similarity: 0.9 }], { existingEdge: true });
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase._edgeInsert).not.toHaveBeenCalled();
  });

  it('no-ops (no rpc) when embeddings are unavailable', async () => {
    mockEmbedText.mockResolvedValue(null);
    const supabase = makeSupabase([{ id: 'target', similarity: 0.9 }]);
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('is non-fatal on an rpc error', async () => {
    const supabase = makeSupabase([], { rpcError: { message: 'boom' } });
    await expect(resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1')).resolves.toBeUndefined();
    expect(supabase._edgeInsert).not.toHaveBeenCalled();
  });

  it('orders thresholds sanely', () => {
    expect(EDGE_REVIEW_THRESHOLD).toBeGreaterThan(0);
    expect(EDGE_REVIEW_THRESHOLD).toBeLessThan(EDGE_AUTO_THRESHOLD);
    expect(EDGE_AUTO_THRESHOLD).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/agents/__tests__/semanticEdges.test.ts --reporter=dot`
Expected: FAIL — cannot resolve `../semanticEdges`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/agents/semanticEdges.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { embedText } from '@/lib/llm/embeddings';
import type { SuggestedConnection } from './connectionResolver';

/** Auto-create an edge at/above this cosine similarity. */
export const EDGE_AUTO_THRESHOLD = 0.80;
/** Between this and the auto threshold → surface for review; below → drop. */
export const EDGE_REVIEW_THRESHOLD = 0.65;

interface MatchRow {
  readonly id: string;
  readonly similarity: number;
}

/**
 * For each connection suggestion the exact-title resolver could not place,
 * embed the target title and find its nearest vetted node via match_nodes.
 * Tier the top hit: auto-create an edge (>= AUTO), record an open
 * edge_suggestions row (REVIEW..AUTO), or drop (< REVIEW). Intended to run
 * async via after(); non-fatal — never throws, no-ops when embeddings are
 * unavailable.
 */
export async function resolveSemantically(
  sourceId: string,
  suggestions: ReadonlyArray<SuggestedConnection>,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  for (const suggestion of suggestions) {
    try {
      const title = suggestion.target_title?.trim();
      if (!title) continue;

      const embedding = await embedText(title, 'query');
      if (!embedding) continue;

      const { data, error } = await supabase.rpc('match_nodes', {
        query_embedding: embedding,
        match_count: 5,
      });
      if (error) {
        console.error('[semanticEdges] match_nodes failed:', error.message);
        continue;
      }

      const top = ((data ?? []) as MatchRow[])
        .filter(m => m.id !== sourceId)
        .sort((a, b) => b.similarity - a.similarity)[0];
      if (!top || top.similarity < EDGE_REVIEW_THRESHOLD) continue;

      const { data: existing } = await supabase
        .from('edges')
        .select('id')
        .eq('source_id', sourceId)
        .eq('target_id', top.id)
        .eq('edge_type', suggestion.edge_type)
        .maybeSingle();
      if (existing) continue;

      const tier = top.similarity >= EDGE_AUTO_THRESHOLD ? 'auto' : 'review';
      console.error(
        `[semanticEdges] "${title}" -> ${top.id} sim=${top.similarity.toFixed(3)} tier=${tier}`,
      );

      if (tier === 'auto') {
        await supabase.from('edges').insert({
          source_id: sourceId,
          target_id: top.id,
          edge_type: suggestion.edge_type,
          weight: top.similarity,
          author_id: userId,
        });
      } else {
        await supabase.from('edge_suggestions').upsert(
          {
            source_id: sourceId,
            target_id: top.id,
            edge_type: suggestion.edge_type,
            rationale: suggestion.rationale ?? null,
            similarity: top.similarity,
            status: 'open',
          },
          { onConflict: 'source_id,target_id,edge_type' },
        );
      }
    } catch (err) {
      console.error('[semanticEdges] failed for', suggestion.target_title, err);
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/agents/__tests__/semanticEdges.test.ts --reporter=dot`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/semanticEdges.ts src/lib/agents/__tests__/semanticEdges.test.ts
git commit -m "feat(edges): resolveSemantically — tiered semantic match for unplaced connections"
```

---

## Task 3: `resolveConnections` returns `{ created, unresolved }`

**Files:**
- Modify: `src/lib/agents/connectionResolver.ts`
- Test: `src/lib/agents/__tests__/connectionResolver.test.ts`

- [ ] **Step 1: Update the tests to the new return shape (failing)**

Replace the entire `describe('resolveConnections', ...)` block (and only that block) with the version below. Changes: destructure `{ created }`; add an `unresolved` test.

```ts
describe('resolveConnections', () => {
  it('returns created 0 and no unresolved when suggestions is empty', async () => {
    const supabase = makeSupabase(null);
    const { created, unresolved } = await resolveConnections('src-id', [], supabase as never, 'user-1');
    expect(created).toBe(0);
    expect(unresolved).toEqual([]);
  });

  it('creates an edge when a matching node is found', async () => {
    const supabase = makeSupabase({ id: 'matched-id' });
    const { created } = await resolveConnections('src-id', [SUGGESTIONS[0]], supabase as never, 'user-1');
    expect(created).toBe(1);
    expect(supabase._mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: 'src-id', target_id: 'matched-id', edge_type: 'supports' }),
    );
  });

  it('returns unmatched valid suggestions in unresolved instead of creating', async () => {
    const supabase = makeSupabase(null);
    const { created, unresolved } = await resolveConnections('src-id', [SUGGESTIONS[1]], supabase as never, 'user-1');
    expect(created).toBe(0);
    expect(unresolved).toEqual([SUGGESTIONS[1]]);
    expect(supabase._mockInsert).not.toHaveBeenCalled();
  });

  it('skips when edge already exists', async () => {
    const supabase = makeSupabase({ id: 'matched-id' }, { id: 'existing-edge' });
    const { created } = await resolveConnections('src-id', [SUGGESTIONS[0]], supabase as never, 'user-1');
    expect(created).toBe(0);
    expect(supabase._mockInsert).not.toHaveBeenCalled();
  });

  it('processes multiple suggestions independently', async () => {
    const supabase = makeSupabase({ id: 'matched-id' });
    const { created } = await resolveConnections('src-id', SUGGESTIONS, supabase as never, 'user-1');
    expect(created).toBeGreaterThan(0);
  });

  it('skips suggestions with empty target_title', async () => {
    const supabase = makeSupabase({ id: 'matched-id' });
    const empty: SuggestedConnection = { target_title: '  ', edge_type: 'supports', rationale: '' };
    const { created, unresolved } = await resolveConnections('src-id', [empty], supabase as never, 'user-1');
    expect(created).toBe(0);
    expect(unresolved).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/agents/__tests__/connectionResolver.test.ts --reporter=dot`
Expected: FAIL — `resolveConnections` returns a number; `created`/`unresolved` are undefined.

- [ ] **Step 3: Update the implementation**

In `src/lib/agents/connectionResolver.ts`, add the result interface after `SuggestedConnection`:

```ts
export interface ResolveResult {
  readonly created: number;
  readonly unresolved: SuggestedConnection[];
}
```

Change the signature return type from `Promise<number>` to `Promise<ResolveResult>`, and update the body. Replace lines from `if (!suggestions.length) return 0;` through the final `return created;` with:

```ts
  const unresolved: SuggestedConnection[] = [];
  if (!suggestions.length) return { created: 0, unresolved };

  let created = 0;

  for (const suggestion of suggestions) {
    if (!suggestion.target_title?.trim()) continue;
    if (!VALID_EDGE_TYPES.has(suggestion.edge_type)) continue;

    const { data: match } = await supabase
      .from('nodes')
      .select('id')
      .ilike('title', suggestion.target_title.trim())
      .neq('id', sourceNodeId)
      .in('status', ['promoted', 'human_reviewed', 'llm_reviewed'])
      .limit(1)
      .maybeSingle();

    if (!match) {
      unresolved.push(suggestion);
      continue;
    }

    const { data: existing } = await supabase
      .from('edges')
      .select('id')
      .eq('source_id', sourceNodeId)
      .eq('target_id', match.id)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from('edges').insert({
      source_id: sourceNodeId,
      target_id: match.id,
      edge_type: suggestion.edge_type,
      weight: 1,
      author_id: userId,
    });

    if (error) {
      process.stderr.write(`[connectionResolver] Edge insert failed (${sourceNodeId} -> ${match.id}, type: ${suggestion.edge_type}): ${error.message}\n`);
    } else {
      created++;
    }
  }

  return { created, unresolved };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node ./node_modules/vitest/vitest.mjs run src/lib/agents/__tests__/connectionResolver.test.ts --reporter=dot`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/connectionResolver.ts src/lib/agents/__tests__/connectionResolver.test.ts
git commit -m "refactor(edges): resolveConnections returns created + unresolved misses"
```

---

## Task 4: Wire the async semantic step into capture/process

**Files:**
- Modify: `src/app/api/capture/process/route.ts` (document path ~line 246; single-node path ~line 321)

`after` (from `next/server`) and `createAdminClient` (from `@/lib/supabase/admin`) are already imported in this file — no new imports needed.

- [ ] **Step 1: Update the document-extraction call site**

Replace this block:

```ts
            if (suggestions && suggestions.length > 0) {
              await resolveConnections(child.id as string, suggestions, supabase, user.id);
            }
```

with:

```ts
            if (suggestions && suggestions.length > 0) {
              const childId = child.id as string;
              const { unresolved } = await resolveConnections(childId, suggestions, supabase, user.id);
              if (unresolved.length > 0) {
                after(() =>
                  import('@/lib/agents/semanticEdges').then(m =>
                    m.resolveSemantically(childId, unresolved, createAdminClient(), user.id),
                  ),
                );
              }
            }
```

- [ ] **Step 2: Update the single-node call site**

Replace this block:

```ts
      const { resolveConnections } = await import('@/lib/agents/connectionResolver');
      await resolveConnections(
        node_id,
        extraction.suggested_connections,
        supabase,
        user.id,
      );
```

with:

```ts
      const { resolveConnections } = await import('@/lib/agents/connectionResolver');
      const { unresolved } = await resolveConnections(
        node_id,
        extraction.suggested_connections,
        supabase,
        user.id,
      );
      if (unresolved.length > 0) {
        after(() =>
          import('@/lib/agents/semanticEdges').then(m =>
            m.resolveSemantically(node_id, unresolved, createAdminClient(), user.id),
          ),
        );
      }
```

- [ ] **Step 3: Verify types compile**

Run: `node ./node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors (clear `.tsbuildinfo` first if present).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/capture/process/route.ts
git commit -m "feat(edges): schedule async semantic resolution for unplaced connections"
```

---

## Task 5: `PATCH /api/edge-suggestions/[id]` accept/dismiss

**Files:**
- Create: `src/app/api/edge-suggestions/[id]/route.ts`
- Test: `src/app/api/edge-suggestions/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Mirrors `src/app/api/newsletters/__tests__/route.test.ts`. The mock returns the suggestion row on read, records the edge insert on accept, and records the status update.

```ts
// src/app/api/edge-suggestions/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
  from: mockFrom,
};
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue(mockSupabase) }));

const SUGGESTION_ROW = { id: 'sug-1', source_id: 's1', target_id: 't1', edge_type: 'supports' };

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe('PATCH /api/edge-suggestions/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for an invalid action', async () => {
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://test/api/edge-suggestions/sug-1', {
      method: 'PATCH', body: JSON.stringify({ action: 'nope' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: makeParams('sug-1') });
    expect(res.status).toBe(400);
  });

  it('dismiss marks the suggestion dismissed and creates no edge', async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const edgeInsert = vi.fn();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'edge_suggestions') return { update };
      if (table === 'edges') return { insert: edgeInsert };
      return {};
    });
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://test/api/edge-suggestions/sug-1', {
      method: 'PATCH', body: JSON.stringify({ action: 'dismiss' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: makeParams('sug-1') });
    expect(res.status).toBe(200);
    expect(edgeInsert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'dismissed' }));
  });

  it('accept inserts the edge and marks the suggestion accepted', async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const edgeInsert = vi.fn().mockResolvedValue({ error: null });
    const sugSelect = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: SUGGESTION_ROW }) })) }));
    mockFrom.mockImplementation((table: string) => {
      if (table === 'edge_suggestions') return { select: sugSelect, update };
      if (table === 'edges') return { insert: edgeInsert };
      return {};
    });
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://test/api/edge-suggestions/sug-1', {
      method: 'PATCH', body: JSON.stringify({ action: 'accept' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: makeParams('sug-1') });
    expect(res.status).toBe(200);
    expect(edgeInsert).toHaveBeenCalledWith(expect.objectContaining({
      source_id: 's1', target_id: 't1', edge_type: 'supports',
    }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run src/app/api/edge-suggestions/__tests__/route.test.ts --reporter=dot`
Expected: FAIL — cannot resolve `../[id]/route`.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/edge-suggestions/[id]/route.ts
import { withAuth, ok, fail } from '@/lib/api/withAuth';

// Resolve an edge suggestion: 'accept' creates the real edge then marks the
// suggestion accepted; 'dismiss' marks it dismissed without creating an edge.
export const PATCH = withAuth<{ id: string }>(async ({ request, supabase, user, params }) => {
  const { id } = await params;

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body');
  }
  if (body.action !== 'accept' && body.action !== 'dismiss') {
    return fail('action must be "accept" or "dismiss"');
  }

  if (body.action === 'dismiss') {
    const { error } = await supabase
      .from('edge_suggestions')
      .update({ status: 'dismissed' })
      .eq('id', id);
    if (error) return fail(error.message, 500);
    return ok({ id, status: 'dismissed' });
  }

  // accept
  const { data: suggestion, error: readErr } = await supabase
    .from('edge_suggestions')
    .select('source_id, target_id, edge_type')
    .eq('id', id)
    .maybeSingle();
  if (readErr) return fail(readErr.message, 500);
  if (!suggestion) return fail('Suggestion not found', 404);

  const { error: edgeErr } = await supabase.from('edges').insert({
    source_id: suggestion.source_id,
    target_id: suggestion.target_id,
    edge_type: suggestion.edge_type,
    weight: 1,
    author_id: user.id,
  });
  if (edgeErr) return fail(edgeErr.message, 500);

  const { error: updateErr } = await supabase
    .from('edge_suggestions')
    .update({ status: 'accepted' })
    .eq('id', id);
  if (updateErr) return fail(updateErr.message, 500);

  return ok({ id, status: 'accepted' });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node ./node_modules/vitest/vitest.mjs run src/app/api/edge-suggestions/__tests__/route.test.ts --reporter=dot`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/edge-suggestions
git commit -m "feat(edges): PATCH /api/edge-suggestions/[id] accept/dismiss"
```

---

## Task 6: `SuggestedConnectionItem` component

**Files:**
- Create: `src/components/review/SuggestedConnectionItem.tsx`
- Test: `src/components/review/__tests__/SuggestedConnectionItem.test.tsx`

- [ ] **Step 1: Write the failing test**

Mirrors `src/components/review/__tests__/DuplicateItem.test.tsx`.

```tsx
// src/components/review/__tests__/SuggestedConnectionItem.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

import { SuggestedConnectionItem, type ReviewEdgeSuggestion } from '../SuggestedConnectionItem';

const suggestion: ReviewEdgeSuggestion = {
  id: 'sug-1',
  similarity: 0.74,
  edgeType: 'supports',
  rationale: 'It builds on the earlier finding',
  source: { id: 's1', title: 'New debt-relief hunch' },
  target: { id: 't1', title: 'Patient debt program' },
};

describe('SuggestedConnectionItem', () => {
  it('renders both node titles, edge type, rationale, and percent', () => {
    render(<SuggestedConnectionItem suggestion={suggestion} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('New debt-relief hunch')).toBeTruthy();
    expect(screen.getByText('Patient debt program')).toBeTruthy();
    expect(screen.getByText(/supports/)).toBeTruthy();
    expect(screen.getByText('It builds on the earlier finding')).toBeTruthy();
    expect(screen.getByText('74% match')).toBeTruthy();
  });

  it('links the target node to its capture page', () => {
    render(<SuggestedConnectionItem suggestion={suggestion} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Patient debt program').closest('a')?.getAttribute('href')).toBe('/capture/t1');
  });

  it('fires onAccept with the suggestion', () => {
    const onAccept = vi.fn();
    render(<SuggestedConnectionItem suggestion={suggestion} onAccept={onAccept} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText('Add connection'));
    expect(onAccept).toHaveBeenCalledWith(suggestion);
  });

  it('fires onDismiss with the suggestion id', () => {
    const onDismiss = vi.fn();
    render(<SuggestedConnectionItem suggestion={suggestion} onAccept={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledWith('sug-1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run src/components/review/__tests__/SuggestedConnectionItem.test.tsx --reporter=dot`
Expected: FAIL — cannot resolve `../SuggestedConnectionItem`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/review/SuggestedConnectionItem.tsx
'use client';

import Link from 'next/link';

export interface ReviewEdgeSuggestion {
  readonly id: string; // edge_suggestions row id
  readonly similarity: number;
  readonly edgeType: string;
  readonly rationale: string | null;
  readonly source: { readonly id: string; readonly title: string };
  readonly target: { readonly id: string; readonly title: string };
}

interface SuggestedConnectionItemProps {
  readonly suggestion: ReviewEdgeSuggestion;
  readonly onAccept: (suggestion: ReviewEdgeSuggestion) => void;
  readonly onDismiss: (suggestionId: string) => void;
}

export function SuggestedConnectionItem({ suggestion, onAccept, onDismiss }: SuggestedConnectionItemProps) {
  const pct = Math.round(suggestion.similarity * 100);
  const edgeLabel = suggestion.edgeType.replace(/_/g, ' ');
  return (
    <div className="bg-cof-bg-elevated border border-cof-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] text-cof-text-secondary">Suggested connection</span>
        <span className="ml-auto text-[10px] text-amber-500">{pct}% match</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
        <div className="border border-cof-border rounded p-2 min-w-0">
          <div className="text-[10px] text-cof-text-tertiary uppercase tracking-wide mb-0.5">This entry</div>
          <div className="text-xs font-medium text-cof-text-primary truncate">{suggestion.source.title}</div>
        </div>
        <div className="flex flex-col items-center justify-center text-cof-text-tertiary text-[10px]">
          <span>{edgeLabel}</span>
          <span>→</span>
        </div>
        <Link href={`/capture/${suggestion.target.id}`} className="border border-cof-border rounded p-2 min-w-0 hover:border-cof-border-strong transition-colors">
          <div className="text-[10px] text-cof-text-tertiary uppercase tracking-wide mb-0.5">Connects to</div>
          <div className="text-xs font-medium text-xco-teal truncate">{suggestion.target.title}</div>
        </Link>
      </div>
      {suggestion.rationale && (
        <p className="text-[11px] text-cof-text-secondary mt-2">{suggestion.rationale}</p>
      )}
      <div className="flex items-center gap-2 justify-end mt-2">
        <button
          type="button"
          onClick={() => onDismiss(suggestion.id)}
          className="text-[10px] px-2 py-1 text-cof-text-tertiary hover:text-cof-text-secondary"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => onAccept(suggestion)}
          className="text-[10px] px-2 py-1 bg-cof-bg-subtle border border-cof-border text-cof-text-secondary rounded hover:border-cof-border-strong"
        >
          Add connection
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node ./node_modules/vitest/vitest.mjs run src/components/review/__tests__/SuggestedConnectionItem.test.tsx --reporter=dot`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/review/SuggestedConnectionItem.tsx src/components/review/__tests__/SuggestedConnectionItem.test.tsx
git commit -m "feat(edges): SuggestedConnectionItem review-inbox row"
```

---

## Task 7: "Suggested connections" section in SystemHealthClient

**Files:**
- Modify: `src/app/review/SystemHealthClient.tsx`

- [ ] **Step 1: Add the import**

After the existing `DuplicateItem` import line:

```ts
import { DuplicateItem, type ReviewDuplicate } from '@/components/review/DuplicateItem';
```

add:

```ts
import { SuggestedConnectionItem, type ReviewEdgeSuggestion } from '@/components/review/SuggestedConnectionItem';
```

- [ ] **Step 2: Add the prop to the interface**

In `SystemHealthClientProps`, after `readonly duplicates: readonly ReviewDuplicate[];` add:

```ts
  readonly edgeSuggestions: readonly ReviewEdgeSuggestion[];
```

- [ ] **Step 3: Destructure the prop and add state**

In the component params, after `duplicates: initialDuplicates,` add `edgeSuggestions: initialEdgeSuggestions,`.
After the `duplicates` `useState` line add:

```ts
  const [edgeSuggestions, setEdgeSuggestions] = useState<readonly ReviewEdgeSuggestion[]>(initialEdgeSuggestions);
```

- [ ] **Step 4: Add the accept/dismiss handlers**

After `handleArchiveDuplicate` add:

```ts
  const resolveEdgeSuggestion = useCallback(async (id: string, action: 'accept' | 'dismiss') => {
    await fetch(`/api/edge-suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => {});
  }, []);

  const handleAcceptSuggestion = useCallback((suggestion: ReviewEdgeSuggestion) => {
    setEdgeSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    void resolveEdgeSuggestion(suggestion.id, 'accept');
  }, [resolveEdgeSuggestion]);

  const handleDismissSuggestion = useCallback((id: string) => {
    setEdgeSuggestions(prev => prev.filter(s => s.id !== id));
    void resolveEdgeSuggestion(id, 'dismiss');
  }, [resolveEdgeSuggestion]);
```

- [ ] **Step 5: Render the section**

Immediately after the closing `)}` of the `{duplicates.length > 0 && ( ... )}` section, add:

```tsx
      {edgeSuggestions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Suggested connections <span className="text-gray-400">· {edgeSuggestions.length}</span>
          </h2>
          <div className="space-y-2">
            {edgeSuggestions.map(suggestion => (
              <SuggestedConnectionItem
                key={suggestion.id}
                suggestion={suggestion}
                onAccept={handleAcceptSuggestion}
                onDismiss={handleDismissSuggestion}
              />
            ))}
          </div>
        </section>
      )}
```

- [ ] **Step 6: Verify types compile**

Run: `node ./node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors. (`page.tsx` will be updated in Task 8 to pass the new required prop; if tsc is run now it will flag the missing prop at the `<SystemHealthClient ... />` call — that is expected and fixed in Task 8. Proceed.)

- [ ] **Step 7: Commit**

```bash
git add src/app/review/SystemHealthClient.tsx
git commit -m "feat(edges): Suggested connections section in the review inbox"
```

---

## Task 8: Fetch open edge suggestions in review/page.tsx

**Files:**
- Modify: `src/app/review/page.tsx`

- [ ] **Step 1: Add the import and row type**

After `import type { ReviewDuplicate } from '@/components/review/DuplicateItem';` add:

```ts
import type { ReviewEdgeSuggestion } from '@/components/review/SuggestedConnectionItem';
```

After the `DuplicateRow` interface add:

```ts
interface EdgeSuggestionRow {
  id: string;
  similarity: number;
  edge_type: string;
  rationale: string | null;
  source_id: string;
  target_id: string;
}
```

- [ ] **Step 2: Add the 5th parallel query**

In the `Promise.all([...])` destructuring, add `edgeSugRes` after `dupesRes`:

```ts
  const [flaggedRes, tensionsRes, awaitingRes, dupesRes, edgeSugRes] = await Promise.all([
```

and append this query as the last array element (after the `duplicate_candidates` query, keeping flagged/awaiting at indices 0 and 2 so `ReviewPage.test.tsx` stays green):

```ts
    supabase
      .from('edge_suggestions')
      .select('id, similarity, edge_type, rationale, source_id, target_id')
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
```

- [ ] **Step 3: Fold suggestion node ids into the title lookup**

After `const dupeRows = (dupesRes.data ?? []) as DuplicateRow[];` add:

```ts
  const edgeSugRows = (edgeSugRes.data ?? []) as EdgeSuggestionRow[];
```

In the `titleIds` set, add the suggestion source/target ids. Replace the `titleIds` definition with:

```ts
  const titleIds = Array.from(new Set([
    ...queue.map(e => e.node.parent_node_id).filter((id): id is string => Boolean(id)),
    ...dupeRows.flatMap(d => [d.node_id, d.similar_node_id]),
    ...edgeSugRows.flatMap(s => [s.source_id, s.target_id]),
  ]));
```

- [ ] **Step 4: Build the resolved suggestions and pass the prop**

After the `duplicates` array is built, add:

```ts
  const edgeSuggestions: ReviewEdgeSuggestion[] = edgeSugRows
    .filter(s => titles[s.source_id] && titles[s.target_id])
    .map(s => ({
      id: s.id,
      similarity: s.similarity,
      edgeType: s.edge_type,
      rationale: s.rationale,
      source: { id: s.source_id, title: titles[s.source_id] },
      target: { id: s.target_id, title: titles[s.target_id] },
    }));
```

In the `<SystemHealthClient ... />` JSX, add the prop after `duplicates={duplicates}`:

```tsx
          edgeSuggestions={edgeSuggestions}
```

- [ ] **Step 5: Verify types compile**

Run: `node ./node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Run the ReviewPage test to confirm it stays green**

Run: `node ./node_modules/vitest/vitest.mjs run src/app/review/__tests__/ReviewPage.test.tsx --reporter=dot`
Expected: PASS (3 tests). The mock already supplies 6 datasets and the new query supports `.select().eq().order()`.

- [ ] **Step 7: Commit**

```bash
git add src/app/review/page.tsx
git commit -m "feat(edges): load open edge suggestions into the review inbox"
```

---

## Task 9: Full verification gauntlet

**Files:** none (verification only)

- [ ] **Step 1: Clear tsbuildinfo and run tsc**

```bash
cd /Users/gurden/Documents/code/cof-learning-system/.claude/worktrees/phase-1
rm -f *.tsbuildinfo
node ./node_modules/typescript/bin/tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: Run lint**

```bash
node ./node_modules/eslint/bin/eslint.js . -f json -o /tmp/lint.json
node -e "const r=require('/tmp/lint.json');console.log('errors:',r.flatMap(f=>f.messages.filter(m=>m.severity===2)).length)"
```
Expected: `errors: 0`.

- [ ] **Step 3: Run the full test suite**

```bash
node ./node_modules/vitest/vitest.mjs run --reporter=dot
```
Expected: all files pass (existing suites + the new semanticEdges, connectionResolver, edge-suggestions route, SuggestedConnectionItem; ReviewPage still green).

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin phase-3-semantic-edges
```
Then open a PR (base `main`) summarizing: exact-first inline matching unchanged; async tiered semantic fallback; `edge_suggestions` table + review section + accept/dismiss endpoint; forward-only. Note the rollout step below.

---

## Rollout (user, after merge)

1. Run `supabase/v1.3-edge-suggestions.sql` in the Supabase SQL editor.
2. `VOYAGE_API_KEY` is already set; depends on `match_nodes` (`v1.1-embeddings.sql`) and embeddings being backfilled.

---

## Self-Review (completed)

- **Spec coverage:** architecture/flow → Tasks 3,4,2; schema → Task 1; thresholds → Task 2; `connectionResolver` change → Task 3; `semanticEdges` → Task 2; endpoint → Task 5; `SuggestedConnectionItem` → Task 6; `SystemHealthClient` → Task 7; `review/page.tsx` → Task 8; error handling (non-fatal/no-op/rpc) → Task 2 tests; testing list → Tasks 2,3,5,6,8; rollout/out-of-scope → captured. No gaps.
- **Type consistency:** `ResolveResult { created, unresolved }` (Task 3) consumed in Task 4; `resolveSemantically(sourceId, suggestions, supabase, userId)` (Task 2) called in Task 4; `ReviewEdgeSuggestion` (Task 6) used in Tasks 7,8; `edgeSuggestions` prop name consistent across Tasks 7,8; endpoint action `'accept' | 'dismiss'` consistent across Tasks 5,7.
- **Placeholder scan:** none — every code step contains full content.
