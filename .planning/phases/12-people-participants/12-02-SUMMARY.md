---
phase: 12-people-participants
plan: 02
subsystem: extraction-agent
tags: [extraction, person-detection, mentioned_in, review-card]
dependency_graph:
  requires: [12-01]
  provides: [person-mention-detection, mentioned_in-edges]
  affects: [src/lib/agents/extraction.ts, src/app/api/capture/process/route.ts, src/components/review/ConnectionSuggestion.tsx]
tech_stack:
  added: []
  patterns: [goal-context-extension, person-node-matching]
key_files:
  created: []
  modified:
    - src/lib/agents/extraction.ts
    - src/app/api/capture/process/route.ts
    - src/components/review/ConnectionSuggestion.tsx
    - src/app/capture/[id]/review/page.tsx
    - src/lib/agents/__tests__/extraction.test.ts
decisions:
  - "personNodes status filter uses promoted/human_reviewed matching the promote handler's allNodes query scope — person nodes follow the same promotion pipeline as other nodes"
  - "formatEdgeType helper added to ConnectionSuggestion renders mentioned_in as Mentioned in — display formatting decoupled from edge type value"
  - "PERSON_DETECTION added as rule 13 in SYSTEM_PROMPT — contractual directive testable in unit tests consistent with existing rule pattern"
metrics:
  duration: 8min
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_changed: 5
---

# Phase 12 Plan 02: Person Mention Detection in Extraction Agent Summary

**One-liner:** Person detection in extraction agent via personNodes GoalContext field and PERSON_DETECTION system prompt rule, surfacing mentioned_in suggested connections through the existing ReviewCard pipeline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add person context to extraction agent prompt | a3e9ff8 | extraction.ts, process/route.ts, extraction.test.ts |
| 2 | Ensure ReviewCard and promote handler support mentioned_in edges | 501dc75 | ConnectionSuggestion.tsx, review/page.tsx |

## What Was Built

**Task 1 — Extraction agent person context:**
- Added `personNodes` field to `GoalContext` interface
- Added rule 13 (`PERSON_DETECTION`) to `SYSTEM_PROMPT` instructing the LLM to detect persons from the known list and suggest `mentioned_in` connections
- Updated `buildExtractionPrompt` to append a "Known persons in the system" section when `personNodes.length > 0`, with instructions to suggest `mentioned_in` edges matching exact names
- Updated `buildExtractionPrompt` early-return logic to also check `hasPersonNodes` before skipping context sections
- Updated `process/route.ts` parallel Promise.all to add a 4th query fetching `node_type=person` nodes with `status IN (promoted, human_reviewed)`, passed as `personNodes` in `goalContext`

**Task 2 — ReviewCard and promote handler:**
- Verified the existing `ConnectionSuggestion` and `ReviewCard` components handle arbitrary edge types generically — `mentioned_in` flows through without structural changes
- Added `formatEdgeType` helper to `ConnectionSuggestion.tsx` that replaces underscores with spaces and capitalises the first letter — `mentioned_in` displays as "Mentioned in"
- Added a comment in the promote handler documenting that `mentioned_in` edges resolve through the same `findBestMatch` pipeline as other suggested connections
- Verified `findBestMatch` queries `status IN (promoted, human_reviewed)` — person nodes in the system are promoted and thus included in the candidate set

## Checker Warning Resolution

The checker flagged: verify `findBestMatch` includes person nodes in its search scope (check the status filter).

Analysis: Person nodes go through the same capture → review → promote pipeline. After promotion, their status is `'promoted'`. The `allNodes` query in the promote handler uses `.in('status', ['promoted', 'human_reviewed'])` which correctly includes promoted person nodes. No widening needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed extraction test fixtures missing personNodes field**
- **Found during:** Task 1 TypeScript verification
- **Issue:** Three test cases in `extraction.test.ts` passed `goalContext` objects without the new required `personNodes` field, causing TS2345 errors
- **Fix:** Added `personNodes: []` to all existing test fixtures; added a new test verifying the persons section is included in the prompt when `personNodes` is present
- **Files modified:** src/lib/agents/__tests__/extraction.test.ts
- **Commit:** a3e9ff8

## Self-Check: PASSED

Files exist:
- src/lib/agents/extraction.ts — FOUND
- src/app/api/capture/process/route.ts — FOUND
- src/components/review/ConnectionSuggestion.tsx — FOUND
- src/app/capture/[id]/review/page.tsx — FOUND

Commits exist:
- a3e9ff8 — FOUND
- 501dc75 — FOUND
