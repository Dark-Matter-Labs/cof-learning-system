# HUNCH Lifecycle Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename lifecycle stages from (divergence/attractor/convergence/execution) to (hypothesis/uncertainty/navigation/coherence/holding), add the new `holding` stage, and update all UI references.

**Architecture:** Single-responsibility changes — SQL migration first (safe: adds values, migrates, tightens), then type layer, then logic layer, then UI layer, then tests. Each layer builds on the previous. No backwards compatibility needed — this is a solo-user app.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Vitest, @testing-library/react, Tailwind v4, D3

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `supabase/v0.9-hunch-lifecycle.sql` | Create | SQL migration — rename stages, add holding |
| `src/lib/lifecycle/autoPromote.ts` | Modify | LifecycleStage type, HunchStats, evaluateStagePromotion, checkHunchPromotion |
| `src/lib/lifecycle/__tests__/autoPromote.test.ts` | Modify | All tests use new stage names + 2 new transition tests |
| `src/lib/llm/index.ts` | Modify | Add portfolio to AgentName union + AGENT_DEFAULT_MODELS |
| `src/app/api/lifecycle/stage/route.ts` | Modify | VALID_STAGES array + z.enum |
| `src/app/api/lifecycle/promote/route.ts` | Modify | Exclusion filter for auto-promote |
| `src/components/graph/GraphCanvas.tsx` | Modify | FLOW_BAND_COLORS, LIFECYCLE_BAND_LABELS, bandStages, bandWidth |
| `src/components/graph/LifecycleBands.tsx` | Modify | 5 bands, holding glow, STAGE_X_POSITIONS |
| `src/components/graph/NodeDetailPanel.tsx` | Modify | LifecyclePrompt prompts + HunchExplainer trigger |
| `src/components/shared/HunchExplainer.tsx` | Create | Modal with HUNCH acronym breakdown |
| `src/lib/dashboard/queries.ts` | Modify | Add HunchStageCounts to SystemPulseData |
| `src/app/page.tsx` | Modify | Add hunch stage breakdown query |
| `src/components/dashboard/SystemPulse.tsx` | Modify | Show stage breakdown in hunches metric |

---

## Task 1: SQL migration file

**Files:**
- Create: `supabase/v0.9-hunch-lifecycle.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/v0.9-hunch-lifecycle.sql
-- HUNCH lifecycle rename + add 'holding' stage
-- Run in Supabase SQL Editor (or via supabase db push)

-- Step 1: Widen constraint to accept both old and new values temporarily
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_lifecycle_stage_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_lifecycle_stage_check
  CHECK (lifecycle_stage IN (
    'hypothesis','uncertainty','navigation','coherence','holding','archived',
    'divergence','attractor','convergence','execution'
  ));

-- Step 2: Migrate existing data to new names
UPDATE nodes SET lifecycle_stage = 'hypothesis'  WHERE lifecycle_stage = 'divergence';
UPDATE nodes SET lifecycle_stage = 'uncertainty' WHERE lifecycle_stage = 'attractor';
UPDATE nodes SET lifecycle_stage = 'navigation'  WHERE lifecycle_stage = 'convergence';
UPDATE nodes SET lifecycle_stage = 'coherence'   WHERE lifecycle_stage = 'execution';

-- Step 3: Update column default
ALTER TABLE nodes ALTER COLUMN lifecycle_stage SET DEFAULT 'hypothesis';

-- Step 4: Tighten constraint to new values only
ALTER TABLE nodes DROP CONSTRAINT nodes_lifecycle_stage_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_lifecycle_stage_check
  CHECK (lifecycle_stage IN ('hypothesis','uncertainty','navigation','coherence','holding','archived'));
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Open your Supabase project → SQL Editor → paste and run.

Expected: no errors. Verify with:
```sql
SELECT lifecycle_stage, count(*) FROM nodes GROUP BY lifecycle_stage;
```
Expected result: all values are one of `hypothesis / uncertainty / navigation / coherence / holding / archived`. No `divergence / attractor / convergence / execution` rows remain.

---

## Task 2: Update autoPromote.ts — type + evaluateStagePromotion

**Files:**
- Modify: `src/lib/lifecycle/autoPromote.ts` (lines 1–44 — the pure functions)

- [ ] **Step 1: Write the failing test first**

Open `src/lib/lifecycle/__tests__/autoPromote.test.ts`. Replace the entire file:

```typescript
import { describe, it, expect } from 'vitest';
import { evaluateStagePromotion, type HunchStats } from '../autoPromote';

