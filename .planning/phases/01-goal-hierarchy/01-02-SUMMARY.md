---
phase: 01-goal-hierarchy
plan: 02
subsystem: ui
tags: [react, typescript, commitment-panel, goal-hierarchy, trajectory-badge]

# Dependency graph
requires:
  - phase: 01-goal-hierarchy/01-01
    provides: DB migration adding trigger_outcome node type and advances_goal/assigned_to_outcome edge types

provides:
  - TrajectoryBadge component (pending/converging/neutral/drifting status pill, score-ready for Phase 5)
  - GoalSpaceSection component (collapsible goal_space header with trigger_outcome tree + per-section AllocationSummary)
  - AllocationSummary extracted to own file for reuse
  - CommitmentPanel restructured to 3-level goal hierarchy (goal_space > trigger_outcome > commitment)
  - GraphOSSurface passes goalSpaces and triggerOutcomes props to CommitmentPanel

affects:
  - phase 2 (GoalSpacePanel — builds on goal_space section headers)
  - phase 5 (trajectory badge — TrajectoryBadge is drop-in ready for live scores)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - GoalSpaceSection: collapsible section with tree-prefix indicators for hierarchy depth
    - TrajectoryBadge: status-driven pill component forward-compatible with Phase 5 scoring
    - AllocationSummary extracted to standalone file for per-section rendering (D-09)

key-files:
  created:
    - src/components/commitment/TrajectoryBadge.tsx
    - src/components/commitment/GoalSpaceSection.tsx
    - src/components/commitment/AllocationSummary.tsx
  modified:
    - src/components/commitment/CommitmentPanel.tsx
    - src/components/graph/GraphOSSurface.tsx

key-decisions:
  - "AllocationSummary extracted from CommitmentPanel to own file so GoalSpaceSection can import it (D-09)"
  - "CommitmentPanel removes global AllocationSummary footer; rendering moves into each GoalSpaceSection"
  - "TrajectoryBadge status union (pending|converging|neutral|drifting) forward-compatible with Phase 5 — Phase 1 always passes pending"
  - "Unlinked commitments (no goal_space or trigger_outcome edge) render in a named Unlinked section at bottom of panel"

patterns-established:
  - "GoalSpaceSection: each goal space is a collapsible section — header with trajectory badge, tree of trigger outcomes, nested commitments, per-section AllocationSummary"
  - "TrajectoryBadge: small pill with icon + score, tooltip explains pending state"
  - "Hierarchy built from edges at render time in CommitmentPanel — no separate fetch"

requirements-completed: [HIER-02, HIER-04]

# Metrics
duration: 18min
completed: 2026-03-27
---

# Phase 1 Plan 02: Goal Hierarchy UI Summary

**CommitmentPanel restructured from flat list to 3-level collapsible tree (goal_space > trigger_outcome > commitment) with TrajectoryBadge placeholder and per-section AllocationSummary**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-27T00:00:00Z
- **Completed:** 2026-03-27T00:18:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- TrajectoryBadge component created with pending/converging/neutral/drifting status prop — Phase 5 drop-in ready
- GoalSpaceSection renders collapsible goal space headers with trigger outcome tree (tree-prefix: ├ / └) and nested CommitmentCards
- AllocationSummary moved inside GoalSpaceSection (per decision D-09) — no longer a global footer
- CommitmentPanel rebuilt to derive hierarchy from edges (advances_goal, assigned_to_outcome, belongs_to_goalspace)
- Unlinked commitments (no goal_space or trigger_outcome edge) appear in Unlinked fallback section
- GraphOSSurface derives goalSpaces and triggerOutcomes from nodes array and passes to CommitmentPanel

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TrajectoryBadge, GoalSpaceSection, AllocationSummary** - `a6a513a` (feat)
2. **Task 2: Restructure CommitmentPanel and update GraphOSSurface** - `87e3376` (feat)

## Files Created/Modified
- `src/components/commitment/TrajectoryBadge.tsx` - Status pill component with icon, score, and pending tooltip
- `src/components/commitment/GoalSpaceSection.tsx` - Collapsible goal space section with trigger outcome tree and AllocationSummary
- `src/components/commitment/AllocationSummary.tsx` - Extracted from CommitmentPanel, now standalone and importable
- `src/components/commitment/CommitmentPanel.tsx` - Rewritten to 3-level hierarchy with GoalSpaceSection and Unlinked fallback
- `src/components/graph/GraphOSSurface.tsx` - Added goalSpaces/triggerOutcomes filtering and passes to CommitmentPanel

## Decisions Made
- AllocationSummary was a private function inside CommitmentPanel; extracted to `AllocationSummary.tsx` so GoalSpaceSection can import it (Rule 2 — missing critical for D-09 compliance)
- TrajectoryBadge `status` union type is forward-compatible with Phase 5 — Phase 1 always passes `pending`
- Commitment hierarchy built from edges at render time (no additional fetch) — matches props-down pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extracted AllocationSummary to standalone file**
- **Found during:** Task 1 (GoalSpaceSection creation)
- **Issue:** Plan stated "import path confirmed by reading CommitmentPanel.tsx" but AllocationSummary was a private local function, not an exported component — GoalSpaceSection could not import it
- **Fix:** Created `src/components/commitment/AllocationSummary.tsx` as an exported standalone component with identical logic
- **Files modified:** src/components/commitment/AllocationSummary.tsx (created), src/components/commitment/CommitmentPanel.tsx (updated to import from AllocationSummary.tsx)
- **Verification:** GoalSpaceSection imports AllocationSummary, TypeScript compiles clean
- **Committed in:** a6a513a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical)
**Impact on plan:** Required for D-09 compliance. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in test files (src/components/graph/__tests__/) due to missing Jest types — out of scope, not introduced by this plan

## Next Phase Readiness
- Phase 2 (GoalSpacePanel): goal_space sections now visible as collapsible headers — clicking them can open a detail panel
- Phase 5 (Trajectory badge): TrajectoryBadge is drop-in ready; Phase 5 replaces `status="pending"` with computed status and score

---
*Phase: 01-goal-hierarchy*
*Completed: 2026-03-27*
