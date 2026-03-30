# Phase 4: Convergence Computation — Research

**Researched:** 2026-03-27
**Domain:** Scoring algorithm, Supabase JSONB schema, threshold-triggered side-effects, Next.js API routes
**Confidence:** HIGH

---

## Summary

Phase 4 introduces the convergence score — a per-goal-space numeric that expresses whether the team's search and commitment activity is spiraling toward that space's trigger outcomes or drifting away. The score is a weighted sum of positive and negative signals derived from the graph's node types and edge types that already exist after Phases 1–3.

Three deliverables are required. First, a pure TypeScript scoring function that takes a goal_space ID plus the full node/edge graph and returns a numeric score with a factor breakdown object. Second, a `convergence_snapshots` Postgres table that stores these scores with a timestamp and the JSONB factor breakdown. Third, an API route (or lightweight post-node-insert side-effect) that counts nodes created since the last snapshot and fires a new snapshot when that count reaches 10.

Phase 5 will immediately consume these snapshots: it needs the most-recent score (for the trajectory badge) and the last 30 days of scores (for the sparkline). The schema must accommodate both reads efficiently.

**Primary recommendation:** Implement the scoring function as a pure function in `src/lib/graph/convergence.ts`, the API route as `src/app/api/convergence/snapshot/route.ts` using the same Supabase server-client pattern already used across the codebase, and the threshold check inline in the existing `POST /api/graph/nodes` route to avoid a separate trigger dependency.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-01 | System computes convergence score per goal space using defined positive/negative weight rules | Pure function in convergence.ts; weight table documented below; fully unit-testable without DB |
| CONV-02 | convergence_snapshots table stores scores with timestamp and factor breakdown (JSONB) | DDL in Research Scoring Algorithm section; JSONB structure matches Phase 5 consumption needs |
| CONV-03 | Convergence snapshots taken on-demand and triggered when 10+ new nodes added since last snapshot | Threshold check in POST /api/graph/nodes; on-demand via POST /api/convergence/snapshot |
</phase_requirements>

---

## Research: Phase 4 — Convergence Computation

### Scoring Algorithm

