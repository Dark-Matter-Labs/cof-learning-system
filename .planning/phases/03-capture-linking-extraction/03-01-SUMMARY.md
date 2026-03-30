---
phase: 03-capture-linking-extraction
plan: 01
subsystem: capture-ui, extraction-agent
tags: [capture, goal-linking, extraction, llm, edge-creation]
dependency_graph:
  requires:
    - 01-01 (trigger_outcome node type exists in DB)
    - 02-01 (goal_space nodes and GoalSpacePanel)
  provides:
    - InlineCaptureCard outcome dropdown for hunch/intervention/signal
    - Outcome edge creation (targets_outcome, indicates_progress)
    - GoalContext-enriched extraction prompts
    - expected_signals field in capture form
  affects:
    - src/components/graph/InlineCaptureCard.tsx
    - src/components/graph/GraphOSSurface.tsx
    - src/lib/agents/extraction.ts
    - src/lib/types/nodes.ts
    - src/app/api/capture/process/route.ts
tech_stack:
  added: []
  patterns:
    - Fire-and-forget edge POST pattern (same as advances_goal)
    - Parallel Supabase queries for goal context fetch
    - Optional GoalContext parameter pattern for backward compat
key_files:
  created: []
  modified:
    - src/components/graph/InlineCaptureCard.tsx
    - src/components/graph/GraphOSSurface.tsx
    - src/app/api/capture/process/route.ts
    - src/lib/agents/extraction.ts
    - src/lib/types/nodes.ts
decisions:
  - "OUTCOME_NODE_TYPES constant ['hunch','intervention','signal'] defines which types show outcome dropdown"
  - "Signal creates indicates_progress edge; hunch/intervention creates targets_outcome edge"
  - "expected_signals field is co-located with outcome dropdown in same UI section"
  - "GoalContext passed as optional param — empty arrays skip goal section in prompt"
  - "Parallel Promise.all for node + goal spaces + trigger outcomes fetch in route"
metrics:
  duration: 15min
  completed_date: "2026-03-30"
  tasks_completed: 3
  files_modified: 5
---

# Phase 03 Plan 01: Capture Linking + Extraction Goal Context Summary

**One-liner:** Outcome dropdown with edge-type routing (targets_outcome/indicates_progress) and GoalContext-enriched extraction prompts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend LlmExtraction type + extraction agent with GoalContext | 8c92dfd | nodes.ts, extraction.ts |
| 2 | InlineCaptureCard outcome dropdown + expected signals + GraphOSSurface wiring | 4e35e9b | InlineCaptureCard.tsx, GraphOSSurface.tsx |
| 3 | Wire goal context into capture/process API route | 0b5e28d | route.ts |

## What Was Built

**Task 1 (Pre-completed):** Extended `LlmExtraction` type with optional `goal_relevance` and `expected_signals` fields. Added `GoalContext` interface and updated `buildExtractionPrompt` to append active goal spaces and trigger outcomes when provided. Updated `runExtraction` to accept optional `GoalContext`.

**Task 2:** Added `triggerOutcomes: readonly Node[]` prop to `InlineCaptureCard`. For hunch/intervention/signal node types, the card now shows:
- An "Which outcome does this target?" dropdown populated from `triggerOutcomes`
- Empty state: "No trigger outcomes yet — create one first."
- A "What signal would tell you this is working?" text input
On save, creates a `targets_outcome` edge (hunch/intervention) or `indicates_progress` edge (signal) if an outcome is selected. Includes `content.expected_signals` in the capture POST body when text is provided. `GraphOSSurface` now passes `triggerOutcomes={triggerOutcomes}` to `InlineCaptureCard`.

**Task 3:** The capture/process route now fetches goal spaces and trigger outcomes in parallel with the node fetch. Builds a `GoalContext` and passes it to `runExtraction`. When both arrays are empty, `buildExtractionPrompt` skips the goal section (backward compatible).

## Verification

- `npx vitest run src/components/graph/__tests__/InlineCaptureCard.test.tsx` — 66 tests, all pass
- `npx tsc --noEmit` — no errors in production code
- All 10 new Task 2 tests pass covering: outcome dropdown visibility, edge type routing, expected signals field, empty state, no-edge when no outcome selected
- Pre-existing failures in other agent worktrees (agent-a1c14d0b ReviewPage tests) are out of scope and unrelated to this plan

## Deviations from Plan

None - plan executed exactly as written.

The worktree required merging v0.4 branch to get Task 1 commits before proceeding. This was a setup action, not a deviation.

## Self-Check

- [x] `src/components/graph/InlineCaptureCard.tsx` — exists, has triggerOutcomes prop and OUTCOME_NODE_TYPES
- [x] `src/components/graph/GraphOSSurface.tsx` — passes triggerOutcomes={triggerOutcomes}
- [x] `src/app/api/capture/process/route.ts` — imports GoalContext, fetches goal data, passes to runExtraction
- [x] Commit 4e35e9b exists — Task 2
- [x] Commit 0b5e28d exists — Task 3
