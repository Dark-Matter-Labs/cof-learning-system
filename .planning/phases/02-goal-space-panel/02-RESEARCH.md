# Phase 2: Goal Space Panel - Research

**Researched:** 2026-03-27
**Domain:** React component routing by node type, graph-derived progress computation
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GOAL-01 | User can select a goal_space node and see a dedicated detail panel (GoalSpacePanel) | Panel routing mechanism identified: `selectedNode.node_type === 'goal_space'` branch in GraphOSSurface replaces NodeDetailPanel render |
| GOAL-02 | Goal space panel shows all trigger outcomes with progress indicators (○ not started, ◐ in progress, ◉ met, ✕ blocked) | Trigger outcomes reachable via `advances_goal` edge; all data already in GraphOSSurface state |
| GOAL-03 | Progress indicators are computed from connected tests, signals, and commitments — not a manual field | Computation logic defined in Architecture Patterns section; uses `indicates_progress`, `assigned_to_outcome`, and `targets_outcome` edges |
| GOAL-04 | Goal space panel shows commitment count and hunch count per trigger outcome | Counts derivable from existing edge + node state; `assigned_to_outcome` for commitments, `targets_outcome` for hunches |
</phase_requirements>

---

## Summary

Phase 2 adds a `GoalSpacePanel` component that replaces the generic `NodeDetailPanel` when the selected node is of type `goal_space`. The routing mechanism is already clear from the code: `GraphOSSurface` renders `NodeDetailPanel` only when `selectedNode !== null`, so a simple type-check branch (`selectedNode.node_type === 'goal_space'`) is enough to intercept goal_space selections and render `GoalSpacePanel` instead.

All data the panel needs — nodes, edges — is already loaded in `GraphOSSurface` state and passed to other panels as props. The pattern is props-down: parent passes all data, components derive what they need. `GoalSpacePanel` should follow the same pattern as `NodeDetailPanel`, receiving `node`, `edges`, and `allNodes` as props. No new API routes or separate data fetches are needed.

The most complex part of this phase is the progress indicator computation logic (GOAL-03). The four status symbols (○ ◐ ◉ ✕) must be derived purely from graph structure: which edge types connect to a trigger_outcome, and what the statuses of connected nodes are. The computation rules are defined here based on the Phase 1 edge vocabulary.