**Confidence:** HIGH (derived from existing node/edge taxonomy in schema.sql, v0.3-migration.sql, v0.4-migration.sql, and the project's stated rough-weights policy)

**Design principle (from STATE.md and PROJECT.md):** Deliberate rough heuristic. Purpose is visibility, not optimisation. Tune over real usage.

#### Node and Edge Taxonomy (verified from schema + migrations)

Node types relevant to convergence scoring:

| node_type | Role |
|-----------|------|
| `hunch` | Exploration activity — directional belief linked to an outcome |
| `signal` | Reality feedback — observable event that may indicate progress |
| `intervention` | Action node — simultaneously tests assumption and serves commitment |
| `commitment` | Resource allocation with delivery pressure |
| `test` | Specific action to validate/challenge an assumption |
| `trigger_outcome` | The measurable outcome belonging to a goal_space |
| `goal_space` | The root node being scored |

Edge types relevant to convergence scoring (full set from migrations):

| edge_type | Direction | Meaning for scoring |
|-----------|-----------|---------------------|
| `advances_goal` | trigger_outcome → goal_space | Structural — establishes which outcomes belong to a space |
| `targets_outcome` | hunch/intervention → trigger_outcome | Exploration aimed at an outcome (positive signal) |
| `indicates_progress` | signal → trigger_outcome | Evidence of real-world progress (strong positive) |
| `assigned_to_outcome` | commitment → trigger_outcome | Resource committed toward an outcome (positive signal) |
| `serves_commitment` | node → commitment | Node contributes to commitment delivery |
| `challenges_assumption` | signal → assumption | Uncertainty signal (negative if linked to outcomes) |
| `tests_assumption` | intervention/test → assumption | Testing activity (neutral to slight positive) |

#### Weight Rules (HIGH confidence — directly derived from project intent)

A convergence score for a goal_space is computed by:

1. Finding all `trigger_outcome` nodes linked to the goal_space via `advances_goal` edges.
2. For each trigger_outcome, tallying contributors using the weights below.
3. Summing across all trigger_outcomes and normalising by the count of trigger_outcomes (so goal spaces with more outcomes are not systematically higher).

**Per-trigger-outcome contributions:**

| Factor | Weight | Rationale |
|--------|--------|-----------|
| `indicates_progress` edge with source node `status = 'promoted'` | +3.0 | Verified real-world signal — highest confidence |
| `indicates_progress` edge with source node `status = 'human_reviewed'` | +2.0 | Reviewed but not yet promoted |
| `indicates_progress` edge with source node status = other | +0.5 | Raw/llm_reviewed signal — lower confidence |
| `assigned_to_outcome` edge (commitment assigned to this outcome) | +2.0 | Resources committed — convergence of action |
| `targets_outcome` edge where source is `hunch`, `status = 'promoted'` | +1.0 | Validated exploratory alignment |
| `targets_outcome` edge where source is `hunch`, status = other | +0.5 | Raw exploratory alignment |
| `targets_outcome` edge where source is `intervention` | +1.5 | Active intervention targeting outcome |
| Source node `status = 'falsified'` on any incoming edge | -2.0 per node | Falsified node undermines outcome |
| Source node `status = 'suspended'` on any incoming edge | -1.0 per node | Suspended node signals stall |
| Zero `targets_outcome` edges and zero `assigned_to_outcome` edges | -1.0 flat | Outcome has no active attention |

**Final score formula:**

```
raw_score = sum(per_outcome_score) / max(1, outcome_count)
score = clamp(raw_score, -10.0, 10.0)
```

The score range is [-10, 10]. Trajectory badge mapping (for Phase 5 consumption):

| Score range | Badge label |
|-------------|-------------|
| score > 1.0 | converging (+) |
| score >= -1.0 and <= 1.0 | neutral |
| score < -1.0 | drifting (-) |

#### Factor Breakdown JSONB Structure

The `factor_breakdown` column must carry enough detail for Phase 5 to render the positive/negative factor list without re-querying. Structure:

```typescript
interface FactorBreakdown {
  readonly outcome_scores: ReadonlyArray<{
    readonly outcome_id: string;
    readonly outcome_title: string;
    readonly score: number;
    readonly positive_factors: ReadonlyArray<{
      readonly factor: string;   // e.g. "indicates_progress:promoted"
      readonly node_id: string;
      readonly node_title: string;
      readonly weight: number;
    }>;
    readonly negative_factors: ReadonlyArray<{
      readonly factor: string;   // e.g. "falsified_source"
      readonly node_id: string;
      readonly node_title: string;
      readonly weight: number;
    }>;
  }>;
  readonly total_outcomes: number;
  readonly raw_score: number;
}
```

---

### DB Schema

**Confidence:** HIGH (follows existing table conventions in schema.sql and v0.3-migration.sql exactly)

#### DDL

```sql
-- v0.4 convergence snapshots
CREATE TABLE IF NOT EXISTS convergence_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_space_id   UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  score           FLOAT NOT NULL,
  factor_breakdown JSONB NOT NULL DEFAULT '{}',
  node_count_at_snapshot INT NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Phase 5 queries
-- "latest snapshot for a goal space" — used by trajectory badge
CREATE INDEX idx_convergence_snapshots_goal_space_computed
  ON convergence_snapshots(goal_space_id, computed_at DESC);

-- "all snapshots in last 30 days for a goal space" — used by sparkline
CREATE INDEX idx_convergence_snapshots_computed
  ON convergence_snapshots(computed_at DESC);

-- RLS (permissive model matches all other tables)
ALTER TABLE convergence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read convergence_snapshots"
  ON convergence_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage convergence_snapshots"
  ON convergence_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**Field notes:**

- `node_count_at_snapshot` stores the total node count at time of snapshot. This allows the threshold check (CONV-03) to compute delta without a separate counter table: `current_node_count - node_count_at_snapshot >= 10`.
- `computed_at` uses `TIMESTAMPTZ NOT NULL DEFAULT NOW()` — consistent with `created_at` conventions across the codebase. No `updated_at` needed (snapshots are immutable records).
- `factor_breakdown JSONB NOT NULL DEFAULT '{}'` — Phase 5 reads this directly; storing as JSONB avoids a join.
- No `updated_at` trigger needed (immutable append-only table).
- Foreign key `ON DELETE CASCADE` — if a goal_space node is deleted (archived), its history cleans up.

---

### Trigger Mechanism

**Confidence:** HIGH (verified against Next.js App Router conventions in codebase; explicit rejection of Supabase scheduled cron in REQUIREMENTS.md Out of Scope)

#### Decision: Inline check in POST /api/graph/nodes

REQUIREMENTS.md explicitly defers scheduled cron to v0.5. The two acceptable trigger points are:

1. **On-demand:** `POST /api/convergence/snapshot` — user or another route calls this explicitly.
2. **Threshold trigger:** Auto-fires when 10+ nodes added since last snapshot.

The cleanest implementation places the threshold check at the end of the existing `POST /api/graph/nodes` route (after the node INSERT succeeds). This avoids database triggers (which add schema complexity and are harder to test) and avoids a separate Supabase Edge Function.

**Threshold check algorithm:**

```
After successful node INSERT:
1. Fetch current total promoted/human_reviewed node count (or all non-archived nodes — decide at plan time)
2. Fetch most recent convergence_snapshot row (any goal_space, ordered by computed_at DESC)
3. delta = current_count - snapshot.node_count_at_snapshot
4. If delta >= 10:
   - For each goal_space node: compute score and insert convergence_snapshot row
   - This is fire-and-forget (do not block the node INSERT response)
```

**Important:** The threshold check should be fire-and-forget (non-blocking). The node POST response must not wait for convergence computation. Use `void computeAndStoreAllSnapshots()` after the successful response has been constructed, or better: run it after `await supabase.from('nodes').insert(...)` but before `return NextResponse.json(...)`, keeping latency impact minimal since it is a pure in-process function call.

**Alternative rejected: Supabase database trigger**
A Postgres trigger on the `nodes` table could call a Supabase Edge Function. This was considered and rejected because: (a) REQUIREMENTS.md explicitly flags cron/scheduled functions as out of scope for v0.4; (b) database triggers are harder to unit test; (c) the in-process approach is consistent with how signal propagation is already handled (propagate.ts called from signals/route.ts after insert).

**On-demand API route structure:**

```
POST /api/convergence/snapshot
Body: { goal_space_id: string } | { all: true }
- "all: true" computes snapshots for every non-archived goal_space
- Returns: { data: { snapshots: Array<{ goal_space_id, score, id }> } }
```

---

### Downstream Consumption

**Confidence:** HIGH (read directly from REQUIREMENTS.md CONV-04, CONV-05, CONV-06)

Phase 5 (Trajectory Indicators) needs:

| Need | What to query | Column used |
|------|--------------|-------------|
| Trajectory badge label and score | Latest snapshot for goal_space_id | `score`, `computed_at` |
| Factor breakdown expansion (CONV-05) | Latest snapshot for goal_space_id | `factor_breakdown` |
| 30-day sparkline (CONV-06) | All snapshots in last 30 days for goal_space_id | `score`, `computed_at` |

**Phase 5 query shapes (for schema validation):**

```sql
-- Latest snapshot (badge + breakdown)
SELECT score, factor_breakdown, computed_at
FROM convergence_snapshots
WHERE goal_space_id = $1
ORDER BY computed_at DESC
LIMIT 1;

-- 30-day history (sparkline)
SELECT score, computed_at
FROM convergence_snapshots
WHERE goal_space_id = $1
  AND computed_at > NOW() - INTERVAL '30 days'
ORDER BY computed_at ASC;
```

Both queries are covered by the composite index `idx_convergence_snapshots_goal_space_computed`.

Phase 6 (Reflection Agent) also needs convergence scores per goal_space in its context assembly (REFL-02). The same latest-snapshot query serves this need.

---

### Codebase Patterns

**Confidence:** HIGH (verified by reading actual source files)

#### Supabase Client

Always `await createClient()` from `@/lib/supabase/server`. The client is created fresh per request — no module-level singleton.

```typescript
// Pattern from capture/process/route.ts and signals/route.ts
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}
```

#### API Response Envelope

All routes return `NextResponse.json({ data: ... })` on success, `NextResponse.json({ error: message }, { status: N })` on failure. The `{ success: boolean }` variant also appears in signals/route.ts. Phase 4 should use `{ data: ... }` / `{ error: ... }` for consistency with graph/nodes and capture/process routes.

#### Pure Functions for Business Logic

Phase 2 established the pattern: all computable business logic goes in pure functions in `src/lib/graph/queries.ts` (or a new sibling module), not in API routes. The scoring function belongs in `src/lib/graph/convergence.ts`. API routes call these functions and persist results.

```typescript
// Pattern from queries.ts — readonly params, O(1) lookups via Map
export function computeConvergenceScore(
  goalSpaceId: string,
  edges: readonly Edge[],
  allNodes: readonly Node[]
): ConvergenceResult { ... }
```

#### Parallel Supabase Queries

`Promise.all` for independent fetches — established in capture/process/route.ts:

```typescript
const [
  { data: goalSpaces },
  { data: triggerOutcomes },
  { data: edges },
] = await Promise.all([
  supabase.from('nodes').select('id, title').eq('node_type', 'goal_space').neq('status', 'archived'),
  supabase.from('nodes').select('id, title').eq('node_type', 'trigger_outcome').neq('status', 'archived'),
  supabase.from('edges').select('*'),
]);
```

#### Activity Logging

After significant writes, insert into `activity_log`. The convergence snapshot insertion should log:

```typescript
await supabase.from('activity_log').insert({
  actor_id: user.id,
  action: 'convergence_snapshot',
  target_node_id: goalSpaceId,
  details: { score, trigger: 'threshold' | 'on_demand' },
});
```

#### Migration File Convention

New DB tables go in a new migration file: `supabase/v0.4-convergence.sql` (following the `v0.4-migration.sql` naming pattern). Use `CREATE TABLE IF NOT EXISTS` and `ON CONFLICT (id) DO UPDATE` for idempotency.

#### LLM Agent Slots

The `callLLM` function accepts an `AgentName` string literal. Phase 4 does not need LLM calls — convergence is a deterministic function. No new agent slot needed.

---

### Validation Architecture

#### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | vitest.config (inferred from package.json scripts) |
| Quick run command | `npx vitest run src/lib/graph/__tests__/convergence.test.ts` |
| Full suite command | `npx vitest run` |

#### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONV-01 | `computeConvergenceScore` returns correct score for goal_space with mixed positive/negative factors | unit | `npx vitest run src/lib/graph/__tests__/convergence.test.ts` | ❌ Wave 0 |
| CONV-01 | Score is clamped to [-10, 10] | unit | same | ❌ Wave 0 |
| CONV-01 | Zero outcomes returns score 0.0 | unit | same | ❌ Wave 0 |
| CONV-01 | Falsified source nodes produce negative weight | unit | same | ❌ Wave 0 |
| CONV-01 | `indicates_progress` + promoted source = +3.0 weight | unit | same | ❌ Wave 0 |
| CONV-02 | `convergence_snapshots` table exists (verifiable via migration file existence) | manual | review migration file | ❌ Wave 0 |
| CONV-03 | Snapshot triggered when delta >= 10 nodes | unit | `npx vitest run src/lib/graph/__tests__/convergence.test.ts` | ❌ Wave 0 |

**Notes on manual-only items:**
- CONV-02 DB existence is verified by running the migration and checking Supabase schema — this is a deployment verification step, not automatable in unit tests. The JSONB structure is validated indirectly via the TypeScript type that the insert must satisfy.

#### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/graph/__tests__/convergence.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

#### Wave 0 Gaps

- [ ] `src/lib/graph/__tests__/convergence.test.ts` — covers CONV-01 scoring logic and threshold detection
- [ ] `supabase/v0.4-convergence.sql` — convergence_snapshots DDL (not a test file, but needed before any integration)

---

## Common Pitfalls

### Pitfall 1: Computing score across ALL nodes instead of scoping to goal_space

**What goes wrong:** The function fetches all nodes, iterates all edges without filtering by goal_space → trigger_outcome → [contributors], and produces a score that conflates multiple goal spaces.

**Why it happens:** The adjacency structure is two hops deep: goal_space → (advances_goal) → trigger_outcome → (targets_outcome/indicates_progress/assigned_to_outcome) → contributors. A naive flat query misses the hop structure.

**How to avoid:** Build the graph query in two steps: first find all trigger_outcomes for the goal_space (via `advances_goal` edges where `target_id === goalSpaceId`), then for each outcome find its contributors. Build a `Set<string>` of relevant outcome IDs before iterating edges.

### Pitfall 2: Blocking the node POST response on convergence computation

**What goes wrong:** Convergence computation requires fetching all goal_spaces, all trigger_outcomes, all edges, computing scores, and inserting one row per goal_space. At 50+ nodes, this adds hundreds of milliseconds to every node POST.

**How to avoid:** Make the threshold check and snapshot computation fire-and-forget. Call `void triggerSnapshotIfThreshold(supabase)` after constructing the success response, or run it before the return but accept that the POST will be slightly slower. Do NOT await the snapshot insertion as part of the response path.

### Pitfall 3: Storing score only, no factor breakdown

**What goes wrong:** Phase 5 needs to render "positive factors: X, Y" and "negative factors: Z" (CONV-05). If `factor_breakdown` is omitted now, Phase 5 must re-query the graph state at snapshot time — which is impossible (graph state changes after snapshot).

**How to avoid:** Store the full factor breakdown JSONB at snapshot time. The `FactorBreakdown` interface above captures per-outcome, per-factor details.

### Pitfall 4: Node count delta using wrong node set

**What goes wrong:** Counting ALL nodes (including archived, error, raw) produces a delta that fires snapshots too often during bulk imports or extraction runs.

**How to avoid:** Count only `promoted` and `human_reviewed` nodes — consistent with what the graph/nodes GET route already filters on (`status IN ('promoted', 'human_reviewed')`). This is the "meaningful knowledge graph" count.

### Pitfall 5: Missing RLS on convergence_snapshots

**What goes wrong:** The table is created without RLS, causing Supabase to reject inserts from the server-side Supabase client (which authenticates as `authenticated` role).

**How to avoid:** Always include `ENABLE ROW LEVEL SECURITY` and both SELECT and ALL policies in the migration, matching the pattern in schema.sql and v0.3-migration.sql.

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── lib/
│   └── graph/
│       ├── convergence.ts           # Pure scoring function + ConvergenceResult type
│       └── __tests__/
│           └── convergence.test.ts  # TDD unit tests
├── app/
│   └── api/
│       ├── convergence/
│       │   └── snapshot/
│       │       └── route.ts         # POST on-demand snapshot endpoint
│       └── graph/
│           └── nodes/
│               └── route.ts         # Extended: threshold check after INSERT
supabase/
└── v0.4-convergence.sql             # convergence_snapshots DDL
```

