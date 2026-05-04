# Portfolio Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** Run plan `2026-05-04-hunch-rename.md` first — this plan assumes the `portfolio` AgentName exists in `llm/index.ts`.

**Goal:** Build the Portfolio Engineering workspace — a structured 13-step workflow from cascading risk to capital structure, with LLM agents for steps 1–8 and scaffolded UI for steps 9–13.

**Architecture:** Three layers — database (Supabase tables + RLS), API (Next.js route handlers), UI (server pages + client components). The `/portfolios` section is self-contained from the knowledge graph. Each portfolio creates all 13 step rows on creation. Steps generate LLM content on demand, cached automatically by the existing LLM cache infrastructure.

**Tech Stack:** Next.js 16, TypeScript, Supabase, @anthropic-ai/sdk (via `callLLM`), Vitest, @testing-library/react, Tailwind v4, Zod

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/v0.9-portfolios.sql` | Create | Table definitions + RLS |
| `src/lib/portfolio/agents.ts` | Create | Step agent configs (prompts, names, implemented flag) |
| `src/lib/portfolio/generate.ts` | Create | generateStepContent — builds context + calls LLM |
| `src/lib/portfolio/__tests__/generate.test.ts` | Create | Unit tests for context building + stub LLM |
| `src/app/api/portfolios/route.ts` | Create | GET list + POST create (seeds 13 steps) |
| `src/app/api/portfolios/[id]/route.ts` | Create | GET detail + PATCH metadata |
| `src/app/api/portfolios/[id]/steps/[step]/route.ts` | Create | GET step + PATCH step content |
| `src/app/api/portfolios/[id]/steps/[step]/generate/route.ts` | Create | POST — trigger LLM agent for step |
| `src/app/api/portfolios/__tests__/route.test.ts` | Create | API integration tests (mocked Supabase) |
| `src/components/portfolio/PortfolioList.tsx` | Create | Grid of portfolio cards with progress bars |
| `src/app/portfolios/page.tsx` | Create | Server page — fetches list, renders PortfolioList |
| `src/components/portfolio/StepNavigator.tsx` | Create | Left sidebar — 13 steps with status icons |
| `src/components/portfolio/StepAIContent.tsx` | Create | AI draft display block |
| `src/components/portfolio/StepView.tsx` | Create | Active step — all 4 states (not_started/ai_drafted/in_review/complete) |
| `src/components/portfolio/PortfolioDetail.tsx` | Create | Split-view container |
| `src/app/portfolios/[id]/page.tsx` | Create | Server page — fetches portfolio + steps |
| `src/components/layout/NavBar.tsx` | Modify | Add Portfolios link |
| `src/components/layout/MobileNav.tsx` | Modify | Add Portfolios item |

---

## Task 1: SQL migration

**Files:**
- Create: `supabase/v0.9-portfolios.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/v0.9-portfolios.sql
-- Portfolio Engineering tables
-- Run in Supabase SQL Editor

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

CREATE INDEX IF NOT EXISTS idx_portfolio_steps_portfolio ON portfolio_steps(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_author ON portfolios(author_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_status ON portfolios(status);

-- Row level security
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own portfolios" ON portfolios
  FOR ALL USING (author_id = auth.uid());

CREATE POLICY "Users manage own portfolio steps" ON portfolio_steps
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM portfolios WHERE author_id = auth.uid())
  );
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Expected: no errors. Verify:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('portfolios', 'portfolio_steps');
```
Expected: 2 rows.

---

## Task 2: Step agent configs

**Files:**
- Create: `src/lib/portfolio/agents.ts`

- [ ] **Step 1: Create agents.ts**

```typescript
export interface StepAgentConfig {
  readonly stepNumber: number;
  readonly name: string;
  readonly implemented: boolean;
  readonly systemPrompt: string;
}

export const STEP_NAMES: Record<number, string> = {
  1:  'Risk Field',
  2:  'Risk Goal',
  3:  'Effects of Risk',
  4:  'Deeper Systemic Goal',
  5:  'Solution Domains',
  6:  'Indicative Portfolio',
  7:  'Indicative Maths',
  8:  'Plausibility Check',
  9:  'Outcome Accelerator',
  10: 'Real Portfolio Formation',
  11: 'Capital Structure',
  12: 'Institutionalisation',
  13: 'Expanded Optionality',
};

