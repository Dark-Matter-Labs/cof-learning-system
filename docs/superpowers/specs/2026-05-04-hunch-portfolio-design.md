# COF OS v0.9 — HUNCH Lifecycle + Portfolio Engineering

**Date:** 2026-05-04  
**Status:** Approved  
**Scope:** Two features — HUNCH lifecycle rename and Portfolio Engineering workflow

---

## Overview

Two additions to v0.9:

1. **HUNCH lifecycle rename** — rename the 5 lifecycle stages to the HUNCH acronym (Hypothesis, Uncertainty, Navigation, Coherence, Holding) with `archived` as the terminal state. Adds a new stage `holding` between `coherence` and `archived`.

2. **Portfolio Engineering** — a structured 13-step workflow for moving from cascading risk to indicative portfolio to capital structure. Steps 1–8 fully wired with LLM agents; steps 9–13 scaffolded (UI visible, agents deferred). Graph integration, export, and multi-portfolio comparison deferred to v1.0.

---

## Part 1: HUNCH Lifecycle Rename

### Stage mapping

| Old | New | Definition |
|-----|-----|------------|
| divergence | hypothesis | Emergent intuition about a future risk, value field, or option |
| attractor | uncertainty | Structured map of what is unknown, testable, reducible, or constitutive |
| convergence | navigation | Pathway of inquiry, relationships, prototypes, evidence, sequencing |
| execution | coherence | Integration into credible field of value, legitimacy, governance, capital |
| *(new)* | holding | Disciplined institutional capacity to keep learning alive |
| archived | archived | Pruned, falsified, or transformed — unchanged |

### Type changes

`src/lib/lifecycle/autoPromote.ts`:
```typescript
export type LifecycleStage =
  | 'hypothesis'
  | 'uncertainty'
  | 'navigation'
  | 'coherence'
  | 'holding'
  | 'archived';
```

`src/lib/llm/index.ts` — add `portfolio` to `AgentName`:
```typescript
export type AgentName =
  | 'extraction' | 'review' | 'create' | 'reflection'
  | 'process' | 'setup' | 'query' | 'digest' | 'portfolio';

const AGENT_DEFAULT_MODELS: Record<string, string> = {
  // ...existing...
  portfolio: 'claude-sonnet-4-6',
};
```

### Auto-promote logic

Five transitions (replaces four):

| Transition | Condition |
|-----------|-----------|
| hypothesis → uncertainty | connectedAssumptions ≥ 2 OR connectedTests ≥ 1 |
| uncertainty → navigation | connectedTests ≥ 1 AND signalsReceived ≥ 1 |
| navigation → coherence | reinforcedEdges ≥ 2 AND activeCommitments ≥ 1 |
| coherence → holding | daysInCoherence ≥ 30 AND linkedLearnings ≥ 2 |
| holding → archived | manual only |

`signalsReceived` — count of signal nodes linked to any test node connected to this hunch (already computed as `testsWithSignals` in current code, reuse pattern).

`daysInCoherence` — derived from `stage_transitioned_at`: `(now - stage_transitioned_at).days` where `lifecycle_stage = 'coherence'`.

`linkedLearnings` — count of `node_type = 'learning'` nodes connected via any edge where `source_id = nodeId OR target_id = nodeId`.

The `HunchStats` interface gains two new fields:
```typescript
export interface HunchStats {
  readonly currentStage: LifecycleStage;
  readonly connectedAssumptions: number;
  readonly connectedTests: number;
  readonly reinforcedEdges: number;
  readonly linkedCommitments: number;
  readonly activeCommitments: number;
  readonly testsWithSignals: number;
  readonly daysInCurrentStage: number;   // new
  readonly linkedLearnings: number;       // new
}
```

### SQL migration: `supabase/v0.9-hunch-lifecycle.sql`

Dual-constraint migration — add new values, migrate data, tighten constraint:

