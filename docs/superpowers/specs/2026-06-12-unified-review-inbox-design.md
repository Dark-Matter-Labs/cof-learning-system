# Unified review inbox + confidence gate on extracted children (Phase 2, piece B)

**Date:** 2026-06-12
**Status:** Approved

## Problem

Review is fragmented and one path bypasses triage:

- `flagged_for_review` nodes (single captures the maturity gate wasn't sure
  about) get one-tap Accept / Edit / Archive via `FlaggedItem` on `/review`.
- Document/meeting extraction forces **every** child to `llm_reviewed`,
  bypassing the maturity gate single captures get. Those children are only
  reachable through a separate per-child page, and non-knowledge children
  don't appear in the review queue at all.

## Goal

One review queue with a single interaction model, and extracted children
triaged like single captures (auto-promote the confident ones, flag the rest).

## Part 1 — Confidence gate on extracted children (backend)

- New pure helper `src/lib/agents/childTriage.ts`:
  `childReviewStatus(confidenceLevel: number): 'promoted' | 'flagged_for_review'`
  → `promoted` when `confidenceLevel >= CHILD_AUTO_PROMOTE_CONFIDENCE` (4),
  else `flagged_for_review`. Threshold exported as a named constant.
- `src/app/api/capture/process/route.ts`: in both the meeting and document
  child-insert blocks, replace `status: 'llm_reviewed' as const` with
  `status: childReviewStatus(extracted.confidence_level)`.
- The parent source node (transcript/document) is unchanged (stays
  `llm_reviewed` — it is the source container, not a knowledge node).
- Effect: confident children auto-promote; the rest land in the inbox flagged.
  No new `llm_reviewed` children are created.

## Part 2 — Unified inbox (frontend)

- `src/app/review/page.tsx`: fetch `flagged_for_review` (all types), legacy
  `llm_reviewed` knowledge nodes, and active tensions. Build one queue array of
  `{ node, kind }` where `kind` is `'flagged' | 'awaiting'`. Also collect the
  distinct `parent_node_id`s across the queue and fetch their `{ id, title }`
  so extracted children can show a "from <source>" tag; pass a
  `sourceTitles: Record<string,string>` map. Heading → "Review".
- Rename `src/components/review/FlaggedItem.tsx` →
  `src/components/review/ReviewItem.tsx`, generalised to take
  `{ node, kind, sourceTitle?, onAccept, onArchive }`. Reason tag:
  - `kind === 'awaiting'` → "Awaiting sign-off"
  - `kind === 'flagged'` with `llm_extraction.maturity` → existing
    `FLAG_REASON_LABELS[maturity]`
  - `kind === 'flagged'` child (has `parent_node_id`, no maturity) →
    "Low extraction confidence"
  - otherwise → "Flagged by LLM"
  Source tag rendered when `parent_node_id` is set (uses `sourceTitle` if
  available, else "Extracted"). Actions unchanged: Accept (PATCH→promoted),
  Edit & promote (→ `/capture/[id]/review`), Archive (PATCH→archived) — all
  already supported by `PATCH /api/nodes/[id]`.
- `src/app/review/SystemHealthClient.tsx`: render the single merged queue
  (using `ReviewItem`) followed by the tension-alerts strip. Remove the old
  separate "Awaiting review" (Review-link-only) section — it folds into the
  queue. Keep the existing `handleAccept` / `handleArchive` (optimistic remove
  on success).
- `src/components/layout/NavBar.tsx`: rename the `/review` label
  "Health" → "Review". (Nav *consolidation* remains piece C.) The live count
  logic is unchanged (flagged + llm_reviewed knowledge).

## Untouched (deliberately)

- Graph visibility of in-progress nodes (`GraphOSSurface` renders all
  non-raw/archived nodes) — a separate concern, not part of this piece.
- `PATCH /api/nodes/[id]` — already supports promoted/archived.

## Testing

- `childTriage` unit test: 5/4 → promoted, 3/1 → flagged, boundary at 4.
- Rename `FlaggedItem.test.tsx` → `ReviewItem.test.tsx`; cover both kinds, the
  reason tags, the source tag, and the three action callbacks.
- Update `ReviewPage.test.tsx` for the merged queue (flagged + awaiting in one
  list; tensions below).
- tsc 0, lint 0, full suite green.