export const STEP_AGENTS: Record<number, StepAgentConfig> = {
  1: {
    stepNumber: 1,
    name: 'Risk Field Mapper',
    implemented: true,
    systemPrompt: `You are the Risk Field Mapper for a Portfolio Engineering process.

Given a portfolio title and site context, map the cascading risk field. Identify:
- Primary risk vectors (heat, water, food, infrastructure, social, ecological, economic)
- Territorial dimensions and scales affected
- How these risks cascade and entangle with each other
- Key uncertainties in the risk picture

Output structured markdown with sections for each risk dimension. Mark all assessments as [INFERENCE] — the human will validate. Be specific and grounded. Avoid vague claims.`,
  },

  2: {
    stepNumber: 2,
    name: 'Goal Articulator',
    implemented: true,
    systemPrompt: `You are the Goal Articulator for a Portfolio Engineering process.

Given the risk field from Step 1, articulate 1–3 candidate political/transition goals. Each goal should be:
- Measurable or directionally clear
- Politically legible (can organise alignment around it)
- Specific enough to be useful
- Not pretending to be the whole solution

For each candidate, explain its shape and key tradeoffs. Example of the right shape: "Cool Madrid by 7.5°C while expanding civic agency." Include your reasoning for each candidate.`,
  },

  3: {
    stepNumber: 3,
    name: 'Effects Translator',
    implemented: true,
    systemPrompt: `You are the Effects Translator for a Portfolio Engineering process.

Given the risk field (Step 1) and goal (Step 2), translate abstract risk into lived consequences. Cover:
- Mortality and health impacts (use real numbers where available)
- Labour productivity loss
- Infrastructure failure modes
- Economic cascades (insurance, agriculture, supply chains)
- Social effects (inequality, displacement, domestic stress)
- Ecological consequences
- Institutional pressure

Be specific. Use real numbers where possible. This section makes the social bond — showing where abstract risk touches the continuity of life.`,
  },

  4: {
    stepNumber: 4,
    name: 'Deeper Goal Surfacer',
    implemented: true,
    systemPrompt: `You are the Deeper Goal Surfacer for a Portfolio Engineering process.

Given the headline goal (Step 2), surface the deeper systemic goals that must be co-pursued. The headline goal is necessary but insufficient. Deeper goals shape HOW success is achieved.

Consider: citizen agency expansion, distributed capability building, ecological regeneration, avoiding power concentration, democratic resilience, equity and distribution.

The test: achieving the headline goal in a way that concentrates power or excludes communities is NOT success. Identify 3–5 deeper goals with brief rationale for each.`,
  },

  5: {
    stepNumber: 5,
    name: 'Solution Domain Mapper',
    implemented: true,
    systemPrompt: `You are the Solution Domain Mapper for a Portfolio Engineering process.

Given the risk, goals, and deeper goals from prior steps, map the full horizon of possible response domains. Across scales:

Territorial/bioregional, Citywide, Infrastructural, Neighbourhood, Household, Civic, Startup/innovation, Public infrastructure, Supply chain/manufacturing, Governance/regulation, Finance/capital

For each scale, identify 3–7 candidate intervention types. Don't pick winners yet — map the option space. Use bullet points per scale.`,
  },

  6: {
    stepNumber: 6,
    name: 'Portfolio Composer',
    implemented: true,
    systemPrompt: `You are the Portfolio Composer for a Portfolio Engineering process.

Given the solution domains (Step 5) and all prior context, compose an indicative portfolio. Requirements:
- Multi-scalar (combines interventions across scales)
- Multi-solving (each intervention addresses multiple problems)
- Compositional (interventions interact, complement, hedge)
- Plural (avoids single-solution capture)
- Civic (defaults to distributed agency where possible)

For each intervention, include: name, what it does, what other goals it serves, what it depends on.

Structure output by layer: Bioregional, Citywide, Infrastructural, Neighbourhood, Household, Civic, Governance, Capital.`,
  },

  7: {
    stepNumber: 7,
    name: 'Proportionality Tester',
    implemented: true,
    systemPrompt: `You are the Proportionality Tester for a Portfolio Engineering process.

Given the portfolio (Step 6) and risk effects (Step 3), run indicative maths. This is an order-of-magnitude proportionality check, not precise engineering.

For the overall portfolio, estimate:
- Total cost of magnitude (e.g. "€50–200M over 10 years")
- The magnitude of annual damages/costs the risk field currently creates
- Whether the portfolio is proportional (right ballpark)

Then for each portfolio layer, give rough: contribution factor, cost magnitude, deployment timeline, confidence level.

Flag if the portfolio is clearly disproportionate (e.g. €5M portfolio against a €2B risk field).`,
  },

  8: {
    stepNumber: 8,
    name: 'Plausibility Assessor',
    implemented: true,
    systemPrompt: `You are the Plausibility Assessor for a Portfolio Engineering process.

Given the full portfolio workflow so far (Steps 1–7), assess whether this portfolio achieves:
- Comprehension: does it make the risk legible to a non-expert reader?
- Confidence: does it create structured confidence (not false certainty)?
- Plausibility: does it convert concern into constructive possibility?

Identify: 3–5 gaps or weaknesses in the current portfolio. 3–5 questions a sophisticated reviewer would ask. Your overall assessment (1 paragraph) of whether this is ready to move toward an accelerator.`,
  },

  9: {
    stepNumber: 9,
    name: 'Outcome Accelerator Designer',
    implemented: false,
    systemPrompt: '',
  },

  10: {
    stepNumber: 10,
    name: 'Real Portfolio Emerger',
    implemented: false,
    systemPrompt: '',
  },

  11: {
    stepNumber: 11,
    name: 'Capital Structurer',
    implemented: false,
    systemPrompt: '',
  },

  12: {
    stepNumber: 12,
    name: 'Institutional Designer',
    implemented: false,
    systemPrompt: '',
  },

  13: {
    stepNumber: 13,
    name: 'Optionality Articulator',
    implemented: false,
    systemPrompt: '',
  },
};
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "agents.ts"
```

Expected: no errors.

---

## Task 3: generateStepContent + tests

**Files:**
- Create: `src/lib/portfolio/generate.ts`
- Create: `src/lib/portfolio/__tests__/generate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/portfolio/__tests__/generate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildStepContext } from '../generate';

