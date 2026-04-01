---
phase: 11-date-timeline
plan: 01
subsystem: capture, graph-timeline
tags: [insight_date, timeline, capture-form, db-migration]
dependency_graph:
  requires: []
  provides: [insight_date column, getTimelineDate helper, insight_date capture field]
  affects: [nodes table, capture form, timeline view, Node type]
tech_stack:
  added: []
  patterns: [nullable timestamp column with fallback, field-gated UI rendering]
key_files:
  created:
    - supabase/v0.5-insight-date.sql
  modified:
    - src/lib/types/nodes.ts
    - src/lib/config/captureTypes.ts
    - src/components/capture/QuickCaptureForm.tsx
    - src/app/capture/page.tsx
    - src/app/api/capture/route.ts
    - src/components/graph/GraphCanvas.tsx
decisions:
  - insight_date is nullable TIMESTAMPTZ — existing nodes retain NULL and fall back to created_at in timeline
  - meeting_notes capture type excluded from insight_date field — meeting_date already serves this purpose; passed as insight_date at API level
  - getTimelineDate helper centralises insight_date ?? created_at fallback — single change point for future modifications
metrics:
  duration: 10min
  completed: 2026-03-31
  tasks_completed: 2
  files_changed: 6
requirements: [CAPT-09, CAPT-10]
---

# Phase 11 Plan 01: insight_date + Timeline View Summary

**One-liner:** Nullable `insight_date` column on nodes with "When did this happen?" capture field and `insight_date ?? created_at` fallback in timeline layout.

## What Was Built

Robyn captures insights days or weeks after the fact. Without `insight_date`, the timeline showed entry date rather than event date — making it misleading. This plan fixes that.

### Task 1: DB Migration + Type + Form + API
- Created `supabase/v0.5-insight-date.sql`: adds `insight_date TIMESTAMPTZ DEFAULT NULL` column and a DESC index for timeline ordering
- Added `readonly insight_date: string | null` to `Node` interface
- Added `'insight_date'` to `CaptureField` union and to `fields` arrays of all non-meeting capture types (hunch, assumption_background, assumption_foreground, test, learning, option, commitment, signal, goal_space, trigger_outcome)
- `QuickCaptureForm` gains `insightDate` state defaulting to today, a "When did this happen?" date input gated behind `fields.includes('insight_date')`, and `insight_date` passed through `CaptureFormData`
- `capture/page.tsx` converts the form's date string to ISO timestamp; meeting notes use `meeting_date` as `insight_date` fallback
- `api/capture/route.ts` destructures and persists `insight_date` in the node insert

### Task 2: Timeline View
- Added `getTimelineDate(node: Node): number` helper: `node.insight_date ?? node.created_at`
- Replaced all 7 call sites in `computeTimelineLayout` (sort comparator, minT, maxT, row positioning)
- Replaced all 3 call sites in the timeline axis rendering section
- No changes to force, tree, or workflow views

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixtures missing insight_date on Node mock objects**
- **Found during:** Task 1 (TypeScript compilation after adding required field)
- **Issue:** Five test fixture `makeNode`/`mockNode`/`baseNode` factories did not include `insight_date`, making them fail TypeScript after the field became required on `Node`
- **Fix:** Added `insight_date: null` to base objects in all five affected test files
- **Files modified:** `GoalSpacePanel.test.tsx`, `InlineCaptureCard.test.tsx`, `GoalRelevanceField.test.tsx`, `queries.test.ts`, `convergence.test.ts`
- **Commit:** 10be1d1 (included in Task 1 commit)

**Note:** Pre-existing `TS2582`/`TS2304` errors in `DashboardSidebar.test.tsx` and `InlineCaptureCard.test.tsx` (missing test runner type declarations for `it`, `expect`, `vi` globals) were present before this plan and are out of scope. Production code compiles with zero errors.

## Self-Check

**Files exist:**
- `supabase/v0.5-insight-date.sql` — present
- `src/lib/types/nodes.ts` — contains `insight_date: string | null`
- `src/components/capture/QuickCaptureForm.tsx` — contains `id="insight-date"` and "When did this happen?"
- `src/components/graph/GraphCanvas.tsx` — contains `getTimelineDate` (8 references)

**Commits exist:**
- `10be1d1` — feat(11-01): insight_date migration, Node type, capture form, API persistence
- `438665d` — feat(11-01): timeline view uses insight_date with created_at fallback

## Self-Check: PASSED
