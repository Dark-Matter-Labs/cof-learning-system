# Phase 9: Review UX - Research

**Researched:** 2026-03-31
**Domain:** React state management, UI defaults, extraction review workflow
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REVIEW-01 | ReviewCard extraction fields default to checked (opt-out model — user rejects bad ones, not approves good ones) | `ExtractionField` currently starts with no `currentAction` set; change `useState` init in `ReviewCard` to pre-populate all field states as `accepted` |
| REVIEW-02 | Promote button enabled by default when all fields are checked | Promote button is currently only `disabled` when `isSubmitting`; with pre-accepted defaults it is already always enabled — no logic gate needed |
| REVIEW-03 | "Promote all" one-click shortcut accepts all fields and promotes to graph immediately | Add a new button above the existing actions that calls `handleAcceptAll` then immediately calls `onPromote(buildReview())` |
</phase_requirements>

---

## Summary

Phase 9 is a pure front-end behavioral change to the `ReviewCard` component. The extraction review workflow currently requires Robyn to explicitly click "Accept" (✓) on each field before the state is recorded as accepted. Fields start with no action recorded (`currentAction` is `undefined`), and `buildReview()` simply passes whatever `fields` state exists at the time — it does not gate on every field being actioned. The Promote button is always enabled (only gated by `isSubmitting`).

The work is three small changes: (1) pre-populate the `fields` state in `ReviewCard` with every extraction field set to `accepted` at mount time, (2) confirm the Promote button requires no gating change because it is already always enabled, and (3) add a "Promote all" button that sets all field states to `accepted` and calls `onPromote` in a single handler.

Connection suggestions (`connectionStatuses`) and goal relevance suggestions (`goalRelevanceActions`) are separate state slices managed by `ConnectionSuggestion` and `GoalRelevanceField`. The spec's opt-out model applies most naturally to the core `ExtractionField` fields (title, summary, structured claim, assumption type, expected signals). Connection suggestions are a different UX pattern (suggest a graph edge, user approves). The planner must decide whether REVIEW-01 and REVIEW-03 apply to connection suggestions too — the research below shows the relevant code paths.

**Primary recommendation:** Initialize all `ExtractionField`-backed state as `accepted` in `useState`; derive field names from the extraction object at construction time; add a `handlePromoteAll` function that also accepts connections and goal relevance before calling `onPromote`.

---

## Standard Stack

### Core (already in use — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 (Next.js 15) | Component state | Already in use |
| Vitest | ^4.1.0 | Unit tests | Already configured |
| @testing-library/react | ^16 | Component rendering in tests | Already configured |

**No new packages required.** Phase 9 is a behavior-only change.

---

## Architecture Patterns

### Current State Initialization (the problem)

`ReviewCard` initialises all field state as empty:

```typescript
// src/components/review/ReviewCard.tsx — current
const [fields, setFields] = useState<Record<string, FieldState>>({});
const [connectionStatuses, setConnectionStatuses] = useState<Record<number, 'accepted' | 'rejected'>>({});
const [goalRelevanceActions, setGoalRelevanceActions] = useState<Record<string, { action: FieldAction; final: unknown }>>({});
```

Fields with no entry in `fields` are treated as neither accepted nor rejected — the `ExtractionField` renders the neutral grey left-border.

### Pattern: Opt-out Default Initialization

Initialize the `fields` map from the extraction object at mount, marking all fields `accepted`:

```typescript
// Derive initial accepted state from the extraction object
function buildInitialFields(extraction: LlmExtraction): Record<string, FieldState> {
  const initial: Record<string, FieldState> = {};
  if (extraction.title) {
    initial.title = { action: 'accepted', original: extraction.title, final: extraction.title };
  }
  if (extraction.summary) {
    initial.summary = { action: 'accepted', original: extraction.summary, final: extraction.summary };
  }
  if (extraction.structured_claim) {
    initial.structured_claim = { action: 'accepted', original: extraction.structured_claim, final: extraction.structured_claim };
  }
  if (extraction.assumption_type) {
    initial.assumption_type = { action: 'accepted', original: extraction.assumption_type, final: extraction.assumption_type };
  }
  if (extraction.expected_signals && extraction.expected_signals.length > 0) {
    const signalsStr = extraction.expected_signals.join(', ');
    initial.expected_signals = { action: 'accepted', original: signalsStr, final: signalsStr };
  }
  return initial;
}

// In ReviewCard component body:
const [fields, setFields] = useState<Record<string, FieldState>>(() => buildInitialFields(extraction));
```

The lazy initializer form `useState(() => ...)` runs once at mount. This is the correct React pattern for derived initial state.

### Pattern: Promote All Button

A single handler that builds an "accept everything" review and promotes immediately:

```typescript
const handlePromoteAll = useCallback(() => {
  // Accept all connections
  const allConnectionStatuses = Object.fromEntries(
    (extraction.suggested_connections ?? []).map((_, i) => [i, 'accepted' as const])
  );
  setConnectionStatuses(allConnectionStatuses);

  // Accept all goal relevance suggestions
  const allGoalRelevanceActions = Object.fromEntries(
    (extraction.goal_relevance ?? []).map(s => [
      s.outcome_id,
      { action: 'accepted' as const, final: s.outcome_id },
    ])
  );
  setGoalRelevanceActions(allGoalRelevanceActions);

  // Build review using updated state directly (not from stale closure)
  // Must pass state explicitly since setState is async
  onPromote(buildReviewWith(
    buildInitialFields(extraction),
    allConnectionStatuses,
    allGoalRelevanceActions,
    confidence,
    domainTags,
    extraction,
  ));
}, [extraction, confidence, domainTags, onPromote]);
```

**Critical implementation note:** React's `setState` is asynchronous — calling `setConnectionStatuses` then immediately calling `buildReview()` (which reads from stale state) will produce incorrect output. The "Promote all" handler must compute the full review synchronously by passing all accepted values directly to `buildReview` or a variant of it, rather than reading from state.

The cleanest approach is to extract `buildReview` to accept explicit overrides, or construct the HumanReview object inline within `handlePromoteAll` without relying on state reads.

### Promote Button — No Gating Required (REVIEW-02)

Current code:
```typescript
<button
  onClick={() => onPromote(buildReview())}
  disabled={isSubmitting}
  ...
>
  Promote to Graph
</button>
```

The button is already always enabled (only `isSubmitting` disables it). With all fields pre-accepted, `buildReview()` will produce a valid `HumanReview` on the first render. REVIEW-02 is satisfied automatically by REVIEW-01.

### Anti-Patterns to Avoid

- **Reading state immediately after setState:** Do not call `setConnectionStatuses(...)` then `buildReview()` expecting the new state to be visible. State updates are batched and asynchronous. Pass values directly.
- **Initializing extraction fields conditionally at render:** Do not use `useEffect` to set initial state after mount — use the lazy `useState` initializer instead to avoid a render-then-patch flash.
- **Duplicating field names as string constants:** The field names (`title`, `summary`, etc.) are already used consistently in the existing `handleFieldAction` calls — match those exactly to avoid producing duplicate keys in the `fields` map.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Derived initial state | Complex useEffect + setState | `useState(() => fn())` lazy initializer | Runs once, no extra render, React-idiomatic |
| Stale closure in async handler | Global ref or extra useEffect | Pass values directly to the review builder | No indirection needed; simpler |

---

## Common Pitfalls

### Pitfall 1: Stale Closure in "Promote All" Handler
**What goes wrong:** Developer calls `setConnectionStatuses(allStatuses)` inside `handlePromoteAll`, then calls `buildReview()` which reads `connectionStatuses` from the closure — which still has the old empty value.
**Why it happens:** React state updates are enqueued, not applied synchronously within the same function call.
**How to avoid:** In `handlePromoteAll`, compute the `HumanReview` object from locally-constructed variables (not from state), then call `onPromote` with that directly. Optionally also call the setters so the UI reflects the accepted state visually.
**Warning signs:** "Promote all" promotes the node but no connections or goal relevance edges are created — state reads returned empty.

### Pitfall 2: useState Initializer Receiving Null Extraction
**What goes wrong:** `ReviewCard` renders before `extraction` is truthy (possible during loading states), and `buildInitialFields(extraction)` is called with `null`, causing a runtime error.
**Why it happens:** The component guards with `if (!extraction) return null;` after the hooks — hooks cannot be called conditionally, so the initializer runs before the guard.
**How to avoid:** The initializer should defensively handle a null/undefined extraction: `useState(() => extraction ? buildInitialFields(extraction) : {})`. Since the component already returns `null` when `extraction` is falsy, the state will never be used — but the initializer must not throw.

### Pitfall 3: ExtractionField Visual State Mismatch
**What goes wrong:** Fields start visually as "neutral" even though they are pre-accepted in state, because `ExtractionField` reads `currentAction` prop to set its border colour.
**Why it happens:** `ExtractionField` renders `border-l-gray-700` when `currentAction` is undefined. If the parent's initial state is correct but the prop is not connected, the visual defaults do not match.
**How to avoid:** Confirm that `currentAction={fields.title?.action}` on each `ExtractionField` will correctly propagate `'accepted'` from the initial state. This is already how the props are wired — no change needed there.

