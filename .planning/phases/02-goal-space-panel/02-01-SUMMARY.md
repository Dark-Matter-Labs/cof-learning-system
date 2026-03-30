---
phase: 02-goal-space-panel
plan: 01
subsystem: graph-queries
tags: [typescript, tdd, pure-functions, graph, outcome-status]

# Dependency graph
requires:
  - phase: 01-goal-hierarchy/01-01
    provides: DB migration with trigger_outcome node type and assigned_to_outcome/targets_outcome/indicates_progress edge types

provides:
  - computeOutcomeStatus pure function (blocked > met > in_progress > not_started priority)
  - getOutcomeCommitmentCount pure function (assigned_to_outcome edge count)
  - getOutcomeHunchCount pure function (targets_outcome edges filtered to hunch source nodes)
  - OutcomeStatus type union
  - Unit tests: 14 test cases covering all status branches and edge cases

affects:
  - phase 02-02 (GoalSpacePanel — imports these functions to drive progress indicators)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure graph query functions with readonly parameters and O(1) node lookup via Map
    - Factory fixture functions (makeNode/makeEdge) returning fresh immutable objects per call

key-files:
  created:
    - src/lib/graph/__tests__/queries.test.ts
  modified:
    - src/lib/graph/queries.ts

key-decisions:
  - "computeOutcomeStatus checks blocked before met — falsified/suspended source nodes take priority regardless of edge type"
  - "getOutcomeHunchCount filters by node_type === hunch to exclude intervention nodes from count"
  - "OutcomeStatus type placed at top of queries.ts alongside imports for discoverability"

# Metrics
duration: 2min
completed: 2026-03-27
---

# Phase 02 Plan 01: Outcome Status Query Functions Summary

**Three pure graph-query functions (computeOutcomeStatus, getOutcomeCommitmentCount, getOutcomeHunchCount) implemented via TDD with 14 unit tests covering all status branches and hunch/intervention distinction**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-27T21:23:00Z
- **Completed:** 2026-03-27T21:25:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- `OutcomeStatus` type exported: `'not_started' | 'in_progress' | 'met' | 'blocked'`
- `computeOutcomeStatus(outcomeId, edges, allNodes)` — priority order: blocked (falsified/suspended source) > met (indicates_progress + promoted) > in_progress (assigned_to_outcome or targets_outcome exists) > not_started
- `getOutcomeCommitmentCount(outcomeId, edges)` — counts `assigned_to_outcome` edges targeting the outcome
- `getOutcomeHunchCount(outcomeId, edges, allNodes)` — counts `targets_outcome` edges where source node_type is `hunch` (excludes interventions)
- All functions pure, no side effects, no mutation, readonly parameter types
- 14 test cases covering all status variants, priority ordering, empty inputs, and type filtering
- Full test suite (32 tests, 6 files) passes with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests** - `6d8e8a1` (test)
2. **Task 2 (GREEN): Implementation** - `97e9b8c` (feat)

## Files Created/Modified

- `src/lib/graph/__tests__/queries.test.ts` — 14 test cases in 3 describe blocks with makeNode/makeEdge factory fixtures
- `src/lib/graph/queries.ts` — Extended with OutcomeStatus type and 3 new exported pure functions (existing functions untouched)

## Decisions Made

- Blocked check happens before met: any source node with status `falsified` or `suspended` returns `blocked` regardless of edge type — ensures negative signals prevent false "met" status
- Hunch count filters by `node_type === 'hunch'` at the node level (not edge level) — this is the correct boundary since both hunches and interventions can have `targets_outcome` edges
- OutcomeStatus type defined at module top so it's visible before function definitions

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

- Phase 02-02 (GoalSpacePanel UI): can now import `computeOutcomeStatus`, `getOutcomeCommitmentCount`, `getOutcomeHunchCount` from `@/lib/graph/queries` to power progress indicators per trigger outcome

---

## Self-Check

- [x] src/lib/graph/__tests__/queries.test.ts — FOUND
- [x] src/lib/graph/queries.ts — FOUND
- [x] Commit 6d8e8a1 (RED: test) — FOUND
- [x] Commit 97e9b8c (GREEN: feat) — FOUND

## Self-Check: PASSED
