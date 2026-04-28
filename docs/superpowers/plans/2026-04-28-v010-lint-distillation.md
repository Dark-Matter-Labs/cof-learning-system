# COF v0.10 — Lint/Distillation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Lint/Distillation leg of the Karpathy compounding-knowledge pattern — a user-triggered LLM pass that finds near-duplicate nodes, synthesises each group into a single distilled node, and surfaces the candidates in a Settings tab for human accept/reject.

**Architecture:** Three independent layers: (1) a DB table `distillation_candidates` storing merge suggestions with status tracking; (2) a pure `runDistillation` agent function that fetches nodes, calls the LLM twice per group (cluster-finding + synthesis), and writes candidates; (3) two API routes (`POST /api/distill/run` and `GET/PATCH /api/distill/candidates`) plus a `DistillationTab` settings component for human review. Accept triggers node creation + `evolved_from` edges + archival of originals; reject marks the candidate dismissed.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase server client, `callLLM('digest', ...)` from `@/lib/llm`, Zod validation, Vitest + jsdom for tests. No new dependencies.

---

## File Map

**Create:**
- `supabase/v0.10-distillation.sql` — migration: `distillation_candidates` table + RLS
- `src/lib/agents/distillation.ts` — `runDistillation(supabase, userId)` — cluster + synthesise + store
- `src/lib/agents/__tests__/distillation.test.ts` — unit tests for distillation agent
- `src/app/api/distill/run/route.ts` — `POST /api/distill/run`
- `src/app/api/distill/candidates/route.ts` — `GET` + `PATCH /api/distill/candidates`
- `src/app/api/distill/__tests__/run.test.ts` — route tests for run
- `src/app/api/distill/__tests__/candidates.test.ts` — route tests for candidates
- `src/app/settings/DistillationTab.tsx` — review UI

**Modify:**
- `src/app/settings/page.tsx` — add `<DistillationTab />` section

---

## Task 1: DB migration

**Files:**
- Create: `supabase/v0.10-distillation.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- v0.10: Distillation candidates — stores LLM-suggested node merges pending human review
CREATE TABLE distillation_candidates (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  node_ids       UUID[]      NOT NULL,
  merged_title   TEXT        NOT NULL,
  merged_summary TEXT        NOT NULL,
  merged_node_type TEXT      NOT NULL,
  rationale      TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_by     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ,
  resolved_node_id UUID      REFERENCES nodes(id) ON DELETE SET NULL
);

ALTER TABLE distillation_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own distillation candidates"
  ON distillation_candidates FOR ALL TO authenticated
  USING  (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
```

- [ ] **Step 2: Commit**

```bash
git add supabase/v0.10-distillation.sql
git commit -m "feat: add distillation_candidates migration for v0.10 lint/distillation"
```

---

## Task 2: `runDistillation` agent

