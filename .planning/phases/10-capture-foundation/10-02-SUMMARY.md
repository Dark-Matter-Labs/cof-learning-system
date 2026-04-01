---
plan: 10-02
phase: 10
status: complete
completed: 2026-04-01
subsystem: capture
tags: [meeting-notes, multi-node-extraction, llm, review-flow]
requires: [10-01]
provides: [meeting-notes-capture, multi-node-extraction-agent]
affects: [capture-page, process-route, review-page]
tech_stack_added: []
tech_stack_patterns: [multi-node-extraction, parent-child-nodes, conditional-form-fields]
key_files_created: []
key_files_modified:
  - src/lib/types/nodes.ts
  - src/lib/agents/extraction.ts
  - src/components/capture/QuickCaptureForm.tsx
  - src/app/capture/page.tsx
  - src/app/api/capture/process/route.ts
  - src/app/capture/[id]/review/page.tsx
decisions:
  - "getCaptureType cast uses Parameters<typeof getCaptureType>[0] to avoid widening to string — keeps type safety without duplicating the union"
  - "Meeting child node llm_extraction mirrors LlmExtraction shape for ReviewCard compatibility — child nodes flow through existing ReviewCard review path unchanged"
  - "Review page shows child list only when node_type=meeting_notes AND childNodes.length>0 — gracefully handles meeting nodes still processing (falls through to standard ReviewCard)"
metrics:
  duration: 12min
  tasks: 2
  files: 6
---

# Phase 10 Plan 02: Meeting Notes Multi-Node Extraction Summary

## One-liner

Meeting transcript capture type with LLM multi-node extraction: transcripts produce parent node + multiple child nodes (insights, actions, decisions) reviewable individually via existing ReviewCard.

## What Was Built

### Task 1: Meeting form fields + multi-node extraction types and agent

**src/lib/types/nodes.ts:**
- Added `MeetingExtractedNode` interface: `node_type`, `title`, `summary`, `category` (insight/action/decision/person_mention/open_question), `confidence_level`, `domain_tags`, `rationale`
- Added `MeetingExtraction` interface: `meeting_title`, `meeting_summary`, `extracted_nodes`, `participants_detected`, `key_themes`

**src/lib/agents/extraction.ts:**
- Added `MEETING_SYSTEM_PROMPT` constant with COF-specific extraction rules and JSON schema
- Added `buildMeetingExtractionPrompt` — assembles meeting context with date, participants, goal context
- Added `parseMeetingExtractionResponse` — validates required fields and non-empty extracted_nodes array
- Added `runMeetingExtraction` — calls LLM with 4096 max tokens and 0.3 temperature

**src/components/capture/QuickCaptureForm.tsx:**
- Extended `CaptureFormData` with optional `meeting_date` and `participants` fields
- Added `meetingDate` and `participants` state variables
- Added conditional `meeting_date` date input (shown when config fields include `meeting_date`)
- Added conditional `participants` text input (shown when config fields include `participants`)
- Description textarea gets meeting-specific placeholder and 8 rows when `meeting_notes` selected
- `handleSubmit` includes meeting fields conditionally in submitted data

**src/app/capture/page.tsx:**
- Updated `handleSubmit` to build `content` JSONB object with `meeting_date` and `participants` array before POST

### Task 2: Multi-node extraction in process route + child node creation

**src/app/api/capture/process/route.ts:**
- Added imports: `getCaptureType`, `runMeetingExtraction`, `MeetingExtraction`
- Node fetch now selects `node_type` and `content` in addition to title and description
- Branch on `captureConfig?.multiNodeExtraction`:
  - **True path (meeting notes):** calls `runMeetingExtraction`, stores `MeetingExtraction` as `llm_extraction` on parent, inserts child nodes with `parent_node_id`, logs with `child_count`
  - **False path (all others):** existing `runExtraction` flow unchanged

**src/app/capture/[id]/review/page.tsx:**
- Added `Link` and `StatusBadge` imports
- Added `childNodes` state
- Fetch now runs 3 parallel queries: node, trigger outcomes, child nodes (by `parent_node_id`)
- Render branch: when `node_type === 'meeting_notes'` and `childNodes.length > 0`, show meeting summary + child node list with links to individual review pages; otherwise show existing ReviewCard

## Decisions Made

- `getCaptureType` cast uses `Parameters<typeof getCaptureType>[0]` — avoids duplicating the CaptureTypeId union while keeping type safety at the call site
- Child node `llm_extraction` mirrors `LlmExtraction` shape — ensures child nodes work with existing ReviewCard without modification
- Review page shows child list only when both conditions met (meeting_notes type AND children exist) — gracefully handles the still-processing state

## Requirements Covered

- CAPT-07: Selecting "Meeting Notes / Transcript" shows title, date, and participants fields ✓
- CAPT-08: Submitting a meeting transcript proposes multiple nodes as separate review cards ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type cast for llm_extraction in review page**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `node.llm_extraction as Record<string, unknown>` failed — `LlmExtraction` and `Record<string, unknown>` don't overlap sufficiently for direct cast
- **Fix:** Used `node.llm_extraction as unknown as Record<string, unknown>` intermediate cast
- **Files modified:** `src/app/capture/[id]/review/page.tsx`
- **Commit:** 8dc06b2

## Self-Check: PASSED

- `src/lib/types/nodes.ts` — MeetingExtractedNode and MeetingExtraction present ✓
- `src/lib/agents/extraction.ts` — runMeetingExtraction, parseMeetingExtractionResponse, buildMeetingExtractionPrompt, MEETING_SYSTEM_PROMPT present ✓
- `src/components/capture/QuickCaptureForm.tsx` — meeting-date and participants inputs present ✓
- `src/app/api/capture/process/route.ts` — getCaptureType, runMeetingExtraction, multiNodeExtraction, parent_node_id present ✓
- `src/app/capture/[id]/review/page.tsx` — parent_node_id query, meeting_notes conditional, Extracted Nodes heading present ✓
- Commits: 00e6bb0 (Task 1), 8dc06b2 (Task 2) ✓
- TypeScript: 0 non-test errors ✓