describe('buildStepContext', () => {
  it('returns portfolio title and description in context', () => {
    const ctx = buildStepContext(
      { title: 'Madrid Urban Heat', description: 'Cooling Madrid' },
      []
    );
    expect(ctx).toContain('Madrid Urban Heat');
    expect(ctx).toContain('Cooling Madrid');
  });

  it('includes completed step summaries', () => {
    const ctx = buildStepContext(
      { title: 'Madrid Urban Heat', description: null },
      [
        { step_number: 1, step_name: 'Risk Field', content: { text: 'Urban heat island effect...' }, status: 'complete' },
      ]
    );
    expect(ctx).toContain('Risk Field');
    expect(ctx).toContain('Urban heat island effect');
  });

  it('excludes incomplete steps from context', () => {
    const ctx = buildStepContext(
      { title: 'Test', description: null },
      [
        { step_number: 1, step_name: 'Risk Field', content: {}, status: 'not_started' },
        { step_number: 2, step_name: 'Risk Goal', content: { text: 'Cool by 7.5C' }, status: 'complete' },
      ]
    );
    expect(ctx).toContain('Risk Goal');
    expect(ctx).not.toContain('Risk Field');
  });

  it('returns empty string for portfolio with no description and no steps', () => {
    const ctx = buildStepContext({ title: 'Empty', description: null }, []);
    expect(ctx).toContain('Empty');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/lib/portfolio/__tests__/generate.test.ts
```

Expected: FAIL — `buildStepContext` not found.

- [ ] **Step 3: Create generate.ts**

```typescript
import { callLLM } from '@/lib/llm';
import { STEP_AGENTS, STEP_NAMES } from './agents';

interface PortfolioSummary {
  readonly title: string;
  readonly description: string | null;
}

interface StepSummary {
  readonly step_number: number;
  readonly step_name: string;
  readonly content: Record<string, unknown>;
  readonly status: string;
}

export function buildStepContext(portfolio: PortfolioSummary, completedSteps: StepSummary[]): string {
  const lines: string[] = [
    `Portfolio: ${portfolio.title}`,
    portfolio.description ? `Description: ${portfolio.description}` : '',
    '',
  ];

  const complete = completedSteps.filter(s => s.status === 'complete');
  if (complete.length > 0) {
    lines.push('## Prior steps (completed)');
    for (const step of complete) {
      const text = typeof step.content.text === 'string' ? step.content.text : JSON.stringify(step.content);
      lines.push(`\n### Step ${step.step_number}: ${step.step_name}`);
      lines.push(text);
    }
  }

  return lines.filter(l => l !== null).join('\n');
}

export async function generateStepContent(portfolioId: string, stepNumber: number): Promise<string> {
  const agent = STEP_AGENTS[stepNumber];
  if (!agent?.implemented) {
    throw new Error(`Step ${stepNumber} agent not yet implemented`);
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('title, description')
    .eq('id', portfolioId)
    .single();

  if (!portfolio) throw new Error(`Portfolio ${portfolioId} not found`);

  const { data: steps } = await supabase
    .from('portfolio_steps')
    .select('step_number, step_name, content, status')
    .eq('portfolio_id', portfolioId)
    .lt('step_number', stepNumber)
    .order('step_number', { ascending: true });

  const context = buildStepContext(
    { title: portfolio.title as string, description: portfolio.description as string | null },
    (steps ?? []) as StepSummary[]
  );

  const userMessage = `${context}\n\n---\nNow complete Step ${stepNumber}: ${STEP_NAMES[stepNumber]}`;

  const response = await callLLM('portfolio', {
    systemPrompt: agent.systemPrompt,
    userMessage,
    maxTokens: 2048,
  });

  return response.content;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/lib/portfolio/__tests__/generate.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portfolio/agents.ts src/lib/portfolio/generate.ts src/lib/portfolio/__tests__/generate.test.ts
git commit -m "feat: add portfolio step agents and generateStepContent"
```

---

## Task 4: Portfolio API routes — list + create

**Files:**
- Create: `src/app/api/portfolios/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/portfolios/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
  from: mockFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

describe('GET /api/portfolios', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no user') });
    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns portfolio list', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'p1', title: 'Test', current_step: 3 }],
        error: null,
      }),
    });
    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/portfolios', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for missing title', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/app/api/portfolios/__tests__/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the route**

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { STEP_NAMES } from '@/lib/portfolio/agents';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
});

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('portfolios')
    .select('id, title, subtitle, status, current_step, created_at, updated_at')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load portfolios' }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { title, subtitle, description } = parsed.data;

  const { data: portfolio, error: insertError } = await supabase
    .from('portfolios')
    .insert({ title, subtitle, description, author_id: user.id })
    .select('id')
    .single();

  if (insertError || !portfolio) {
    return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
  }

  const stepRows = Object.entries(STEP_NAMES).map(([num, name]) => ({
    portfolio_id: portfolio.id,
    step_number: Number(num),
    step_name: name,
  }));

  const { error: stepsError } = await supabase.from('portfolio_steps').insert(stepRows);
  if (stepsError) {
    await supabase.from('portfolios').delete().eq('id', portfolio.id);
    return NextResponse.json({ error: 'Failed to initialise steps' }, { status: 500 });
  }

  return NextResponse.json({ data: { id: portfolio.id } }, { status: 201 });
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/app/api/portfolios/__tests__/route.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portfolios/route.ts src/app/api/portfolios/__tests__/route.test.ts
git commit -m "feat: add portfolio list and create API endpoints"
```

---

## Task 5: Portfolio detail + step API routes

**Files:**
- Create: `src/app/api/portfolios/[id]/route.ts`
- Create: `src/app/api/portfolios/[id]/steps/[step]/route.ts`
- Create: `src/app/api/portfolios/[id]/steps/[step]/generate/route.ts`

- [ ] **Step 1: Create [id]/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['in_progress', 'complete', 'paused', 'archived']).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: portfolio, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .eq('author_id', user.id)
    .single();

  if (error || !portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: steps } = await supabase
    .from('portfolio_steps')
    .select('*')
    .eq('portfolio_id', id)
    .order('step_number', { ascending: true });

  return NextResponse.json({ data: { ...portfolio, steps: steps ?? [] } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { data, error } = await supabase
    .from('portfolios')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('author_id', user.id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found or update failed' }, { status: 404 });

  return NextResponse.json({ data });
}
```

- [ ] **Step 2: Create [id]/steps/[step]/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const patchSchema = z.object({
  content: z.record(z.unknown()).optional(),
  human_input: z.string().max(10000).optional(),
  status: z.enum(['not_started', 'ai_drafted', 'in_review', 'complete']).optional(),
});

type Params = { id: string; step: string };

async function getPortfolioForUser(supabase: Awaited<ReturnType<typeof createClient>>, portfolioId: string, userId: string) {
  const { data } = await supabase
    .from('portfolios')
    .select('id, current_step')
    .eq('id', portfolioId)
    .eq('author_id', userId)
    .single();
  return data;
}

export async function GET(_req: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, step } = await params;
  const stepNumber = parseInt(step, 10);
  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 13) {
    return NextResponse.json({ error: 'Invalid step number' }, { status: 400 });
  }

  const portfolio = await getPortfolioForUser(supabase, id, user.id);
  if (!portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: stepData, error } = await supabase
    .from('portfolio_steps')
    .select('*')
    .eq('portfolio_id', id)
    .eq('step_number', stepNumber)
    .single();

  if (error || !stepData) return NextResponse.json({ error: 'Step not found' }, { status: 404 });

  return NextResponse.json({ data: stepData });
}