```sql
-- Step 1: widen constraint to accept both old and new values
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_lifecycle_stage_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_lifecycle_stage_check
  CHECK (lifecycle_stage IN (
    'hypothesis','uncertainty','navigation','coherence','holding','archived',
    'divergence','attractor','convergence','execution'
  ));

-- Step 2: migrate existing data
UPDATE nodes SET lifecycle_stage = 'hypothesis'  WHERE lifecycle_stage = 'divergence';
UPDATE nodes SET lifecycle_stage = 'uncertainty' WHERE lifecycle_stage = 'attractor';
UPDATE nodes SET lifecycle_stage = 'navigation'  WHERE lifecycle_stage = 'convergence';
UPDATE nodes SET lifecycle_stage = 'coherence'   WHERE lifecycle_stage = 'execution';

-- Step 3: update default
ALTER TABLE nodes ALTER COLUMN lifecycle_stage SET DEFAULT 'hypothesis';

-- Step 4: tighten to new values only
ALTER TABLE nodes DROP CONSTRAINT nodes_lifecycle_stage_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_lifecycle_stage_check
  CHECK (lifecycle_stage IN ('hypothesis','uncertainty','navigation','coherence','holding','archived'));
```

### UI changes

**`LifecycleBands.tsx`** — 5 bands, `holding` gets the green glow treatment (gradient background + left border + inset shadow):

```typescript
const BANDS = [
  { stage: 'hypothesis',  label: 'Hypothesis',  color: 'text-gray-400' },
  { stage: 'uncertainty', label: 'Uncertainty', color: 'text-node-hunch' },  // amber
  { stage: 'navigation',  label: 'Navigation',  color: 'text-node-assumption-bg' },  // blue
  { stage: 'coherence',   label: 'Coherence',   color: 'text-node-commitment' },  // purple
  { stage: 'holding',     label: 'Holding',     color: 'text-emerald-400', glow: true },
] as const;

export const STAGE_X_POSITIONS: Record<string, number> = {
  hypothesis:  0.1,
  uncertainty: 0.3,
  navigation:  0.5,
  coherence:   0.7,
  holding:     0.9,
};
```

The `holding` band renders with `background: linear-gradient(90deg, #0a1a10, #0f2518)`, `border-left: 2px solid #10b981`, and `box-shadow: inset 0 0 12px rgba(16,185,129,0.15)`. The `bandWidth` calculation updates from `width / 4` to `width / 5`.

**`NodeDetailPanel.tsx`** — lifecycle prompts updated with HUNCH vocabulary:

| Stage | Threshold | Prompt |
|-------|-----------|--------|
| hypothesis | 7 days | "This hypothesis has been sitting for N days. Time to map the uncertainty: [Connect an assumption] [Archive it]" |
| uncertainty | 14 days | "Uncertainties mapped but untested. What probe generates the most informative signal? [Design a test]" |
| navigation | 14 days | "Inquiry active but not yet integrated. What would moving toward coherence require? [Connect to a commitment]" |
| coherence | 0 days | "The field is coherent. What's the holding pattern? Who carries this through time? [Capture a learning]" |
| holding | 0 days | "This is live capability. What's the current state of learning? [Capture an outcome]" |

**Dashboard** — "Hunches in flight" metric updated to use new stage names in breakdown.

### HUNCH explainer modal

New component `src/components/shared/HunchExplainer.tsx` — a dialog triggered by a `?` icon near any lifecycle stage badge.

Content: acronym expansion — Hypothesis, Uncertainty, Navigation, Coherence, Holding — with one-line definition for each. Tagline: *"Hypothesis under uncertainty, navigated into coherence and held through learning."*

The `?` icon appears in: NodeDetailPanel stage badge area, LifecycleBands header, dashboard hunch count metric.

---

## Part 2: Portfolio Engineering

### Scope for v0.9

- **Steps 1–8 fully wired**: LLM agents defined and connected, generate/refine/accept UI working
- **Steps 9–13 scaffolded**: UI renders, "Generate" button shows a "Coming soon" toast
- **Deferred to v1.0**: graph integration (push/pull), PDF/deck export, multi-portfolio comparison

### Database: `supabase/v0.9-portfolios.sql`