### Pattern: Pure Convergence Function

```typescript
// src/lib/graph/convergence.ts
// Source: codebase pattern from queries.ts (Phase 2)

export interface ConvergenceResult {
  readonly score: number;                    // clamped [-10, 10]
  readonly factor_breakdown: FactorBreakdown;
}

export function computeConvergenceScore(
  goalSpaceId: string,
  edges: readonly Edge[],
  allNodes: readonly Node[]
): ConvergenceResult {
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  // Step 1: find trigger_outcomes for this goal_space
  const outcomeIds = edges
    .filter(e => e.edge_type === 'advances_goal' && e.target_id === goalSpaceId)
    .map(e => e.source_id);

  if (outcomeIds.length === 0) {
    return { score: 0, factor_breakdown: { outcome_scores: [], total_outcomes: 0, raw_score: 0 } };
  }

  // Step 2: score each outcome
  const outcomeScores = outcomeIds.map(outcomeId =>
    scoreOutcome(outcomeId, nodeMap.get(outcomeId)?.title ?? outcomeId, edges, nodeMap)
  );

  const raw_score = outcomeScores.reduce((sum, os) => sum + os.score, 0) / outcomeIds.length;
  const score = Math.max(-10, Math.min(10, raw_score));

  return {
    score,
    factor_breakdown: {
      outcome_scores: outcomeScores,
      total_outcomes: outcomeIds.length,
      raw_score,
    },
  };
}
```

