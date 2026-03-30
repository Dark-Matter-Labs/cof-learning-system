# Phase 3: Capture Linking + Extraction - Research

**Researched:** 2026-03-27
**Domain:** React form extension, LLM prompt engineering, Supabase edge queries, weekly review page
**Confidence:** HIGH

## Summary

Phase 3 has two independent workstreams that share a data model. The first is a UI/form extension: add a trigger_outcome dropdown and an expected_signals text field to InlineCaptureCard, create a targets_outcome edge post-save (mirroring the already-working advances_goal pattern), and surface undirected hunches in the weekly review. The second is an extraction agent enrichment: inject active goal context into the existing SYSTEM_PROMPT, add two new output fields (goal_relevance, expected_signals) to the LlmExtraction type, and render Accept/Reject/Link actions for those fields in ReviewCard.

The edge creation pattern, the extraction prompt structure, the ReviewCard field pattern, and the data model are all already in place. No new libraries are needed. The main design decisions are: (a) how to fetch trigger_outcomes for the InlineCaptureCard dropdown, (b) how to pass goal context to the extraction agent without bloating the capture POST payload, and (c) what "Link to different outcome" means in ReviewCard terms.

The review page (`/review`) is a server-side component with static Supabase queries. Adding the undirected-hunches section means adding one more query (hunches with no `targets_outcome` edge) and a new UI section in the existing grid layout.

**Primary recommendation:** Extend InlineCaptureCard with triggerOutcomes prop (same pattern as goalSpaces), extend extraction.ts with a context-aware overload, and add a GoalRelevanceField component to ReviewCard — all three follow existing patterns exactly.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAPT-01 | Capture form shows "Which outcome does this target?" dropdown (optional, lists active trigger_outcomes) | InlineCaptureCard already has goalSpaces dropdown pattern — extend with triggerOutcomes prop |
| CAPT-02 | Selecting an outcome auto-creates a targets_outcome edge on save | advances_goal edge creation in handleCreate is the exact pattern to replicate |
| CAPT-03 | Capture form has "What signal would tell you this is working?" optional text field, saved as content.expected_signals | /api/capture already accepts a content field passed through to JSONB column |
| CAPT-04 | Weekly review surfaces undirected hunches (no targets_outcome edge) with "consider linking" prompt | review/page.tsx is a server component; add a Supabase query that fetches hunch nodes lacking a targets_outcome edge |
| EXTR-01 | Extraction agent receives active goal spaces and trigger outcomes in system prompt context | extraction.ts has a single SYSTEM_PROMPT constant and a runExtraction function — extend to accept optional context |
| EXTR-02 | Extraction agent suggests GOAL_RELEVANCE (which trigger outcome(s) the hunch targets) | Add goal_relevance field to LlmExtraction type and the JSON schema in SYSTEM_PROMPT |
| EXTR-03 | Extraction agent suggests EXPECTED_SIGNALS (specific observable signals if this hunch is correct) | Add expected_signals field to LlmExtraction type and JSON schema |
| EXTR-04 | Review card shows suggested goal relevance with Accept / Reject / Link to different outcome actions | ReviewCard renders ExtractionField components per field; add a GoalRelevanceField with outcome selector |
</phase_requirements>

---

## Standard Stack

### Core (already present — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (Next.js App Router) | Existing | UI components | Project stack |
| Supabase JS client | Existing | DB queries | Project stack |
| Vitest + jsdom | Existing | Unit + component tests | vitest.config.ts present |
| @testing-library/react | Existing | Component rendering in tests | src/test-setup.ts present |

**Installation:** None needed.

---

## Architecture Patterns

### Existing Pattern: InlineCaptureCard contextual section

The card conditionally renders a goal-space dropdown when `nodeType === 'trigger_outcome'`. The same technique applies for the CAPT-01/02/03 fields:

```
nodeType IN ('hunch', 'intervention', 'signal')  → show trigger_outcome dropdown
any nodeType where expected_signals makes sense  → show expected_signals text field
```

