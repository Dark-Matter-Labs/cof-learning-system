# Field Intelligence Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/newsletter` page that generates plain-text field intelligence briefs from the knowledge graph, in two formats (Mission Pathways and Close Contacts), with history tracking.

**Architecture:** Content selection queries Supabase for nodes active in the last 6 weeks, formats them into a structured LLM user message, calls `callLLM('newsletter', ...)`, and saves the result to a new `newsletters` table. A client-side tab component handles generation, output display, and history.

**Tech Stack:** Next.js 16 app router, Supabase (server client + RLS), `callLLM` abstraction, Zod v4 validation, Vitest, Tailwind v4 with `cof-*` tokens.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/v0.9-newsletters.sql` | Table, indexes, RLS |
| Modify | `src/lib/llm/index.ts` | Add `'newsletter'` to AgentName + AGENT_DEFAULT_MODELS |
| Create | `src/lib/newsletter/select.ts` | DB queries — returns structured data for each format |
| Create | `src/lib/newsletter/__tests__/select.test.ts` | Tests for select functions |
| Create | `src/lib/newsletter/agents.ts` | System prompts + message builder functions |
| Create | `src/lib/newsletter/__tests__/agents.test.ts` | Tests for message builders |
| Create | `src/app/api/newsletters/route.ts` | GET list + POST generate |
| Create | `src/app/api/newsletters/__tests__/route.test.ts` | API route tests |
| Create | `src/components/newsletter/NewsletterTabs.tsx` | Tab UI, generate button, output area, history |
| Create | `src/app/newsletter/page.tsx` | Server page, auth guard |
| Modify | `src/components/layout/NavBar.tsx` | Add Newsletter, restore Capture |
| Modify | `src/components/layout/MobileNav.tsx` | Add Newsletter |

---

## Task 1: SQL Migration

**Files:**
- Create: `supabase/v0.9-newsletters.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/v0.9-newsletters.sql
CREATE TABLE IF NOT EXISTS newsletters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL CHECK (type IN ('mission_pathways', 'close_contacts')),
  content    TEXT NOT NULL,
  author_id  UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletters_author ON newsletters(author_id);
CREATE INDEX IF NOT EXISTS idx_newsletters_author_type ON newsletters(author_id, type, created_at DESC);

ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own newsletters" ON newsletters
  FOR ALL USING (author_id = auth.uid());
```

- [ ] **Step 2: Commit**

```bash
git add supabase/v0.9-newsletters.sql
git commit -m "feat: add newsletters table migration"
```

> **Note for implementer:** Run this SQL in the Supabase SQL Editor before the API route tests will pass against a real DB. Tests mock Supabase so they'll pass regardless.

---

## Task 2: Register newsletter LLM agent

**Files:**
- Modify: `src/lib/llm/index.ts`

The current file has:
```typescript
const AGENT_DEFAULT_MODELS: Record<string, string> = {
  // ...
  portfolio: 'claude-sonnet-4-6',
};

export type AgentName = '...' | 'portfolio';
```

- [ ] **Step 1: Add newsletter to AGENT_DEFAULT_MODELS and AgentName**

In `src/lib/llm/index.ts`, make two changes:

Change AGENT_DEFAULT_MODELS to add `newsletter`:
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
  newsletter: 'claude-sonnet-4-6',
};
```

Change AgentName to add `'newsletter'`:
```typescript
export type AgentName = 'extraction' | 'review' | 'create' | 'reflection' | 'process' | 'setup' | 'query' | 'digest' | 'portfolio' | 'newsletter';
```

- [ ] **Step 2: Run the test suite to confirm no regressions**

```bash
npx vitest run src/lib/llm
```

