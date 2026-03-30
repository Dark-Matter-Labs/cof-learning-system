---
phase: 05-trajectory-indicators
plan: 02
subsystem: ui
tags: [react, typescript, vitest, testing-library, convergence, trajectory, sparkline]

# Dependency graph
requires:
  - phase: 05-01
    provides: ConvergenceSparkline component, GET /api/convergence/snapshots endpoint, ConvergenceData/SparklinePoint types
  - phase: 04-convergence-computation
    provides: convergence scoring, convergence_snapshots table, FactorBreakdown/OutcomeScore types
provides:
  - TrajectoryBadge upgraded with scoreToStatus export, click-expand factor breakdown, button element
  - GoalSpaceSection wired to live convergence API with live badge + sparkline
  - GoalSpacePanel wired to live convergence API with badge, score, factor breakdown, and sparkline
affects:
  - 06-reflection-agent (uses GoalSpacePanel for goal space display)
  - 07-reflect-page (uses commitment panel with GoalSpaceSection)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Click-expand breakdown: button element toggles expanded state, conditionally renders breakdown panel"
    - "Silent fetch-fail pattern: catch block silent, component stays in pending/empty state on error"
    - "scoreToStatus pure function: exported for reuse in parent components that derive status from score"

key-files:
  created:
    - src/components/commitment/__tests__/TrajectoryBadge.test.tsx
  modified:
    - src/components/commitment/TrajectoryBadge.tsx
    - src/components/commitment/GoalSpaceSection.tsx
    - src/components/graph/GoalSpacePanel.tsx

key-decisions:
  - "Render weight and node_title in separate spans within breakdown panel — allows CSS class targeting in tests and cleaner DOM structure"
  - "GoalSpacePanel gets 'use client' directive — needed for useState/useEffect, panel is client-side interactive"

patterns-established:
  - "TrajectoryBadge: outer element is button not span — accessibility requirement for clickable elements"
  - "scoreToStatus: strictly > 1.0 for converging, strictly < -1.0 for drifting (not >=)"

requirements-completed: [CONV-04, CONV-05, CONV-06]

# Metrics
duration: 18min
completed: 2026-03-30
---

# Phase 05 Plan 02: Trajectory Indicators UI Summary

**TrajectoryBadge upgraded to live score + click-expand factor breakdown; GoalSpaceSection and GoalSpacePanel wired to convergence API with badge and sparkline**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-30T12:26:00Z
- **Completed:** 2026-03-30T12:44:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 created)

## Accomplishments
- TrajectoryBadge: exports `scoreToStatus`, replaced span with button, click-toggles factor breakdown panel with positive (teal) and negative (red) factor display, 16 tests all passing
- GoalSpaceSection: fetches convergence data on mount, passes live status/score/breakdown to TrajectoryBadge, renders ConvergenceSparkline when history available
- GoalSpacePanel: added `'use client'` directive, fetches convergence data on mount, shows TrajectoryBadge with score and breakdown next to NodeTypeBadge, shows 30-day sparkline below title

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade TrajectoryBadge with live score display and click-expand factor breakdown** - `4ed5ea8` (feat)
2. **Task 2: Wire convergence data into GoalSpaceSection and GoalSpacePanel** - `1e31d9b` (feat)

_Note: Task 1 used TDD — tests written first (RED: 15 failing), implementation written second (GREEN: 16 passing)_

## Files Created/Modified
- `src/components/commitment/__tests__/TrajectoryBadge.test.tsx` - 16 unit tests covering scoreToStatus, badge rendering, click-expand, color classes, edge cases
- `src/components/commitment/TrajectoryBadge.tsx` - Upgraded: button element, scoreToStatus export, expanded state, factor breakdown panel
- `src/components/commitment/GoalSpaceSection.tsx` - Added useEffect fetch, live TrajectoryBadge props, ConvergenceSparkline
- `src/components/graph/GoalSpacePanel.tsx` - Added 'use client', useEffect fetch, TrajectoryBadge + ConvergenceSparkline

## Decisions Made
- Render weight and node_title in separate `<span>` elements within the breakdown panel — allows CSS class targeting in tests and cleaner DOM structure
- GoalSpacePanel needed `'use client'` directive — was previously a pure server component but now requires useState/useEffect for convergence fetch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Separated weight and node_title into distinct spans in breakdown panel**
- **Found during:** Task 1 (TDD GREEN phase — tests failing after initial implementation)
- **Issue:** Initial implementation rendered `+3.0 Retention improved 5%` as a single text node inside one div; `getByText('Retention improved 5%')` couldn't match the partial text
- **Fix:** Split into `<span className="text-teal-400">+{weight}</span>` and `<span className="text-gray-400">{node_title}</span>` — makes node_title independently selectable and weight color class separately targetable
- **Files modified:** src/components/commitment/TrajectoryBadge.tsx
- **Verification:** All 16 tests pass
- **Committed in:** 4ed5ea8 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Fix was necessary for correct DOM structure and test-queryable output. Improved accessibility by separating semantic content.

## Issues Encountered
- Worktree was on an old branch commit — rebased onto v0.4 before starting. This was pre-existing infra setup, not a code issue.

## Next Phase Readiness
- Phase 5 complete: trajectory badge and sparkline fully wired in both GoalSpaceSection (commitment panel) and GoalSpacePanel (graph detail panel)
- All 126 tests pass, no regressions
- Phase 6 (reflection agent) can proceed — goal space UI fully supports convergence visualization

---
*Phase: 05-trajectory-indicators*
*Completed: 2026-03-30*

## Self-Check: PASSED

- FOUND: src/components/commitment/__tests__/TrajectoryBadge.test.tsx
- FOUND: src/components/commitment/TrajectoryBadge.tsx
- FOUND: src/components/commitment/GoalSpaceSection.tsx
- FOUND: src/components/graph/GoalSpacePanel.tsx
- FOUND: .planning/phases/05-trajectory-indicators/05-02-SUMMARY.md
- FOUND commit: 4ed5ea8 (Task 1)
- FOUND commit: 1e31d9b (Task 2)