The `goalSpaces` prop is already received from GraphOSSurface (which filters `nodes` by `node_type === 'goal_space'`). The same parent already computes `triggerOutcomes = nodes.filter(n => n.node_type === 'trigger_outcome')` and passes it to CommitmentPanel. Adding it to InlineCaptureCard is a one-line prop addition in GraphOSSurface.

### Existing Pattern: Post-save edge creation

`handleCreate` in InlineCaptureCard already does:
1. POST `/api/capture` → get `data.id`
2. If condition met, POST `/api/graph/edges` with `{ source_id, target_id, edge_type }`
3. Edge failure does not block node creation (fire-and-forget with try/catch)

The `targets_outcome` edge must follow the same pattern. The edge direction per migration is: `source = hunch/intervention/signal`, `target = trigger_outcome`.

### Existing Pattern: content JSONB field

`/api/capture/route.ts` already accepts `content` in the request body and passes it through to the `nodes` insert. The `Node` type has `content: unknown | null`. Storing `expected_signals` as `content.expected_signals` requires no DB migration — just pass `content: { expected_signals: text }` in the capture POST body.

### Existing Pattern: extraction.ts prompt extension

`runExtraction(title, description)` calls `callLLM` with a static `SYSTEM_PROMPT`. To inject goal context for EXTR-01, the cleanest approach matching the existing pattern is:

```typescript
// Source: src/lib/agents/extraction.ts (existing pattern)
export async function runExtraction(
  title: string,
  description: string,
  goalContext?: GoalContext
): Promise<LlmExtraction>
```

`goalContext` is optional so all existing call sites remain unchanged. The `/api/capture/process/route.ts` POST handler fetches the node — it can also fetch goal spaces and trigger outcomes from Supabase before calling `runExtraction`.

### Existing Pattern: ReviewCard field rendering

ReviewCard renders `<ExtractionField>` components for each LlmExtraction field. The `HumanReview.fields` record accepts any field name as a key. Adding `goal_relevance` to ReviewCard is:
1. Add `goal_relevance` and `expected_signals` to the `LlmExtraction` type (both optional)
2. Render a new component (`GoalRelevanceField`) that shows the suggested outcome(s) with Accept/Reject actions plus a "Link to different outcome" selector

For EXTR-04's "Link to different outcome" action, the ReviewCard needs access to available trigger_outcomes. This means either: (a) ReviewCard receives triggerOutcomes as a prop (same parent pattern), or (b) the component fetches them itself. Option (a) is consistent with the project's props-down pattern.

The review page at `/capture/[id]/review/page.tsx` is a client component that fetches the node. It should also fetch trigger_outcomes and pass them to ReviewCard.

### Existing Pattern: Weekly review undirected hunches (CAPT-04)

The review page is a server-side Next.js page component. The current queries all use direct Supabase calls in `Promise.all`. To find hunches with no `targets_outcome` edge, use a Supabase NOT EXISTS / left join approach:

```sql
-- Conceptual query:
SELECT n.* FROM nodes n
WHERE n.node_type = 'hunch'
  AND n.status NOT IN ('archived')
  AND NOT EXISTS (
    SELECT 1 FROM edges e
    WHERE e.source_id = n.id AND e.edge_type = 'targets_outcome'
  )
```

In Supabase JS this is achievable with a subquery or by fetching edges separately and filtering in JS. The existing pattern fetches nodes and edges separately and does JS-side filtering (e.g., getCommitmentConnectedNodes). Same approach is appropriate here.

### Recommended Project Structure (Phase 3 additions)

```
src/
├── components/
│   ├── graph/
│   │   └── InlineCaptureCard.tsx          # Add triggerOutcomes prop, CAPT-01/02/03
│   └── review/
│       ├── ReviewCard.tsx                  # Add GoalRelevanceField rendering, EXTR-04
│       └── GoalRelevanceField.tsx          # New component for EXTR-04
├── lib/
│   ├── agents/
│   │   └── extraction.ts                   # Add GoalContext type, extend runExtraction, EXTR-01/02/03
│   └── types/
│       └── nodes.ts                        # Add goal_relevance + expected_signals to LlmExtraction
└── app/
    ├── review/page.tsx                     # Add undirected hunches section, CAPT-04
    └── capture/[id]/review/page.tsx        # Pass triggerOutcomes to ReviewCard
```