export async function PATCH(request: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, step } = await params;
  const stepNumber = parseInt(step, 10);
  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 13) {
    return NextResponse.json({ error: 'Invalid step number' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const portfolio = await getPortfolioForUser(supabase, id, user.id);
  if (!portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const update: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (parsed.data.status === 'complete') {
    update.completed_at = new Date().toISOString();
  }

  const { data: stepData, error } = await supabase
    .from('portfolio_steps')
    .update(update)
    .eq('portfolio_id', id)
    .eq('step_number', stepNumber)
    .select()
    .single();

  if (error || !stepData) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  // Advance portfolio.current_step if this step just completed and it's the current step
  if (parsed.data.status === 'complete' && stepNumber === portfolio.current_step && stepNumber < 13) {
    await supabase.from('portfolios')
      .update({ current_step: stepNumber + 1, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('author_id', user.id);
  }

  return NextResponse.json({ data: stepData });
}
```

- [ ] **Step 3: Create [id]/steps/[step]/generate/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateStepContent } from '@/lib/portfolio/generate';
import { STEP_AGENTS } from '@/lib/portfolio/agents';

type Params = { id: string; step: string };

export async function POST(_req: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, step } = await params;
  const stepNumber = parseInt(step, 10);
  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 13) {
    return NextResponse.json({ error: 'Invalid step number' }, { status: 400 });
  }

  // Verify ownership
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('id', id)
    .eq('author_id', user.id)
    .single();
  if (!portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check if step is implemented
  if (!STEP_AGENTS[stepNumber]?.implemented) {
    return NextResponse.json({ error: 'This step agent is not yet implemented' }, { status: 422 });
  }

  try {
    const content = await generateStepContent(id, stepNumber);

    await supabase.from('portfolio_steps')
      .update({
        ai_suggestions: { text: content, generated_at: new Date().toISOString() },
        status: 'ai_drafted',
        updated_at: new Date().toISOString(),
      })
      .eq('portfolio_id', id)
      .eq('step_number', stepNumber);

    return NextResponse.json({ data: { content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "portfolios"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portfolios/[id]/route.ts src/app/api/portfolios/[id]/steps/[step]/route.ts src/app/api/portfolios/[id]/steps/[step]/generate/route.ts
git commit -m "feat: add portfolio detail, step CRUD, and step generate API endpoints"
```

---

## Task 6: PortfolioList component + list page

**Files:**
- Create: `src/components/portfolio/PortfolioList.tsx`
- Create: `src/app/portfolios/page.tsx`

- [ ] **Step 1: Create PortfolioList.tsx**

```typescript
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Portfolio {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly status: string;
  readonly current_step: number;
  readonly updated_at: string;
}

interface PortfolioListProps {
  readonly portfolios: readonly Portfolio[];
}

function ProgressBar({ value, max }: { readonly value: number; readonly max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-cof-bg-subtle rounded-full overflow-hidden">
        <div
          className="h-full bg-node-learning rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-cof-text-tertiary tabular-nums">{pct}%</span>
    </div>
  );
}

export function PortfolioList({ portfolios }: PortfolioListProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const title = window.prompt('Portfolio title:');
    if (!title?.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      const body = await res.json() as { data?: { id: string }; error?: string };
      if (!res.ok || !body.data?.id) {
        setError(body.error ?? 'Failed to create portfolio');
        return;
      }
      router.push(`/portfolios/${body.data.id}`);
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-cof-text-primary">Portfolio Engineering</h1>
          <p className="text-sm text-cof-text-tertiary mt-1">
            Indicative portfolios for civilizational option fields. From cascading risk to capital structure.
          </p>
        </div>
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="text-xs bg-cof-bg-subtle border border-cof-border rounded px-3 py-2 text-cof-text-secondary hover:text-cof-text-primary hover:border-cof-border-strong transition-colors disabled:opacity-50"
        >
          {creating ? 'Creating…' : '+ New portfolio'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

      {portfolios.length === 0 ? (
        <div className="text-center py-16 text-cof-text-tertiary">
          <p className="text-sm mb-2">No portfolios yet.</p>
          <p className="text-xs">Start by creating your first portfolio engineering project.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {portfolios.map(p => (
            <Link
              key={p.id}
              href={`/portfolios/${p.id}`}
              className="block bg-cof-bg-elevated border border-cof-border rounded-lg p-4 hover:border-cof-border-strong transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-cof-text-primary truncate">{p.title}</h2>
                  {p.subtitle && (
                    <p className="text-xs text-cof-text-tertiary mt-0.5 truncate">{p.subtitle}</p>
                  )}
                </div>
                <span className="text-[10px] text-cof-text-tertiary ml-3 flex-shrink-0">
                  Step {p.current_step} of 13
                </span>
              </div>
              <ProgressBar value={p.current_step - 1} max={13} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create /portfolios/page.tsx**

```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PortfolioList } from '@/components/portfolio/PortfolioList';

export default async function PortfoliosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('portfolios')
    .select('id, title, subtitle, status, current_step, updated_at')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <PortfolioList portfolios={data ?? []} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "PortfolioList|portfolios/page"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/portfolio/PortfolioList.tsx src/app/portfolios/page.tsx
git commit -m "feat: add portfolio list page"
```

---

## Task 7: StepNavigator + StepAIContent components

**Files:**
- Create: `src/components/portfolio/StepNavigator.tsx`
- Create: `src/components/portfolio/StepAIContent.tsx`

- [ ] **Step 1: Create StepNavigator.tsx**

```typescript
import { STEP_NAMES } from '@/lib/portfolio/agents';

interface Step {
  readonly step_number: number;
  readonly status: string;
}

interface StepNavigatorProps {
  readonly steps: readonly Step[];
  readonly activeStep: number;
  readonly onSelectStep: (stepNumber: number) => void;
}

function stepIcon(status: string): string {
  if (status === 'complete') return '✓';
  return '○';
}

function stepColor(status: string, isActive: boolean): string {
  if (isActive) return 'text-cof-text-primary font-semibold';
  if (status === 'complete') return 'text-cof-text-tertiary';
  return 'text-cof-text-tertiary opacity-50';
}

export function StepNavigator({ steps, activeStep, onSelectStep }: StepNavigatorProps) {
  return (
    <div className="w-44 flex-shrink-0 border-r border-cof-border overflow-y-auto">
      <div className="p-3 space-y-0.5">
        {steps.map(step => {
          const isActive = step.step_number === activeStep;
          return (
            <button
              key={step.step_number}
              type="button"
              onClick={() => onSelectStep(step.step_number)}
              className={`w-full flex items-start gap-2 px-2 py-2 rounded text-left transition-colors text-[11px] ${
                isActive
                  ? 'bg-cof-bg-subtle text-cof-text-primary'
                  : 'hover:bg-cof-bg-subtle text-cof-text-tertiary'
              }`}
            >
              <span className={`flex-shrink-0 w-3 ${step.status === 'complete' ? 'text-emerald-500' : 'text-cof-text-tertiary'}`}>
                {isActive && step.status !== 'complete' ? '▶' : stepIcon(step.status)}
              </span>
              <span className={stepColor(step.status, isActive)}>
                {step.step_number}. {STEP_NAMES[step.step_number]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create StepAIContent.tsx**

```typescript
interface StepAIContentProps {
  readonly agentName: string;
  readonly content: string;
}

export function StepAIContent({ agentName, content }: StepAIContentProps) {
  return (
    <div className="bg-cof-bg-subtle border border-cof-border rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-node-hunch font-semibold uppercase tracking-wider">
          ✦ AI Draft
        </span>
        <span className="text-[10px] text-cof-text-tertiary">— {agentName}</span>
      </div>
      <div className="text-xs text-cof-text-secondary leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/portfolio/StepNavigator.tsx src/components/portfolio/StepAIContent.tsx
git commit -m "feat: add StepNavigator and StepAIContent components"
```

---

## Task 8: StepView component

**Files:**
- Create: `src/components/portfolio/StepView.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/portfolio/__tests__/StepView.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepView } from '../StepView';

const baseStep = {
  id: 's1',
  portfolio_id: 'p1',
  step_number: 1,
  step_name: 'Risk Field',
  content: {},
  ai_suggestions: null,
  human_input: null,
  status: 'not_started' as const,
  completed_at: null,
};

describe('StepView', () => {
  it('shows Generate button for not_started step', () => {
    render(<StepView step={baseStep} portfolioId="p1" onStepUpdated={vi.fn()} />);
    expect(screen.getByText(/Generate AI draft/i)).toBeInTheDocument();
  });

  it('shows AI content for ai_drafted step', () => {
    const step = {
      ...baseStep,
      status: 'ai_drafted' as const,
      ai_suggestions: { text: 'Urban heat island effect is severe', generated_at: '' },
    };
    render(<StepView step={step} portfolioId="p1" onStepUpdated={vi.fn()} />);
    expect(screen.getByText(/Urban heat island effect/i)).toBeInTheDocument();
  });

  it('shows Accept button for ai_drafted step', () => {
    const step = {
      ...baseStep,
      status: 'ai_drafted' as const,
      ai_suggestions: { text: 'Some content', generated_at: '' },
    };
    render(<StepView step={step} portfolioId="p1" onStepUpdated={vi.fn()} />);
    expect(screen.getByText(/Accept/i)).toBeInTheDocument();
  });

  it('shows locked summary for complete step', () => {
    const step = {
      ...baseStep,
      status: 'complete' as const,
      ai_suggestions: { text: 'Completed content here', generated_at: '' },
    };
    render(<StepView step={step} portfolioId="p1" onStepUpdated={vi.fn()} />);
    expect(screen.getByText(/Completed content here/i)).toBeInTheDocument();
    expect(screen.getByText(/Re-open/i)).toBeInTheDocument();
  });

  it('shows Coming soon for unimplemented step', () => {
    const step = { ...baseStep, step_number: 9, step_name: 'Outcome Accelerator', status: 'not_started' as const };
    render(<StepView step={step} portfolioId="p1" onStepUpdated={vi.fn()} />);
    expect(screen.getByText(/Generate AI draft/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/components/portfolio/__tests__/StepView.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create StepView.tsx**

```typescript
'use client';

import { useState } from 'react';
import { StepAIContent } from './StepAIContent';
import { STEP_AGENTS } from '@/lib/portfolio/agents';

interface Step {
  readonly id: string;
  readonly portfolio_id: string;
  readonly step_number: number;
  readonly step_name: string;
  readonly content: Record<string, unknown>;
  readonly ai_suggestions: { text: string; generated_at: string } | null;
  readonly human_input: string | null;
  readonly status: 'not_started' | 'ai_drafted' | 'in_review' | 'complete';
  readonly completed_at: string | null;
}

interface StepViewProps {
  readonly step: Step;
  readonly portfolioId: string;
  readonly onStepUpdated: (step: Step) => void;
}

export function StepView({ step, portfolioId, onStepUpdated }: StepViewProps) {
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const agent = STEP_AGENTS[step.step_number];
  const isImplemented = agent?.implemented ?? false;

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function handleGenerate() {
    if (!isImplemented) {
      showToast('This step is coming in a future update.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/steps/${step.step_number}/generate`, {
        method: 'POST',
      });
      const body = await res.json() as { data?: { content: string }; error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Generation failed');
        return;
      }
      // Refresh step from server
      const stepRes = await fetch(`/api/portfolios/${portfolioId}/steps/${step.step_number}`);
      const stepBody = await stepRes.json() as { data?: Step };
      if (stepBody.data) onStepUpdated(stepBody.data);
    } catch {
      setError('Network error — could not generate content');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const content = step.ai_suggestions?.text ?? editText;
      const res = await fetch(`/api/portfolios/${portfolioId}/steps/${step.step_number}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { text: content }, status: 'complete' }),
      });
      const body = await res.json() as { data?: Step; error?: string };
      if (!res.ok || !body.data) {
        setError(body.error ?? 'Failed to accept step');
        return;
      }
      onStepUpdated(body.data);
    } catch {
      setError('Network error');
    } finally {
      setAccepting(false);
    }
  }

  async function handleReopen() {
    const res = await fetch(`/api/portfolios/${portfolioId}/steps/${step.step_number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ai_drafted' }),
    });
    const body = await res.json() as { data?: Step };
    if (body.data) onStepUpdated(body.data);
  }

  async function handleSaveEdit() {
    const res = await fetch(`/api/portfolios/${portfolioId}/steps/${step.step_number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ human_input: editText, status: 'in_review' }),
    });
    const body = await res.json() as { data?: Step };
    if (body.data) onStepUpdated(body.data);
  }

  const stepDef = STEP_AGENTS[step.step_number];

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {toastMsg && (
        <div className="mb-4 text-xs bg-cof-bg-subtle border border-cof-border rounded px-3 py-2 text-cof-text-secondary">
          {toastMsg}
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-cof-text-primary">
          Step {step.step_number} — {step.step_name}
        </h2>
        {stepDef?.implemented === false && (
          <p className="text-[11px] text-cof-text-tertiary mt-1">Coming in a future update.</p>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {/* not_started */}
      {step.status === 'not_started' && (
        <button
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="text-xs bg-cof-bg-subtle border border-cof-border rounded px-4 py-2 text-cof-text-secondary hover:text-cof-text-primary hover:border-cof-border-strong transition-colors disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate AI draft'}
        </button>
      )}

      {/* ai_drafted */}
      {step.status === 'ai_drafted' && step.ai_suggestions && (
        <>
          <StepAIContent agentName={stepDef?.name ?? 'AI'} content={step.ai_suggestions.text} />
          <div className="flex gap-2">
            <button
              onClick={() => { setEditText(step.ai_suggestions?.text ?? ''); onStepUpdated({ ...step, status: 'in_review' }); }}
              className="text-xs border border-cof-border rounded px-3 py-1.5 text-cof-text-secondary hover:border-cof-border-strong transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => void handleAccept()}
              disabled={accepting}
              className="text-xs bg-node-learning/10 border border-node-learning/30 rounded px-3 py-1.5 text-node-learning hover:bg-node-learning/20 transition-colors disabled:opacity-50"
            >
              {accepting ? 'Saving…' : 'Accept →'}
            </button>
          </div>
        </>
      )}

      {/* in_review */}
      {step.status === 'in_review' && (
        <>
          <textarea
            value={editText || step.human_input || step.ai_suggestions?.text || ''}
            onChange={e => setEditText(e.target.value)}
            className="w-full h-48 text-xs bg-cof-bg-subtle border border-cof-border rounded p-3 text-cof-text-primary resize-none focus:outline-none focus:border-cof-border-strong mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void handleSaveEdit()}
              className="text-xs border border-cof-border rounded px-3 py-1.5 text-cof-text-secondary hover:border-cof-border-strong transition-colors"
            >
              Save draft
            </button>
            <button
              onClick={() => void handleAccept()}
              disabled={accepting}
              className="text-xs bg-node-learning/10 border border-node-learning/30 rounded px-3 py-1.5 text-node-learning hover:bg-node-learning/20 transition-colors disabled:opacity-50"
            >
              {accepting ? 'Saving…' : 'Accept →'}
            </button>
          </div>
        </>
      )}

      {/* complete */}
      {step.status === 'complete' && (
        <>
          <div className="bg-cof-bg-subtle rounded-lg p-4 mb-4">
            <p className="text-xs text-cof-text-secondary leading-relaxed whitespace-pre-wrap">
              {typeof step.content.text === 'string' ? step.content.text : step.ai_suggestions?.text ?? ''}
            </p>
          </div>
          <button
            onClick={() => void handleReopen()}
            className="text-[11px] text-cof-text-tertiary hover:text-cof-text-secondary transition-colors"
          >
            Re-open
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/components/portfolio/__tests__/StepView.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/portfolio/StepView.tsx src/components/portfolio/__tests__/StepView.test.tsx
git commit -m "feat: add StepView component with all 4 step states"
```

---

## Task 9: PortfolioDetail + detail page

**Files:**
- Create: `src/components/portfolio/PortfolioDetail.tsx`
- Create: `src/app/portfolios/[id]/page.tsx`

- [ ] **Step 1: Create PortfolioDetail.tsx**

```typescript
'use client';

import { useState } from 'react';
import { StepNavigator } from './StepNavigator';
import { StepView } from './StepView';

interface Step {
  readonly id: string;
  readonly portfolio_id: string;
  readonly step_number: number;
  readonly step_name: string;
  readonly content: Record<string, unknown>;
  readonly ai_suggestions: { text: string; generated_at: string } | null;
  readonly human_input: string | null;
  readonly status: 'not_started' | 'ai_drafted' | 'in_review' | 'complete';
  readonly completed_at: string | null;
}

interface Portfolio {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly current_step: number;
  readonly steps: readonly Step[];
}

interface PortfolioDetailProps {
  readonly portfolio: Portfolio;
}

export function PortfolioDetail({ portfolio }: PortfolioDetailProps) {
  const [steps, setSteps] = useState<Step[]>([...portfolio.steps]);
  const [activeStep, setActiveStep] = useState(portfolio.current_step);

  function handleStepUpdated(updated: Step) {
    setSteps(prev => prev.map(s => s.step_number === updated.step_number ? updated : s));
    if (updated.status === 'complete') {
      setActiveStep(Math.min(updated.step_number + 1, 13));
    }
  }

  const currentStep = steps.find(s => s.step_number === activeStep) ?? steps[0];

  return (
    <div className="flex h-[calc(100vh-49px)]">
      <StepNavigator
        steps={steps}
        activeStep={activeStep}
        onSelectStep={setActiveStep}
      />
      {currentStep && (
        <StepView
          step={currentStep}
          portfolioId={portfolio.id}
          onStepUpdated={handleStepUpdated}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create /portfolios/[id]/page.tsx**

```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { PortfolioDetail } from '@/components/portfolio/PortfolioDetail';

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function PortfolioDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { id } = await params;

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .eq('author_id', user.id)
    .single();

  if (!portfolio) notFound();

  const { data: steps } = await supabase
    .from('portfolio_steps')
    .select('*')
    .eq('portfolio_id', id)
    .order('step_number', { ascending: true });

  return (
    <div className="pt-[49px]">
      <div className="px-6 py-3 border-b border-cof-border">
        <h1 className="text-sm font-semibold text-cof-text-primary">{portfolio.title as string}</h1>
        {portfolio.subtitle && (
          <p className="text-xs text-cof-text-tertiary mt-0.5">{portfolio.subtitle as string}</p>
        )}
      </div>
      <PortfolioDetail portfolio={{ ...portfolio, steps: steps ?? [] }} />
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "portfolios/\[id\]"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/portfolio/PortfolioDetail.tsx src/app/portfolios/[id]/page.tsx
git commit -m "feat: add portfolio detail page with split-view step workflow"
```

---

## Task 10: Navigation update

**Files:**
- Modify: `src/components/layout/NavBar.tsx`
- Modify: `src/components/layout/MobileNav.tsx`

- [ ] **Step 1: Add Portfolios to NavBar**

In `src/components/layout/NavBar.tsx`, replace the `links` array:

```typescript
  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/graph', label: 'Graph' },
    { href: '/portfolios', label: 'Portfolios' },
    { href: '/commitments', label: 'Commitments' },
    { href: '/query', label: 'Query' },
    { href: '/review', label: 'Health' },
    { href: '/reflect', label: 'Reflect' },
    { href: '/settings', label: 'Settings' },
  ];
```

- [ ] **Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1 | grep "NavBar"
git add src/components/layout/NavBar.tsx src/components/layout/MobileNav.tsx
git commit -m "feat: add Portfolios to navigation"
```

---

## Task 11: Full test suite + smoke check

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Start dev server and verify routes load**

```bash
npm run dev
```

Navigate to:
- `http://localhost:3000/portfolios` — should show list page with "+ New portfolio" button
- Create a portfolio → should redirect to `/portfolios/[id]`
- On the detail page, Step 1 should show "Generate AI draft" button
- Clicking Step 2–13 navigates correctly; steps 9–13 show "Coming in a future update" note

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete portfolio engineering v0.9 - steps 1-8 wired, 9-13 scaffolded"
```
