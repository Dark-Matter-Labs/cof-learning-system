---
phase: 04-convergence-computation
plan: 02
subsystem: api
tags: [convergence, snapshots, supabase, nextjs, tdd, vitest]

# Dependency graph
requires:
  - phase: 04-01
    provides: computeConvergenceScore function and convergence_snapshots DB migration

provides:
  - POST /api/convergence/snapshot — on-demand snapshot for single goal space or all goal spaces
  - shouldTriggerSnapshot pure function in convergence.ts with TDD coverage (7 tests)
  - Threshold trigger in nodes POST route — fire-and-forget snapshot when 10+ new promoted/human_reviewed nodes

affects: [05-trajectory-badge, 05-sparkline]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget void pattern for non-blocking async side effects, TDD red-green-refactor for pure functions]

key-files:
  created:
    - src/app/api/convergence/snapshot/route.ts
  modified:
    - src/lib/graph/convergence.ts
    - src/lib/graph/__tests__/convergence.test.ts
    - src/app/api/graph/nodes/route.ts

key-decisions:
  - "shouldTriggerSnapshot threshold logic lives in convergence.ts pure function library — not in route handlers — consistent with computeConvergenceScore pattern"
  - "checkAndTriggerSnapshots is fire-and-forget via void keyword — snapshot failure never blocks node creation"
  - "Threshold counts only promoted + human_reviewed nodes (not raw/processing) — consistent with qualified node semantics"

patterns-established:
  - "Fire-and-forget pattern: void asyncFn() after response construction, silent catch inside to prevent side-effect failures from breaking main flow"
  - "Threshold decisions extracted to pure functions in lib/graph/ for testability and reuse across routes"

requirements-completed: [CONV-03]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 4 Plan 02: Convergence Snapshot API + Threshold Trigger Summary

**On-demand convergence snapshot route and automatic threshold trigger wired into nodes POST — fire-and-forget, 22 unit tests green, no type errors**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T11:53:42Z
- **Completed:** 2026-03-27T11:56:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- POST /api/convergence/snapshot route accepts { goal_space_id } or { all: true }, computes scores, inserts into convergence_snapshots, logs activity
- shouldTriggerSnapshot pure function with 7 unit tests covering all threshold edge cases (null prior, default threshold, delta at/above/below boundary)
- checkAndTriggerSnapshots wired into nodes POST route as fire-and-forget — triggers when delta >= 10 promoted/human_reviewed nodes since last snapshot

## Task Commits

Each task was committed atomically:

1. **Task 1: On-demand convergence snapshot API route** - `f69dbd9` (feat)
2. **Task 2 RED: Add failing shouldTriggerSnapshot tests** - `2cf648d` (test)
3. **Task 2 GREEN: Implement shouldTriggerSnapshot** - `0812468` (feat)
4. **Task 2: Wire threshold trigger into nodes route** - `227c834` (feat)

_Note: TDD task has separate RED (test) and GREEN (feat) commits_

## Files Created/Modified

- `src/app/api/convergence/snapshot/route.ts` — POST handler: auth, parse body, fetch graph, compute scores, insert snapshots, log activity
- `src/lib/graph/convergence.ts` — Added TriggerSnapshotInput interface and shouldTriggerSnapshot function
- `src/lib/graph/__tests__/convergence.test.ts` — Added 7 shouldTriggerSnapshot tests (22 total)
- `src/app/api/graph/nodes/route.ts` — Added checkAndTriggerSnapshots + fire-and-forget call in POST

## Decisions Made

- shouldTriggerSnapshot lives in convergence.ts lib alongside computeConvergenceScore — keeps threshold logic in the pure-function layer, not scattered in route handlers
- checkAndTriggerSnapshots is NOT exported from nodes/route.ts — it's internal to that module
- The void pattern ensures the nodes POST response is never delayed by snapshot computation
- Threshold counts promoted + human_reviewed nodes only — consistent with the qualified node semantics used throughout the system

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — worktree was initialized at main commit (44cc128) rather than v0.4 tip. Resolved by fast-forward merging v0.4 before beginning execution. This is expected setup behavior for executor agents.

## Next Phase Readiness

- convergence_snapshots table has data (once migration is applied and nodes exist)
- POST /api/convergence/snapshot ready for trajectory badge Phase 5 to query latest snapshots
- Time-series data accumulates automatically via threshold trigger as nodes are added
- Phase 5 (trajectory badge + sparkline) can query convergence_snapshots by goal_space_id ordered by computed_at

## Self-Check: PASSED

All files created and commits verified:
- FOUND: src/app/api/convergence/snapshot/route.ts
- FOUND: src/lib/graph/convergence.ts (modified)
- FOUND: src/app/api/graph/nodes/route.ts (modified)
- FOUND: f69dbd9 (snapshot route)
- FOUND: 2cf648d (threshold tests RED)
- FOUND: 0812468 (shouldTriggerSnapshot GREEN)
- FOUND: 227c834 (nodes route wiring)

---
*Phase: 04-convergence-computation*
*Completed: 2026-03-27*