### Anti-Patterns to Avoid

- **Fetching trigger_outcomes inside InlineCaptureCard:** The card does not fetch independently (project pattern). Receive as prop from GraphOSSurface.
- **Adding a DB column for expected_signals:** The `content` JSONB field already exists and the capture API already accepts it. No migration needed.
- **Changing the runExtraction signature in a breaking way:** All existing call sites pass `(title, description)`. Make goalContext a third optional parameter.
- **Making GoalRelevanceField fetch its own data:** ReviewCard does not fetch independently. Trigger outcomes must come from the review page as a prop.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Edge uniqueness on duplicate save | Custom dedup logic | DB UNIQUE(source_id, target_id, edge_type) constraint | Already in schema.sql — Supabase will return a 409 on duplicate insert; catch it silently |
| Goal context injection | Separate context API | Pass as optional param to runExtraction | Avoids new endpoint, keeps extraction testable |
| Undirected hunch detection | Complex query library | JS-side filter on edges array | GraphOSSurface already loads all edges; same pattern in weekly review |

---

## Common Pitfalls

### Pitfall 1: targets_outcome edge direction
**What goes wrong:** Creating the edge with source/target reversed (target_id = hunch, source_id = trigger_outcome).
**Why it happens:** The `advances_goal` edge in the existing code goes `source = trigger_outcome, target = goal_space` — developers may copy that pattern and get confused about which direction `targets_outcome` goes.
**How to avoid:** Per migration comment: `targets_outcome` is `hunch/intervention → trigger_outcome`. Source = hunch, target = trigger_outcome.
**Warning signs:** GoalSpacePanel hunch count queries will return 0 for newly-linked hunches.

### Pitfall 2: expected_signals lost on extraction re-run
**What goes wrong:** The extraction agent overwrites `llm_extraction` but `expected_signals` is stored in `content` — they are separate fields. No conflict. But if a developer accidentally stores expected_signals in `llm_extraction` rather than `content`, it gets cleared on re-extraction.
**How to avoid:** expected_signals is captured at node creation time by the user (via InlineCaptureCard) and stored in `content.expected_signals`. The extraction agent separately suggests its own expected_signals in `llm_extraction.expected_signals`. These are intentionally distinct values.

### Pitfall 3: LlmExtraction type not updated for new fields
**What goes wrong:** `parseExtractionResponse` validates required fields. If `goal_relevance` and `expected_signals` are added to the prompt but not the type, TypeScript will not catch missing field access.
**How to avoid:** Add both fields as optional (`goal_relevance?: ...`, `expected_signals?: string[]`) to `LlmExtraction` in `nodes.ts`. Do NOT add them to the required fields array in `parseExtractionResponse` — they should be optional so the extraction can run without goal context when none is available.

### Pitfall 4: Weekly review page becomes a client component
**What goes wrong:** Adding interactivity to the undirected hunches section (e.g., a "Link" button) forces the currently-server-side `/review/page.tsx` to become a client component.
**How to avoid:** The "consider linking" prompt for CAPT-04 only needs to be an informational link to the capture review page (e.g., `href={/capture/${node.id}/review}`). No client-side state needed. Keep page.tsx as a server component.

### Pitfall 5: GoalContext injection bloats the capture POST body
**What goes wrong:** Passing the full list of trigger_outcomes through the `/api/capture` POST body and then to `/api/capture/process` creates coupling between capture and goal infrastructure.
**How to avoid:** `/api/capture/process/route.ts` already has a Supabase client. It should fetch trigger_outcomes itself before calling `runExtraction`. This keeps capture lean and extraction self-contained.

---

## Code Examples

Verified from codebase inspection:

### CAPT-01/02: Adding trigger_outcome dropdown to InlineCaptureCard
```typescript
// Pattern: mirrors goalSpaces for trigger_outcome type (src/components/graph/InlineCaptureCard.tsx)
// Props extension:
interface InlineCaptureCardProps {
  readonly position: { x: number; y: number };
  readonly linkedNodeId?: string;
  readonly defaultNodeType?: string;
  readonly onClose: () => void;
  readonly onCreated: (nodeId: string) => void;
  readonly goalSpaces: readonly Node[];
  readonly triggerOutcomes: readonly Node[];  // ADD THIS
}

// Edge creation in handleCreate (after existing advances_goal block):
if (triggerOutcomeId && ['hunch', 'intervention', 'signal'].includes(nodeType)) {
  try {
    await fetch('/api/graph/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: data.id,
        target_id: triggerOutcomeId,
        edge_type: 'targets_outcome',
      }),
    });
  } catch {
    // Edge creation failure does not block node creation
  }
}
```

### CAPT-03: Passing expected_signals via content field
```typescript
// /api/capture/route.ts already accepts content:
body: JSON.stringify({
  title: title.trim(),
  node_type: nodeType,
  hunch_type: 'new',
  confidence_level: 3,
  content: expectedSignals ? { expected_signals: expectedSignals } : undefined,
})
```

### EXTR-01: Injecting goal context into extraction
```typescript
// src/lib/agents/extraction.ts
export interface GoalContext {
  readonly goalSpaces: ReadonlyArray<{ id: string; title: string }>;
  readonly triggerOutcomes: ReadonlyArray<{ id: string; title: string }>;
}

export function buildExtractionPrompt(
  title: string,
  description: string,
  goalContext?: GoalContext
): string {
  const base = `Title: ${title}\n\nDescription: ${description}`;
  if (!goalContext) return base;
  const goalSection = [
    '\n\nActive goal spaces:',
    ...goalContext.goalSpaces.map(gs => `- ${gs.title}`),
    '\nActive trigger outcomes:',
    ...goalContext.triggerOutcomes.map(to => `- ${to.title} (id: ${to.id})`),
  ].join('\n');
  return base + goalSection;
}
```

### EXTR-02/03: New fields in LlmExtraction
```typescript
// src/lib/types/nodes.ts — add to LlmExtraction:
readonly goal_relevance?: ReadonlyArray<{
  readonly outcome_id: string;
  readonly outcome_title: string;
  readonly rationale: string;
}>;
readonly expected_signals?: readonly string[];
```