const base: HunchStats = {
  currentStage: 'hypothesis',
  connectedAssumptions: 0,
  connectedTests: 0,
  reinforcedEdges: 0,
  linkedCommitments: 0,
  activeCommitments: 0,
  testsWithSignals: 0,
  daysInCurrentStage: 0,
  linkedLearnings: 0,
};

describe('evaluateStagePromotion — hypothesis → uncertainty', () => {
  it('promotes when 2+ assumptions connected', () => {
    const result = evaluateStagePromotion({ ...base, connectedAssumptions: 2 });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('uncertainty');
  });

  it('promotes when 1+ test connected', () => {
    const result = evaluateStagePromotion({ ...base, connectedTests: 1 });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('uncertainty');
  });

  it('does not promote with 1 assumption and 0 tests', () => {
    const result = evaluateStagePromotion({ ...base, connectedAssumptions: 1 });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — uncertainty → navigation', () => {
  it('promotes when 1+ test and 1+ signal received', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'uncertainty',
      connectedTests: 1,
      testsWithSignals: 1,
    });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('navigation');
  });

  it('does not promote with tests but no signals', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'uncertainty',
      connectedTests: 2,
      testsWithSignals: 0,
    });
    expect(result.advance).toBe(false);
  });

  it('does not promote with signals but no tests', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'uncertainty',
      connectedTests: 0,
      testsWithSignals: 1,
    });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — navigation → coherence', () => {
  it('promotes when 2+ reinforced edges and 1+ active commitment', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'navigation',
      reinforcedEdges: 2,
      activeCommitments: 1,
    });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('coherence');
  });

  it('does not promote with reinforced edges but no active commitment', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'navigation',
      reinforcedEdges: 3,
      activeCommitments: 0,
    });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — coherence → holding', () => {
  it('promotes when 30+ days in stage and 2+ learnings', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'coherence',
      daysInCurrentStage: 30,
      linkedLearnings: 2,
    });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('holding');
  });

  it('does not promote before 30 days even with learnings', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'coherence',
      daysInCurrentStage: 29,
      linkedLearnings: 2,
    });
    expect(result.advance).toBe(false);
  });

  it('does not promote with 30 days but fewer than 2 learnings', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'coherence',
      daysInCurrentStage: 31,
      linkedLearnings: 1,
    });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — terminal stages', () => {
  it('never auto-promotes from holding', () => {
    const result = evaluateStagePromotion({ ...base, currentStage: 'holding' });
    expect(result.advance).toBe(false);
  });

  it('never promotes from archived', () => {
    const result = evaluateStagePromotion({ ...base, currentStage: 'archived' });
    expect(result.advance).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/lib/lifecycle/__tests__/autoPromote.test.ts
```

Expected: multiple failures — `hypothesis` not in `LifecycleStage`, `daysInCurrentStage` not in `HunchStats`.

- [ ] **Step 3: Update the type and pure function in autoPromote.ts**

Replace lines 1–44 of `src/lib/lifecycle/autoPromote.ts`:

```typescript
export type LifecycleStage =
  | 'hypothesis'
  | 'uncertainty'
  | 'navigation'
  | 'coherence'
  | 'holding'
  | 'archived';

export interface HunchStats {
  readonly currentStage: LifecycleStage;
  readonly connectedAssumptions: number;
  readonly connectedTests: number;
  readonly reinforcedEdges: number;
  readonly linkedCommitments: number;
  readonly activeCommitments: number;
  readonly testsWithSignals: number;
  readonly daysInCurrentStage: number;
  readonly linkedLearnings: number;
}

export interface StageDecision {
  readonly advance: boolean;
  readonly newStage?: LifecycleStage;
  readonly reason?: string;
}

export function evaluateStagePromotion(stats: HunchStats): StageDecision {
  const {
    currentStage,
    connectedAssumptions,
    connectedTests,
    reinforcedEdges,
    activeCommitments,
    testsWithSignals,
    daysInCurrentStage,
    linkedLearnings,
  } = stats;

  if (currentStage === 'hypothesis') {
    if (connectedAssumptions >= 2) {
      return { advance: true, newStage: 'uncertainty', reason: `${connectedAssumptions} assumptions connected` };
    }
    if (connectedTests >= 1) {
      return { advance: true, newStage: 'uncertainty', reason: `${connectedTests} test(s) linked` };
    }
  }

  if (currentStage === 'uncertainty') {
    if (connectedTests >= 1 && testsWithSignals >= 1) {
      return { advance: true, newStage: 'navigation', reason: `Active inquiry: ${connectedTests} test(s) with ${testsWithSignals} signal(s)` };
    }
  }

  if (currentStage === 'navigation') {
    if (reinforcedEdges >= 2 && activeCommitments >= 1) {
      return { advance: true, newStage: 'coherence', reason: `${reinforcedEdges} reinforced edges, active commitment` };
    }
  }

  if (currentStage === 'coherence') {
    if (daysInCurrentStage >= 30 && linkedLearnings >= 2) {
      return { advance: true, newStage: 'holding', reason: `${daysInCurrentStage} days in coherence with ${linkedLearnings} learnings` };
    }
  }

  return { advance: false };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/lib/lifecycle/__tests__/autoPromote.test.ts
```

Expected: all 11 tests pass.

---

## Task 3: Update checkHunchPromotion — DB query

**Files:**
- Modify: `src/lib/lifecycle/autoPromote.ts` (lines 46 onwards — the async DB function)

The function currently queries the DB to build `HunchStats`. It needs to add `daysInCurrentStage` and `linkedLearnings`, and update the VALID_STAGES fallback.

- [ ] **Step 1: Replace checkHunchPromotion in autoPromote.ts**

Replace from `export async function checkHunchPromotion` to the end of the file:

```typescript
export async function checkHunchPromotion(nodeId: string): Promise<StageDecision> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: node } = await supabase
      .from('nodes')
      .select('lifecycle_stage, node_type, stage_transitioned_at, created_at')
      .eq('id', nodeId)
      .single();

    if (!node || node.node_type !== 'hunch') return { advance: false };

    // Edges FROM this hunch
    const { data: edgesFromHunch } = await supabase.from('edges').select('target_id').eq('source_id', nodeId);
    // Edges TO this hunch (needed for linkedLearnings)
    const { data: edgesToHunch } = await supabase.from('edges').select('source_id').eq('target_id', nodeId);

    let connectedAssumptions = 0;
    let connectedTests = 0;
    let linkedCommitments = 0;
    let activeCommitments = 0;

    if (edgesFromHunch?.length) {
      const tids = edgesFromHunch.map(e => e.target_id as string);
      const { count: aCount } = await supabase.from('nodes').select('id', { count: 'exact', head: true })
        .in('id', tids).in('node_type', ['assumption_background', 'assumption_foreground']);
      connectedAssumptions = aCount ?? 0;

      const { count: tCount } = await supabase.from('nodes').select('id', { count: 'exact', head: true })
        .in('id', tids).eq('node_type', 'test');
      connectedTests = tCount ?? 0;

      const { data: commitmentRows } = await supabase.from('nodes').select('id, status')
        .in('id', tids).eq('node_type', 'commitment');
      linkedCommitments = commitmentRows?.length ?? 0;
      activeCommitments = commitmentRows?.filter(c => c.status === 'promoted').length ?? 0;
    }

    const { count: reinforcedEdges } = await supabase.from('edges').select('id', { count: 'exact', head: true })
      .eq('source_id', nodeId).eq('path_status', 'reinforced');

    // testsWithSignals: signals linked to any test connected to this hunch
    let testsWithSignals = 0;
    if (edgesFromHunch?.length) {
      const tids = edgesFromHunch.map(e => e.target_id as string);
      const { data: testNodes } = await supabase.from('nodes')
        .select('id').in('id', tids).eq('node_type', 'test');
      if (testNodes?.length) {
        const testIds = testNodes.map(t => t.id as string);
        const { data: signalEdges } = await supabase.from('edges')
          .select('source_id').in('target_id', testIds);
        if (signalEdges?.length) {
          const sourceIds = [...new Set(signalEdges.map(e => e.source_id as string))];
          const { count } = await supabase.from('nodes')
            .select('id', { count: 'exact', head: true })
            .in('id', sourceIds).eq('node_type', 'signal');
          testsWithSignals = count ?? 0;
        }
      }
    }

    // linkedLearnings: learning nodes connected in either direction
    const allConnectedIds = [
      ...(edgesFromHunch ?? []).map(e => e.target_id as string),
      ...(edgesToHunch ?? []).map(e => e.source_id as string),
    ];
    let linkedLearnings = 0;
    if (allConnectedIds.length > 0) {
      const { count: lCount } = await supabase.from('nodes')
        .select('id', { count: 'exact', head: true })
        .in('id', allConnectedIds).eq('node_type', 'learning');
      linkedLearnings = lCount ?? 0;
    }

    // daysInCurrentStage: derived from stage_transitioned_at (or created_at if not set)
    const transitionedAt = node.stage_transitioned_at
      ? new Date(node.stage_transitioned_at as string)
      : new Date(node.created_at as string);
    const daysInCurrentStage = Math.floor((Date.now() - transitionedAt.getTime()) / (1000 * 60 * 60 * 24));

    const VALID_STAGES: readonly LifecycleStage[] = ['hypothesis', 'uncertainty', 'navigation', 'coherence', 'holding', 'archived'];
    const rawStage = node.lifecycle_stage as string;
    const currentStage: LifecycleStage = VALID_STAGES.includes(rawStage as LifecycleStage)
      ? (rawStage as LifecycleStage)
      : 'hypothesis';

    const stats: HunchStats = {
      currentStage,
      connectedAssumptions,
      connectedTests,
      reinforcedEdges: reinforcedEdges ?? 0,
      linkedCommitments,
      activeCommitments,
      testsWithSignals,
      daysInCurrentStage,
      linkedLearnings,
    };

    return evaluateStagePromotion(stats);
  } catch (err) {
    process.stderr.write(`[lifecycle] checkHunchPromotion error for ${nodeId}: ${String(err)}\n`);
    return { advance: false };
  }
}
```

- [ ] **Step 2: Run all autoPromote tests**

```bash
npx vitest run src/lib/lifecycle/__tests__/autoPromote.test.ts
```

Expected: all 11 tests still pass (pure function tests, unchanged).

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `autoPromote.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/lifecycle/autoPromote.ts src/lib/lifecycle/__tests__/autoPromote.test.ts supabase/v0.9-hunch-lifecycle.sql
git commit -m "feat: rename lifecycle stages to HUNCH acronym with holding stage"
```

---

## Task 4: Add portfolio agent to llm/index.ts

**Files:**
- Modify: `src/lib/llm/index.ts` (lines 27–38)

- [ ] **Step 1: Update AGENT_DEFAULT_MODELS and AgentName**

In `src/lib/llm/index.ts`, replace lines 27–38:

```typescript
const AGENT_DEFAULT_MODELS: Record<string, string> = {
  extraction: 'claude-haiku-4-5-20251001',
  review: 'claude-haiku-4-5-20251001',
  process: 'claude-haiku-4-5-20251001',
  reflection: 'claude-sonnet-4-6',
  create: 'claude-sonnet-4-6',
  setup: 'claude-sonnet-4-6',
  query: 'claude-sonnet-4-6',
  digest: 'claude-sonnet-4-6',
  portfolio: 'claude-sonnet-4-6',
};

