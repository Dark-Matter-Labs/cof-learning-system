# Optional capture titles (Phase 2, piece D)

**Date:** 2026-06-12
**Status:** Approved

## Problem

Capturing a thought or pasting a transcript requires typing a title, even
though the LLM extraction already produces a better one. The backend already
backfills an empty title (`node.title === '' ? extraction.title`) for the
single-node and document paths — only the capture form's submit gate and the
API's title-required check block it, and the meeting/call path doesn't backfill.

## Changes

### Frontend — `src/components/capture/QuickCaptureForm.tsx`

- Submit gate (non-file modes): enable when there is a title **or** a
  description, instead of requiring a title:
  `(title.trim() || description.trim()) && !isBusy`. File mode unchanged.
- Relabel "Title" → "Title (optional)"; placeholder hint such as
  "Leave blank — the AI will name it from your notes".

### Backend — `src/app/api/capture/route.ts`

- Relax the title-required check (currently rejects empty title when there's no
  attachment): reject only when there is no attachment **and** no title **and**
  no description — i.e. an entirely-empty capture. Message → "Add a title or
  some content".

### Backend — `src/app/api/capture/process/route.ts` (meeting branch)

- When the parent node has an empty title, backfill it from
  `meetingExtraction.meeting_title` (mirrors the single-node and document
  branches, which already backfill). Spread a `titleUpdate` into the parent
  node update.

## Out of scope

- Changing how single-node / document titles are backfilled (already correct).

## Testing

- `QuickCaptureForm` test: submit is enabled when a description is present and
  the title is empty; disabled when both title and description are empty.
- `capture/route` validation test (if present): empty title + non-empty
  description is accepted; entirely-empty capture is rejected.
- tsc 0, lint 0, full suite green.
