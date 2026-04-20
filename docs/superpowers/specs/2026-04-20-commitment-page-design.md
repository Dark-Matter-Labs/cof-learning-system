# Commitment Page & Graph Node Shape — Design Spec

**Date:** 2026-04-20
**Branch:** feature/cof-v06-pipeline
**Priority:** v0.6 step 8 (after filterable reflection)

---

## Overview

The `CommitmentPanel` sidebar on the graph canvas crowds the view. Replace it with:
1. Commitment nodes rendered as distinct squares on the graph (visually separate from all other node cards)
2. Click on a commitment node → navigate to `/commitments` page
3. A dedicated `/commitments` page with the full hierarchy previously in the panel
4. A "Commitments" nav link

---

## Architecture

Three independent changes:

- **Graph shape** — commitment nodes render as compact squares in the D3 SVG canvas, distinct from all other node types which remain as 200×80 rounded cards.
- **Panel removal** — `CommitmentPanel` is deleted. `GraphOSSurface` loses all commitment-related state/handlers. Canvas gets full width.
- **Commitments page** — server-fetched, full hierarchy, scroll-to-commitment via `?id=X`.

---

## Graph Node Shape

### Constants

Add to `src/lib/graph/layout.ts`:

```ts
export const COMMIT_SIZE = 80;
```

### GraphCanvas rendering

`GraphCanvas` gains one new optional prop:
```tsx
onSelectCommitment?: (id: string) => void;
```

D3 click handler branches on `node_type`:
```js
.on('click', (ev, d) => {
  ev.stopPropagation();
  if (d.data.node_type === 'commitment' && onSelectCommitment) {
    onSelectCommitment(d.data.id);
  } else {
    onSelectNode(d.data);
  }
})
```

Rendering is split by node type. Non-commitment nodes render exactly as today. Commitment nodes:
- Backing rect: `width: COMMIT_SIZE, height: COMMIT_SIZE, rx: 0, fill: d.color` (blue `#185FA5`)
- No left-strip, no type label, no confidence dots
- Title text: white, font-size 10, centred at `(COMMIT_SIZE/2, COMMIT_SIZE/2 - 6)`, truncated to 14 chars, text-anchor middle
- Status dot (from `content.status`): small circle at bottom centre, colour matches status

Transform uses `COMMIT_SIZE/2` offset:
```js
// commitment nodes:
`translate(${(d.x ?? 0) - COMMIT_SIZE / 2}, ${(d.y ?? 0) - COMMIT_SIZE / 2})`
// all other nodes (unchanged):
`translate(${(d.x ?? 0) - CARD_WIDTH / 2}, ${(d.y ?? 0) - CARD_HEIGHT / 2})`
```

This transform must be applied in all three positioning paths: `applyStaticPositions`, force `tick`, and the initial static position call.

---

## GraphOSSurface Changes

**Remove:**
- `CommitmentPanel` import and render
- `selectedCommitmentId` state
- `handleSelectCommitment` callback
- `handleSelectTension` callback
- `handleAssumptionClick` callback
- `handleAcknowledgeTension` callback
- `handleResolveTension` callback
- `getCommitmentConnectedNodes` helper
- `getTensionChain` helper
- `getAssumptionTree` helper
- `tensions` state and its realtime channel (tension alerts now shown on `/review` only)
- `highlight` state (only ever set by commitment/tension/assumption handlers — all removed)
- `HighlightState` import and `highlight` prop passed to `GraphCanvas`

**Add:**
- `useRouter` from `next/navigation`
- `onSelectCommitment` passed to `GraphCanvas`:
```tsx
onSelectCommitment={(id) => router.push(`/commitments?id=${id}`)}
```

**Keep:** everything else unchanged — node selection, capture card, process flow, goal space panel.

---

## /commitments Page

### Server component — `src/app/commitments/page.tsx`

Auth guard → redirect to `/login` if not authenticated.

Parallel fetches:
```
nodes WHERE node_type = 'commitment'
nodes WHERE node_type = 'goal_space'
nodes WHERE node_type = 'trigger_outcome'
nodes (all — for linked assumption lookups)
edges (all)
tension_alerts WHERE status = 'active'
```

Reads `searchParams.id` and passes as `highlightId` to `CommitmentsClient`.

### Client component — `src/app/commitments/CommitmentsClient.tsx`

Props:
```tsx
interface CommitmentsClientProps {
  readonly goalSpaces: readonly Node[];
  readonly triggerOutcomes: readonly Node[];
  readonly commitments: readonly Node[];
  readonly allNodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly tensions: readonly TensionAlert[];
  readonly highlightId?: string;
}
```

On mount: if `highlightId` is set, `document.getElementById(highlightId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })`.

Renders the same goal-space hierarchy as the old `CommitmentPanel` (minus collapse toggle, minus graph-interaction callbacks):
- Reuses `CommitmentCard`, `GoalSpaceSection`, `TensionAlertItem` components unchanged
- Each `CommitmentCard` wrapper div gets `id={commitment.id}`
- Highlighted commitment (matching `highlightId`) gets a visible ring: `ring-2 ring-[#185FA5]`
- Empty state: "No commitments yet."

The `onSelect` and `onAssumptionClick` props passed to `CommitmentCard`/`GoalSpaceSection` are `() => {}` — this is a read view, graph highlighting doesn't apply here.

---

## NavBar

Add `{ href: '/commitments', label: 'Commitments' }` between Capture and Review in the `links` array in `NavBar.tsx`.

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/graph/layout.ts` | Add `COMMIT_SIZE = 80` |
| `src/components/graph/GraphCanvas.tsx` | Branch D3 rendering for commitment nodes, new `onSelectCommitment` prop |
| `src/components/graph/GraphOSSurface.tsx` | Remove `CommitmentPanel` + all commitment/tension state and handlers |
| `src/app/commitments/page.tsx` | New server page |
| `src/app/commitments/CommitmentsClient.tsx` | New client component |
| `src/components/layout/NavBar.tsx` | Add Commitments nav link |
| `src/components/commitment/CommitmentPanel.tsx` | Delete |

---

## Error Handling

- `/commitments` fetch errors: show inline "Failed to load commitments" message, no redirect
- `highlightId` not found in DOM (node doesn't exist): `scrollIntoView` silently no-ops — acceptable
- Empty graph (no commitments): commitment nodes simply absent from canvas — no change needed

---

## Testing

- Unit: `CommitmentsClient` renders goal space section when goal spaces exist
- Unit: `CommitmentsClient` scrolls to `highlightId` on mount
- Unit: `GraphCanvas` renders commitment node as square (COMMIT_SIZE × COMMIT_SIZE rect, rx=0) rather than standard card
- Integration: GET `/commitments` returns 200 and contains page content
