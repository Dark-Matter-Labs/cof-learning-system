# Phase 5: Trajectory Indicators — Research

**Researched:** 2026-03-30
**Domain:** React UI components, inline SVG sparklines, Supabase data fetching, trajectory badge with expandable breakdown
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-04 | Trajectory indicator badge shows converging (+) / neutral / drifting (-) with numeric score | TrajectoryBadge component stub exists in GoalSpaceSection (status="pending"); Phase 5 wires it to live snapshot data and exposes score |
| CONV-05 | Clicking trajectory badge expands to show positive and negative factor breakdown | factor_breakdown JSONB from convergence_snapshots contains full per-outcome, per-factor details; expand/collapse is local state on click |
| CONV-06 | Trajectory sparkline renders 30-day convergence history as inline SVG (200x40, teal/coral fill) | SVG path computation from score-over-time array; D3 is already in dependencies and can compute paths, or hand-rolled polyline is sufficient at this scale |
</phase_requirements>

---

## Summary

Phase 5 is a pure UI phase. The backend (convergence scoring function, snapshot API, threshold trigger) was completed in Phase 4. Phase 5 reads from `convergence_snapshots` and displays the results in two places: the GoalSpacePanel (graph view) and the GoalSpaceSection header in CommitmentPanel. Three concrete deliverables are required.

First, the `TrajectoryBadge` component in `src/components/commitment/TrajectoryBadge.tsx` must be updated to accept and display a live score, and clicking it must expand an inline factor breakdown panel listing positive and negative contributors. The existing stub handles `status="pending"` with a tooltip placeholder — Phase 5 replaces this with data-driven behavior.

Second, a `ConvergenceSparkline` component must be created that renders an inline SVG (200x40 px) showing convergence score over the last 30 days. The fill is teal when the score trend is positive and coral when negative. D3 is already installed (`d3: ^7.9.0`) and can scale/path the time series, or a minimal hand-rolled implementation using SVG `<path>` elements is viable for this fixed-dimension sparkline.

Third, both the GoalSpacePanel and GoalSpaceSection must fetch snapshot data from Supabase (latest snapshot for the badge+breakdown, last-30-days snapshots for the sparkline) and pass it down to the components. The query shapes are already defined in the Phase 4 research and schema.

**Primary recommendation:** Add a GET endpoint at `/api/convergence/snapshots` that returns both the latest snapshot and the 30-day history for a given `goal_space_id`. Components call this on mount. Use D3 `scaleLinear` + `line` for the sparkline path to avoid manual math.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component model, useState for expand/collapse, useEffect for data fetching | Already in project |
| Tailwind CSS | ^4 | Styling for badge, breakdown panel | Already in project |
| Supabase JS | ^2.99.3 | Fetching convergence_snapshots rows | Already in project; same client pattern as all other components |
| D3 | ^7.9.0 | scaleLinear + line for sparkline path calculation | Already installed; avoids hand-rolling time-scale math |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | ^16.3.2 | Component unit tests | All new components get vitest + RTL tests |
| vitest | ^4.1.0 | Test runner | Existing test framework |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| D3 for sparkline | Hand-rolled SVG path | D3 is already installed; for a fixed 200x40 sparkline, hand-rolled polyline is also viable (15-20 lines). D3 is preferred for correctness under edge cases (empty array, single point, all-same value) |
| GET /api/convergence/snapshots endpoint | Direct Supabase client in component | App Router convention: API routes decouple data fetching from components and keep Supabase server-only. Keep pattern consistent with all other data fetching in this codebase |

**Installation:** No new packages required. All dependencies are already present.

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── components/
│   ├── commitment/
│   │   ├── TrajectoryBadge.tsx           # UPDATE: live score + click-expand breakdown
│   │   └── GoalSpaceSection.tsx          # UPDATE: fetch + pass snapshot data
│   └── graph/
│       ├── GoalSpacePanel.tsx            # UPDATE: fetch + display badge + sparkline
│       └── convergence/
│           └── ConvergenceSparkline.tsx  # NEW: inline SVG sparkline component
├── app/
│   └── api/
│       └── convergence/
│           └── snapshots/
│               └── route.ts             # NEW: GET endpoint for badge + 30-day history
└── lib/
    └── types/
        └── convergence.ts               # NEW (or extend existing): ConvergenceSnapshot type