Expected: all existing LLM tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/llm/index.ts
git commit -m "feat: register newsletter LLM agent"
```

---

## Task 3: Newsletter content selection

**Files:**
- Create: `src/lib/newsletter/select.ts`
- Create: `src/lib/newsletter/__tests__/select.test.ts`

`select.ts` exports both pure helper functions (easily unit tested) and the async DB functions that call them. Tests cover only the pure functions — no Supabase mocking needed. This matches the `buildStepContext` pattern in `src/lib/portfolio/generate.ts`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/newsletter/__tests__/select.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeStageCounts,
  filterRecentlyMoved,
  filterStuckHunches,
  filterActiveCommitments,
  filterCompletedCommitments,
} from '../select';

type RawHunch = {
  id: string;
  title: string;
  lifecycle_stage: string;
  stage_transitioned_at: string | null;
  created_at: string;
};

type RawCommitment = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
};

const OLD = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
const RECENT = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const SIX_WEEKS_AGO = new Date(Date.now() - 6 * 7 * 24 * 60 * 60 * 1000).toISOString();
const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

describe('computeStageCounts', () => {
  it('counts hunches by lifecycle stage', () => {
    const hunches: RawHunch[] = [
      { id: 'h1', title: 'A', lifecycle_stage: 'hypothesis', stage_transitioned_at: null, created_at: OLD },
      { id: 'h2', title: 'B', lifecycle_stage: 'hypothesis', stage_transitioned_at: null, created_at: OLD },
      { id: 'h3', title: 'C', lifecycle_stage: 'navigation', stage_transitioned_at: null, created_at: OLD },
    ];
    const counts = computeStageCounts(hunches);
    expect(counts['hypothesis']).toBe(2);
    expect(counts['navigation']).toBe(1);
    expect(counts['coherence']).toBeUndefined();
  });

  it('returns empty object for no hunches', () => {
    expect(computeStageCounts([])).toEqual({});
  });
});

describe('filterRecentlyMoved', () => {
  it('returns hunches that moved stages within the window', () => {
    const hunches: RawHunch[] = [
      { id: 'h1', title: 'Recent', lifecycle_stage: 'navigation', stage_transitioned_at: RECENT, created_at: OLD },
      { id: 'h2', title: 'Old', lifecycle_stage: 'uncertainty', stage_transitioned_at: OLD, created_at: OLD },
      { id: 'h3', title: 'NoDate', lifecycle_stage: 'hypothesis', stage_transitioned_at: null, created_at: OLD },
    ];
    const moved = filterRecentlyMoved(hunches, SIX_WEEKS_AGO);
    expect(moved).toHaveLength(1);
    expect(moved[0].title).toBe('Recent');
  });
});

describe('filterStuckHunches', () => {
  it('returns hunches stuck 30+ days', () => {
    const hunches: RawHunch[] = [
      { id: 'h1', title: 'Stuck', lifecycle_stage: 'uncertainty', stage_transitioned_at: OLD, created_at: OLD },
      { id: 'h2', title: 'Fresh', lifecycle_stage: 'uncertainty', stage_transitioned_at: RECENT, created_at: RECENT },
    ];
    const stuck = filterStuckHunches(hunches, THIRTY_DAYS_AGO);
    expect(stuck).toHaveLength(1);
    expect(stuck[0].title).toBe('Stuck');
    expect(stuck[0].daysStuck).toBeGreaterThanOrEqual(40);
  });

  it('excludes holding and archived hunches', () => {
    const hunches: RawHunch[] = [
      { id: 'h1', title: 'Holding', lifecycle_stage: 'holding', stage_transitioned_at: OLD, created_at: OLD },
      { id: 'h2', title: 'Archived', lifecycle_stage: 'archived', stage_transitioned_at: OLD, created_at: OLD },
    ];
    expect(filterStuckHunches(hunches, THIRTY_DAYS_AGO)).toHaveLength(0);
  });

  it('falls back to created_at when stage_transitioned_at is null', () => {
    const hunches: RawHunch[] = [
      { id: 'h1', title: 'OldCreate', lifecycle_stage: 'hypothesis', stage_transitioned_at: null, created_at: OLD },
    ];
    const stuck = filterStuckHunches(hunches, THIRTY_DAYS_AGO);
    expect(stuck).toHaveLength(1);
  });
});

describe('filterActiveCommitments', () => {
  it('returns only active commitments', () => {
    const commitments: RawCommitment[] = [
      { id: 'c1', title: 'Active', status: 'active', updated_at: RECENT },
      { id: 'c2', title: 'Complete', status: 'complete', updated_at: RECENT },
      { id: 'c3', title: 'Archived', status: 'archived', updated_at: RECENT },
    ];
    const active = filterActiveCommitments(commitments);
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe('Active');
  });
});

describe('filterCompletedCommitments', () => {
  it('returns commitments completed within the window', () => {
    const commitments: RawCommitment[] = [
      { id: 'c1', title: 'RecentDone', status: 'complete', updated_at: RECENT },
      { id: 'c2', title: 'OldDone', status: 'complete', updated_at: OLD },
      { id: 'c3', title: 'Active', status: 'active', updated_at: RECENT },
    ];
    const completed = filterCompletedCommitments(commitments, SIX_WEEKS_AGO);
    expect(completed).toHaveLength(1);
    expect(completed[0].title).toBe('RecentDone');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/newsletter/__tests__/select.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement select.ts**

Create `src/lib/newsletter/select.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