### Pattern: Threshold Snapshot Trigger (non-blocking)

```typescript
// In POST /api/graph/nodes route — after successful insert
// Fire-and-forget: does not block response
void checkAndTriggerSnapshots(supabase, userId);
return NextResponse.json({ data }, { status: 201 });
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| DB-level triggers for side effects | In-process fire-and-forget (established by propagate.ts pattern) | Testable, deployable without Edge Function config |
| Separate counter table for threshold | Store `node_count_at_snapshot` in snapshot row | Single-table delta computation |
| Supabase scheduled cron | On-demand + threshold (explicitly deferred in REQUIREMENTS.md) | No cron configuration needed for v0.4 |

---

## Open Questions

1. **Which node statuses count toward the threshold delta?**
   - What we know: The graph/nodes GET route filters `status IN ('promoted', 'human_reviewed')`.
   - What's unclear: Should raw/processing nodes count? The spirit of "10 new nodes" suggests meaningful knowledge additions, not raw captures.
   - Recommendation: Count `status IN ('promoted', 'human_reviewed')` — consistent with the graph query convention. Planner should confirm.

2. **Should snapshots be computed for ALL goal_spaces or only the one whose outcome was just targeted?**
   - What we know: CONV-03 says "triggered when 10+ new nodes added" — no scoping to a specific goal_space.
   - What's unclear: Computing all goal_spaces at threshold time is correct but may be expensive at scale.
   - Recommendation: Compute all non-archived goal_spaces at threshold time (consistent with CONV-03 wording). At v0.4 team scale (small team, few goal_spaces) this is fine.

3. **What is the `advances_goal` edge direction?**
   - What we know: From v0.4-migration.sql: `'advances_goal' — This trigger outcome advances progress toward a goal space`. Edge direction in the edge_types table is `is_directional = true`. The description implies `trigger_outcome → advances_goal → goal_space` (source = trigger_outcome, target = goal_space).
   - Recommendation: Verify against actual data before writing the scoring function. The scoring function must filter `edges.filter(e => e.edge_type === 'advances_goal' && e.target_id === goalSpaceId)` to find trigger_outcomes if direction is trigger_outcome → goal_space.

---

## Sources

### Primary (HIGH confidence)
- `supabase/schema.sql` — full base schema, node/edge table structure, RLS pattern, index conventions
- `supabase/v0.3-migration.sql` — all v0.3 node types (commitment, intervention, signal, goal_space) and edge types
- `supabase/v0.4-migration.sql` — trigger_outcome node type, advances_goal/targets_outcome/indicates_progress/assigned_to_outcome edge types
- `src/lib/graph/queries.ts` — pure function pattern, Map-based O(1) lookups, readonly parameters
- `src/app/api/capture/process/route.ts` — parallel Promise.all Supabase pattern, auth check, activity log pattern
- `src/app/api/signals/route.ts` — fire-and-forget side-effect pattern via propagate.ts
- `src/lib/agents/extraction.ts` — pure function + callLLM integration pattern
- `src/lib/llm/index.ts` — agent slot naming (no new slot needed for Phase 4)
- `.planning/REQUIREMENTS.md` — CONV-01 through CONV-06 requirements, explicit deferral of cron and ML scoring
- `.planning/PROJECT.md` — "rough heuristic" weight policy, stack confirmation
- `package.json` — vitest ^4.1.0 confirmed as test framework

### Secondary (MEDIUM confidence)
- `.planning/phases/02-goal-space-panel/02-01-SUMMARY.md` — TDD approach, makeNode/makeEdge factory fixture pattern to follow for convergence tests
- `.planning/STATE.md` — key decisions: trajectory badge chosen, rough weights, on-demand threshold trigger

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — verified from actual source files
- Architecture: HIGH — follows established codebase patterns (propagate.ts, queries.ts, capture/process)
- Scoring Algorithm: MEDIUM-HIGH — weights are new design decisions (not from prior code), but derived directly from the node/edge taxonomy and project's stated design intent
- DB Schema: HIGH — follows v0.3-migration.sql conventions exactly
- Pitfalls: HIGH — derived from reading actual code patterns

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable stack; weight rules may be refined after first real usage)
