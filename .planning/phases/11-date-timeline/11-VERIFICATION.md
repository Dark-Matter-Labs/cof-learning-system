---
phase: 11-date-timeline
verified: 2026-03-31T12:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 11: Date & Timeline Verification Report

**Phase Goal:** Nodes have an insight date distinct from their creation timestamp, and the timeline view positions nodes by when the insight occurred rather than when it was entered.
**Verified:** 2026-03-31
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Capture form shows a "When did this happen?" date field that defaults to today | VERIFIED | `QuickCaptureForm.tsx` line 50: `useState<string>(new Date().toISOString().slice(0, 10))`, line 134-135: `id="insight-date"` with label "When did this happen?"; field gated behind `selectedConfig?.fields.includes('insight_date')` |
| 2 | Submitting a capture stores the date as insight_date on the node row | VERIFIED | `capture/page.tsx` lines 48-53 convert form date to ISO; line 68 sends `insight_date: insightDate ?? meetingAsInsight` in POST body; `api/capture/route.ts` line 13 destructures `insight_date`, line 36 inserts `insight_date: insight_date ?? null` |
| 3 | Timeline view positions nodes by insight_date when set, falling back to created_at | VERIFIED | `GraphCanvas.tsx` lines 112-116: `getTimelineDate` helper uses `node.insight_date ?? node.created_at`; all 6 timeline call sites (sort, minT, maxT, row positioning × 2, axis sort/minT/maxT) use `getTimelineDate` — no residual `data.created_at` references remain in timeline code |
| 4 | Existing nodes without insight_date still appear correctly in timeline (fallback to created_at) | VERIFIED | `getTimelineDate` uses nullish coalescing (`??`): returns `created_at` when `insight_date` is null; `Node.insight_date` is typed `string | null`; DB column is `TIMESTAMPTZ DEFAULT NULL` so existing rows are null |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/v0.5-insight-date.sql` | DB migration adding insight_date column | VERIFIED | Contains `ALTER TABLE nodes ADD COLUMN insight_date TIMESTAMPTZ DEFAULT NULL` and `CREATE INDEX idx_nodes_insight_date ON nodes(insight_date DESC NULLS LAST)` |
| `src/lib/types/nodes.ts` | Node interface with insight_date field | VERIFIED | Line 120: `readonly insight_date: string \| null;` present in `Node` interface |
| `src/components/capture/QuickCaptureForm.tsx` | Insight date field in capture form | VERIFIED | `CaptureFormData` has `readonly insight_date?: string`; `insightDate` state; `id="insight-date"` input with "When did this happen?" label; passed through `onSubmit` |
| `src/components/graph/GraphCanvas.tsx` | Timeline layout using insight_date with fallback | VERIFIED | `getTimelineDate` helper defined at line 113; 8 total references (1 definition + 7 call sites) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `QuickCaptureForm.tsx` | `capture/page.tsx` | `CaptureFormData.insight_date` field passed through `onSubmit` | WIRED | Form sets `insight_date` in submit payload; `page.tsx` reads `formData.insight_date` at line 48 |
| `capture/page.tsx` | `api/capture/route.ts` | POST body includes `insight_date` | WIRED | Line 68: `insight_date: insightDate ?? meetingAsInsight` in JSON body; meeting notes correctly fall back to `meetingAsInsight` |
| `api/capture/route.ts` | supabase nodes table | insert includes insight_date column | WIRED | Line 13 destructures `insight_date`; line 36 persists `insight_date: insight_date ?? null` |
| `GraphCanvas.tsx` | `src/lib/types/nodes.ts` | `GraphNode.data.insight_date` accessed in `getTimelineDate` | WIRED | `getTimelineDate(node: Node)` typed against `Node` from `@/lib/types/nodes`; `node.insight_date` accessed at line 114 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CAPT-09 | 11-01-PLAN.md | Insight date field on capture form ("When did this happen?", defaults to today), stored as insight_date on node | SATISFIED | Form field with default-today state, API persistence confirmed |
| CAPT-10 | 11-01-PLAN.md | Timeline view uses insight_date for node positioning when set, falling back to created_at | SATISFIED | `getTimelineDate` with `??` fallback used at all 7 timeline call sites |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `capture/page.tsx` | 79 | `console.error('Capture failed:', error)` | Info | Error logging in catch block — acceptable error handling pattern |

No blocker or warning anti-patterns. The `console.error` is in an error handler and is appropriate.

### Pre-existing TS Issues (Out of Scope)

`npx tsc --noEmit` reports `TS2582`/`TS2304` errors in `DashboardSidebar.test.tsx` and `InlineCaptureCard.test.tsx` (missing test runner type declarations for `it`, `expect`, `vi` globals). These are pre-existing issues documented in the SUMMARY as present before this phase. All production source files compile with zero errors.

### Human Verification Required

The following items cannot be verified programmatically:

#### 1. Date field renders with today's date pre-filled

**Test:** Open the capture page, select "Hunch" capture type. Check the "When did this happen?" date input.
**Expected:** The date input shows today's date (2026-03-31) pre-populated without any user interaction.
**Why human:** Cannot verify browser-rendered default date values programmatically.

#### 2. Meeting notes type does not show insight_date field

**Test:** Open capture page, select "Meeting Notes / Transcript".
**Expected:** No "When did this happen?" field appears; only "Meeting Date" and "Participants" fields show.
**Why human:** Field rendering depends on runtime config filtering, requires browser rendering to confirm.

#### 3. Timeline node positions shift when insight_date differs from created_at

**Test:** Find a node with `insight_date` set to a date different from `created_at` in the graph timeline view.
**Expected:** The node appears at its `insight_date` position on the axis, not at `created_at`.
**Why human:** Requires live data with both fields populated to observe visual positioning difference.

### Gaps Summary

No gaps found. All four observable truths are verified, all six success criteria from the plan are met, both requirements (CAPT-09, CAPT-10) are satisfied, all key links are wired end-to-end.

The `getTimelineDate` helper achieves the exact contract: `node.insight_date ?? node.created_at`, and it is called at all 7 timeline layout sites (sort comparator, minT, maxT in `computeTimelineLayout`; sort, minT, maxT in the axis rendering section, and row position assignment). The meeting notes fallback (`meetingAsInsight`) correctly handles the edge case where `meeting_date` substitutes for `insight_date`.

---

_Verified: 2026-03-31_
_Verifier: Claude (gsd-verifier)_