export type AgentName = 'extraction' | 'review' | 'create' | 'reflection' | 'process' | 'setup' | 'query' | 'digest' | 'portfolio';
```

- [ ] **Step 2: Run existing LLM tests**

```bash
npx vitest run src/lib/llm/__tests__/
```

Expected: all tests pass. No changes needed to tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/llm/index.ts
git commit -m "feat: add portfolio agent to LLM config"
```

---

## Task 5: Update lifecycle API routes

**Files:**
- Modify: `src/app/api/lifecycle/stage/route.ts`
- Modify: `src/app/api/lifecycle/promote/route.ts`

- [ ] **Step 1: Update stage route**

In `src/app/api/lifecycle/stage/route.ts`, replace line 5:

```typescript
const VALID_STAGES = ['hypothesis', 'uncertainty', 'navigation', 'coherence', 'holding', 'archived'] as const;
```

The `z.enum(VALID_STAGES)` below it uses this array so no other change needed.

- [ ] **Step 2: Update promote route exclusion filter**

In `src/app/api/lifecycle/promote/route.ts`, replace line 15:

```typescript
    .not('lifecycle_stage', 'in', '("holding","archived")');
```

(Previously excluded `execution` and `archived`. Now excludes `holding` and `archived` since those cannot auto-promote.)

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "lifecycle"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/lifecycle/stage/route.ts src/app/api/lifecycle/promote/route.ts
git commit -m "fix: update lifecycle API routes for HUNCH stage names"
```

---

## Task 6: Update GraphCanvas.tsx

**Files:**
- Modify: `src/components/graph/GraphCanvas.tsx` (lines 136–143 and 460–463)

- [ ] **Step 1: Update FLOW_BAND_COLORS, LIFECYCLE_BAND_LABELS**

In `src/components/graph/GraphCanvas.tsx`, replace lines 136–143:

```typescript
const FLOW_BAND_COLORS: Record<string, string> = {
  hypothesis:  '#9ca3af',
  uncertainty: '#7F77DD',
  navigation:  '#1D9E75',
  coherence:   '#185FA5',
  holding:     '#10b981',
};

