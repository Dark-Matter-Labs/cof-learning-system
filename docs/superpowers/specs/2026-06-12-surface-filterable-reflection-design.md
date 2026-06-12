# Surface filterable reflection (Phase 2, piece A)

**Date:** 2026-06-12
**Status:** Approved

## Problem

The team's highest-value reflection feature — filterable LLM synthesis
("What's the status of Madrid?") — is buried in the middle of the `/review`
(Health) page as `ReflectionSection`. Meanwhile the nav's `/reflect` page is a
structured session ritual (convergence sparklines + guided-question textareas +
decisions log) whose textareas are the "homework" the primary user pushed back
on. The killer feature is behind the wrong door.

## Goal

Make `/reflect` the filterable reflection tool, and make `/review` (Health) a
focused review surface.

## Changes

### `/reflect` — becomes the filterable reflection tool

- `src/app/reflect/page.tsx` (server): fetch the scope filter lists — `sites`,
  `options`, `goalSpaces` — using the same queries currently in
  `src/app/review/page.tsx`. Pass them to the client. Drop the `lastSession`
  fetch.
- `src/app/reflect/ReflectClient.tsx`: rewritten to the filterable reflection
  UI — a scope `<select>` (Whole system / Sites / Options / Goal spaces) and a
  "Run reflection" button → `POST /api/reflect/analyse` → synthesis rendered via
  `Markdown` (upgrade from the old plain `whitespace-pre-wrap`). States:
  idle / loading / done / error, plus Re-run. This absorbs the logic from
  `components/review/ReflectionSection.tsx`.
- Retired from `/reflect`: Trajectory sparklines, guided-question textareas,
  Decisions log, session save. Remove `src/app/reflect/questions.ts`; trim
  `src/app/reflect/types.ts` to only what the new client needs (drop
  `DecisionEntry`, `ReflectionSession`, `ReflectionSessionPayload`,
  `GoalSpaceInfo` if unused). Stop importing `ConvergenceSparkline`,
  `FeedbackWidget`, `Spinner` here if unused.

### `/review` (Health) — review-only

- `src/app/review/page.tsx`: remove the `sites` / `options` / `goalSpaces`
  queries and the props passed for them.
- `src/app/review/SystemHealthClient.tsx`: remove `<ReflectionSection>` and its
  three props. Health = flagged-for-review + tension alerts + awaiting-review.

### Component

- Delete `src/components/review/ReflectionSection.tsx` — logic absorbed into
  `ReflectClient`; Health was its only other consumer.

## Untouched (deliberately)

- `POST /api/reflect/analyse` — the synthesis engine, unchanged.
- `POST /api/reflect/session` + the `reflection_sessions` table — the session
  endpoint loses its UI caller but stays (the table still backs
  `reflection/run`'s 24h rate-limit check and future scheduled reflection).
- `ConvergenceSparkline`, `FeedbackWidget` — kept; used elsewhere
  (dashboard / commitments). Convergence trajectory still surfaces there, so the
  Trajectory view being dropped from `/reflect` loses no data.
- Nav — still shows both Health and Reflect; consolidation is Phase 2 piece C.

## Out of scope

- Wiring a feedback/correction loop on the synthesis (`/api/reflect/analyse`
  returns no persisted id to attach `FeedbackWidget` to).

## Testing

- Rewrite `src/app/reflect/__tests__/ReflectClient.test.tsx`: scope select
  change updates state; "Run reflection" calls `/api/reflect/analyse` with the
  right body and renders the returned synthesis; error state renders on failure.
- Update `src/app/review/__tests__/ReviewPage.test.tsx`: drop any assertions on
  the reflection section; keep flagged / tensions / awaiting-review assertions.
- tsc 0, lint 0, full suite green.