const SIX_WEEKS_MS = 6 * 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface MissionPathwaysData {
  readonly stageCounts: Readonly<Record<string, number>>;
  readonly recentlyMoved: ReadonlyArray<{ readonly id: string; readonly title: string; readonly lifecycle_stage: string }>;
  readonly activeCommitments: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly completedCommitments: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly testsWithActivity: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly stuckHunches: ReadonlyArray<{ readonly id: string; readonly title: string; readonly lifecycle_stage: string; readonly daysStuck: number }>;
}

export interface CloseContactsData {
  readonly learnings: ReadonlyArray<{ readonly id: string; readonly title: string; readonly summary: string | null }>;
  readonly testsWithActivity: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly coherentHunches: ReadonlyArray<{ readonly id: string; readonly title: string; readonly lifecycle_stage: string }>;
}

type RawHunch = { id: string; title: string; lifecycle_stage: string; stage_transitioned_at: string | null; created_at: string };
type RawCommitment = { id: string; title: string; status: string; updated_at: string };

export function computeStageCounts(hunches: readonly RawHunch[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const h of hunches) {
    counts[h.lifecycle_stage] = (counts[h.lifecycle_stage] ?? 0) + 1;
  }
  return counts;
}

export function filterRecentlyMoved(hunches: readonly RawHunch[], sixWeeksAgo: string): ReadonlyArray<{ id: string; title: string; lifecycle_stage: string }> {
  return hunches
    .filter(h => h.stage_transitioned_at && h.stage_transitioned_at > sixWeeksAgo)
    .map(h => ({ id: h.id, title: h.title, lifecycle_stage: h.lifecycle_stage }));
}

export function filterStuckHunches(hunches: readonly RawHunch[], thirtyDaysAgo: string): ReadonlyArray<{ id: string; title: string; lifecycle_stage: string; daysStuck: number }> {
  return hunches
    .filter(h => {
      if (['holding', 'archived'].includes(h.lifecycle_stage)) return false;
      const since = h.stage_transitioned_at ?? h.created_at;
      return since < thirtyDaysAgo;
    })
    .map(h => {
      const since = h.stage_transitioned_at ?? h.created_at;
      const daysStuck = Math.floor((Date.now() - new Date(since).getTime()) / (24 * 60 * 60 * 1000));
      return { id: h.id, title: h.title, lifecycle_stage: h.lifecycle_stage, daysStuck };
    });
}

export function filterActiveCommitments(commitments: readonly RawCommitment[]): ReadonlyArray<{ id: string; title: string }> {
  return commitments.filter(c => c.status === 'active').map(c => ({ id: c.id, title: c.title }));
}

export function filterCompletedCommitments(commitments: readonly RawCommitment[], sixWeeksAgo: string): ReadonlyArray<{ id: string; title: string }> {
  return commitments
    .filter(c => c.status === 'complete' && c.updated_at > sixWeeksAgo)
    .map(c => ({ id: c.id, title: c.title }));
}