```sql
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  status TEXT DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'complete', 'paused', 'archived')),
  current_step INT DEFAULT 1 CHECK (current_step BETWEEN 1 AND 13),
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  step_number INT NOT NULL CHECK (step_number BETWEEN 1 AND 13),
  step_name TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  ai_suggestions JSONB,
  human_input TEXT,
  status TEXT DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'ai_drafted', 'in_review', 'complete')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, step_number)
);

CREATE INDEX idx_portfolio_steps_portfolio ON portfolio_steps(portfolio_id);
CREATE INDEX idx_portfolios_author ON portfolios(author_id);
CREATE INDEX idx_portfolios_status ON portfolios(status);
```

Row-level security: users can only read/write their own portfolios (same pattern as nodes).

### API routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/portfolios` | List all portfolios for authenticated user |
| POST | `/api/portfolios` | Create new portfolio, seed all 13 step rows |
| GET | `/api/portfolios/[id]` | Get portfolio + all steps |
| PATCH | `/api/portfolios/[id]` | Update title/subtitle/description/status |
| GET | `/api/portfolios/[id]/steps/[step]` | Get single step content |
| PATCH | `/api/portfolios/[id]/steps/[step]` | Save step content (human edit or accept) |
| POST | `/api/portfolios/[id]/steps/[step]/generate` | Trigger LLM agent for step |

Creating a portfolio (POST `/api/portfolios`) inserts the portfolio row and seeds all 13 `portfolio_steps` rows in a single transaction, so the detail page always has all 13 rows to render.

### LLM agent structure

`src/lib/portfolio/agents.ts` — exports `STEP_AGENTS: Record<number, StepAgentConfig>` for steps 1–13 (steps 9–13 marked `implemented: false`).

`src/lib/portfolio/generate.ts` — exports `generateStepContent(portfolioId: string, stepNumber: number): Promise<string>`:
1. Fetch portfolio + all completed prior steps from DB
2. Build system prompt from `STEP_AGENTS[stepNumber].prompt`
3. Interpolate prior step content into user message
4. Call `callLLM('portfolio', { systemPrompt, userMessage })`

`callLLM` handles caching automatically via `hashRequest` (keyed on model + system prompt + user message) — the portfolio agent name routes to `claude-sonnet-4-6`. Re-generating the same step with unchanged prior content is a cache hit.

### Pages and components

**`src/app/portfolios/page.tsx`** — server component, fetches list, renders `PortfolioList`.

**`src/components/portfolio/PortfolioList.tsx`** — grid of cards. Each card: title, subtitle, progress bar (`current_step / 13`), "Step N of 13" label.

**`src/app/portfolios/[id]/page.tsx`** — server component, fetches portfolio + steps, renders `PortfolioDetail`.

**`src/components/portfolio/PortfolioDetail.tsx`** — split-view container. Left: `StepNavigator`. Right: `StepView` for active step.

**`src/components/portfolio/StepNavigator.tsx`** — 13-step list. Each row: status icon (✓ complete / ▶ active / ○ not started), step name, click to navigate. Receives `steps` array and `activeStep` number.

**`src/components/portfolio/StepView.tsx`** — renders active step. States:
- `not_started`: description + "Generate AI draft" button
- `ai_drafted`: AI content block + Refine / Edit / Accept buttons
- `in_review`: editable textarea + Save / Accept buttons  
- `complete`: locked content summary + "Re-open" link

For steps 9–13 (unimplemented agents): "Generate AI draft" shows a toast: *"This step is coming in a future update."* Step is still navigable and human input still saveable.

**`src/components/portfolio/StepAIContent.tsx`** — renders the AI draft in a styled block with the agent name header (`✦ AI DRAFT — Portfolio Composer`).

### Step interaction flow

