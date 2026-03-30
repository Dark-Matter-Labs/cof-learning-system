---
phase: 03-capture-linking-extraction
plan: 02
subsystem: review-ui
tags: [review, goal-relevance, hunch-linking, weekly-review, capture-review]
dependency_graph:
  requires: []
  provides:
    - undirected-hunches-section-in-weekly-review
    - GoalRelevanceField-component
    - ReviewCard-goal-relevance-integration
    - capture-review-targets-outcome-edge-creation
  affects:
    - src/app/review/page.tsx
    - src/components/review/ReviewCard.tsx
    - src/app/capture/[id]/review/page.tsx
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN for each task)
    - Server component with extended Promise.all for new queries
    - Inline client component with toggle state for "link to different outcome" dropdown
    - Supabase query chaining for parallel fetch (node + trigger_outcome) in useEffect
key_decisions:
  - Added goal_relevance and expected_signals to LlmExtraction as part of Task 1 setup (plan 03-01 parallel dependency)
  - "Link to different outcome" uses native select element inline (no modal) per plan spec
  - goalRelevanceActions stored separately from fields in ReviewCard to isolate goal relevance state
  - targets_outcome edges created at promotion time by scanning goal_relevance_* keys in review.fields
key_files:
  created:
    - src/components/review/GoalRelevanceField.tsx
    - src/components/review/__tests__/GoalRelevanceField.test.tsx
    - src/app/review/__tests__/ReviewPage.test.tsx
  modified:
    - src/app/review/page.tsx
    - src/components/review/ReviewCard.tsx
    - src/app/capture/[id]/review/page.tsx
    - src/lib/types/nodes.ts
metrics:
  duration: ~15 minutes
  completed: 2026-03-27
  tasks_completed: 2
  files_changed: 7
---

# Phase 03 Plan 02: Goal Relevance Review UI Summary

**One-liner:** Undirected hunch surfacing in weekly review + GoalRelevanceField Accept/Reject/Link UI wired into ReviewCard and capture review with targets_outcome edge creation on promote.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add undirected hunches section to weekly review page | 4a296ec | page.tsx, nodes.ts, ReviewPage.test.tsx |
| 2 | Create GoalRelevanceField + wire into ReviewCard + capture review page | e35a4af | GoalRelevanceField.tsx, GoalRelevanceField.test.tsx, ReviewCard.tsx, capture/review/page.tsx |

## What Was Built

### Task 1: Weekly Review Undirected Hunches Section

Extended `src/app/review/page.tsx` (server component) with two new Supabase queries added to the existing `Promise.all`:
- All active hunches (excluding archived/falsified/suspended status)
- All `targets_outcome` edges (to compute which hunches are linked)

Computed `undirectedHunches` by filtering out hunch ids present in the edges set. Added "Undirected hunches" section in the Context health column with amber-tinted styling, count, "consider linking" prompt, and links to `/capture/{id}/review`.

Updated `isEmpty` check to include `undirectedHunches.length === 0` so the page shows content even when only undirected hunches exist (and no awaiting/tensions/lowConf).

### Task 2: GoalRelevanceField Component

New `GoalRelevanceField` component renders each AI-suggested outcome with:
- `outcome_title` (bold) and `rationale` (gray text)
- Accept button (teal) — calls `onAction(outcomeId, 'accepted', outcomeId)`
- Reject button (red) — calls `onAction(outcomeId, 'rejected', outcomeId)`
- "Link to different outcome" toggle button — reveals native `<select>` with all trigger outcomes; on selection calls `onAction(originalId, 'edited', selectedId)`
- Border highlights current action state (teal=accepted, red=rejected, blue=edited)

`ReviewCard.tsx` changes:
- Added optional `triggerOutcomes` prop (default `[]`)
- Added `goalRelevanceActions` state for tracking Accept/Reject/Edit per outcome
- Renders `GoalRelevanceField` when `extraction.goal_relevance` exists and has length > 0
- Renders `ExtractionField` for `expected_signals` as comma-separated text when present
- `buildReview()` includes `goal_relevance_{outcomeId}` entries in `fields` for accepted/edited outcomes

`src/app/capture/[id]/review/page.tsx` changes:
- `useEffect` now runs two queries in parallel: node fetch + trigger_outcome fetch
- Stores `triggerOutcomes` in state; passes to `ReviewCard`
- `handlePromote` scans `review.fields` for `goal_relevance_*` keys with accepted/edited action and inserts `targets_outcome` edges into `supabase.from('edges')`

### Type Extensions

Added to `LlmExtraction` in `src/lib/types/nodes.ts` (required by plan 03-01 parallel dependency):
- `goal_relevance?: ReadonlyArray<{ outcome_id, outcome_title, rationale }>`
- `expected_signals?: readonly string[]`

## Test Coverage

| File | Tests | All Pass |
|------|-------|----------|
| ReviewPage.test.tsx | 6 | Yes |
| GoalRelevanceField.test.tsx | 9 (7 component + 2 ReviewCard integration) | Yes |
| Total across project | 33 | Yes |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Pre-existing Issues (Out of Scope)

**Pre-existing TypeScript errors in unrelated test files:**
- `src/components/graph/__tests__/DashboardSidebar.test.tsx` — uses vitest globals (`it`, `expect`, `vi`) without explicit imports; tsconfig doesn't reference vitest types
- `src/components/graph/__tests__/InlineCaptureCard.test.tsx` — same issue

These errors existed before this plan and are not caused by any changes made here. Logged to deferred items.

## Self-Check: PASSED

- FOUND: src/components/review/GoalRelevanceField.tsx
- FOUND: src/components/review/__tests__/GoalRelevanceField.test.tsx
- FOUND: src/app/review/__tests__/ReviewPage.test.tsx
- FOUND: commit 4a296ec (Task 1)
- FOUND: commit e35a4af (Task 2)