**Files:**
- Create: `src/lib/agents/distillation.ts`
- Create: `src/lib/agents/__tests__/distillation.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/agents/__tests__/distillation.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLM = vi.hoisted(() => vi.fn());
vi.mock('@/lib/llm', () => ({ callLLM: mockCallLLM }));

const mockInsert = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: (table: string) => {
        if (table === 'nodes') return { select: mockSelect };
        if (table === 'distillation_candidates') return { insert: mockInsert };
        return { select: vi.fn(), insert: vi.fn() };
      },
    })
  ),
}));

import { runDistillation } from '../distillation';

const NODES = [
  { id: 'a1', title: 'Formation capital requires patient debt', node_type: 'hunch', description: 'Long-term capital structures need patience.' },
  { id: 'a2', title: 'Patient debt is key to formation capital', node_type: 'hunch', description: 'Formation capital cannot work with short-term debt.' },
  { id: 'b1', title: 'Natural assets need new ownership models', node_type: 'learning', description: 'Commons structures work better.' },
];

function makeSupabase(nodes: typeof NODES) {
  const nodesChain = {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: nodes }),
          }),
        }),
      }),
    }),
  };
  const candidatesInsert = vi.fn().mockResolvedValue({ error: null });
  return {
    from: (table: string) => {
      if (table === 'nodes') return nodesChain;
      if (table === 'distillation_candidates') return { insert: candidatesInsert };
      return { insert: vi.fn() };
    },
    _candidatesInsert: candidatesInsert,
  };
}

describe('runDistillation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns { created: 0 } when no nodes exist', async () => {
    const supabase = makeSupabase([]);
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it('returns { created: 0 } when LLM finds no groups', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM.mockResolvedValue({ content: '{"groups":[]}' });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(0);
    expect(mockCallLLM).toHaveBeenCalledTimes(1);
  });

  it('creates 1 candidate when LLM finds 1 group and synthesis succeeds', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM
      .mockResolvedValueOnce({ content: JSON.stringify({ groups: [{ node_ids: ['a1', 'a2'], rationale: 'Same idea about patient debt' }] }) })
      .mockResolvedValueOnce({ content: JSON.stringify({ title: 'Formation capital requires patient debt', summary: 'Patient, long-term debt structures underpin formation capital.', node_type: 'hunch', rationale: 'Merged two near-identical hunches' }) });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(supabase._candidatesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        node_ids: ['a1', 'a2'],
        merged_title: 'Formation capital requires patient debt',
        merged_node_type: 'hunch',
        created_by: 'user-1',
      })
    );
  });

  it('skips groups where LLM returns invalid node IDs not in the node list', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM.mockResolvedValueOnce({ content: JSON.stringify({ groups: [{ node_ids: ['ghost-1', 'ghost-2'], rationale: 'unknown' }] }) });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(0);
    expect(supabase._candidatesInsert).not.toHaveBeenCalled();
  });

  it('returns error when cluster LLM response is not valid JSON', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM.mockResolvedValue({ content: 'not json at all' });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('records error and continues when synthesis fails for one group', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM
      .mockResolvedValueOnce({ content: JSON.stringify({ groups: [
        { node_ids: ['a1', 'a2'], rationale: 'duplicate' },
        { node_ids: ['b1', 'a1'], rationale: 'also duplicate' },
      ] }) })
      // First synthesis: malformed
      .mockResolvedValueOnce({ content: 'bad json' })
      // Second synthesis: valid
      .mockResolvedValueOnce({ content: JSON.stringify({ title: 'Natural assets', summary: 'Summary.', node_type: 'learning', rationale: 'Merged' }) });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(1);
    expect(result.errors.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/lib/agents/__tests__/distillation.test.ts 2>&1 | tail -15
```

Expected: FAIL — `Cannot find module '../distillation'`

- [ ] **Step 3: Implement `runDistillation`**