**Primary recommendation:** Add a `node_type === 'goal_space'` branch in `GraphOSSurface` to render `GoalSpacePanel`, build the panel as a pure props-down component parallel to `NodeDetailPanel`, and implement progress computation as a pure utility function in `src/lib/graph/queries.ts`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | (project's existing) | Component rendering | Already used throughout |
| TypeScript | (project's existing) | Type safety | Project standard |

### No New Dependencies

This phase introduces zero new npm dependencies. All work is:
- A new React component (`GoalSpacePanel`)
- A routing branch in `GraphOSSurface`
- A pure utility function for progress computation
- Vitest unit tests

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── components/
│   └── graph/
│       ├── GoalSpacePanel.tsx          # NEW — dedicated panel component
│       └── __tests__/
│           └── GoalSpacePanel.test.tsx # NEW — unit tests
├── lib/
│   └── graph/
│       └── queries.ts                  # EXTEND — add computeOutcomeStatus()
```

### Pattern 1: Node-type-discriminated Panel Routing

**What:** `GraphOSSurface` already renders `NodeDetailPanel` when `selectedNode !== null`. Insert a type-guard branch before that render.

**When to use:** Any time a node type needs a dedicated detail view.

**Existing code location:** `src/components/graph/GraphOSSurface.tsx` lines 314–320.

**Current code:**
```tsx
{selectedNode !== null && (
  <NodeDetailPanel
    node={selectedNode}
    edges={edges}
    allNodes={nodes}
    onClose={() => setSelectedNode(null)}
  />
)}
```

**Pattern after change:**
```tsx
{selectedNode !== null && selectedNode.node_type === 'goal_space' && (
  <GoalSpacePanel
    node={selectedNode}
    edges={edges}
    allNodes={nodes}
    onClose={() => setSelectedNode(null)}
  />
)}
{selectedNode !== null && selectedNode.node_type !== 'goal_space' && (
  <NodeDetailPanel
    node={selectedNode}
    edges={edges}
    allNodes={nodes}
    onClose={() => setSelectedNode(null)}
  />
)}
```

This keeps the change minimal and isolated. No refactor of `handleSelectNode` is needed.

### Pattern 2: GoalSpacePanel Props Interface

Mirrors `NodeDetailPanel` exactly — same four props, same positioning class.

```tsx
interface GoalSpacePanelProps {
  readonly node: Node;           // the goal_space node
  readonly edges: readonly Edge[];
  readonly allNodes: readonly Node[];
  readonly onClose: () => void;
}
```

**Positioning:** Same absolute position as `NodeDetailPanel`:
`className="absolute right-0 top-[49px] bottom-0 w-72 bg-gray-950 border-l border-gray-800 p-4 overflow-y-auto"`

### Pattern 3: Progress Computation as Pure Utility

**What:** A pure function in `src/lib/graph/queries.ts` takes a trigger_outcome node ID plus the full edges and nodes arrays and returns one of four status values.

**Type:**
```typescript
export type OutcomeStatus = 'not_started' | 'in_progress' | 'met' | 'blocked';
```

**Computation rules** (derived from edge vocabulary defined in v0.4-migration.sql):

| Status | Symbol | Condition |
|--------|--------|-----------|
| `blocked` | ✕ | Any connected node has `status === 'falsified'` OR `status === 'suspended'` |
| `met` | ◉ | At least one `indicates_progress` signal exists AND connected node `status === 'promoted'` with `content.outcome === 'positive'` (or no falsified signals) |
| `in_progress` | ◐ | At least one of: `assigned_to_outcome` commitment exists, OR `indicates_progress` signal exists, OR `targets_outcome` hunch exists — but not yet `met` |
| `not_started` | ○ | None of the above |

**Edge types relevant to each trigger_outcome:**
- `advances_goal` (source=trigger_outcome, target=goal_space) — used for linking, NOT for status
- `assigned_to_outcome` (source=commitment, target=trigger_outcome) — commitment assigned to this outcome
- `targets_outcome` (source=hunch/intervention, target=trigger_outcome) — hunch targeting this outcome
- `indicates_progress` (source=signal, target=trigger_outcome) — signal pointing at this outcome

**Function signature:**
```typescript
export function computeOutcomeStatus(
  outcomeId: string,
  edges: readonly Edge[],
  allNodes: readonly Node[]
): OutcomeStatus
```

**Implementation approach:**
1. Collect all edges where `target_id === outcomeId`
2. Map edge `source_id` values to their node objects
3. Apply blocked check first (any falsified/suspended source node)
4. Apply met check: `indicates_progress` sources with `status === 'promoted'`
5. Apply in_progress check: any `assigned_to_outcome` or `targets_outcome` edge exists
6. Default to `not_started`

### Pattern 4: Trigger Outcome List Construction

To find all trigger outcomes for a goal_space node, filter edges by `edge_type === 'advances_goal'` and `target_id === goalSpaceNode.id`, then map `source_id` to nodes.

```typescript
const outcomeIds = edges
  .filter(e => e.edge_type === 'advances_goal' && e.target_id === node.id)
  .map(e => e.source_id);

const outcomes = allNodes.filter(n => outcomeIds.includes(n.id));
```

### Pattern 5: Count Computation

**Commitment count per outcome:** edges where `edge_type === 'assigned_to_outcome'` AND `target_id === outcome.id`

**Hunch count per outcome:** edges where `edge_type === 'targets_outcome'` AND `target_id === outcome.id` — filter source nodes to `node_type === 'hunch'` for precision (interventions also use `targets_outcome`)

```typescript
const commitmentCount = edges.filter(
  e => e.edge_type === 'assigned_to_outcome' && e.target_id === outcome.id
).length;

const hunchCount = edges
  .filter(e => e.edge_type === 'targets_outcome' && e.target_id === outcome.id)
  .filter(e => allNodes.find(n => n.id === e.source_id)?.node_type === 'hunch')
  .length;
```

### Pattern 6: Status Symbol and Color Mapping

Consistent with existing dark theme:

```typescript
const STATUS_DISPLAY: Record<OutcomeStatus, { symbol: string; colorClass: string; label: string }> = {
  not_started: { symbol: '○', colorClass: 'text-gray-600',   label: 'Not started' },
  in_progress:  { symbol: '◐', colorClass: 'text-yellow-500', label: 'In progress' },
  met:          { symbol: '◉', colorClass: 'text-teal-400',   label: 'Met'         },
  blocked:      { symbol: '✕', colorClass: 'text-red-500',    label: 'Blocked'     },
};
```

### Anti-Patterns to Avoid

- **Fetching in GoalSpacePanel:** Do NOT add a `useEffect`/Supabase query inside `GoalSpacePanel`. All data is already in `GraphOSSurface` state. Props-down is the established pattern (see CommitmentPanel, NodeDetailPanel).
- **Storing computed status in state:** Status is derived data. Compute it inline or in a pure function call during render — never store it in `useState`.
- **Modifying handleSelectNode:** The selection handler is generic. The routing decision belongs in the render branch, not in the handler.
- **Mutating edge/node arrays:** All filtering operations must return new arrays (`filter`, `map`) — never use `push` or index assignment.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status symbol rendering | Custom icon component | Inline unicode + Tailwind color class | Project already uses this pattern (GoalSpaceSection uses `○` inline) |
| Node-type badge in panel header | Custom badge | `NodeTypeBadge` component | Already exists at `src/components/shared/NodeTypeBadge.tsx`, used in NodeDetailPanel |
| Data fetching | New API route or hook | Props from GraphOSSurface | All nodes + edges already loaded at top level |

---

## Common Pitfalls

### Pitfall 1: `advances_goal` edge direction

**What goes wrong:** Developer queries edges looking for `source_id === goalSpaceNode.id` to find trigger outcomes, finds nothing.

**Why it happens:** The edge is directional: trigger_outcome (source) → goal_space (target). The goal_space is the TARGET, not the source.

**How to avoid:** Filter `edges.filter(e => e.edge_type === 'advances_goal' && e.target_id === goalSpaceNode.id)`, then read `e.source_id` to get the trigger_outcome IDs.

**Warning signs:** Trigger outcome list is always empty even though edges exist in DB.

### Pitfall 2: `targets_outcome` includes interventions, not just hunches

**What goes wrong:** Hunch count is inflated because `targets_outcome` edges can be sourced by both `hunch` and `intervention` node types.

**Why it happens:** The migration defines `targets_outcome` as "hunch or intervention → trigger_outcome".

**How to avoid:** After collecting `targets_outcome` source IDs, filter by `node_type === 'hunch'` before counting. Count interventions separately if needed.

**Warning signs:** Hunch count is higher than expected.

### Pitfall 3: `met` status requiring too strict a signal check

**What goes wrong:** Status never reaches `met` because signal `content.outcome` field doesn't exist yet (Phase 3 adds expected_signals).

**Why it happens:** Phase 2 is early — signals may exist but won't have a structured positive/negative outcome field until later phases.

**How to avoid:** For Phase 2, simplify the `met` definition: an outcome is `met` if at least one `indicates_progress` edge exists AND its source signal node has `status === 'promoted'`. Do not require `content.outcome === 'positive'` yet — that field doesn't exist in Phase 2.

**Warning signs:** Status computation works in tests with mock data but never shows `met` in real app.

### Pitfall 4: Panel z-index / positioning conflict

**What goes wrong:** `GoalSpacePanel` appears behind `CommitmentPanel` or is obscured.

**Why it happens:** `CommitmentPanel` is positioned on the left (`left-0`); `NodeDetailPanel` is on the right (`right-0`). As long as `GoalSpacePanel` uses the same `right-0` positioning as `NodeDetailPanel`, there is no conflict.

**How to avoid:** Copy the exact positioning class from `NodeDetailPanel`: `absolute right-0 top-[49px] bottom-0 w-72`.

---

## Code Examples

### GoalSpacePanel skeleton matching established patterns

```tsx
// src/components/graph/GoalSpacePanel.tsx
// Source: mirrors NodeDetailPanel.tsx structure
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { NodeTypeBadge } from '@/components/shared/NodeTypeBadge';
import { computeOutcomeStatus, type OutcomeStatus } from '@/lib/graph/queries';

interface GoalSpacePanelProps {
  readonly node: Node;
  readonly edges: readonly Edge[];
  readonly allNodes: readonly Node[];
  readonly onClose: () => void;
}

const STATUS_DISPLAY: Record<OutcomeStatus, { symbol: string; colorClass: string }> = {
  not_started: { symbol: '○', colorClass: 'text-gray-600' },
  in_progress:  { symbol: '◐', colorClass: 'text-yellow-500' },
  met:          { symbol: '◉', colorClass: 'text-teal-400' },
  blocked:      { symbol: '✕', colorClass: 'text-red-500' },
};

export function GoalSpacePanel({ node, edges, allNodes, onClose }: GoalSpacePanelProps) {
  const outcomeIds = edges
    .filter(e => e.edge_type === 'advances_goal' && e.target_id === node.id)
    .map(e => e.source_id);
  const outcomes = allNodes.filter(n => outcomeIds.includes(n.id));

  return (
    <div className="absolute right-0 top-[49px] bottom-0 w-72 bg-gray-950 border-l border-gray-800 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <NodeTypeBadge nodeType={node.node_type} />
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-lg">×</button>
      </div>
      <h3 className="text-sm font-bold text-gray-200 mb-4">{node.title}</h3>

      <div className="text-[10px] text-gray-600 uppercase mb-2">Trigger Outcomes ({outcomes.length})</div>
      {outcomes.length === 0 && (
        <p className="text-[10px] text-gray-700 italic">No trigger outcomes linked</p>
      )}
      {outcomes.map(outcome => {
        const status = computeOutcomeStatus(outcome.id, edges, allNodes);
        const { symbol, colorClass } = STATUS_DISPLAY[status];
        const commitmentCount = edges.filter(
          e => e.edge_type === 'assigned_to_outcome' && e.target_id === outcome.id
        ).length;
        const hunchCount = edges
          .filter(e => e.edge_type === 'targets_outcome' && e.target_id === outcome.id)
          .filter(e => allNodes.find(n => n.id === e.source_id)?.node_type === 'hunch')
          .length;

        return (
          <div key={outcome.id} className="mb-3 border border-gray-800 rounded p-2">
            <div className="flex items-start gap-2">
              <span className={`text-sm mt-0.5 ${colorClass}`}>{symbol}</span>
              <span className="text-[11px] text-gray-300 leading-tight">{outcome.title}</span>
            </div>
            <div className="flex gap-3 mt-1.5 pl-5">
              <span className="text-[9px] text-gray-600">{commitmentCount} commitment{commitmentCount !== 1 ? 's' : ''}</span>
              <span className="text-[9px] text-gray-600">{hunchCount} hunch{hunchCount !== 1 ? 'es' : ''}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### computeOutcomeStatus utility

```typescript
// src/lib/graph/queries.ts — add to existing file
export type OutcomeStatus = 'not_started' | 'in_progress' | 'met' | 'blocked';

export function computeOutcomeStatus(
  outcomeId: string,
  edges: readonly Edge[],
  allNodes: readonly Node[]
): OutcomeStatus {
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  // Edges pointing at this outcome
  const incomingEdges = edges.filter(e => e.target_id === outcomeId);

  // blocked: any connected source node is falsified or suspended
  const hasBlocked = incomingEdges.some(e => {
    const n = nodeMap.get(e.source_id);
    return n?.status === 'falsified' || n?.status === 'suspended';
  });
  if (hasBlocked) return 'blocked';

  // met: at least one indicates_progress signal with status promoted
  const hasMet = incomingEdges
    .filter(e => e.edge_type === 'indicates_progress')
    .some(e => nodeMap.get(e.source_id)?.status === 'promoted');
  if (hasMet) return 'met';

  // in_progress: any assigned commitment or targeting hunch/intervention exists
  const hasInProgress = incomingEdges.some(
    e => e.edge_type === 'assigned_to_outcome' || e.edge_type === 'targets_outcome'
  );
  if (hasInProgress) return 'in_progress';

  return 'not_started';
}
```

### GraphOSSurface routing branch

```tsx
// src/components/graph/GraphOSSurface.tsx — replace existing NodeDetailPanel block
{selectedNode !== null && selectedNode.node_type === 'goal_space' && (
  <GoalSpacePanel
    node={selectedNode}
    edges={edges}
    allNodes={nodes}
    onClose={() => setSelectedNode(null)}
  />
)}
{selectedNode !== null && selectedNode.node_type !== 'goal_space' && (
  <NodeDetailPanel
    node={selectedNode}
    edges={edges}
    allNodes={nodes}
    onClose={() => setSelectedNode(null)}
  />
)}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Generic node detail for all types | Type-discriminated panels | Already used implicitly — CommitmentPanel shows commitments separately. Phase 2 makes the pattern explicit for goal_space. |
| Manual status fields on nodes | Computed status from graph structure | GOAL-03 specifically requires computation, not a stored field |

---

## Open Questions

1. **Blocked condition scope**
   - What we know: "blocked" should indicate a trigger outcome is stuck
   - What's unclear: Should `blocked` apply when a connected commitment is `archived`, or only when a signal/assumption is `falsified`/`suspended`?
   - Recommendation: For Phase 2, scope `blocked` to `falsified` and `suspended` source nodes only. Archived commitments should not block an outcome — they just reduce `in_progress` evidence. Revisit in Phase 4 when convergence scoring adds more nuance.

2. **`met` without signal infrastructure**
   - What we know: Phase 3 adds `expected_signals` to captures; Phase 2 ships before that
   - What's unclear: In Phase 2, will any real `indicates_progress` edges exist?
   - Recommendation: The computation logic is correct and future-safe. In practice, `met` will rarely show in Phase 2 because users haven't created `indicates_progress` edges yet. This is expected — the panel still shows ○/◐ statuses usefully.

3. **`targets_outcome` vs `assigned_to_outcome` for hunch count**
   - What we know: Both edge types point at trigger_outcome; hunches use `targets_outcome`, commitments use `assigned_to_outcome`
   - What's unclear: Should interventions that use `targets_outcome` count toward hunch count or be counted separately?
   - Recommendation: For Phase 2, filter `targets_outcome` source nodes to `node_type === 'hunch'` only. Show a separate "interventions" count only if product decides it's valuable — keep it simple for v0.4.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 + @testing-library/react |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --run src/components/graph/__tests__/GoalSpacePanel.test.tsx` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GOAL-01 | GoalSpacePanel renders when goal_space node selected (not NodeDetailPanel) | unit | `npm test -- --run src/components/graph/__tests__/GoalSpacePanel.test.tsx` | ❌ Wave 0 |
| GOAL-02 | Panel lists trigger outcomes with correct status symbols | unit | `npm test -- --run src/components/graph/__tests__/GoalSpacePanel.test.tsx` | ❌ Wave 0 |
| GOAL-03 | `computeOutcomeStatus()` returns correct status for each condition | unit | `npm test -- --run src/lib/graph/__tests__/queries.test.ts` | ❌ Wave 0 |
| GOAL-04 | Commitment count and hunch count render correctly per row | unit | `npm test -- --run src/components/graph/__tests__/GoalSpacePanel.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run src/components/graph/__tests__/GoalSpacePanel.test.tsx src/lib/graph/__tests__/queries.test.ts`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/graph/__tests__/GoalSpacePanel.test.tsx` — covers GOAL-01, GOAL-02, GOAL-04
- [ ] `src/lib/graph/__tests__/queries.test.ts` — covers GOAL-03 (`computeOutcomeStatus` pure function)

Note: `src/test-setup.ts` and shared fixtures already exist (referenced in vitest.config.ts). No framework install needed — Vitest is already configured.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/components/graph/GraphOSSurface.tsx` — routing and state management pattern
- Direct code inspection: `src/components/graph/NodeDetailPanel.tsx` — panel structure and props interface to mirror
- Direct code inspection: `src/components/commitment/CommitmentPanel.tsx` — hierarchy construction from edges (advances_goal, assigned_to_outcome patterns)
- Direct code inspection: `src/components/commitment/GoalSpaceSection.tsx` — status symbol visual language (○ prefix already in use)
- Direct code inspection: `src/lib/graph/queries.ts` — existing utility function patterns
- Direct code inspection: `supabase/v0.4-migration.sql` — definitive edge type definitions and directionality
- Direct code inspection: `src/lib/types/nodes.ts` — Node interface with all fields including `status`

### Secondary (MEDIUM confidence)
- Phase 1 CONTEXT.md decisions — confirms props-down pattern (D-06), status symbol vocabulary (D-11, D-13), and that GoalSpacePanel is explicitly deferred to Phase 2

### Tertiary (LOW confidence)
- None — all critical decisions verified from source code directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all patterns verified from existing source files
- Architecture: HIGH — routing mechanism, props interface, and data derivation patterns confirmed from code
- Pitfalls: HIGH — edge direction and node type filtering risks verified against migration SQL
- Progress computation rules: MEDIUM — the `met`/`blocked` boundary conditions involve product judgment (Open Questions 1 and 2); code mechanics are HIGH but exact thresholds are MEDIUM pending product confirmation

**Research date:** 2026-03-27
**Valid until:** Stable — no external dependencies; only invalidated if Phase 1 changes edge type definitions