export async function selectMissionPathwaysNodes(supabase: SupabaseClient): Promise<MissionPathwaysData> {
  const sixWeeksAgo = new Date(Date.now() - SIX_WEEKS_MS).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const [hunchesRes, commitmentsRes, testsRes] = await Promise.all([
    supabase
      .from('nodes')
      .select('id, title, lifecycle_stage, stage_transitioned_at, created_at')
      .eq('node_type', 'hunch')
      .not('status', 'in', '("archived","falsified")'),
    supabase
      .from('nodes')
      .select('id, title, status, updated_at')
      .eq('node_type', 'commitment')
      .not('status', 'in', '("archived","falsified")'),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'test')
      .not('status', 'in', '("archived","falsified")')
      .gte('updated_at', sixWeeksAgo),
  ]);

  const hunches = (hunchesRes.data ?? []) as RawHunch[];
  const commitments = (commitmentsRes.data ?? []) as RawCommitment[];
  const tests = (testsRes.data ?? []) as Array<{ id: string; title: string }>;

  return {
    stageCounts: computeStageCounts(hunches),
    recentlyMoved: filterRecentlyMoved(hunches, sixWeeksAgo),
    activeCommitments: filterActiveCommitments(commitments),
    completedCommitments: filterCompletedCommitments(commitments, sixWeeksAgo),
    testsWithActivity: tests.map(t => ({ id: t.id, title: t.title })),
    stuckHunches: filterStuckHunches(hunches, thirtyDaysAgo),
  };
}