```

### Pattern 1: TrajectoryBadge with Expand/Collapse

**What:** The badge button displays label + numeric score. A click toggles a local `expanded` state. When expanded, an absolutely-positioned (or inline) panel renders the factor breakdown from `factor_breakdown.outcome_scores`.

**When to use:** Per the requirements: CONV-04 (badge visible), CONV-05 (click to expand).

**Existing stub behavior:** `TrajectoryBadge` in `src/components/commitment/TrajectoryBadge.tsx` uses `useState(false)` for tooltip on hover. Phase 5 changes this from hover-tooltip to click-expand. The component receives the full `FactorBreakdown` object (already defined in `src/lib/graph/convergence.ts`) and renders outcome-level breakdowns.

**Key design decision:** The badge should be a `<button>` (not a `<span>`) to handle click for accessibility. The existing stub uses `<span>` with `onMouseEnter`/`onMouseLeave` — Phase 5 changes it to `<button>` with `onClick`.

**Updated TrajectoryBadge props:**
```typescript
// Source: derived from FactorBreakdown type in src/lib/graph/convergence.ts
interface TrajectoryBadgeProps {
  readonly status: TrajectoryStatus;   // 'converging' | 'neutral' | 'drifting' | 'pending'
  readonly score?: number;
  readonly factorBreakdown?: FactorBreakdown;  // NEW: from convergence_snapshots.factor_breakdown
}
```

**Score-to-status mapping** (from Phase 4 research, HIGH confidence):
```typescript
// Source: .planning/phases/04-convergence-computation/04-RESEARCH.md
function scoreToStatus(score: number): TrajectoryStatus {
  if (score > 1.0) return 'converging';
  if (score < -1.0) return 'drifting';
  return 'neutral';
}
```

### Pattern 2: ConvergenceSparkline (inline SVG)

**What:** A React component that receives an array of `{ score: number; computed_at: string }` objects and renders an inline `<svg width="200" height="40">` with a filled area path. Teal fill when trending converging, coral fill when trending drifting.

**When to use:** CONV-06 — every goal space in both GoalSpacePanel and GoalSpaceSection.

**Spec from REQUIREMENTS.md:** 200x40 px, teal/coral fill, 30-day window.

**D3 approach:**

```typescript
// Source: D3 documentation pattern — scaleLinear + area
import { scaleLinear, area, line } from 'd3';

const xScale = scaleLinear()
  .domain([0, snapshots.length - 1])
  .range([0, 200]);

const yScale = scaleLinear()
  .domain([-10, 10])  // convergence score range is fixed [-10, 10]
  .range([40, 0]);    // SVG y-axis is inverted

const areaGenerator = area<Snapshot>()
  .x((_, i) => xScale(i))
  .y0(yScale(0))       // baseline at score=0
  .y1(d => yScale(d.score));
```

**Fill color logic:** Compute the average score of the last 30-day window. If `avgScore > 0`, fill with teal (`#14b8a6` or Tailwind's `teal-500`). If `avgScore <= 0`, fill with coral (`#f97316` or Tailwind's `orange-400`). The score at the last data point is the most direct signal — use that rather than average for the fill decision, consistent with how the badge maps score to status.

**Empty state:** When `snapshots.length === 0`, render a placeholder (e.g., a dashed horizontal line at y=50% or a text "No history yet").

**Single-point state:** When `snapshots.length === 1`, render a dot or horizontal line rather than an area.

### Pattern 3: Data Fetching — GET /api/convergence/snapshots

**What:** A new GET route that takes `?goal_space_id=<uuid>` query param and returns both the latest snapshot and the 30-day history.

**Why a new route (not extending the existing POST):** The existing `POST /api/convergence/snapshot` creates snapshots. Reading snapshot history for display needs a GET. Extending POST to GET would violate REST semantics and break the route contract.

**Response shape:**
```typescript
// GET /api/convergence/snapshots?goal_space_id=<uuid>
{
  data: {
    latest: {
      score: number;
      factor_breakdown: FactorBreakdown;
      computed_at: string;
    } | null;
    history: Array<{
      score: number;
      computed_at: string;
    }>;
  }
}
```

