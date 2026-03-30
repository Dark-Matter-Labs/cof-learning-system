# Phase 1: Goal Hierarchy - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `trigger_outcome` node type and three new edge types to the DB schema, then restructure the CommitmentPanel to render the 3-level goal hierarchy (goal_space → trigger_outcome → commitment) as a collapsible tree with a trajectory badge placeholder per goal space.

This phase is foundational — all Phase 2–7 features depend on trigger_outcome nodes and their edges existing.

</domain>

<decisions>
## Implementation Decisions

### DB Schema

- **D-01:** Add `trigger_outcome` node type to node_types table. Color: `#085041` (dark teal, darker than goal_space `#0F6E56`). Sort order: 15.
- **D-02:** The `goal_space` node type already exists in DB (from v0.3). Update its description to clarify it contains trigger outcomes and commitments.
- **D-03:** Add three new edge types: `advances_goal` (trigger_outcome → goal_space), `targets_outcome` (hunch/intervention → trigger_outcome), `indicates_progress` (signal → trigger_outcome).
- **D-04:** The existing `belongs_to_goalspace` edge (commitment → goal_space) stays as-is. Commitments link to goal_space directly AND to trigger_outcome via a new `assigned_to_outcome` edge — this allows commitments to appear under their trigger outcome in the hierarchy tree.
- **D-05:** Migration file: `supabase/v0.4-migration.sql`. Follow DROP POLICY IF EXISTS pattern from v0.3 migration to avoid duplicate policy errors.

### Commitment Panel Restructure

- **D-06:** CommitmentPanel receives `goalSpaces`, `triggerOutcomes`, and `commitments` as separate props (all Node[]). The parent (GraphOSSurface) fetches and passes them. This matches the existing props-down pattern.
- **D-07:** Goal spaces render as collapsible section headers. Each contains its trigger outcomes (indented). Each trigger outcome contains its commitments (further indented). Uncommitted trigger outcomes still appear (with "no commitments" message).
- **D-08:** Goal spaces and trigger outcomes with no linked nodes still render if they exist — the hierarchy is always visible.
- **D-09:** Existing AllocationSummary component stays but moves inside each goal space section (not a global footer).
- **D-10:** The flat commitment list is replaced by the hierarchy. If a commitment has no trigger_outcome link and no goal_space link, it renders in an "Unlinked" section at the bottom.

### Trajectory Badge Placeholder

- **D-11:** Phase 1 renders a simple grey placeholder badge: `⊙ —` (em dash, meaning "not yet computed"). It uses the same visual shape as the future Option C badge (teal/coral pill). Clicking it shows a tooltip: "Trajectory computed in Phase 4."
- **D-12:** Badge component is created as `TrajectoryBadge` with a `status` prop: `'pending' | 'converging' | 'neutral' | 'drifting'` and `score?: number`. Phase 1 always passes `status='pending'`. This makes Phase 5 a drop-in.

### trigger_outcome Creation

- **D-13:** In Phase 1, trigger_outcome nodes can be created via the existing inline capture form (InlineCaptureCard / InterventionForm) — the node type just needs to appear in the type selector. No dedicated creation UI is needed yet. Phase 2 adds the GoalSpacePanel which provides more structured creation.

### Claude's Discretion

- Exact visual styling of the collapsible tree (indentation depth, connector lines vs indentation, icon for trigger_outcome vs commitment) — use the app's established dark theme (gray-950 bg, gray-800 borders, small text sizes).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing DB Schema
- `supabase/v0.3-migration.sql` — Existing node types (goal_space, commitment, etc.) and edge types (belongs_to_goalspace, etc.). Do NOT re-add these.
- `supabase/schema.sql` — Base schema structure; understand before writing migration.

### Existing Components
- `src/components/commitment/CommitmentPanel.tsx` — Component to restructure. Read before modifying.
- `src/lib/types/nodes.ts` — Node interface; `node_type: string` is how types are distinguished.

### Spec Reference
- The v0.4 spec in conversation history defines the goal hierarchy conceptual model and UI wireframe for CommitmentPanel (goal space sections with trigger outcomes).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CommitmentCard` — existing card component for commitments; keep for leaf-level rendering
- `TensionAlertItem` — stays in its own section; unchanged
- `AllocationSummary` — reuse per goal space section

### Established Patterns
- Dark theme: `bg-gray-950`, `border-gray-800/50`, text sizes `text-[10px]`, `text-[9px]`
- Props-down: parent passes all data; components don't fetch independently
- Immutability: all state updates via spread; no mutation
- `node_type: string` discriminates node types (no TS discriminated unions)

### Integration Points
- `GraphOSSurface.tsx` — the parent component that fetches data and passes props to CommitmentPanel. Needs to also fetch goal_space and trigger_outcome nodes.
- Supabase `nodes` table filtered by `node_type` to get the right layers of the hierarchy.
- `edges` table with `edge_type IN ('advances_goal', 'belongs_to_goalspace', 'assigned_to_outcome')` to build the hierarchy tree.

</code_context>

<specifics>
## Specific Ideas

- The spec wireframe shows: `▼ Formation capital model  ↗ Converging (+7)` as the goal space header, with trigger outcomes using `├ ◐` and `└ ○` prefixes. Use this visual language for Phase 1 (with `⊙ —` placeholder instead of the live badge).
- Trigger outcome status indicators (○ ◐ ◉ ✕) are computed in Phase 2 (GoalSpacePanel). In Phase 1, all trigger outcomes show `○` (not started) as a placeholder.

</specifics>

<deferred>
## Deferred Ideas

- GoalSpacePanel detail view (clicking a goal space shows full breakdown) — Phase 2
- Progress indicator computation (○ ◐ ◉ ✕ from connected tests/signals) — Phase 2
- Hunch-to-outcome dropdown in capture — Phase 3
- Live convergence scores in the badge — Phase 4/5

</deferred>

---

*Phase: 01-goal-hierarchy*
*Context gathered: 2026-03-27*