### CAPT-04: Undirected hunches query in weekly review
```typescript
// src/app/review/page.tsx — server component pattern
const [undirectedHunchesRes, targetEdgesRes] = await Promise.all([
  supabase
    .from('nodes')
    .select('*')
    .eq('node_type', 'hunch')
    .not('status', 'in', '("archived","falsified","suspended")'),
  supabase
    .from('edges')
    .select('source_id')
    .eq('edge_type', 'targets_outcome'),
]);

const linkedHunchIds = new Set((targetEdgesRes.data ?? []).map(e => e.source_id));
const undirectedHunches = (undirectedHunchesRes.data ?? []).filter(
  n => !linkedHunchIds.has(n.id)
);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Static extraction prompt with no goal awareness | Parameterised prompt with optional goal context | Extraction suggestions become goal-contextualised without changing existing call sites |
| captures have no goal linkage at creation time | targets_outcome edge created immediately on save | No post-hoc relinking needed for well-defined hunches |

---

## Open Questions

1. **Which node types show the trigger_outcome dropdown?**
   - What we know: `targets_outcome` edge type is defined for "hunch or intervention" (per migration comment). Signal uses `indicates_progress` instead.
   - What's unclear: Should signals also show the outcome dropdown (creating `indicates_progress` edges), or is that out of scope for Phase 3?
   - Recommendation: CAPT-01/02 requirements say "capture form" without specifying node types. Default to hunch + intervention + signal showing the dropdown, but create the correct edge type per node type: `targets_outcome` for hunch/intervention, `indicates_progress` for signal.

2. **"Link to different outcome" in EXTR-04 — modal or inline selector?**
   - What we know: ReviewCard has a right-side panel with ConnectionSuggestion components. ExtractionField has inline edit.
   - What's unclear: Whether "Link to different outcome" opens a modal or renders an inline dropdown in GoalRelevanceField.
   - Recommendation: Inline dropdown within GoalRelevanceField, consistent with ExtractionField's inline edit pattern. No modal infrastructure exists.

3. **Does EXTR-04 require saving the accepted outcome link as a real edge?**
   - What we know: When the user promotes a node, connections_accepted creates edges. The same mechanism can create a `targets_outcome` edge at promotion time.
   - What's unclear: Whether the accepted goal_relevance should write an edge immediately (on accept click) or at promotion time.
   - Recommendation: Write the edge at promotion time — consistent with how suggested_connections edges are created in the existing handlePromote. Store the accepted outcome in HumanReview.fields so the promotion handler can read it.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAPT-01 | triggerOutcomes dropdown renders for hunch/intervention types | unit | `npx vitest run src/components/graph/__tests__/InlineCaptureCard.test.tsx` | ✅ (extend existing) |
| CAPT-02 | targets_outcome edge POST fires on save when outcome selected | unit | `npx vitest run src/components/graph/__tests__/InlineCaptureCard.test.tsx` | ✅ (extend existing) |
| CAPT-03 | content.expected_signals written to capture body when text provided | unit | `npx vitest run src/components/graph/__tests__/InlineCaptureCard.test.tsx` | ✅ (extend existing) |
| CAPT-04 | undirected hunches section renders with "consider linking" prompt | unit | `npx vitest run src/app/review/__tests__/ReviewPage.test.tsx` | ❌ Wave 0 |
| EXTR-01 | buildExtractionPrompt includes goal context when provided | unit | `npx vitest run src/lib/agents/__tests__/extraction.test.ts` | ✅ (extend existing) |
| EXTR-02 | parseExtractionResponse accepts goal_relevance field | unit | `npx vitest run src/lib/agents/__tests__/extraction.test.ts` | ✅ (extend existing) |
| EXTR-03 | parseExtractionResponse accepts expected_signals field | unit | `npx vitest run src/lib/agents/__tests__/extraction.test.ts` | ✅ (extend existing) |
| EXTR-04 | GoalRelevanceField renders Accept/Reject/Link actions | unit | `npx vitest run src/components/review/__tests__/GoalRelevanceField.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/app/review/__tests__/ReviewPage.test.tsx` — covers CAPT-04 (undirected hunches section)
- [ ] `src/components/review/__tests__/GoalRelevanceField.test.tsx` — covers EXTR-04 (Accept/Reject/Link UI)

*(All other test files exist and can be extended in-place)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/components/graph/InlineCaptureCard.tsx` (152 lines) — current form shape, goalSpaces pattern, advances_goal edge creation
- Direct codebase inspection — `src/lib/agents/extraction.ts` — full prompt, runExtraction signature, parseExtractionResponse validation
- Direct codebase inspection — `src/components/review/ReviewCard.tsx` — field rendering pattern, HumanReview build, connection actions
- Direct codebase inspection — `src/app/review/page.tsx` — server component, Supabase query pattern, grid layout
- Direct codebase inspection — `supabase/schema.sql` — content JSONB field confirmed, UNIQUE edge constraint confirmed
- Direct codebase inspection — `supabase/v0.4-migration.sql` — edge type directions confirmed for targets_outcome and indicates_progress
- Direct codebase inspection — `src/components/graph/GraphOSSurface.tsx` — triggerOutcomes already computed, props-down pattern confirmed
- Direct codebase inspection — `src/lib/types/nodes.ts` — LlmExtraction shape, HumanReview structure

### Secondary (MEDIUM confidence)
- None needed — all findings are from direct source inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new installs
- Architecture: HIGH — all patterns verified by direct code inspection
- Pitfalls: HIGH — derived from specific code details (edge direction in migration, content field in capture API, server component status of review page)

**Research date:** 2026-03-27
**Valid until:** Stable until codebase changes — these are implementation facts, not external library facts