export async function selectCloseContactsNodes(supabase: SupabaseClient): Promise<CloseContactsData> {
  const sixWeeksAgo = new Date(Date.now() - SIX_WEEKS_MS).toISOString();

  const [learningsRes, testsRes, hunchesRes] = await Promise.all([
    supabase
      .from('nodes')
      .select('id, title, description')
      .eq('node_type', 'learning')
      .not('status', 'in', '("archived","falsified")')
      .gte('created_at', sixWeeksAgo),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'test')
      .not('status', 'in', '("archived","falsified")')
      .gte('updated_at', sixWeeksAgo),
    supabase
      .from('nodes')
      .select('id, title, lifecycle_stage')
      .eq('node_type', 'hunch')
      .not('status', 'in', '("archived","falsified")')
      .in('lifecycle_stage', ['coherence', 'holding'])
      .gte('updated_at', sixWeeksAgo),
  ]);

  return {
    learnings: (learningsRes.data ?? []).map(l => ({
      id: l.id as string,
      title: l.title as string,
      summary: (l.description ?? null) as string | null,
    })),
    testsWithActivity: (testsRes.data ?? []).map(t => ({
      id: t.id as string,
      title: t.title as string,
    })),
    coherentHunches: (hunchesRes.data ?? []).map(h => ({
      id: h.id as string,
      title: h.title as string,
      lifecycle_stage: h.lifecycle_stage as string,
    })),
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/newsletter/__tests__/select.test.ts
```

Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/newsletter/select.ts src/lib/newsletter/__tests__/select.test.ts
git commit -m "feat: newsletter content selection with pure helper functions"
```

---

## Task 4: Newsletter system prompts and message builders

**Files:**
- Create: `src/lib/newsletter/agents.ts`
- Create: `src/lib/newsletter/__tests__/agents.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/newsletter/__tests__/agents.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildMissionPathwaysMessage, buildCloseContactsMessage } from '../agents';
import type { MissionPathwaysData, CloseContactsData } from '../select';

const fullMissionData: MissionPathwaysData = {
  stageCounts: { hypothesis: 3, uncertainty: 2, navigation: 1 },
  recentlyMoved: [{ id: 'h1', title: 'Climate Risk Hunch', lifecycle_stage: 'navigation' }],
  activeCommitments: [{ id: 'c1', title: 'Pilot deployment' }],
  completedCommitments: [{ id: 'c2', title: 'Stakeholder mapping' }],
  testsWithActivity: [{ id: 't1', title: 'Field sensor test' }],
  stuckHunches: [{ id: 'h2', title: 'Slow Hunch', lifecycle_stage: 'uncertainty', daysStuck: 45 }],
};

const emptyMissionData: MissionPathwaysData = {
  stageCounts: {},
  recentlyMoved: [],
  activeCommitments: [],
  completedCommitments: [],
  testsWithActivity: [],
  stuckHunches: [],
};

const fullContactsData: CloseContactsData = {
  learnings: [{ id: 'l1', title: 'Heat resilience patterns', summary: 'Urban areas show...' }],
  testsWithActivity: [{ id: 't1', title: 'Cooling intervention test' }],
  coherentHunches: [{ id: 'h1', title: 'Mycorrhizal corridors', lifecycle_stage: 'coherence' }],
};

const emptyContactsData: CloseContactsData = {
  learnings: [],
  testsWithActivity: [],
  coherentHunches: [],
};

describe('buildMissionPathwaysMessage', () => {
  it('includes stage counts', () => {
    const msg = buildMissionPathwaysMessage(fullMissionData);
    expect(msg).toContain('hypothesis: 3');
    expect(msg).toContain('uncertainty: 2');
  });

  it('includes recently moved hunches', () => {
    const msg = buildMissionPathwaysMessage(fullMissionData);
    expect(msg).toContain('Climate Risk Hunch');
    expect(msg).toContain('navigation');
  });

  it('includes stuck hunches with days', () => {
    const msg = buildMissionPathwaysMessage(fullMissionData);
    expect(msg).toContain('Slow Hunch');
    expect(msg).toContain('45');
  });

  it('does not throw on empty data', () => {
    expect(() => buildMissionPathwaysMessage(emptyMissionData)).not.toThrow();
  });
});

describe('buildCloseContactsMessage', () => {
  it('includes learning titles and summaries', () => {
    const msg = buildCloseContactsMessage(fullContactsData);
    expect(msg).toContain('Heat resilience patterns');
    expect(msg).toContain('Urban areas show...');
  });

  it('includes coherent hunches', () => {
    const msg = buildCloseContactsMessage(fullContactsData);
    expect(msg).toContain('Mycorrhizal corridors');
    expect(msg).toContain('coherence');
  });

  it('returns fallback message when no data', () => {
    const msg = buildCloseContactsMessage(emptyContactsData);
    expect(msg).toContain('No significant activity');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/newsletter/__tests__/agents.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement agents.ts**

Create `src/lib/newsletter/agents.ts`:

```typescript
import type { MissionPathwaysData, CloseContactsData } from './select';

export const MISSION_PATHWAYS_PROMPT = `You are writing a plain-text field intelligence brief for an internal team meeting.
Write in a concise, factual style. No bullet overload — use short paragraphs.
Structure: Opening status line → Hunch movement → Active commitments → Tests with signals → [Optional] Agenda flag if anything is stuck or needs decision.
Do not include headers or markdown. Plain text only.
Length: 200–350 words.`;

export const CLOSE_CONTACTS_PROMPT = `You are writing a plain-text field update for colleagues doing related work in the field.
Write as one practitioner sharing with another — warm, honest, reflective.
Structure: What we've been learning → What tested out → Where our thinking has landed.
Do not include headers or markdown. Plain text only.
Length: 250–400 words.`;

export function buildMissionPathwaysMessage(data: MissionPathwaysData): string {
  const lines: string[] = ['## Knowledge Graph — Last 6 Weeks', ''];

  const stageOrder = ['hypothesis', 'uncertainty', 'navigation', 'coherence', 'holding'];
  const stageLines = stageOrder
    .filter(s => (data.stageCounts[s] ?? 0) > 0)
    .map(s => `${s}: ${data.stageCounts[s]}`);
  if (stageLines.length > 0) {
    lines.push('Hunch stages: ' + stageLines.join(', '));
  }

  if (data.recentlyMoved.length > 0) {
    lines.push('');
    lines.push('Recently moved:');
    for (const h of data.recentlyMoved) {
      lines.push(`- "${h.title}" → ${h.lifecycle_stage}`);
    }
  }

  if (data.activeCommitments.length > 0) {
    lines.push('');
    lines.push('Active commitments:');
    for (const c of data.activeCommitments) {
      lines.push(`- ${c.title}`);
    }
  }

  if (data.completedCommitments.length > 0) {
    lines.push('');
    lines.push('Completed this period:');
    for (const c of data.completedCommitments) {
      lines.push(`- ${c.title}`);
    }
  }

  if (data.testsWithActivity.length > 0) {
    lines.push('');
    lines.push('Tests with recent activity:');
    for (const t of data.testsWithActivity) {
      lines.push(`- ${t.title}`);
    }
  }

  if (data.stuckHunches.length > 0) {
    lines.push('');
    lines.push('Stuck (30+ days in same stage):');
    for (const h of data.stuckHunches) {
      lines.push(`- "${h.title}" (${h.lifecycle_stage}, ${h.daysStuck} days)`);
    }
  }

  return lines.join('\n');
}

export function buildCloseContactsMessage(data: CloseContactsData): string {
  const lines: string[] = ['## Field Intelligence — Last 6 Weeks', ''];

  if (data.learnings.length > 0) {
    lines.push('Learnings:');
    for (const l of data.learnings) {
      lines.push(`- "${l.title}"${l.summary ? ': ' + l.summary : ''}`);
    }
  }

  if (data.testsWithActivity.length > 0) {
    lines.push('');
    lines.push('Tests with recent activity:');
    for (const t of data.testsWithActivity) {
      lines.push(`- ${t.title}`);
    }
  }

  if (data.coherentHunches.length > 0) {
    lines.push('');
    lines.push('Ideas that have reached coherence or are being held:');
    for (const h of data.coherentHunches) {
      lines.push(`- "${h.title}" (${h.lifecycle_stage})`);
    }
  }

  if (data.learnings.length === 0 && data.testsWithActivity.length === 0 && data.coherentHunches.length === 0) {
    lines.push('No significant activity in the last 6 weeks.');
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/newsletter/__tests__/agents.test.ts
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/newsletter/agents.ts src/lib/newsletter/__tests__/agents.test.ts
git commit -m "feat: newsletter system prompts and message builders"
```

---

## Task 5: API routes

**Files:**
- Create: `src/app/api/newsletters/route.ts`
- Create: `src/app/api/newsletters/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/newsletters/__tests__/route.test.ts`:

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

vi.mock('@/lib/llm', () => ({
  callLLM: vi.fn().mockResolvedValue({ content: 'Generated newsletter text.', model: 'claude-sonnet-4-6' }),
}));

vi.mock('@/lib/newsletter/select', () => ({
  selectMissionPathwaysNodes: vi.fn().mockResolvedValue({
    stageCounts: { hypothesis: 1 },
    recentlyMoved: [],
    activeCommitments: [],
    completedCommitments: [],
    testsWithActivity: [],
    stuckHunches: [],
  }),
  selectCloseContactsNodes: vi.fn().mockResolvedValue({
    learnings: [],
    testsWithActivity: [],
    coherentHunches: [],
  }),
}));

describe('GET /api/newsletters', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no user') });
    const { GET } = await import('../route');
    const req = new Request('http://test/api/newsletters?type=mission_pathways');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid type', async () => {
    const { GET } = await import('../route');
    const req = new Request('http://test/api/newsletters?type=invalid');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns newsletter list for valid type', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'n1', content: 'test', created_at: '2026-01-01' }], error: null }),
    });
    const { GET } = await import('../route');
    const req = new Request('http://test/api/newsletters?type=mission_pathways');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/newsletters', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no user') });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/newsletters', {
      method: 'POST',
      body: JSON.stringify({ type: 'mission_pathways' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid type', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://test/api/newsletters', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid_type' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('generates and saves a newsletter', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'n1', content: 'Generated newsletter text.', created_at: '2026-05-05T00:00:00Z' },
        error: null,
      }),
    });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/newsletters', {
      method: 'POST',
      body: JSON.stringify({ type: 'mission_pathways' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { content: string } };
    expect(body.data.content).toBe('Generated newsletter text.');
  });

  it('generates close contacts newsletter', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'n2', content: 'Field update text.', created_at: '2026-05-05T00:00:00Z' },
        error: null,
      }),
    });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/newsletters', {
      method: 'POST',
      body: JSON.stringify({ type: 'close_contacts' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/app/api/newsletters/__tests__/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the API route**

Create `src/app/api/newsletters/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callLLM } from '@/lib/llm';
import { selectMissionPathwaysNodes, selectCloseContactsNodes } from '@/lib/newsletter/select';
import {
  MISSION_PATHWAYS_PROMPT,
  CLOSE_CONTACTS_PROMPT,
  buildMissionPathwaysMessage,
  buildCloseContactsMessage,
} from '@/lib/newsletter/agents';

const typeSchema = z.enum(['mission_pathways', 'close_contacts']);
const postSchema = z.object({ type: typeSchema });

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const typeResult = typeSchema.safeParse(searchParams.get('type'));
  if (!typeResult.success) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  const { data, error } = await supabase
    .from('newsletters')
    .select('id, type, content, created_at')
    .eq('author_id', user.id)
    .eq('type', typeResult.data)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: 'Failed to load newsletters' }, { status: 500 });

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

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { type } = parsed.data;

  let userMessage: string;
  let systemPrompt: string;

  if (type === 'mission_pathways') {
    const nodeData = await selectMissionPathwaysNodes(supabase);
    userMessage = buildMissionPathwaysMessage(nodeData);
    systemPrompt = MISSION_PATHWAYS_PROMPT;
  } else {
    const nodeData = await selectCloseContactsNodes(supabase);
    userMessage = buildCloseContactsMessage(nodeData);
    systemPrompt = CLOSE_CONTACTS_PROMPT;
  }

  const llmResponse = await callLLM('newsletter', { systemPrompt, userMessage, maxTokens: 800 });

  const { data: newsletter, error: insertError } = await supabase
    .from('newsletters')
    .insert({ type, content: llmResponse.content, author_id: user.id })
    .select('id, content, created_at')
    .single();

  if (insertError || !newsletter) {
    return NextResponse.json({ error: 'Failed to save newsletter' }, { status: 500 });
  }

  return NextResponse.json({ data: newsletter }, { status: 201 });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/api/newsletters/__tests__/route.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/newsletters/route.ts src/app/api/newsletters/__tests__/route.test.ts