### Pitfall 4: Connection Suggestions Opt-Out Scope Ambiguity
**What goes wrong:** "Promote all" accepts connection suggestions the user did not review, creating unwanted graph edges.
**Why it happens:** Requirement scope is ambiguous — REVIEW-01 says "extraction fields" and REVIEW-03 says "accepts every field." Connection suggestions are a different UX concept (linking to existing nodes) with higher consequence than text edits.
**How to avoid:** Planner should decide explicitly. Conservative interpretation: "Promote all" pre-accepts `ExtractionField` rows and goal relevance, but leaves connection suggestions untouched (user still reviews them individually). Aggressive interpretation: "Promote all" accepts connections too. The current `buildReview` already gates connections on `connectionStatuses[i] === 'accepted'`, so connections with no status will be neither accepted nor rejected (silently skipped).

---

## Code Examples

### ExtractionField border — current behavior with accepted action
```typescript
// ExtractionField.tsx — border logic
const borderColor = currentAction === 'accepted'
  ? 'border-l-green-500'    // green when accepted
  : currentAction === 'rejected'
  ? 'border-l-red-500'
  : currentAction === 'edited'
  ? 'border-l-node-hunch'
  : 'border-l-gray-700';   // neutral gray when undefined
```

With pre-accepted state, fields will open with `border-l-green-500` — immediately communicating that they are accepted by default.

### buildReview — how fields feed into HumanReview
```typescript
// ReviewCard.tsx — buildReview (current)
return {
  reviewed_at: new Date().toISOString(),
  reviewer_id: node.author_id ?? '',
  fields: {
    ...fields,                // ExtractionField states
    ...goalRelevanceFields,   // GoalRelevanceField states (accepted/edited only)
    confidence: { ... },
    domain_tags: { ... },
  },
  connections_accepted: (extraction.suggested_connections ?? [])
    .filter((_, i) => connectionStatuses[i] === 'accepted')
    .map(c => ({ ... })),
  connections_rejected: (extraction.suggested_connections ?? [])
    .filter((_, i) => connectionStatuses[i] === 'rejected')
    .map(c => c.target_title),
  connections_added: [],
};
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 9 |
|--------------|------------------|--------------------|
| Opt-in review (user approves each field) | Opt-out review (user rejects bad fields) | Requires inverting the useState initialization |
| No "accept all" shortcut | "Promote all" one-click button | New handler + button in the actions panel |

---

## Open Questions

1. **Does "Promote all" accept connection suggestions?**
   - What we know: REVIEW-03 says "accepts every field" — connections are not fields in the ExtractionField sense
   - What's unclear: Whether unwanted connections being auto-accepted would be harmful to Robyn
   - Recommendation: Planner should default to NOT auto-accepting connections in "Promote all" (lower risk), and note this explicitly in the plan

2. **Does "Promote all" also apply to goal relevance suggestions?**
   - What we know: Goal relevance is rendered via `GoalRelevanceField`, which has its own state slice and its own Accept/Reject/Link buttons
   - What's unclear: Whether pre-accepting goal relevance automatically creates `targets_outcome` edges Robyn might not want
   - Recommendation: Pre-accept goal relevance in "Promote all" since it's analogous to ExtractionField — but note it in the plan

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 + @testing-library/react |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REVIEW-01 | ReviewCard opens with all ExtractionFields pre-accepted (green border state) | unit | `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx` | Wave 0 |
| REVIEW-02 | Promote button is enabled immediately without user interaction | unit | `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx` | Wave 0 |
| REVIEW-03 | "Promote all" button calls onPromote with all fields accepted in one click | unit | `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/review/__tests__/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/review/__tests__/ReviewCard.test.tsx` — covers REVIEW-01, REVIEW-02, REVIEW-03 (file does not exist; ExtractionField.test.tsx exists but ReviewCard itself has no test file)

---

## Sources

### Primary (HIGH confidence)
- Direct code reading of `src/components/review/ReviewCard.tsx` — state initialization, buildReview, Promote button
- Direct code reading of `src/components/review/ExtractionField.tsx` — border color logic, currentAction prop contract
- Direct code reading of `src/components/review/ConnectionSuggestion.tsx` — connectionStatuses shape
- Direct code reading of `src/components/review/GoalRelevanceField.tsx` — goalRelevanceActions shape
- Direct code reading of `src/app/capture/[id]/review/page.tsx` — how ReviewCard is wired and what onPromote does
- `vitest.config.ts` — test environment confirmed (jsdom, globals true)
- `src/components/review/__tests__/ExtractionField.test.tsx` — test patterns in use

### Secondary (MEDIUM confidence)
- React documentation (training data, stable API) — lazy `useState` initializer pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing stack fully confirmed by reading source
- Architecture: HIGH — all relevant components read directly; change surface is small and well-understood
- Pitfalls: HIGH — stale closure pitfall verified by reading buildReview's reliance on state closure; other pitfalls derived from React fundamentals

**Research date:** 2026-03-31
**Valid until:** 2026-05-01 (stable domain)
