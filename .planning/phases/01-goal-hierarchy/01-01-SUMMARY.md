---
phase: 01-goal-hierarchy
plan: 01
subsystem: database, ui
tags: [supabase, postgresql, react, typescript, nextjs]

# Dependency graph
requires: []
provides:
  - trigger_outcome node type in database (color #085041, sort_order 15)
  - advances_goal, targets_outcome, indicates_progress, assigned_to_outcome edge types in database
  - trigger_outcome selectable in inline capture form
  - Optional goal-space linking when creating trigger_outcome nodes (auto-creates advances_goal edge)
  - trigger_outcome in graph type filter bar (NODE_TYPE_OPTIONS)
affects: [02-goal-space-panel, 03-hunch-to-outcome, 04-convergence-scoring, 05-trajectory-badge, 06-reflection-agent, 07-reflect-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ON CONFLICT (id) DO UPDATE SET for idempotent node_type and edge_type inserts"
    - "Optional edge creation after node save: create node first, then try edge, don't block onCreated on edge failure"
    - "goalSpaces filtered from nodes array in GraphOSSurface, passed down as prop to InlineCaptureCard"

key-files:
  created:
    - supabase/v0.4-migration.sql
  modified:
    - src/components/graph/InlineCaptureCard.tsx
    - src/components/graph/GraphOSSurface.tsx
    - src/components/graph/__tests__/InlineCaptureCard.test.tsx

key-decisions:
  - "goal space link when creating trigger_outcome is optional — edge creation failure does not block onCreated"
  - "goalSpaceId reset to empty string on successful node save alongside title reset"
  - "Pre-existing vitest globals TypeScript issue (it/expect/vi not found) is out of scope — not caused by this plan"

patterns-established:
  - "Optional relationship linking in inline capture: conditional UI + post-save edge creation wrapped in try/catch"

requirements-completed: [HIER-03, HIER-01]

# Metrics
duration: 15min
completed: 2026-03-27
---

# Phase 1 Plan 1: Goal Hierarchy Schema and UI Foundation Summary

**trigger_outcome node type and four goal-hierarchy edge types added to DB schema via idempotent v0.4 migration; trigger_outcome selectable in inline capture with optional advances_goal edge auto-creation on goal-space selection**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-27T15:05:00Z
- **Completed:** 2026-03-27T15:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `supabase/v0.4-migration.sql` using the v0.3 ON CONFLICT upsert pattern — adds trigger_outcome node type (#085041, sort_order 15), updates goal_space description, and adds all four edge types (advances_goal, targets_outcome, indicates_progress, assigned_to_outcome)
- Added trigger_outcome to InlineCaptureCard's NODE_TYPES array and wired the optional goal-space dropdown that appears when trigger_outcome is selected; post-save edge creation via `/api/graph/edges`
- Added trigger_outcome to GraphOSSurface's NODE_TYPE_OPTIONS (color #085041) and passes goalSpaces derived from nodes to InlineCaptureCard

## Task Commits

Each task was committed atomically:

1. **Task 1: Create v0.4 migration with trigger_outcome node type and edge types** - `a9dfda4` (feat)
2. **Task 2: Add trigger_outcome to type selectors and wire goal-space linking** - `4bc0639` (feat)

## Files Created/Modified

- `supabase/v0.4-migration.sql` - Idempotent migration adding trigger_outcome node type and four goal-hierarchy edge types
- `src/components/graph/InlineCaptureCard.tsx` - Added trigger_outcome to NODE_TYPES, goalSpaces prop, goal-space dropdown UI, advances_goal edge creation
- `src/components/graph/GraphOSSurface.tsx` - Added trigger_outcome to NODE_TYPE_OPTIONS, derives goalSpaces and passes to InlineCaptureCard
- `src/components/graph/__tests__/InlineCaptureCard.test.tsx` - Updated tests to pass required goalSpaces prop; added two new tests for goal-space dropdown behavior

## Decisions Made

- Goal space link when creating trigger_outcome is optional: edge creation is wrapped in a separate try/catch so edge failure does not block `onCreated` or node persistence
- goalSpaceId state is reset to `''` on successful node save alongside title, matching the existing reset pattern
- Used `nodeType === 'trigger_outcome'` guard on the edge creation call so the advances_goal edge is only created for trigger_outcome nodes (not for other types that happen to have a goalSpaceId set)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated InlineCaptureCard test file to pass required goalSpaces prop**
- **Found during:** Task 2 (TypeScript compilation check)
- **Issue:** After adding goalSpaces as a required prop, existing tests would fail TypeScript compilation with "Property 'goalSpaces' is missing"
- **Fix:** Updated all four existing test cases to use a shared DEFAULT_PROPS constant with `goalSpaces: []`; added two new tests covering goal-space dropdown visibility
- **Files modified:** `src/components/graph/__tests__/InlineCaptureCard.test.tsx`
- **Verification:** `npx tsc --noEmit` no longer reports goalSpaces-related errors
- **Committed in:** `4bc0639` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical test update)
**Impact on plan:** Necessary for TypeScript correctness. Added coverage for the new dropdown behavior as a bonus.

## Issues Encountered

Pre-existing TypeScript issue: vitest globals (`it`, `expect`, `vi`) not in tsconfig `types` — affects DashboardSidebar.test.tsx and InlineCaptureCard.test.tsx. Not caused by this plan. Deferred to a chore task.

## Self-Check

- [x] `supabase/v0.4-migration.sql` exists
- [x] Contains `trigger_outcome` with `#085041` and sort_order 15
- [x] Contains all four edge types with ON CONFLICT pattern
- [x] Does NOT contain CREATE TABLE or DROP/CREATE POLICY
- [x] `grep "trigger_outcome" src/components/graph/InlineCaptureCard.tsx` returns matches
- [x] `grep "goalSpaces" src/components/graph/InlineCaptureCard.tsx` returns matches
- [x] `grep "advances_goal" src/components/graph/InlineCaptureCard.tsx` returns matches
- [x] `grep "trigger_outcome" src/components/graph/GraphOSSurface.tsx` returns matches
- [x] `grep "#085041" src/components/graph/GraphOSSurface.tsx` returns matches
- [x] No goalSpaces TypeScript errors (pre-existing vitest globals errors are out-of-scope)

## Self-Check: PASSED

## Next Phase Readiness

- DB migration is ready to run against Supabase (idempotent — safe to run multiple times)
- trigger_outcome nodes can now be created via inline capture and linked to goal spaces
- Phase 2 (GoalSpacePanel) can build on trigger_outcome nodes and advances_goal edges established here
- Phase 3 (hunch-to-outcome linking) can add targets_outcome edge creation to capture forms

---
*Phase: 01-goal-hierarchy*
*Completed: 2026-03-27*