**Supabase queries (both covered by existing index `idx_convergence_snapshots_goal_space_computed`):**
```typescript
// Latest snapshot (badge + breakdown)
const { data: latest } = await supabase
  .from('convergence_snapshots')
  .select('score, factor_breakdown, computed_at')
  .eq('goal_space_id', goalSpaceId)
  .order('computed_at', { ascending: false })
  .limit(1)
  .single();

// 30-day history (sparkline)
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const { data: history } = await supabase
  .from('convergence_snapshots')
  .select('score, computed_at')
  .eq('goal_space_id', goalSpaceId)
  .gte('computed_at', thirtyDaysAgo)
  .order('computed_at', { ascending: true });
```

### Pattern 4: Component Data Fetching via useEffect

GoalSpacePanel and GoalSpaceSection are client components (`'use client'`). They fetch snapshot data via `useEffect` on mount, calling `GET /api/convergence/snapshots?goal_space_id=<id>`. This is consistent with how other panels in this codebase fetch data.

```typescript
// Pattern from existing 'use client' components in this codebase
const [convergenceData, setConvergenceData] = useState<ConvergenceData | null>(null);

useEffect(() => {
  fetch(`/api/convergence/snapshots?goal_space_id=${node.id}`)
    .then(res => res.json())
    .then(json => {
      if (json.data) setConvergenceData(json.data);
    })
    .catch(() => {
      // silent fail — badge shows 'pending' when data unavailable
    });
}, [node.id]);
```

**GoalSpacePanel integration:** The panel already receives `node`, `edges`, and `allNodes` as props. It needs to add the `useEffect` fetch and pass `convergenceData.latest` to `TrajectoryBadge` and `convergenceData.history` to `ConvergenceSparkline`.

**GoalSpaceSection integration:** Similarly receives `goalSpace` as a prop. Adds the same `useEffect` pattern. The existing `<TrajectoryBadge status="pending" />` on line 56 becomes `<TrajectoryBadge status={status} score={score} factorBreakdown={breakdown} />`.

### Anti-Patterns to Avoid

- **Fetching snapshot data in a server component and passing it as props:** GoalSpacePanel is a client component and is already rendered inside a D3 canvas overlay. It cannot be converted to a server component. Keep data fetching in useEffect.
- **Rendering SVG path as a string template literal:** Use D3's area generator or a proper coordinate array. String interpolation for SVG paths is error-prone with floating-point numbers.
- **Passing the entire `factor_breakdown` from every outcome in history for the sparkline:** The sparkline only needs `score` + `computed_at` per point. Keep the history response lean.
- **Opening the breakdown panel on hover instead of click:** CONV-05 specifies "clicking the badge." Hover tooltips are fragile on touch devices and in dense UIs. Use click with toggle.
- **Mutating the TrajectoryBadge's showTooltip state variable for the expanded state:** The existing stub uses `showTooltip` for a simple hover tooltip. Phase 5 replaces this mechanism with `expanded` (click toggle) — rename the state variable for clarity.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time-series path calculation | Custom SVG path string builder | D3 `area()` + `scaleLinear()` | Edge cases: empty array, single point, all-same values, NaN scores — D3 handles these |
| Score clamping | Inline `Math.max/Math.min` in component | Already done in `computeConvergenceScore` — trust the stored score | Scores in DB are already clamped to [-10, 10]; re-clamping in UI is redundant but harmless |
| Status-to-label mapping | Switch/if-else in render | Lookup table (`STATUS_CONFIG` pattern already used in TrajectoryBadge) | Consistent with existing pattern, easy to update labels |

**Key insight:** The heavy lifting (scoring, factor accumulation, snapshot storage) is already complete from Phase 4. Phase 5 is reading + displaying. Resist the urge to re-derive the trajectory status from raw graph data in the UI — always use the stored snapshot.

---

## Common Pitfalls

### Pitfall 1: ConvergenceSparkline with 0 or 1 data points crashing D3

**What goes wrong:** D3 `area()` with an empty array produces `null` for the path `d` attribute. React renders `<path d={null}>` which causes a React warning and potentially a blank SVG.

**Why it happens:** No snapshots exist until the first threshold trigger or on-demand snapshot.

**How to avoid:** Guard in the component: `if (snapshots.length === 0)` return a placeholder (dashed baseline). `if (snapshots.length === 1)` return a single circle/dot. Only render the full area path when `snapshots.length >= 2`.

**Warning signs:** Blank sparkline area in development; React console warnings about null SVG attribute.

### Pitfall 2: `factor_breakdown` typed as `unknown` or `any` from Supabase

**What goes wrong:** Supabase returns JSONB columns as `Json` type (`unknown` in practice). If the breakdown expansion panel tries to access `factorBreakdown.outcome_scores`, TypeScript errors or runtime crashes occur.