git commit -m "feat: newsletters API route (GET list, POST generate)"
```

---

## Task 6: NewsletterTabs client component

**Files:**
- Create: `src/components/newsletter/NewsletterTabs.tsx`

No unit tests for this component — it is a UI-only client component tested manually in the browser.

- [ ] **Step 1: Create the component**

Create `src/components/newsletter/NewsletterTabs.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

type NewsletterType = 'mission_pathways' | 'close_contacts';

interface Newsletter {
  readonly id: string;
  readonly type: NewsletterType;
  readonly content: string;
  readonly created_at: string;
}

const TAB_LABELS: Record<NewsletterType, string> = {
  mission_pathways: 'Mission Pathways',
  close_contacts: 'Close Contacts',
};

export function NewsletterTabs() {
  const [activeTab, setActiveTab] = useState<NewsletterType>('mission_pathways');
  const [generating, setGenerating] = useState(false);
  const [currentOutput, setCurrentOutput] = useState<string | null>(null);
  const [history, setHistory] = useState<Newsletter[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async (type: NewsletterType) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const res = await fetch(`/api/newsletters?type=${type}`);
      const body = await res.json() as { data?: Newsletter[]; error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Failed to load history');
        return;
      }
      setHistory(body.data ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    setCurrentOutput(null);
    setExpandedId(null);
    void loadHistory(activeTab);
  }, [activeTab, loadHistory]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/newsletters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeTab }),
      });
      const body = await res.json() as { data?: Newsletter; error?: string };
      if (!res.ok || !body.data) {
        setError(body.error ?? 'Failed to generate newsletter');
        return;
      }
      setCurrentOutput(body.data.content);
      setHistory(prev => [body.data!, ...prev]);
    } catch {
      setError('Network error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="flex gap-4 mb-6 border-b border-cof-border">
        {(['mission_pathways', 'close_contacts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-node-hunch border-b-2 border-node-hunch'
                : 'text-cof-text-tertiary hover:text-cof-text-secondary'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <button
        onClick={() => void handleGenerate()}
        disabled={generating}
        className="mb-6 px-4 py-2 text-sm bg-node-hunch text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {generating ? 'Generating...' : `Generate ${TAB_LABELS[activeTab]} brief`}
      </button>

      {error && (
        <p className="mb-4 text-sm text-red-400">{error}</p>
      )}

      {currentOutput && (
        <div className="mb-8">
          <p className="text-xs text-cof-text-tertiary mb-2">Just generated — select all and copy</p>
          <textarea
            readOnly
            value={currentOutput}
            rows={16}
            className="w-full font-mono text-sm bg-cof-bg-elevated border border-cof-border rounded-md p-4 text-cof-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-node-hunch"
          />
        </div>
      )}

      <div>
        <h2 className="text-xs text-cof-text-tertiary uppercase tracking-widest mb-3">History</h2>
        {loadingHistory ? (
          <p className="text-sm text-cof-text-tertiary">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-cof-text-tertiary">No newsletters generated yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map(item => (
              <div key={item.id} className="border border-cof-border rounded-md overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full flex items-start justify-between gap-4 px-4 py-3 text-left hover:bg-cof-bg-elevated transition-colors"
                >
                  <span className="text-xs text-cof-text-tertiary shrink-0">
                    {new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-sm text-cof-text-secondary truncate flex-1">
                    {item.content.slice(0, 80)}…
                  </span>
                  <span className="text-xs text-cof-text-tertiary shrink-0">
                    {expandedId === item.id ? '▲' : '▼'}
                  </span>
                </button>
                {expandedId === item.id && (
                  <div className="px-4 pb-4 border-t border-cof-border">
                    <textarea
                      readOnly
                      value={item.content}
                      rows={16}
                      className="w-full mt-3 font-mono text-sm bg-cof-bg-elevated border border-cof-border rounded-md p-4 text-cof-text-primary resize-none focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/newsletter/NewsletterTabs.tsx
git commit -m "feat: NewsletterTabs client component"
```

---

## Task 7: Newsletter page and navigation updates

**Files:**
- Create: `src/app/newsletter/page.tsx`
- Modify: `src/components/layout/NavBar.tsx`
- Modify: `src/components/layout/MobileNav.tsx`

- [ ] **Step 1: Create the newsletter page**

Create `src/app/newsletter/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NewsletterTabs } from '@/components/newsletter/NewsletterTabs';

export default async function NewsletterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-cof-text-primary">Field Intelligence</h1>
          <p className="mt-1 text-sm text-cof-text-tertiary">
            Generate briefings from the knowledge graph for your networks.
          </p>
        </div>
        <NewsletterTabs />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update NavBar links**

In `src/components/layout/NavBar.tsx`, find the `links` array (currently at line ~20):

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

Replace with:

```typescript
const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/graph', label: 'Graph' },
  { href: '/portfolios', label: 'Portfolios' },
  { href: '/newsletter', label: 'Intelligence' },
  { href: '/commitments', label: 'Commitments' },
  { href: '/query', label: 'Query' },
  { href: '/review', label: 'Health' },
  { href: '/reflect', label: 'Reflect' },
  { href: '/capture', label: 'Capture' },
  { href: '/settings', label: 'Settings' },
];
```

- [ ] **Step 3: Update MobileNav**

In `src/components/layout/MobileNav.tsx`, find the `NAV_ITEMS` array:

```typescript
const NAV_ITEMS = [
  { href: '/portfolios', label: 'Portfolios', icon: '◎' },
  { href: '/graph', label: 'Graph', icon: '🕸' },
  { href: '/capture', label: 'Capture', icon: '＋' },
  { href: '/query', label: 'Query', icon: '💬' },
  { href: '/', label: 'Home', icon: '⌂' },
] as const;
```

Replace with:

```typescript
const NAV_ITEMS = [
  { href: '/portfolios', label: 'Portfolios', icon: '◎' },
  { href: '/graph', label: 'Graph', icon: '🕸' },
  { href: '/capture', label: 'Capture', icon: '＋' },
  { href: '/newsletter', label: 'Intel', icon: '✉' },
  { href: '/', label: 'Home', icon: '⌂' },
] as const;
```

- [ ] **Step 4: Run the full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all tests pass. If any pre-existing tests fail, note them — do not fix pre-existing failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/newsletter/page.tsx src/components/layout/NavBar.tsx src/components/layout/MobileNav.tsx
git commit -m "feat: newsletter page and nav updates (restore Capture, add Intelligence)"
```

---

## Final Checklist

- [ ] SQL migration file created (`supabase/v0.9-newsletters.sql`) — run it in Supabase SQL Editor
- [ ] All tests pass: `npx vitest run`
- [ ] `/newsletter` page loads and shows two tabs
- [ ] Generate button produces plain text output in the textarea
- [ ] History list shows past newsletters, click to expand
- [ ] Capture appears in desktop nav
- [ ] Intelligence appears in desktop nav at `/newsletter`