const LIFECYCLE_BAND_LABELS = ['Hypothesis', 'Uncertainty', 'Navigation', 'Coherence', 'Holding'] as const;
```

- [ ] **Step 2: Update bandWidth and bandStages in the flow view render**

In `src/components/graph/GraphCanvas.tsx`, replace lines 462–463:

```typescript
      const bandWidth = width / 5;
      const bandStages = ['hypothesis', 'uncertainty', 'navigation', 'coherence', 'holding'];
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "GraphCanvas"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/graph/GraphCanvas.tsx
git commit -m "fix: update GraphCanvas flow view for 5 HUNCH lifecycle bands"
```

---

## Task 7: Update LifecycleBands.tsx

**Files:**
- Modify: `src/components/graph/LifecycleBands.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
const BANDS = [
  { stage: 'hypothesis',  label: 'Hypothesis',  color: 'text-gray-400' },
  { stage: 'uncertainty', label: 'Uncertainty', color: 'text-node-hunch' },
  { stage: 'navigation',  label: 'Navigation',  color: 'text-node-assumption-bg' },
  { stage: 'coherence',   label: 'Coherence',   color: 'text-node-learning' },
  { stage: 'holding',     label: 'Holding',     color: 'text-emerald-400' },
] as const;

interface LifecycleBandsProps {
  readonly width: number;
}