**Why it happens:** Supabase's generated types do not know the structure of JSONB columns.

**How to avoid:** Cast the Supabase result to the known `FactorBreakdown` type from `src/lib/graph/convergence.ts` at the API route boundary. The GET route returns `factor_breakdown as FactorBreakdown` in the typed response. The component receives it already typed — no runtime casting needed in the component.

### Pitfall 3: GoalSpaceSection displaying stale "pending" badge after data loads

**What goes wrong:** `GoalSpaceSection` renders `TrajectoryBadge status="pending"` on first render. After useEffect resolves, if state update doesn't trigger a re-render correctly, the badge stays pending.

**Why it happens:** If `convergenceData` state is initialized as `null` and the component derives `status` inline without checking null, the status always falls back to `'pending'`.

**How to avoid:** Derive `status` explicitly: `const status = convergenceData?.latest ? scoreToStatus(convergenceData.latest.score) : 'pending'`. This ensures the badge updates when `convergenceData` transitions from `null` to a value.

### Pitfall 4: Sparkline width/height mismatch between viewBox and rendered dimensions

**What goes wrong:** SVG is set to `width="200" height="40"` but Tailwind classes override the displayed size, causing the sparkline to appear stretched or cut off.

**Why it happens:** SVG elements respond to both attribute dimensions and CSS dimensions. If a parent applies `w-full`, the SVG stretches beyond the coordinate system.

**How to avoid:** Do not set a `viewBox` that conflicts with the `width`/`height` attributes. Use `width={200} height={40}` as React props (not via Tailwind) and do not apply any width-overriding CSS classes to the SVG element itself. Place inside a `div` with constrained width if needed.

### Pitfall 5: Breaking the TrajectoryBadge's existing usage in CommitmentPanel

**What goes wrong:** GoalSpaceSection currently passes `<TrajectoryBadge status="pending" />` with no other props. When TrajectoryBadge gains a `factorBreakdown` prop, the existing call site must still compile without passing that prop (since it's optional during the transition).

**Why it happens:** TypeScript will error if a newly required prop is missing at existing call sites.

**How to avoid:** Keep `factorBreakdown` optional in the TrajectoryBadge props interface. The component renders nothing for the breakdown panel when `factorBreakdown` is undefined.

### Pitfall 6: Pre-existing tsc errors in test files (inherited from Phase 4)

**What goes wrong:** `tsc --noEmit` reports errors in `DashboardSidebar.test.tsx` and `InlineCaptureCard.test.tsx` (TS2582 — cannot find name `it`, `expect`, `vi`). These are pre-existing.

**Why it happens:** Those test files use Vitest globals without imports, and tsc doesn't have vitest type definitions configured.

**How to avoid:** Do not treat these as Phase 5 regressions. Document them in deferred-items.md if still unresolved. Phase 5 tests must add explicit `import { describe, it, expect, vi } from 'vitest'` imports (as all other test files in this project already do — see `GoalSpacePanel.test.tsx`).

---

## Code Examples

Verified patterns from codebase reading:

### makeNode / makeEdge test factory (established pattern)

```typescript
// Source: src/components/graph/__tests__/GoalSpacePanel.test.tsx
function makeNode(overrides: Partial<Node>): Node {
  return {
    id: 'node-1',
    node_type: 'hunch',
    title: 'Test',
    description: null,
    content: null,
    hunch_type: null,
    confidence_level: null,
    confidence_basis: null,
    status: 'raw',
    llm_extraction: null,
    llm_review: null,
    human_review: null,
    author_id: null,
    parent_node_id: null,
    domain_tags: [],
    external_links: [],
    attachments: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}
```

### Supabase GET route auth pattern

```typescript
// Source: src/app/api/convergence/snapshot/route.ts (established in Phase 4)
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // ...
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### Query param extraction in App Router GET route

```typescript
// Source: Next.js App Router convention
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const goalSpaceId = searchParams.get('goal_space_id');
  if (!goalSpaceId) {
    return NextResponse.json({ error: 'goal_space_id required' }, { status: 400 });
  }
  // ...
}
```

### D3 sparkline skeleton

```typescript
// Source: D3 documentation — area chart pattern
import { scaleLinear, area } from 'd3';

const WIDTH = 200;
const HEIGHT = 40;

