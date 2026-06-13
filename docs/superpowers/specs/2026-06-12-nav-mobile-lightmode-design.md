# Nav consolidation + mobile nav + light-mode sweep (Phase 2, piece C)

**Date:** 2026-06-12
**Status:** Approved

## Problem

- The nav is 10 flat links in a non-responsive `flex` row — it overflows on
  mobile (no wrap/hamburger), and "Dashboard" duplicates the xCO logo (both →
  `/`).
- ~14 hardcoded dark-only classes (`bg-gray-900/800`, `text-gray-200/300`,
  `border-gray-700/800`) in the capture surfaces render dark-on-light and look
  broken in light mode, while the rest of the app uses theme-aware `cof-*`
  tokens / `dark:` pairs.

## Part 1 — Nav consolidation (`src/components/layout/NavBar.tsx`)

- **Primary row (desktop):** Capture · Review · Graph · Ask · Reflect ·
  Commitments. Rename the `/query` label "Query" → "Ask" (route unchanged).
- **"More ▾" popover (desktop):** Portfolios · Intelligence (`/newsletter`) ·
  Dashboard (`/`). A button toggling an absolutely-positioned list; closes on
  outside click / item click / Escape.
- **Settings** → a gear icon button (links `/settings`) beside the review-count
  badge and avatar. Drop the "Dashboard" text item from the primary row.
- Keep the live "N to review" badge → `/review` and the avatar/sign-out.
- Active-state: a primary link is active via `pathname.startsWith`; the "More"
  button shows active when any secondary route matches.

## Part 2 — Mobile nav

- Below `sm` (`< 640px`): hide the desktop link row + More popover; show the
  logo, the review-count badge, and a hamburger button. The hamburger toggles a
  dropdown drawer listing **all** links (primary + secondary, flat) plus
  Settings and Sign out. Closes on item click / Escape.
- Desktop (`sm+`) unchanged. Implement with Tailwind responsive classes
  (`hidden sm:flex` / `sm:hidden`) — no JS breakpoint logic.

## Part 3 — Light-mode token sweep

Replace hardcoded dark-only classes in the capture surfaces with theme-aware
`cof-*` tokens:
- `bg-gray-900` → `bg-cof-bg-elevated`; `bg-gray-800` → `bg-cof-bg-subtle`
- `border-gray-700` / `border-gray-800` → `border-cof-border`
- `text-gray-200` → `text-cof-text-primary`; `text-gray-300` →
  `text-cof-text-secondary`; `text-gray-500/600` → `text-cof-text-tertiary`
  where they were dark-only
Files: `src/app/capture/[id]/page.tsx`, `src/app/capture/[id]/review/page.tsx`
(skeletons), `src/components/capture/InterventionForm.tsx`,
`src/components/capture/HunchCard.tsx`. Verify by re-grepping those surfaces for
remaining dark-only `bg-gray-(8|9)00` with no `dark:` pairing.

## Out of scope

- Merging the Query and Reflect *features* (nav only relabels Query → Ask).
- A full app-wide light-mode audit beyond the capture surfaces named above.

## Testing

- Rewrite `src/components/layout/__tests__/NavBar.test.tsx` for the new
  structure (primary links present; More popover toggles and reveals secondary
  links; mobile hamburger toggles the drawer; review badge shows when count > 0)
  and **remove it from the `vitest.config.ts` QUARANTINE list** (it was a
  pre-existing failing suite; this rewrite re-enables it).
- tsc 0, lint 0, full suite green.