export function LifecycleBands({ width }: LifecycleBandsProps) {
  const bandWidth = width / 5;

  return (
    <div className="absolute top-0 left-0 right-0 flex pointer-events-none" style={{ height: 32 }}>
      {BANDS.map((band, i) => {
        const isHolding = band.stage === 'holding';
        return (
          <div
            key={band.stage}
            className={`flex items-center justify-center border-r border-gray-100 dark:border-gray-800/50 last:border-r-0 ${band.color}`}
            style={{
              width: bandWidth,
              ...(isHolding ? {
                background: 'linear-gradient(90deg, #0a1a10, #0f2518)',
                borderLeft: '2px solid #10b981',
                boxShadow: 'inset 0 0 12px rgba(16,185,129,0.15)',
              } : {}),
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
              {band.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const STAGE_X_POSITIONS: Record<string, number> = {
  hypothesis:  0.1,
  uncertainty: 0.3,
  navigation:  0.5,
  coherence:   0.7,
  holding:     0.9,
};
```

- [ ] **Step 2: Run ConvergenceSparkline test to confirm no regressions**

```bash
npx vitest run src/components/graph/__tests__/ConvergenceSparkline.test.tsx
```

Expected: passes (ConvergenceSparkline doesn't depend on LifecycleBands).

- [ ] **Step 3: Commit**

```bash
git add src/components/graph/LifecycleBands.tsx
git commit -m "fix: update LifecycleBands to 5 HUNCH stages with holding glow"
```

---

## Task 8: Update NodeDetailPanel.tsx lifecycle prompts

**Files:**
- Modify: `src/components/graph/NodeDetailPanel.tsx` (lines 68–96 — the LifecyclePrompt component + its prompts)

- [ ] **Step 1: Replace the prompts object inside LifecyclePrompt**

In `src/components/graph/NodeDetailPanel.tsx`, replace the `prompts` object inside `LifecyclePrompt` (lines 69–96):

```typescript
  const prompts: Partial<Record<LifecycleStage, { threshold: number; text: string; actions: readonly { label: string; href: string }[] }>> = {
    hypothesis: {
      threshold: 7,
      text: `This hypothesis has been sitting for ${daysSinceTransition} days. Time to map the uncertainty.`,
      actions: [
        { label: 'Connect an assumption', href: `/capture/${nodeId}` },
        { label: 'Archive it', href: `/capture/${nodeId}` },
      ],
    },
    uncertainty: {
      threshold: 14,
      text: 'Uncertainties mapped but untested. What probe generates the most informative signal?',
      actions: [{ label: 'Design a test', href: `/capture/${nodeId}` }],
    },
    navigation: {
      threshold: 14,
      text: 'Inquiry active but not yet integrated. What would moving toward coherence require?',
      actions: [
        { label: 'Connect to a commitment', href: `/commitments` },
        { label: 'Log a signal', href: `/capture` },
      ],
    },
    coherence: {
      threshold: 0,
      text: 'The field is coherent. What\'s the holding pattern? Who carries this through time?',
      actions: [{ label: 'Capture a learning', href: `/capture` }],
    },
    holding: {
      threshold: 0,
      text: 'This is live capability. What\'s the current state of learning?',
      actions: [{ label: 'Capture an outcome', href: `/capture` }],
    },
  };
```

- [ ] **Step 2: Run NodeDetailPanel tests**

```bash
npx vitest run src/components/graph/__tests__/NodeDetailPanel.test.tsx
```

Expected: passes. If any test references old stage names like `'divergence'` or `'execution'`, update those test strings to use the new HUNCH names.

- [ ] **Step 3: Commit**

```bash
git add src/components/graph/NodeDetailPanel.tsx
git commit -m "fix: update NodeDetailPanel lifecycle prompts for HUNCH vocabulary"
```

---

## Task 9: Create HunchExplainer modal

**Files:**
- Create: `src/components/shared/HunchExplainer.tsx`
- Modify: `src/components/graph/NodeDetailPanel.tsx` (add trigger)
- Modify: `src/components/graph/LifecycleBands.tsx` (add trigger)

- [ ] **Step 1: Create HunchExplainer.tsx**

```typescript
'use client';

import { useState } from 'react';

const STAGES = [
  {
    letter: 'H',
    name: 'Hypothesis',
    definition: 'Emergent intuition about a future risk, value field, or option.',
  },
  {
    letter: 'U',
    name: 'Uncertainty',
    definition: 'What\'s unknown, testable, reducible. The map of the question, not the answer.',
  },
  {
    letter: 'N',
    name: 'Navigation',
    definition: 'Active inquiry. Tests, prototypes, signals. The pathway being walked.',
  },
  {
    letter: 'C',
    name: 'Coherence',
    definition: 'Integration into a credible field of value, legitimacy, governance, capital.',
  },
  {
    letter: 'H',
    name: 'Holding',
    definition: 'Disciplined institutional capacity to keep learning alive. Live capability.',
  },
] as const;

interface HunchExplainerProps {
  readonly trigger?: React.ReactNode;
}

export function HunchExplainer({ trigger }: HunchExplainerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-cof-text-tertiary hover:text-cof-text-secondary transition-colors"
        aria-label="What is HUNCH?"
      >
        {trigger ?? '?'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-cof-bg-elevated border border-cof-border rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-cof-text-primary tracking-widest">HUNCH</h2>
                <p className="text-[11px] text-cof-text-tertiary mt-0.5 italic">
                  Hypothesis under uncertainty, navigated into coherence and held through learning.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-cof-text-tertiary hover:text-cof-text-secondary text-lg ml-4"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {STAGES.map(stage => (
                <div key={stage.name} className="flex gap-3">
                  <span className="text-xs font-bold text-node-hunch w-4 flex-shrink-0 pt-0.5">
                    {stage.letter}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-cof-text-primary">{stage.name}</span>
                    <p className="text-[11px] text-cof-text-tertiary mt-0.5 leading-relaxed">
                      {stage.definition}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add HunchExplainer trigger to NodeDetailPanel**

In `src/components/graph/NodeDetailPanel.tsx`, add the import at the top:

```typescript
import { HunchExplainer } from '@/components/shared/HunchExplainer';
```

Then in `LifecyclePrompt`, wrap the section with a `?` button. Replace the `return (` inside `LifecyclePrompt` to add a header row:

```tsx
  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">{prompt.text}</p>
        <HunchExplainer />
      </div>
      <div className="flex flex-wrap gap-2">
        {prompt.actions.map(action => (
          <a
            key={action.label}
            href={action.href}
            className="text-xs text-node-hunch border border-node-hunch/30 rounded px-2 py-1 hover:bg-node-hunch/5 transition-colors"
          >
            {action.label}
          </a>
        ))}
      </div>
    </div>
  );
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "HunchExplainer|NodeDetailPanel"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/HunchExplainer.tsx src/components/graph/NodeDetailPanel.tsx
git commit -m "feat: add HunchExplainer modal with HUNCH acronym breakdown"
```

---

## Task 10: Update dashboard — hunch stage breakdown

**Files:**
- Modify: `src/lib/dashboard/queries.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/dashboard/SystemPulse.tsx`

- [ ] **Step 1: Update SystemPulseData type in queries.ts**

In `src/lib/dashboard/queries.ts`, replace the `SystemPulseData` interface:

```typescript
export interface HunchStageCounts {
  readonly hypothesis: number;
  readonly uncertainty: number;
  readonly navigation: number;
  readonly coherence: number;
  readonly holding: number;
}

export interface SystemPulseData {
  readonly lastCaptureAt: string | null;
  readonly thisWeekCount: number;
  readonly activeCommitmentsCount: number;
  readonly openTensionsCount: number;
  readonly hunchesInFlightCount: number;
  readonly hunchStageCounts: HunchStageCounts;
}
```

- [ ] **Step 2: Update dashboard queries test**

```bash
npx vitest run src/lib/dashboard/__tests__/queries.test.ts
```

If any test constructs `SystemPulseData`, add `hunchStageCounts: { hypothesis: 0, uncertainty: 0, navigation: 0, coherence: 0, holding: 0 }` to it. Run again to confirm pass.

- [ ] **Step 3: Update page.tsx to fetch stage breakdown**

In `src/app/page.tsx`, add a new parallel query at the end of the `Promise.all` array (after `hunchCountRes`):

```typescript
    supabase.from('nodes').select('lifecycle_stage')
      .eq('node_type', 'hunch').neq('status', 'archived').neq('status', 'falsified')
      .neq('status', 'suspended').neq('status', 'promoted'),
```

Destructure it as `hunchStagesRes` in the array destructuring. Then compute the counts before building the `pulse` object:

```typescript
  const stageCounts = { hypothesis: 0, uncertainty: 0, navigation: 0, coherence: 0, holding: 0 };
  for (const row of (hunchStagesRes.data ?? [])) {
    const s = row.lifecycle_stage as string;
    if (s in stageCounts) stageCounts[s as keyof typeof stageCounts]++;
  }
```

Then add `hunchStageCounts: stageCounts` to the `pulse` object:

```typescript
  const pulse: SystemPulseData = {
    lastCaptureAt: (lastCaptureRes.data ?? [])[0]?.created_at ?? null,
    thisWeekCount: weekCountRes.count ?? 0,
    activeCommitmentsCount: commitmentCountRes.count ?? 0,
    openTensionsCount: tensionCountRes.count ?? 0,
    hunchesInFlightCount: hunchCountRes.count ?? 0,
    hunchStageCounts: stageCounts,
  };
```

- [ ] **Step 4: Update SystemPulse.tsx to show breakdown**

In `src/components/dashboard/SystemPulse.tsx`, replace the "Hunches in flight" `<div>`:

```tsx
        <div className="flex justify-between text-sm">
          <dt className="text-cof-text-secondary">Hunches in flight</dt>
          <dd className="text-right">
            <Link href="/graph" className="font-medium text-cof-text-primary hover:text-node-hunch transition-colors">
              {data.hunchesInFlightCount}
            </Link>
            {data.hunchesInFlightCount > 0 && (
              <div className="text-[10px] text-cof-text-tertiary mt-0.5">
                {(['hypothesis', 'uncertainty', 'navigation', 'coherence', 'holding'] as const)
                  .filter(s => data.hunchStageCounts[s] > 0)
                  .map(s => `${data.hunchStageCounts[s]} ${s}`)
                  .join(' · ')}
              </div>
            )}
          </dd>
        </div>
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "SystemPulse|dashboard|page.tsx"
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard/queries.ts src/app/page.tsx src/components/dashboard/SystemPulse.tsx
git commit -m "feat: show HUNCH stage breakdown in dashboard hunches metric"
```

---

## Task 11: Run full test suite + final cleanup

**Files:**
- Check: all test files that may still reference old stage names

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Note any failures.

- [ ] **Step 2: Fix remaining old stage name references in tests**

Search for any remaining old stage names:

```bash
grep -rn "'divergence'\|'attractor'\|'execution'" src --include="*.test.ts" --include="*.test.tsx"
```

For each match, replace with the equivalent HUNCH name:
- `'divergence'` → `'hypothesis'`
- `'attractor'` → `'uncertainty'`
- `'convergence'` → `'navigation'` (only if it refers to lifecycle stage, not the convergence score system)
- `'execution'` → `'coherence'`

Note: references to `convergence_snapshots`, `ConvergenceSparkline`, `convergence.ts`, `computeConvergenceScore` etc. are about the **convergence scoring system** (how aligned are commitments + hunches) — these are NOT lifecycle stage references and must NOT be renamed.

- [ ] **Step 3: Run full test suite again**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: update remaining test files for HUNCH stage names"
```
