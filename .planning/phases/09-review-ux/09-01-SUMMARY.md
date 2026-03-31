---
phase: 09-review-ux
plan: 01
subsystem: ui
tags: [react, vitest, testing-library, review, ux]

# Dependency graph
requires: []
provides:
  - ReviewCard opt-out default acceptance model (all fields pre-accepted on open)
  - Promote All one-click shortcut button (teal, above Promote to Graph)
  - buildInitialFields pure function for lazy useState initialization
  - ReviewCard.test.tsx unit tests for REVIEW-01, REVIEW-02, REVIEW-03
affects: [review-ux, ReviewCard, HumanReview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Lazy useState initializer to set opt-out defaults: `useState(() => buildInitialFields(extraction))`
    - handlePromoteAll builds HumanReview from local variables (not state) to avoid stale closure

key-files:
  created:
    - src/components/review/__tests__/ReviewCard.test.tsx
  modified:
    - src/components/review/ReviewCard.tsx

key-decisions:
  - "Opt-out review model: fields pre-accepted by default, user rejects bad ones — inverts friction for common case (accept all)"
  - "handlePromoteAll reads from local variables not state to avoid stale closure pitfall"
  - "buildInitialFields uses null guard (extraction ? ... : {}) to prevent throw when extraction is null"

patterns-established:
  - "TDD RED/GREEN for UI behavior changes: write failing tests first, then implement"
  - "Lazy useState initializer pattern for computed initial state from props"

requirements-completed: [REVIEW-01, REVIEW-02, REVIEW-03]

# Metrics
duration: ~40min
completed: 2026-03-31
---

# Phase 9 Plan 01: ReviewCard Opt-Out Defaults Summary

**ReviewCard rewritten to pre-accept all extraction fields on open, with a teal Promote All button that promotes in one click — zero clicks required for the common case**

## Performance

- **Duration:** ~40 min (including human-verify checkpoint)
- **Started:** 2026-03-31T20:00:00Z
- **Completed:** 2026-03-31T22:25:00Z
- **Tasks:** 3 (Task 0 RED, Task 1 GREEN, Task 2 human-verify)
- **Files modified:** 2

## Accomplishments

- All ExtractionFields open with green left border (pre-accepted) without any user interaction
- New "Promote all" teal button above "Promote to Graph" accepts all fields and calls onPromote in one click
- `buildInitialFields` pure function extracted above component for lazy useState initialization
- Three unit tests covering REVIEW-01, REVIEW-02, REVIEW-03 — all GREEN
- Hydration error fixed separately (suppressHydrationWarning on html element)

## Task Commits

Each task was committed atomically:

1. **Task 0: Create ReviewCard.test.tsx with failing stubs (RED)** - `f1b72a6` (test)
2. **Task 1: Opt-out defaults + Promote All button (GREEN)** - `23c00cb` (feat)
3. **Task 2: Visual verification** - approved by human (no commit — browser confirmation)

Additional: `179544c` — fix(layout): suppressHydrationWarning for dark mode script (separate hydration fix)

_Note: TDD tasks have two commits (test RED → feat GREEN)_

## Files Created/Modified

- `src/components/review/__tests__/ReviewCard.test.tsx` - Unit tests for REVIEW-01 (green border on open), REVIEW-02 (Promote enabled on first render), REVIEW-03 (Promote All calls onPromote with all fields accepted)
- `src/components/review/ReviewCard.tsx` - Added buildInitialFields, lazy useState initializer, handlePromoteAll callback, and Promote All button

## Decisions Made

- Opt-out model: fields default to `action: 'accepted'` via `buildInitialFields` lazy initializer. User only acts on fields they want to reject/edit.
- `handlePromoteAll` builds `HumanReview` from local computed variables, not from state reads, to avoid stale closure bugs.
- `extraction ? buildInitialFields(extraction) : {}` null guard protects against nodes with null `llm_extraction`.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Hydration error caused by dark mode inline script that ran before React hydration. Fixed by adding `suppressHydrationWarning` to the `<html>` element in the root layout. This was a pre-existing issue surfaced by dark mode work from Phase 08, fixed as part of this session but committed separately.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ReviewCard opt-out model is complete and visually verified in browser
- REVIEW-01, REVIEW-02, REVIEW-03 requirements satisfied
- Phase 09 is the only phase; milestone v0.5 UX Polish execution can now wrap up

---
*Phase: 09-review-ux*
*Completed: 2026-03-31*