1. User navigates to a step
2. If `not_started`: shows step description + "Generate AI draft" button
3. Click generate → POST to `/api/portfolios/[id]/steps/[step]/generate` → awaits LLM response → saves to `ai_suggestions`, status becomes `ai_drafted`
4. User can: **Refine** (opens inline textarea; sends refinement instruction + prior draft to LLM as a follow-up call, updates `ai_suggestions`), **Edit** (direct edit of the content in textarea, status → `in_review`), **Accept** (saves content, status → `complete`, advances `portfolio.current_step`)
5. Complete step content is frozen in DB and used as context for all subsequent step generations

### Navigation update

`src/components/layout/NavBar.tsx` and `src/components/layout/MobileNav.tsx` — add Portfolios between Graph and Commitments:

```typescript
const links = [
  { href: '/',            label: 'Dashboard' },
  { href: '/graph',       label: 'Graph' },
  { href: '/portfolios',  label: 'Portfolios' },  // new
  { href: '/commitments', label: 'Commitments' },
  { href: '/query',       label: 'Query' },
  { href: '/review',      label: 'Health' },
  { href: '/reflect',     label: 'Reflect' },
  { href: '/settings',    label: 'Settings' },
];
```

---

## Part 3: HUNCH ↔ Portfolio connection

When a portfolio reaches milestones, the linked knowledge can inform hunch lifecycle progression. This is a conceptual link for now — the graph integration (explicit node sync) is deferred to v1.0. In v0.9 the two features are independent but share vocabulary: portfolio steps 1–2 map to Hypothesis, 3–5 to Uncertainty, 6–8 to Navigation, 9–11 to Coherence, 12–13 to Holding.

---

## Build order

1. SQL migration: `v0.9-hunch-lifecycle.sql` — rename stages, add holding
2. `autoPromote.ts` — new `LifecycleStage` type, updated `HunchStats`, five transitions
3. `llm/index.ts` — add `portfolio` agent name
4. UI sweep — `LifecycleBands`, `NodeDetailPanel` prompts, dashboard breakdown
5. `HunchExplainer` modal component
6. SQL migration: `v0.9-portfolios.sql`
7. `lib/portfolio/agents.ts` + `lib/portfolio/generate.ts`
8. API routes: portfolios CRUD + generate endpoint
9. `PortfolioList` + `/portfolios` page
10. `PortfolioDetail`, `StepNavigator`, `StepView`, `StepAIContent` + `/portfolios/[id]` page
11. Nav update (NavBar + MobileNav)
12. Tests: autoPromote unit tests, portfolio API integration tests, component tests for StepView states

---

## Files created / modified

**New files:**
- `supabase/v0.9-hunch-lifecycle.sql`
- `supabase/v0.9-portfolios.sql`
- `src/lib/portfolio/agents.ts`
- `src/lib/portfolio/generate.ts`
- `src/components/shared/HunchExplainer.tsx`
- `src/components/portfolio/PortfolioList.tsx`
- `src/components/portfolio/PortfolioDetail.tsx`
- `src/components/portfolio/StepNavigator.tsx`
- `src/components/portfolio/StepView.tsx`
- `src/components/portfolio/StepAIContent.tsx`
- `src/app/portfolios/page.tsx`
- `src/app/portfolios/[id]/page.tsx`
- `src/app/api/portfolios/route.ts`
- `src/app/api/portfolios/[id]/route.ts`
- `src/app/api/portfolios/[id]/steps/[step]/route.ts`
- `src/app/api/portfolios/[id]/steps/[step]/generate/route.ts`

**Modified files:**
- `src/lib/lifecycle/autoPromote.ts`
- `src/lib/llm/index.ts`
- `src/components/graph/LifecycleBands.tsx`
- `src/components/graph/NodeDetailPanel.tsx`
- `src/components/graph/convergence/ConvergenceSparkline.tsx`
- `src/components/layout/NavBar.tsx`
- `src/components/layout/MobileNav.tsx`
- `src/app/page.tsx` (dashboard hunch breakdown)
- All test files referencing old stage names

---

## Out of scope (v1.0)

- Graph integration: push step content → nodes, pull graph nodes into step context
- PDF / deck / one-pager export
- Multi-portfolio comparison view (`/portfolios/compare`)
- Steps 9–13 agent implementation