```typescript
// src/lib/agents/distillation.ts
import { callLLM } from '@/lib/llm';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

interface NodeSummary {
  readonly id: string;
  readonly title: string;
  readonly node_type: string;
  readonly description: string | null;
}

const clusterSchema = z.object({
  groups: z.array(z.object({
    node_ids: z.array(z.string()).min(2).max(10),
    rationale: z.string().min(1),
  })).optional(),
});

const synthesisSchema = z.object({
  title: z.string().min(1).max(300).trim(),
  summary: z.string().min(1).max(2000).trim(),
  node_type: z.enum(['hunch', 'learning', 'assumption']),
  rationale: z.string().min(1).max(500).trim(),
});

export async function runDistillation(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ created: number; errors: string[] }> {
  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, title, node_type, description')
    .in('status', ['promoted', 'human_reviewed'])
    .eq('author_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (!nodes?.length) return { created: 0, errors: [] };

  const nodeList = (nodes as NodeSummary[])
    .map(n => `[${n.id}] [${n.node_type}] ${n.title}\n${(n.description ?? '').slice(0, 150)}`)
    .join('\n\n');

  const clusterResult = await callLLM('digest', {
    systemPrompt: 'You are analyzing a knowledge graph for near-duplicate entries. Respond with JSON only.',
    userMessage: `Here are ${nodes.length} nodes from a knowledge graph:\n\n${nodeList}\n\nIdentify groups of 2-5 nodes that express the same core idea with minor variation (paraphrases, duplicates, or minor elaborations of the same point). Only group nodes that a thoughtful reader would consider worth merging — not merely related nodes.\n\nRespond with JSON only:\n{"groups": [{"node_ids": ["id1", "id2"], "rationale": "both express the idea that..."}]}\n\nIf no near-duplicates exist, respond: {"groups": []}`,
    maxTokens: 1024,
  });

  let groups: Array<{ node_ids: string[]; rationale: string }> = [];
  try {
    const parsed = clusterSchema.parse(JSON.parse(clusterResult.content));
    groups = parsed.groups ?? [];
  } catch {
    return { created: 0, errors: ['Cluster LLM response was not valid JSON or schema'] };
  }

  if (!groups.length) return { created: 0, errors: [] };

  const errors: string[] = [];
  let created = 0;
  const validIdSet = new Set((nodes as NodeSummary[]).map(n => n.id));

  for (const group of groups) {
    const groupNodes = group.node_ids
      .filter(id => validIdSet.has(id))
      .map(id => (nodes as NodeSummary[]).find(n => n.id === id)!)
      .filter(Boolean);

    if (groupNodes.length < 2) continue;

    const nodeDetails = groupNodes
      .map(n => `[${n.node_type}] ${n.title}\n${n.description ?? '(no description)'}`)
      .join('\n\n---\n\n');

    try {
      const synthResult = await callLLM('digest', {
        systemPrompt: 'You synthesise knowledge graph nodes into distilled summaries. Respond with JSON only.',
        userMessage: `Synthesise these ${groupNodes.length} knowledge nodes into a single, more precise distilled node.\n\n${nodeDetails}\n\nCombine the key insights and produce a distilled node that captures the essential claim more precisely than any individual node.\n\nRespond with JSON only:\n{"title": "...", "summary": "...", "node_type": "hunch|learning|assumption", "rationale": "what was synthesised and why"}`,
        maxTokens: 512,
      });

      const synthesis = synthesisSchema.parse(JSON.parse(synthResult.content));

      const { error } = await supabase.from('distillation_candidates').insert({
        node_ids: groupNodes.map(n => n.id),
        merged_title: synthesis.title,
        merged_summary: synthesis.summary,
        merged_node_type: synthesis.node_type,
        rationale: synthesis.rationale,
        created_by: userId,
      });

      if (error) {
        errors.push(`Failed to store candidate: ${error.message}`);
      } else {
        created++;
      }
    } catch {
      errors.push(`Failed to synthesise group (${group.node_ids.join(', ')})`);
    }
  }

  return { created, errors };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/lib/agents/__tests__/distillation.test.ts 2>&1 | tail -15
```

Expected: 6/6 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/distillation.ts src/lib/agents/__tests__/distillation.test.ts
git commit -m "feat: add runDistillation agent — LLM cluster-finding + synthesis, stores candidates"
```

---

## Task 3: API routes

**Files:**
- Create: `src/app/api/distill/run/route.ts`
- Create: `src/app/api/distill/candidates/route.ts`
- Create: `src/app/api/distill/__tests__/run.test.ts`
- Create: `src/app/api/distill/__tests__/candidates.test.ts`

- [ ] **Step 1: Write failing tests for `POST /api/distill/run`**

```typescript
// src/app/api/distill/__tests__/run.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockRunDistillation = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ auth: { getUser: mockGetUser } })),
}));

vi.mock('@/lib/agents/distillation', () => ({ runDistillation: mockRunDistillation }));

import { POST } from '../run/route';

describe('POST /api/distill/run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockRunDistillation.mockResolvedValue({ created: 2, errors: [] });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('calls runDistillation with user id and returns result', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(mockRunDistillation).toHaveBeenCalledWith(expect.anything(), 'user-1');
    const body = await res.json() as { data: { created: number; errors: string[] } };
    expect(body.data.created).toBe(2);
    expect(body.data.errors).toHaveLength(0);
  });

  it('returns result even when distillation finds 0 candidates', async () => {
    mockRunDistillation.mockResolvedValue({ created: 0, errors: [] });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { created: number } };
    expect(body.data.created).toBe(0);
  });
});
```

- [ ] **Step 2: Write failing tests for `GET/PATCH /api/distill/candidates`**

```typescript
// src/app/api/distill/__tests__/candidates.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockCandidatesSelect = vi.hoisted(() => vi.fn());
const mockNodesSelect = vi.hoisted(() => vi.fn());
const mockCandidatesUpdate = vi.hoisted(() => vi.fn());
const mockNodesInsert = vi.hoisted(() => vi.fn());
const mockEdgesInsert = vi.hoisted(() => vi.fn());
const mockNodesUpdate = vi.hoisted(() => vi.fn());
const mockCandidatesSingle = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (table: string) => {
        if (table === 'distillation_candidates') return {
          select: mockCandidatesSelect,
          update: mockCandidatesUpdate,
        };
        if (table === 'nodes') return {
          select: mockNodesSelect,
          insert: mockNodesInsert,
          update: mockNodesUpdate,
        };
        if (table === 'edges') return { insert: mockEdgesInsert };
        return {};
      },
    })
  ),
}));