export function ConvergenceSparkline({ snapshots }: Props) {
  if (snapshots.length === 0) {
    return <svg width={WIDTH} height={HEIGHT}><line x1={0} y1={HEIGHT / 2} x2={WIDTH} y2={HEIGHT / 2} stroke="#374151" strokeDasharray="4 2" /></svg>;
  }

  const xScale = scaleLinear().domain([0, Math.max(snapshots.length - 1, 1)]).range([0, WIDTH]);
  const yScale = scaleLinear().domain([-10, 10]).range([HEIGHT, 0]);

  const areaGen = area<{ score: number }>()
    .x((_, i) => xScale(i))
    .y0(yScale(0))
    .y1(d => yScale(d.score));

  const lastScore = snapshots[snapshots.length - 1]?.score ?? 0;
  const fillColor = lastScore > 0 ? '#14b8a6' : '#f97316';  // teal-500 / orange-400

  const pathD = areaGen(snapshots) ?? '';

  return (
    <svg width={WIDTH} height={HEIGHT}>
      <path d={pathD} fill={fillColor} fillOpacity={0.4} />
    </svg>
  );
}
```

### STATUS_CONFIG lookup pattern (from existing TrajectoryBadge)

```typescript
// Source: src/components/commitment/TrajectoryBadge.tsx
const STATUS_CONFIG: Record<TrajectoryStatus, { label: string; icon: string; bgClass: string; textClass: string }> = {
  pending:    { label: '---',        icon: '⊙',  bgClass: 'bg-gray-800',    textClass: 'text-gray-500' },
  converging: { label: 'Converging', icon: '↗',  bgClass: 'bg-teal-900/50', textClass: 'text-teal-400' },
  neutral:    { label: 'Neutral',    icon: '→',  bgClass: 'bg-gray-800',    textClass: 'text-gray-400' },
  drifting:   { label: 'Drifting',   icon: '↘',  bgClass: 'bg-red-900/30',  textClass: 'text-red-400'  },
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TrajectoryBadge status="pending" (stub) | Live score from convergence_snapshots | Phase 5 | Badge shows real converging/neutral/drifting |
| No factor breakdown visible | Click-to-expand inline panel | Phase 5 | CONV-05 requirement |
| No sparkline | 30-day inline SVG via D3 area | Phase 5 | CONV-06 requirement |

**Deprecated/outdated:**
- `showTooltip` hover state in TrajectoryBadge: replaced by `expanded` click-toggle state in Phase 5. The "Trajectory computed in Phase 4" placeholder tooltip can be removed.

---

## Open Questions

1. **Where exactly does ConvergenceSparkline render in GoalSpacePanel?**
   - What we know: GoalSpacePanel renders a right-side panel (`w-72`) showing trigger outcomes. The panel header shows the goal space title.
   - What's unclear: Should the sparkline sit in the panel header (above the outcomes list) or at the bottom of the panel?
   - Recommendation: Place sparkline in the panel header section, between the goal space title and the outcomes list. This gives it prominence without pushing outcome content off screen.

2. **Should GoalSpaceSection in CommitmentPanel also show the sparkline?**
   - What we know: CONV-06 says "goal space displays an inline SVG sparkline." GoalSpaceSection is the goal space row in CommitmentPanel.
   - What's unclear: The goal space section header is a narrow button row (`px-3 py-2`). A 200x40 sparkline would overflow the header.
   - Recommendation: Show sparkline in GoalSpaceSection only when expanded (below the header), not inline in the collapsed header. GoalSpacePanel always shows it (panel has more space). The planner should confirm this interpretation.

3. **Should the factor breakdown expansion in TrajectoryBadge use a popover or inline expansion?**
   - What we know: CONV-05 says "expands to show positive and negative contributing factors" — no specific UI treatment mandated.
   - What's unclear: Popover (absolutely positioned, z-index management) vs. inline expansion below the badge row.
   - Recommendation: Inline expansion below the badge within the panel is simpler and avoids z-index conflicts with the D3 graph canvas. Use a `<div>` that conditionally renders below the badge, not a floating popover.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (globals: true, environment: jsdom) |
| Quick run command | `npx vitest run src/components` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONV-04 | TrajectoryBadge renders "Converging" label when score > 1 | unit | `npx vitest run src/components/commitment/__tests__/TrajectoryBadge.test.tsx` | ❌ Wave 0 |
| CONV-04 | TrajectoryBadge renders "Neutral" label when score is 0 | unit | same | ❌ Wave 0 |
| CONV-04 | TrajectoryBadge renders "Drifting" label when score < -1 | unit | same | ❌ Wave 0 |
| CONV-04 | TrajectoryBadge renders numeric score with sign prefix (+3.5, -2.1) | unit | same | ❌ Wave 0 |
| CONV-04 | GoalSpaceSection renders badge with live score after data fetch | unit | `npx vitest run src/components/commitment/__tests__/GoalSpaceSection.test.tsx` | ❌ Wave 0 |
| CONV-05 | TrajectoryBadge does not show breakdown panel before click | unit | `npx vitest run src/components/commitment/__tests__/TrajectoryBadge.test.tsx` | ❌ Wave 0 |
| CONV-05 | Clicking TrajectoryBadge expands factor breakdown panel | unit | same | ❌ Wave 0 |
| CONV-05 | Breakdown panel lists positive factor names | unit | same | ❌ Wave 0 |
| CONV-05 | Breakdown panel lists negative factor names | unit | same | ❌ Wave 0 |
| CONV-05 | Clicking badge again collapses the breakdown panel | unit | same | ❌ Wave 0 |
| CONV-06 | ConvergenceSparkline renders SVG with width=200 height=40 | unit | `npx vitest run src/components/graph/__tests__/ConvergenceSparkline.test.tsx` | ❌ Wave 0 |
| CONV-06 | ConvergenceSparkline renders placeholder when snapshots array is empty | unit | same | ❌ Wave 0 |
| CONV-06 | ConvergenceSparkline renders path element when snapshots has >= 2 entries | unit | same | ❌ Wave 0 |

**Notes on manual-only items:**
- None for Phase 5. All behaviors are testable through React component rendering in jsdom.
- The GET API route is not unit-tested (Supabase server client cannot be mocked without additional setup). Verification is via TypeScript type-check + manual smoke test.

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/commitment/__tests__/TrajectoryBadge.test.tsx src/components/graph/__tests__/ConvergenceSparkline.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/commitment/__tests__/TrajectoryBadge.test.tsx` — covers CONV-04 and CONV-05
- [ ] `src/components/graph/__tests__/ConvergenceSparkline.test.tsx` — covers CONV-06
- [ ] `src/components/commitment/__tests__/GoalSpaceSection.test.tsx` — covers CONV-04 integration (badge with live data)

---

## Sources

### Primary (HIGH confidence)

- `src/lib/graph/convergence.ts` — FactorBreakdown, OutcomeScore, FactorDetail, ConvergenceResult types; score clamping to [-10, 10]
- `src/app/api/convergence/snapshot/route.ts` — established Supabase auth pattern, parallel fetch, activity log, response envelope
- `src/components/commitment/TrajectoryBadge.tsx` — existing stub: STATUS_CONFIG, TrajectoryStatus type, score display logic
- `src/components/commitment/GoalSpaceSection.tsx` — existing call site: `<TrajectoryBadge status="pending" />`
- `src/components/graph/GoalSpacePanel.tsx` — existing panel structure (w-72 right panel, outcome list)
- `src/components/graph/__tests__/GoalSpacePanel.test.tsx` — makeNode/makeEdge factory pattern, RTL + vitest import style
- `vitest.config.ts` — globals: true, jsdom, @/ alias
- `.planning/REQUIREMENTS.md` — CONV-04/05/06 exact requirements, score thresholds for badge labels
- `.planning/phases/04-convergence-computation/04-RESEARCH.md` — score-to-status thresholds, Phase 5 query shapes, DB schema
- `.planning/STATE.md` — trajectory badge (Option C) chosen; spiral SVG deferred to design pass

### Secondary (MEDIUM confidence)

- `package.json` — d3 ^7.9.0 confirmed present; no SVG-specific library beyond D3

### Tertiary (LOW confidence)

- None for this phase — all findings verified from codebase source files.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — verified from package.json and existing source files
- Architecture: HIGH — follows established patterns from Phase 2-4 (pure functions, useEffect fetch, STATUS_CONFIG lookup table)
- Component design: HIGH — existing TrajectoryBadge stub defines the shape; Phase 5 wires it to live data
- Sparkline implementation: MEDIUM-HIGH — D3 is installed and documented; edge cases (empty/single point) identified
- Pitfalls: HIGH — derived from reading actual code, not assumptions

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack; D3 v7 API is stable)
