---
phase: 08-layout-theme
plan: 04
subsystem: ui
tags: [tailwind, dark-mode, theming, react]

# Dependency graph
requires:
  - phase: 08-01
    provides: Tailwind dark mode config and color mapping table established

provides:
  - review/page.tsx with full light+dark mode support on all list cards and tension alerts
  - settings/page.tsx with full light+dark mode support on all type rows and agent config card
  - capture/page.tsx headings with dark: text variants
  - ReflectClient.tsx trajectory cards, textareas, decision items, and buttons with dark: variants
  - ReviewCard.tsx action divider border with dark: variant
  - InlineCaptureCard.tsx card root, all inputs, all selects, goal space containers with dark: variants

affects:
  - Any phase adding new UI to these pages or components should follow the established dark: variant pairing convention

# Tech tracking
tech-stack:
  added: []
  patterns:
    - All gray backgrounds pair light + dark: e.g. bg-gray-50 dark:bg-gray-900
    - Semantic colors (teal, amber, red, green, node-type colors) excluded from dark: pairing
    - Brand/hardcoded hex colors ([#085041], [#185FA5], [#D4537E]) excluded from dark: pairing

key-files:
  created: []
  modified:
    - src/app/review/page.tsx
    - src/app/settings/page.tsx
    - src/app/capture/page.tsx
    - src/app/reflect/ReflectClient.tsx
    - src/components/review/ReviewCard.tsx
    - src/components/graph/InlineCaptureCard.tsx

key-decisions:
  - "Undirected hunches card uses amber border (semantic) — bg updated to light+dark but amber border left as-is"
  - "text-gray-500 in section subheaders left unchanged (same value in both modes per color mapping table)"

patterns-established:
  - "bg-gray-50 dark:bg-gray-900 as standard card background pair"
  - "bg-gray-100 dark:bg-gray-800 as secondary card background pair"
  - "border-gray-200 dark:border-gray-800 as standard card border pair"

requirements-completed:
  - LAYOUT-02

# Metrics
duration: 10min
completed: 2026-03-31
---

# Phase 08 Plan 04: Dark Mode Gap Closure — Remaining Pages and Components Summary

**Tailwind dark: variants applied to all six remaining files (review, settings, capture pages; ReflectClient, ReviewCard, InlineCaptureCard), closing LAYOUT-02 with zero unadorned dark-only gray classes remaining**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-31T12:57:00Z
- **Completed:** 2026-03-31T13:07:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- All list-card backgrounds and text in review/page.tsx now use light+dark pairs — no more invisible-in-light-mode cards
- Settings type rows and agent config card fully readable in both modes
- Capture page headings adapt to light/dark theme
- ReflectClient window buttons, trajectory cards, textareas, decision list, and add-decision button adapted to both modes
- ReviewCard action divider border and connection section text adapted
- InlineCaptureCard card root, title input, node type select, goal space containers, selects, and expected signals input all adapted

## Task Commits

1. **Task 1: Add dark: variants to review/page.tsx, settings/page.tsx, and capture/page.tsx** - `af8b67e` (feat)
2. **Task 2: Add dark: variants to ReflectClient.tsx, ReviewCard.tsx, and InlineCaptureCard.tsx** - `a4ca9ad` (feat)

## Files Created/Modified

- `src/app/review/page.tsx` - All list cards, SEVERITY_COLORS border-gray-800 entry, tension alert container updated with dark: pairs
- `src/app/settings/page.tsx` - h1, section h2 headers, type-row cards (node and edge), agent config card updated
- `src/app/capture/page.tsx` - h1 and h2 subheader updated with dark: text variants
- `src/app/reflect/ReflectClient.tsx` - Window buttons, trajectory cards, section h2 headings, textareas, decision list items, decision input, add button updated
- `src/components/review/ReviewCard.tsx` - Suggested Connections label, no-connections text, action divider border updated
- `src/components/graph/InlineCaptureCard.tsx` - Card root, title input, node type select, goal space containers, both selects, expected signals input, cancel button hover updated

## Decisions Made

- Undirected hunches link card uses `border-amber-900/30` — semantic alert color, left unchanged per plan exceptions; only the `bg-gray-900` background was updated to the light+dark pair
- `text-gray-500` section subheaders in review page left as-is per the color mapping table (same value in both modes)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LAYOUT-02 is fully satisfied: all six files updated, no unadorned dark-only gray classes remain in the app
- Phase 08 gap closure is complete — all identified hardcoded dark-only colors have been replaced with light+dark pairs across the entire application

---
*Phase: 08-layout-theme*
*Completed: 2026-03-31*