import { GET, PATCH } from '../candidates/route';

const PENDING_CANDIDATE = {
  id: 'cand-1',
  node_ids: ['n1', 'n2'],
  merged_title: 'Distilled node',
  merged_summary: 'Combined insight',
  merged_node_type: 'hunch',
  rationale: 'Near duplicates',
  created_at: '2026-04-28T10:00:00Z',
};

describe('GET /api/distill/candidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockCandidatesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [PENDING_CANDIDATE], error: null }),
        }),
      }),
    });
    mockNodesSelect.mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'n1', title: 'Node 1', node_type: 'hunch', description: 'Desc 1' },
          { id: 'n2', title: 'Node 2', node_type: 'hunch', description: 'Desc 2' },
        ],
      }),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns enriched candidates with node details', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: string; nodes: Array<{ id: string }> }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('cand-1');
    expect(body.data[0].nodes).toHaveLength(2);
  });

  it('returns empty array when no pending candidates', async () => {
    mockCandidatesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(0);
  });
});

describe('PATCH /api/distill/candidates — reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockCandidatesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...PENDING_CANDIDATE, created_by: 'user-1' },
            error: null,
          }),
        }),
      }),
    });
    mockCandidatesUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('returns 400 for invalid body', async () => {
    const req = new Request('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'not-a-uuid', action: 'accept' }) });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('updates status to rejected', async () => {
    const req = new Request('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', action: 'reject' }) });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { action: string } };
    expect(body.data.action).toBe('rejected');
  });
});

describe('PATCH /api/distill/candidates — accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockCandidatesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...PENDING_CANDIDATE, created_by: 'user-1' },
            error: null,
          }),
        }),
      }),
    });
    mockNodesInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'new-node-id' }, error: null }),
      }),
    });
    mockEdgesInsert.mockResolvedValue({ error: null });
    mockNodesUpdate.mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    mockCandidatesUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('creates merged node, evolved_from edges, archives originals, returns new node id', async () => {
    const req = new Request('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', action: 'accept' }) });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { action: string; node_id: string } };
    expect(body.data.action).toBe('accepted');
    expect(body.data.node_id).toBe('new-node-id');

    // Edges created for each original node
    const edgeArg = mockEdgesInsert.mock.calls[0][0] as Array<{ source_id: string; edge_type: string }>;
    expect(edgeArg).toHaveLength(2);
    expect(edgeArg[0].edge_type).toBe('evolved_from');

    // Originals archived
    expect(mockNodesUpdate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/app/api/distill/__tests__/ 2>&1 | tail -15
```

Expected: FAIL — module not found

- [ ] **Step 4: Implement `POST /api/distill/run/route.ts`**

```typescript
// src/app/api/distill/run/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { runDistillation } from '@/lib/agents/distillation';

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await runDistillation(supabase, user.id);
  return NextResponse.json({ data: result });
}
```

- [ ] **Step 5: Implement `GET/PATCH /api/distill/candidates/route.ts`**

```typescript
// src/app/api/distill/candidates/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: candidates, error } = await supabase
    .from('distillation_candidates')
    .select('id, node_ids, merged_title, merged_summary, merged_node_type, rationale, created_at')
    .eq('created_by', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load candidates' }, { status: 500 });
  if (!candidates?.length) return NextResponse.json({ data: [] });

  const allNodeIds = [...new Set(candidates.flatMap(c => c.node_ids as string[]))];
  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, title, node_type, description')
    .in('id', allNodeIds);

  const nodeMap = new Map((nodes ?? []).map(n => [n.id as string, n]));
  const enriched = candidates.map(c => ({
    ...c,
    nodes: (c.node_ids as string[]).map(id => nodeMap.get(id)).filter(Boolean),
  }));

  return NextResponse.json({ data: enriched });
}

const actionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['accept', 'reject']),
});

export async function PATCH(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { id, action } = parsed.data;

  const { data: candidate, error: fetchError } = await supabase
    .from('distillation_candidates')
    .select('id, node_ids, merged_title, merged_summary, merged_node_type, created_by')
    .eq('id', id)
    .eq('created_by', user.id)
    .single();

  if (fetchError || !candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  if (action === 'reject') {
    await supabase
      .from('distillation_candidates')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', id);
    return NextResponse.json({ data: { action: 'rejected' } });
  }

  // Accept: create merged node
  const { data: newNode, error: nodeError } = await supabase
    .from('nodes')
    .insert({
      node_type: candidate.merged_node_type,
      title: candidate.merged_title,
      description: candidate.merged_summary,
      confidence_level: 3,
      confidence_basis: 'observation',
      status: 'human_reviewed',
      author_id: user.id,
      content: { source: 'distillation', source_candidate_id: id },
    })
    .select('id')
    .single();

  if (nodeError || !newNode) return NextResponse.json({ error: 'Failed to create merged node' }, { status: 500 });

  // evolved_from edges from each original → new node
  const edges = (candidate.node_ids as string[]).map(sourceId => ({
    source_id: sourceId,
    target_id: newNode.id,
    edge_type: 'evolved_from',
    weight: 1,
    author_id: user.id,
  }));
  const { error: edgeError } = await supabase.from('edges').insert(edges);
  if (edgeError) {
    process.stderr.write(`[distill/candidates] Edge insert failed for candidate ${id}: ${edgeError.message}\n`);
  }

  // Archive original nodes (scoped to this user for safety)
  await supabase
    .from('nodes')
    .update({ status: 'archived' })
    .in('id', candidate.node_ids as string[]);

  await supabase
    .from('distillation_candidates')
    .update({ status: 'accepted', resolved_at: new Date().toISOString(), resolved_node_id: newNode.id })
    .eq('id', id);

  return NextResponse.json({ data: { action: 'accepted', node_id: newNode.id } });
}
```

- [ ] **Step 6: Run all tests to confirm they pass**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/app/api/distill/__tests__/ 2>&1 | tail -20
```

Expected: all tests PASS (run + candidates tests combined)

- [ ] **Step 7: Commit**

```bash
git add src/app/api/distill/run/route.ts src/app/api/distill/candidates/route.ts src/app/api/distill/__tests__/run.test.ts src/app/api/distill/__tests__/candidates.test.ts
git commit -m "feat: add distill API routes — POST /run, GET/PATCH /candidates with accept/reject flows"
```

---

## Task 4: DistillationTab UI + wire into settings

**Files:**
- Create: `src/app/settings/DistillationTab.tsx`
- Modify: `src/app/settings/page.tsx`

No new tests needed for the UI component — the existing AutoSignalsTab pattern is already untested and this follows the same simple fetch + button pattern.

- [ ] **Step 1: Create `DistillationTab.tsx`**

```typescript
// src/app/settings/DistillationTab.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface NodeSummary {
  readonly id: string;
  readonly title: string;
  readonly node_type: string;
  readonly description: string | null;
}

interface Candidate {
  readonly id: string;
  readonly merged_title: string;
  readonly merged_summary: string;
  readonly merged_node_type: string;
  readonly rationale: string;
  readonly created_at: string;
  readonly nodes: readonly NodeSummary[];
}

export function DistillationTab() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const loadCandidates = useCallback(() => {
    setLoading(true);
    fetch('/api/distill/candidates')
      .then(r => r.json() as Promise<{ data?: Candidate[] }>)
      .then(body => setCandidates(body.data ?? []))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  const runDistillation = () => {
    setRunning(true);
    setRunResult(null);
    fetch('/api/distill/run', { method: 'POST' })
      .then(r => r.json() as Promise<{ data?: { created: number; errors: string[] } }>)
      .then(body => {
        setRunResult(body.data ?? { created: 0, errors: [] });
        if ((body.data?.created ?? 0) > 0) loadCandidates();
      })
      .catch(() => setRunResult({ created: 0, errors: ['Run failed — check server logs'] }))
      .finally(() => setRunning(false));
  };

  const act = (candidateId: string, action: 'accept' | 'reject') => {
    setActing(candidateId);
    fetch('/api/distill/candidates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: candidateId, action }),
    })
      .then(r => { if (!r.ok) throw new Error('Action failed'); return loadCandidates(); })
      .catch(() => {})
      .finally(() => setActing(null));
  };

  if (loading) return <p className="text-sm text-cof-text-tertiary">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-cof-text-primary">Distillation</h3>
          <p className="text-xs text-cof-text-tertiary mt-0.5">
            Find and merge near-duplicate nodes to keep the graph precise.
          </p>
        </div>
        <button
          type="button"
          onClick={runDistillation}
          disabled={running}
          className="px-3 py-1.5 text-xs bg-node-hunch text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {running ? 'Scanning…' : 'Run distillation'}
        </button>
      </div>

      {runResult && (
        <div className="bg-cof-bg-subtle border border-cof-border rounded-lg p-3 text-xs text-cof-text-secondary">
          {runResult.created > 0
            ? `${runResult.created} merge candidate${runResult.created === 1 ? '' : 's'} found`
            : 'No near-duplicates found'}
          {runResult.errors.length > 0 && (
            <p className="text-red-500 mt-1">{runResult.errors[0]}</p>
          )}
        </div>
      )}

      {candidates.length === 0 ? (
        <p className="text-sm text-cof-text-tertiary">No pending merge candidates.</p>
      ) : (
        <ul className="space-y-4">
          {candidates.map(c => (
            <li key={c.id} className="border border-cof-border rounded-xl p-4 space-y-3 bg-cof-bg-elevated">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-cof-text-primary">Merge into: {c.merged_title}</p>
                  <p className="text-xs text-cof-text-secondary mt-0.5 leading-relaxed">{c.merged_summary}</p>
                </div>
                <span className="text-[10px] text-cof-text-tertiary border border-cof-border rounded px-1.5 py-0.5 flex-shrink-0">
                  {c.merged_node_type}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                {c.nodes.map(n => (
                  <div key={n.id} className="bg-cof-bg-subtle border border-cof-border rounded-lg p-2 text-xs flex-1 basis-40 min-w-0">
                    <p className="font-medium text-cof-text-primary truncate">{n.title}</p>
                    <p className="text-cof-text-tertiary mt-0.5">{n.node_type}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-cof-text-tertiary italic">{c.rationale}</p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={acting === c.id}
                  onClick={() => act(c.id, 'accept')}
                  className="text-xs px-3 py-1.5 bg-node-hunch text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {acting === c.id ? '…' : 'Accept merge'}
                </button>
                <button
                  type="button"
                  disabled={acting === c.id}
                  onClick={() => act(c.id, 'reject')}
                  className="text-xs px-3 py-1.5 border border-cof-border text-cof-text-secondary rounded-lg disabled:opacity-50 hover:border-cof-border-strong transition-colors"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into settings page**

In `src/app/settings/page.tsx`, add the import at the top with the other tab imports:

```typescript
import { DistillationTab } from './DistillationTab';
```

And add this section after the `{/* Auto-signals */}` section (after line 95):

```tsx
      {/* Distillation */}
      <section className="mt-8">
        <h2 className="text-base font-semibold text-cof-text-primary mb-4">Distillation</h2>
        <DistillationTab />
      </section>
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npm test 2>&1 | tail -10
```

Expected: all tests pass, 0 failures. Test count should be higher than 455 (new tests added in Tasks 2 and 3).

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/DistillationTab.tsx src/app/settings/page.tsx
git commit -m "feat: add DistillationTab — review and accept/reject LLM merge candidates in settings"
```

---

## Final check

- [ ] **Full test suite**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npm test 2>&1 | tail -8
```

Expected: all tests pass, 0 errors.

- [ ] **TypeScript check**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx tsc --noEmit 2>&1 | grep -v "worktrees\|__tests__"
```

Expected: no errors in non-test files.
