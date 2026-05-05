# Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline feedback widget to all AI-generated output surfaces (newsletter, query, reflect) so users can flag errors in free text — the system then auto-corrects the contributing knowledge graph nodes via an LLM correction agent.

**Architecture:** Node references are stored at generation time (stored context + correction agent — Option A). When feedback is submitted, `POST /api/feedback` inserts a record and kicks off a background `after()` task that fetches contributing nodes, calls an LLM correction agent, and applies update/archive/create actions directly on the Supabase `nodes` table. The widget is a self-contained client component dropped under each output.

**Tech Stack:** Next.js 15 app router, Supabase (server client), Zod v4, Vitest + React Testing Library, `callLLM` abstraction (`src/lib/llm/index.ts`), `after()` from `next/server`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/v0.10-feedback.sql` | query_sessions table, node_refs on newsletters, feedback table, RLS |
| Modify | `src/lib/llm/index.ts` | Add 'correction' agent |
| Create | `src/lib/correction/agent.ts` | buildCorrectionPrompt, parseCorrectionActions, applyCorrection |
| Create | `src/lib/correction/__tests__/agent.test.ts` | Unit tests for pure helpers |
| Create | `src/app/api/feedback/route.ts` | POST /api/feedback |
| Create | `src/app/api/feedback/__tests__/route.test.ts` | API route tests |
| Create | `src/components/feedback/FeedbackWidget.tsx` | Shared client component |
| Create | `src/components/feedback/__tests__/FeedbackWidget.test.tsx` | Component tests |
| Modify | `src/app/api/newsletters/route.ts` | Collect + store node_refs on insert |
| Modify | `src/components/newsletter/NewsletterTabs.tsx` | Capture newsletter.id, add FeedbackWidget |
| Modify | `src/app/api/query/route.ts` | Pre-generate session_id, save query_session, add X-Query-Session-Id header |
| Modify | `src/app/query/AskMode.tsx` | Capture session_id from header, add FeedbackWidget per message |
| Modify | `src/app/api/reflect/session/route.ts` | Return session ID in response |
| Modify | `src/app/reflect/ReflectClient.tsx` | Capture session ID after save, add FeedbackWidget |

---

## Task 1: SQL Migration

**Files:**
- Create: `supabase/v0.10-feedback.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/v0.10-feedback.sql
-- Feedback loop tables
-- Run in Supabase SQL Editor

-- 1. Add node_refs to newsletters (tracks which nodes contributed to each newsletter)
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS node_refs UUID[] DEFAULT '{}';

-- 2. Persist query context so feedback can reference contributing nodes
CREATE TABLE IF NOT EXISTS query_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  response   TEXT NOT NULL,
  node_refs  UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_sessions_author ON query_sessions(author_id);

ALTER TABLE query_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own query sessions" ON query_sessions
  FOR ALL USING (author_id = auth.uid());

-- 3. Feedback records (one per user-submitted correction)
CREATE TABLE IF NOT EXISTS feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type   TEXT NOT NULL CHECK (source_type IN ('reflection', 'query', 'newsletter')),
  source_id     UUID NOT NULL,
  feedback_text TEXT NOT NULL,
  applied_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_author ON feedback(author_id);
CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(source_type, source_id);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own feedback" ON feedback
  FOR ALL USING (author_id = auth.uid());
```

- [ ] **Step 2: Commit**

```bash
git add supabase/v0.10-feedback.sql
git commit -m "chore: add feedback loop SQL migration (v0.10)"
```

---

## Task 2: Register Correction LLM Agent

**Files:**
- Modify: `src/lib/llm/index.ts`

- [ ] **Step 1: Read current AgentName type and AGENT_DEFAULT_MODELS**

Current file is at `src/lib/llm/index.ts`. The relevant lines:
```typescript
const AGENT_DEFAULT_MODELS: Record<string, string> = {
  // ... existing agents
  newsletter: 'claude-sonnet-4-6',
};

export type AgentName = 'extraction' | 'review' | 'create' | 'reflection' | 'process' | 'setup' | 'query' | 'digest' | 'portfolio' | 'newsletter';
```

- [ ] **Step 2: Add correction agent**

In `src/lib/llm/index.ts`, add `correction` to both locations:

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
  correction: 'claude-sonnet-4-6',
};

export type AgentName = 'extraction' | 'review' | 'create' | 'reflection' | 'process' | 'setup' | 'query' | 'digest' | 'portfolio' | 'newsletter' | 'correction';
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/llm/index.ts
git commit -m "feat: register correction LLM agent"
```

---

## Task 3: Correction Agent (TDD)

**Files:**
- Create: `src/lib/correction/__tests__/agent.test.ts`
- Create: `src/lib/correction/agent.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/correction/__tests__/agent.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { buildCorrectionPrompt, parseCorrectionActions } from '../agent';
import type { CorrectionNode } from '../agent';

const mockNodes: CorrectionNode[] = [
  { id: 'node-1', node_type: 'hunch', title: 'AI will transform finance', description: 'This is happening' },
  { id: 'node-2', node_type: 'learning', title: 'Old learning', description: 'Outdated info' },
];

describe('buildCorrectionPrompt', () => {
  it('includes all node IDs in the prompt', () => {
    const prompt = buildCorrectionPrompt('Generated text here', mockNodes, 'node-1 is wrong');
    expect(prompt).toContain('node-1');
    expect(prompt).toContain('node-2');
  });

  it('includes the user feedback text', () => {
    const feedback = 'The description is completely incorrect';
    const prompt = buildCorrectionPrompt('Output', mockNodes, feedback);
    expect(prompt).toContain(feedback);
  });

  it('includes the generated text', () => {
    const generated = 'This was the AI output';
    const prompt = buildCorrectionPrompt(generated, mockNodes, 'wrong');
    expect(prompt).toContain(generated);
  });

  it('includes node titles and descriptions', () => {
    const prompt = buildCorrectionPrompt('Output', mockNodes, 'feedback');
    expect(prompt).toContain('AI will transform finance');
    expect(prompt).toContain('Outdated info');
  });
});

describe('parseCorrectionActions', () => {
  it('parses an update action', () => {
    const raw = JSON.stringify({
      reasoning: 'description was wrong',
      actions: [{ action: 'update', node_id: 'node-1', fields: { description: 'corrected' } }],
    });
    const result = parseCorrectionActions(raw);
    expect(result.reasoning).toBe('description was wrong');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({ action: 'update', node_id: 'node-1' });
  });

  it('parses an archive action', () => {
    const raw = JSON.stringify({
      reasoning: 'node was irreparably wrong',
      actions: [{ action: 'archive', node_id: 'node-2' }],
    });
    const result = parseCorrectionActions(raw);
    expect(result.actions[0]).toMatchObject({ action: 'archive', node_id: 'node-2' });
  });

  it('parses a create action', () => {
    const raw = JSON.stringify({
      reasoning: 'missing information',
      actions: [{ action: 'create', node_type: 'learning', title: 'New node', description: 'Correct info' }],
    });
    const result = parseCorrectionActions(raw);
    expect(result.actions[0]).toMatchObject({ action: 'create', node_type: 'learning', title: 'New node' });
  });

  it('returns empty actions on invalid JSON', () => {
    const result = parseCorrectionActions('not json {{{');
    expect(result.actions).toEqual([]);
    expect(result.reasoning).toBe('');
  });

  it('returns empty actions when actions field is missing', () => {
    const raw = JSON.stringify({ reasoning: 'something', no_actions: [] });
    const result = parseCorrectionActions(raw);
    expect(result.actions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/lib/correction/__tests__/agent.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the correction agent**

Create `src/lib/correction/agent.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { callLLM } from '@/lib/llm';

export interface CorrectionNode {
  readonly id: string;
  readonly node_type: string;
  readonly title: string;
  readonly description: string | null;
}

export type CorrectionAction =
  | { readonly action: 'update'; readonly node_id: string; readonly fields: { readonly title?: string; readonly description?: string; readonly domain_tags?: string[] } }
  | { readonly action: 'archive'; readonly node_id: string }
  | { readonly action: 'create'; readonly node_type: string; readonly title: string; readonly description: string };

export interface CorrectionResult {
  readonly reasoning: string;
  readonly actions: readonly CorrectionAction[];
}

const CORRECTION_SYSTEM_PROMPT = `You are a knowledge graph correction agent. The user has flagged an error in AI-generated output.
You will receive: the original generated text, the nodes that contributed to it (with their full content), and the user's feedback describing what is wrong.

Your job is to decide what corrections are needed and apply them as a JSON action list.

Actions available:
- update: modify title, description, or domain_tags on an existing node
- archive: set a node's status to 'archived' (use when a node contains fundamentally wrong information)
- create: add a new node with correct information (use when the user explicitly identifies something missing)

Rules:
- Only touch nodes that are directly relevant to the feedback
- Prefer update over archive unless the node is irreparably wrong
- Only create a node when the user explicitly identifies missing information
- Return ONLY valid JSON — no explanation, no markdown

Output schema:
{
  "reasoning": "one sentence explaining what was wrong",
  "actions": [
    { "action": "update", "node_id": "<uuid>", "fields": { "description": "corrected text" } },
    { "action": "archive", "node_id": "<uuid>" },
    { "action": "create", "node_type": "learning", "title": "...", "description": "..." }
  ]
}`;

export function buildCorrectionPrompt(
  generatedText: string,
  nodes: readonly CorrectionNode[],
  feedbackText: string
): string {
  const nodesSection = nodes.map(n =>
    `ID: ${n.id}\nType: ${n.node_type}\nTitle: ${n.title}\nDescription: ${n.description ?? '(none)'}`
  ).join('\n\n');

  return `ORIGINAL GENERATED OUTPUT:\n${generatedText}\n\nCONTRIBUTING NODES:\n${nodesSection}\n\nUSER FEEDBACK:\n${feedbackText}`;
}

export function parseCorrectionActions(rawJson: string): CorrectionResult {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return { reasoning: '', actions: [] };
    const obj = parsed as Record<string, unknown>;
    const reasoning = typeof obj['reasoning'] === 'string' ? obj['reasoning'] : '';
    if (!Array.isArray(obj['actions'])) return { reasoning, actions: [] };
    const actions = (obj['actions'] as unknown[]).filter((a): a is CorrectionAction => {
      if (typeof a !== 'object' || a === null) return false;
      const action = (a as Record<string, unknown>)['action'];
      return action === 'update' || action === 'archive' || action === 'create';
    });
    return { reasoning, actions };
  } catch {
    return { reasoning: '', actions: [] };
  }
}

export async function applyCorrection(
  feedbackId: string,
  nodeRefs: readonly string[],
  generatedText: string,
  feedbackText: string,
  supabase: SupabaseClient,
  authorId: string
): Promise<void> {
  const nodes: CorrectionNode[] = [];

  if (nodeRefs.length > 0) {
    const { data } = await supabase
      .from('nodes')
      .select('id, node_type, title, description')
      .in('id', nodeRefs);
    if (data) {
      for (const row of data) {
        nodes.push({
          id: row.id as string,
          node_type: row.node_type as string,
          title: row.title as string,
          description: (row.description ?? null) as string | null,
        });
      }
    }
  }

  const userMessage = buildCorrectionPrompt(generatedText, nodes, feedbackText);
  const llmResponse = await callLLM('correction', {
    systemPrompt: CORRECTION_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 600,
  });

  const { actions } = parseCorrectionActions(llmResponse.content);

  for (const action of actions) {
    if (action.action === 'update') {
      await supabase.from('nodes').update(action.fields).eq('id', action.node_id);
    } else if (action.action === 'archive') {
      await supabase.from('nodes').update({ status: 'archived' }).eq('id', action.node_id);
    } else if (action.action === 'create') {
      await supabase.from('nodes').insert({
        node_type: action.node_type,
        title: action.title,
        description: action.description,
        status: 'raw',
        author_id: authorId,
        hunch_type: 'new',
        confidence_level: 3,
        confidence_basis: 'intuition',
      });
    }
  }

  await supabase.from('feedback').update({ applied_at: new Date().toISOString() }).eq('id', feedbackId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/lib/correction/__tests__/agent.test.ts 2>&1 | tail -20
```

Expected: 9 tests pass.

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/correction/agent.ts src/lib/correction/__tests__/agent.test.ts
git commit -m "feat: add correction agent with TDD"
```

---

## Task 4: Feedback API Route (TDD)

**Files:**
- Create: `src/app/api/feedback/__tests__/route.test.ts`
- Create: `src/app/api/feedback/route.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/feedback/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAfter = vi.fn((fn: () => Promise<void>) => { void fn(); });
const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
  from: mockFrom,
};

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: mockAfter };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

vi.mock('@/lib/correction/agent', () => ({
  applyCorrection: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('returns 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no user') });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'newsletter', source_id: 'n1', feedback_text: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing feedback_text)', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'newsletter', source_id: 'n1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid source_type', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'invalid', source_id: 'n1', feedback_text: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when source record not found', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'newsletter', source_id: 'no-such-id', feedback_text: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('inserts feedback and returns 201 for newsletter source', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'n1', content: 'newsletter content', node_refs: ['node-a'] },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'fb-1', created_at: '2026-05-05T00:00:00Z' },
          error: null,
        }),
      });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'newsletter', source_id: 'n1', feedback_text: 'wrong info' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string };
    expect(body.id).toBe('fb-1');
  });

  it('calls after() to schedule background correction', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'n1', content: 'newsletter content', node_refs: [] },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'fb-1', created_at: '2026-05-05T00:00:00Z' },
          error: null,
        }),
      });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'newsletter', source_id: 'n1', feedback_text: 'something is wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(req);
    expect(mockAfter).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/app/api/feedback/__tests__/route.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the feedback API route**

Create `src/app/api/feedback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { applyCorrection } from '@/lib/correction/agent';

const postSchema = z.object({
  source_type: z.enum(['reflection', 'query', 'newsletter']),
  source_id: z.string().uuid(),
  feedback_text: z.string().trim().min(1).max(2000),
});

type SourceType = 'reflection' | 'query' | 'newsletter';

const SOURCE_TABLE: Record<SourceType, string> = {
  newsletter: 'newsletters',
  query: 'query_sessions',
  reflection: 'reflection_sessions',
};

const SOURCE_CONTENT_FIELD: Record<SourceType, string> = {
  newsletter: 'content',
  query: 'response',
  reflection: 'machine_reflection',
};

function extractNodeRefs(sourceType: SourceType, record: Record<string, unknown>): string[] {
  if (sourceType === 'newsletter' || sourceType === 'query') {
    const refs = record['node_refs'];
    return Array.isArray(refs) ? refs.filter((r): r is string => typeof r === 'string') : [];
  }
  // reflection: extract from machine_reflection JSONB
  const mr = record['machine_reflection'];
  if (!mr || typeof mr !== 'object') return [];
  const report = mr as Record<string, unknown>;
  const ids = new Set<string>();
  const contradictions = report['contradictions'];
  if (Array.isArray(contradictions)) {
    for (const c of contradictions) {
      const nodeIds = (c as Record<string, unknown>)['node_ids'];
      if (Array.isArray(nodeIds)) {
        for (const id of nodeIds) {
          if (typeof id === 'string') ids.add(id);
        }
      }
    }
  }
  const recommendations = report['recommendations'];
  if (Array.isArray(recommendations)) {
    for (const r of recommendations) {
      const targetId = (r as Record<string, unknown>)['target_node_id'];
      if (typeof targetId === 'string') ids.add(targetId);
    }
  }
  return [...ids];
}

function extractGeneratedText(sourceType: SourceType, record: Record<string, unknown>): string {
  const field = SOURCE_CONTENT_FIELD[sourceType];
  const val = record[field];
  if (sourceType === 'reflection' && typeof val === 'object' && val !== null) {
    return JSON.stringify(val);
  }
  return typeof val === 'string' ? val : '';
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

  const { source_type, source_id, feedback_text } = parsed.data;
  const table = SOURCE_TABLE[source_type];

  const { data: sourceRecord, error: sourceError } = await supabase
    .from(table)
    .select('*')
    .eq('id', source_id)
    .single();

  if (sourceError || !sourceRecord) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  const record = sourceRecord as Record<string, unknown>;
  const nodeRefs = extractNodeRefs(source_type, record);
  const generatedText = extractGeneratedText(source_type, record);

  const { data: feedback, error: insertError } = await supabase
    .from('feedback')
    .insert({
      author_id: user.id,
      source_type,
      source_id,
      feedback_text,
    })
    .select('id, created_at')
    .single();

  if (insertError || !feedback) {
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  const feedbackId = (feedback as Record<string, unknown>)['id'] as string;
  const userId = user.id;

  after(async () => {
    const bgSupabase = await createClient();
    try {
      await applyCorrection(feedbackId, nodeRefs, generatedText, feedback_text, bgSupabase, userId);
    } catch (err) {
      console.error('[feedback] correction failed:', err);
    }
  });

  return NextResponse.json(
    { id: feedbackId, created_at: (feedback as Record<string, unknown>)['created_at'] },
    { status: 201 }
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/app/api/feedback/__tests__/route.test.ts 2>&1 | tail -20
```

Expected: all 6 tests pass.

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/feedback/route.ts src/app/api/feedback/__tests__/route.test.ts
git commit -m "feat: add feedback API route with background correction"
```

---

## Task 5: FeedbackWidget Component (TDD)

**Files:**
- Create: `src/components/feedback/__tests__/FeedbackWidget.test.tsx`
- Create: `src/components/feedback/FeedbackWidget.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/feedback/__tests__/FeedbackWidget.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackWidget } from '../FeedbackWidget';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FeedbackWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders idle state with feedback link', () => {
    render(<FeedbackWidget sourceType="newsletter" sourceId="n1" />);
    expect(screen.getByText(/something wrong/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/describe/i)).not.toBeInTheDocument();
  });

  it('opens the form when the link is clicked', () => {
    render(<FeedbackWidget sourceType="newsletter" sourceId="n1" />);
    fireEvent.click(screen.getByText(/something wrong/i));
    expect(screen.getByPlaceholderText(/describe what/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('shows loading state on submit', async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<FeedbackWidget sourceType="newsletter" sourceId="n1" />);
    fireEvent.click(screen.getByText(/something wrong/i));
    const textarea = screen.getByPlaceholderText(/describe what/i);
    fireEvent.change(textarea, { target: { value: 'this is wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
    });
  });

  it('shows confirmation on successful submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'fb-1', created_at: '2026-05-05' }),
    });
    render(<FeedbackWidget sourceType="query" sourceId="q1" />);
    fireEvent.click(screen.getByText(/something wrong/i));
    fireEvent.change(screen.getByPlaceholderText(/describe what/i), { target: { value: 'node info was incorrect' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByText(/feedback received/i)).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText(/describe what/i)).not.toBeInTheDocument();
  });

  it('shows error and keeps form open on failed submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });
    render(<FeedbackWidget sourceType="reflection" sourceId="r1" />);
    fireEvent.click(screen.getByText(/something wrong/i));
    fireEvent.change(screen.getByPlaceholderText(/describe what/i), { target: { value: 'wrong node' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/describe what/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/components/feedback/__tests__/FeedbackWidget.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement FeedbackWidget**

Create `src/components/feedback/FeedbackWidget.tsx`:

```typescript
'use client';

import { useState } from 'react';

type FeedbackState = 'idle' | 'open' | 'submitting' | 'done' | 'error';

interface FeedbackWidgetProps {
  readonly sourceType: 'reflection' | 'query' | 'newsletter';
  readonly sourceId: string;
}

export function FeedbackWidget({ sourceType, sourceId }: FeedbackWidgetProps) {
  const [state, setState] = useState<FeedbackState>('idle');
  const [text, setText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit() {
    if (!text.trim()) return;
    setState('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: sourceType, source_id: sourceId, feedback_text: text.trim() }),
      });
      const body = await res.json() as { id?: string; error?: string };
      if (!res.ok) {
        setErrorMsg(body.error ?? 'Failed to submit feedback');
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setErrorMsg('Network error — please try again');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <p className="mt-3 text-xs text-cof-text-tertiary">
        Feedback received — corrections applying in the background.
      </p>
    );
  }

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setState('open')}
        className="mt-3 text-xs text-cof-text-tertiary hover:text-cof-text-secondary transition-colors"
      >
        Something wrong? Give feedback
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe what's incorrect or missing…"
        rows={3}
        className="w-full text-sm bg-cof-bg-elevated border border-cof-border rounded-md px-3 py-2 text-cof-text-primary placeholder-cof-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-node-hunch"
      />
      {(state === 'error') && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={state === 'submitting' || !text.trim()}
          className="px-3 py-1 text-xs bg-node-hunch text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {state === 'submitting' ? 'Submitting…' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={() => { setState('idle'); setText(''); setErrorMsg(''); }}
          className="px-3 py-1 text-xs text-cof-text-tertiary hover:text-cof-text-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/components/feedback/__tests__/FeedbackWidget.test.tsx 2>&1 | tail -20
```

Expected: 5 tests pass.

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/feedback/FeedbackWidget.tsx src/components/feedback/__tests__/FeedbackWidget.test.tsx
git commit -m "feat: add FeedbackWidget client component with TDD"
```

---

## Task 6: Newsletter Route + UI Updates

**Files:**
- Modify: `src/app/api/newsletters/route.ts`
- Modify: `src/components/newsletter/NewsletterTabs.tsx`

The newsletter route needs to collect node IDs from the content selection results and store them in `node_refs`. The `NewsletterTabs` component needs to track the `id` of the most recently generated newsletter and render `FeedbackWidget`.

- [ ] **Step 1: Update the newsletter POST route to store node_refs**

In `src/app/api/newsletters/route.ts`, modify the POST handler to collect node IDs:

The current select result types (`MissionPathwaysData` and `CloseContactsData`) both have arrays of objects with `id` fields. Collect all node IDs from all arrays.

Replace the current POST body (lines 56–83):

```typescript
  const { type } = parsed.data;

  let userMessage: string;
  let systemPrompt: string;
  let llmResponse: { content: string };
  let nodeRefs: string[] = [];

  try {
    if (type === 'mission_pathways') {
      const nodeData = await selectMissionPathwaysNodes(supabase);
      userMessage = buildMissionPathwaysMessage(nodeData);
      systemPrompt = MISSION_PATHWAYS_PROMPT;
      nodeRefs = [
        ...nodeData.recentlyMoved,
        ...nodeData.activeCommitments,
        ...nodeData.completedCommitments,
        ...nodeData.testsWithActivity,
        ...nodeData.stuckHunches,
      ].map(n => n.id);
    } else {
      const nodeData = await selectCloseContactsNodes(supabase);
      userMessage = buildCloseContactsMessage(nodeData);
      systemPrompt = CLOSE_CONTACTS_PROMPT;
      nodeRefs = [
        ...nodeData.learnings,
        ...nodeData.testsWithActivity,
        ...nodeData.coherentHunches,
      ].map(n => n.id);
    }
    // Deduplicate
    nodeRefs = [...new Set(nodeRefs)];
    llmResponse = await callLLM('newsletter', { systemPrompt, userMessage, maxTokens: 800 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: newsletter, error: insertError } = await supabase
    .from('newsletters')
    .insert({ type, content: llmResponse.content, author_id: user.id, node_refs: nodeRefs })
    .select('id, type, content, created_at')
    .single();

  if (insertError || !newsletter) {
    return NextResponse.json({ error: 'Failed to save newsletter' }, { status: 500 });
  }

  return NextResponse.json({ data: newsletter }, { status: 201 });
```

- [ ] **Step 2: Run existing newsletter tests**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run src/app/api/newsletters/__tests__/route.test.ts 2>&1 | tail -20
```

Expected: all tests still pass (the insert mock doesn't validate the node_refs field).

- [ ] **Step 3: Update NewsletterTabs to show FeedbackWidget**

In `src/components/newsletter/NewsletterTabs.tsx`:

1. Add import at top: `import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';`
2. Add state: `const [currentId, setCurrentId] = useState<string | null>(null);`
3. In `handleGenerate`, after `setCurrentOutput(body.data.content)`, add: `setCurrentId(body.data.id);`
4. Also reset `currentId` when tab changes: in the `useEffect`, add `setCurrentId(null);`
5. After the output `<textarea>`, add:
```tsx
{currentId && (
  <FeedbackWidget sourceType="newsletter" sourceId={currentId} />
)}
```

Full updated `handleGenerate` and state declarations:

```typescript
// Add alongside other useState declarations:
const [currentId, setCurrentId] = useState<string | null>(null);

// In useEffect for tab switch, add:
setCurrentId(null);

// In handleGenerate, after setCurrentOutput:
setCurrentId(body.data.id);
```

Full updated output section (replace the existing `{currentOutput && ...}` block):

```tsx
{currentOutput && (
  <div className="mb-8">
    <p className="text-xs text-cof-text-tertiary mb-2">Just generated — select all and copy</p>
    <textarea
      readOnly
      value={currentOutput}
      rows={16}
      className="w-full font-mono text-sm bg-cof-bg-elevated border border-cof-border rounded-md p-4 text-cof-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-node-hunch"
    />
    {currentId && (
      <FeedbackWidget sourceType="newsletter" sourceId={currentId} />
    )}
  </div>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/newsletters/route.ts src/components/newsletter/NewsletterTabs.tsx
git commit -m "feat: store node_refs on newsletter, add feedback widget to newsletter UI"
```

---

## Task 7: Query Route + UI Updates

**Files:**
- Modify: `src/app/api/query/route.ts`
- Modify: `src/app/query/AskMode.tsx`

The query route streams. The plan: generate a session UUID before streaming, include it in `X-Query-Session-Id` response header, and save the `query_sessions` row inside the streaming `start` function after the loop completes (before `controller.close()`).

`AskMode.tsx` extends the `Message` interface to include `sessionId?: string`, reads the header once streaming starts, and shows `FeedbackWidget` under each completed assistant message.

- [ ] **Step 1: Update the query route to save query_sessions**

In `src/app/api/query/route.ts`, the changes are:

1. At top of POST handler, after auth/validation, before stream creation:
```typescript
const sessionId = crypto.randomUUID();
```

2. Inside the `ReadableStream` `start` function, add accumulator before the for-await loop:
```typescript
let accumulatedResponse = '';
```

3. Inside the content_block_delta handler, also accumulate:
```typescript
accumulatedResponse += chunk.delta.text;
```

4. After the for-await loop completes, before `controller.close()`, save the session:
```typescript
await supabase
  .from('query_sessions')
  .insert({
    id: sessionId,
    author_id: user.id,
    query_text: query,
    response: accumulatedResponse,
    node_refs: contextNodeIds,
  });
controller.close();
```

(Remove the standalone `controller.close()` that was previously there.)

5. Add `'X-Query-Session-Id': sessionId` to the response headers.

Full modified `stream` and return in the route (replace lines 99–132 entirely):

```typescript
  const sessionId = crypto.randomUUID();
  const encoder = new TextEncoder();
  const anthropic = new Anthropic({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: process.env.QUERY_LLM_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        let accumulatedResponse = '';
        for await (const chunk of messageStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            accumulatedResponse += chunk.delta.text;
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        await supabase
          .from('query_sessions')
          .insert({
            id: sessionId,
            author_id: user.id,
            query_text: query,
            response: accumulatedResponse,
            node_refs: contextNodeIds,
          });

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Context-Nodes': JSON.stringify(contextNodeIds),
      'X-Query-Session-Id': sessionId,
    },
  });
```

- [ ] **Step 2: TypeScript check on query route**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Update AskMode to capture session_id and show FeedbackWidget**

In `src/app/query/AskMode.tsx`:

1. Add import at top: `import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';`

2. Extend the `Message` interface to add `sessionId`:
```typescript
interface Message {
  readonly id: number;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly nodeIds: readonly string[];
  readonly savedNodeId?: string;
  readonly sessionId?: string;
}
```

3. In `handleSubmit`, after reading `contextNodeIds` from the `X-Context-Nodes` header, also read the session ID:
```typescript
let sessionId: string | undefined;
try {
  const raw = res.headers.get('X-Query-Session-Id');
  sessionId = raw ?? undefined;
} catch {
  // non-fatal
}
```

4. When updating the final assistant message (in the `while (true)` loop, on the `done` break or after), also set `sessionId`. Currently the message is updated as:
```typescript
updated[updated.length - 1] = { ...updated[updated.length - 1], content: current, nodeIds: contextNodeIds };
```

This update happens on every chunk. The `sessionId` should be set on the initial assistant message placeholder, not in the streaming loop. Add it when the placeholder message is created:

```typescript
// Replace:
setMessages(prev => [...prev, { id: nextId.current++, role: 'assistant', content: '', nodeIds: [] }]);
// With:
setMessages(prev => [...prev, { id: nextId.current++, role: 'assistant', content: '', nodeIds: [], sessionId: undefined }]);
```

Then after the stream ends (after the while loop, before `setIsStreaming(false)`), update the last message with sessionId:
```typescript
setMessages(prev => {
  const updated = [...prev];
  updated[updated.length - 1] = {
    ...updated[updated.length - 1],
    sessionId,
  };
  return updated;
});
```

5. In the assistant message render block, after the save-to-graph section (inside `{msg.content && !isStreaming && ...}`), add FeedbackWidget:

```tsx
{msg.content && !isStreaming && (
  <div className="mt-2">
    {/* existing save-to-graph section */}
    ...
    {msg.sessionId && (
      <FeedbackWidget sourceType="query" sourceId={msg.sessionId} />
    )}
  </div>
)}
```

The full updated inner render for assistant messages (replace the `{msg.content && !isStreaming && ...}` block):

```tsx
{msg.content && !isStreaming && (
  <div className="mt-2">
    {msg.savedNodeId ? (
      <a
        href={`/capture/${msg.savedNodeId}`}
        className="text-xs text-node-hunch hover:underline"
      >
        Saved to graph →
      </a>
    ) : saveState?.messageId === msg.id ? (
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <input
          type="text"
          value={saveState.title}
          onChange={e => setSaveState(s => s ? { ...s, title: e.target.value, saveError: null } : null)}
          placeholder="Node title…"
          className="text-xs bg-cof-bg-elevated border border-cof-border rounded px-2 py-1 text-cof-text-primary w-56 focus:outline-none focus:border-node-hunch"
        />
        <div className="flex gap-1">
          {(['learning', 'hunch'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setSaveState(s => s ? { ...s, nodeType: t } : null)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${saveState.nodeType === t ? 'border-node-hunch bg-node-hunch/10 text-node-hunch' : 'border-cof-border text-cof-text-tertiary'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!saveState.title.trim() || saveState.saving}
          onClick={() => handleSave(msg)}
          className="text-xs px-3 py-1 bg-node-hunch text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {saveState.saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setSaveState(null)}
          className="text-xs text-cof-text-tertiary hover:text-cof-text-secondary"
        >
          Cancel
        </button>
        {saveState.saveError && (
          <p className="text-xs text-red-500 w-full mt-1">{saveState.saveError}</p>
        )}
      </div>
    ) : (
      <button
        type="button"
        onClick={() => openSaveForm(msg)}
        className="text-xs text-cof-text-tertiary hover:text-node-hunch transition-colors mt-1"
      >
        Save to graph
      </button>
    )}
    {msg.sessionId && (
      <FeedbackWidget sourceType="query" sourceId={msg.sessionId} />
    )}
  </div>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/query/route.ts src/app/query/AskMode.tsx
git commit -m "feat: persist query sessions and add feedback widget to query UI"
```

---

## Task 8: Reflect Route + UI Updates

**Files:**
- Modify: `src/app/api/reflect/session/route.ts`
- Modify: `src/app/reflect/ReflectClient.tsx`

The reflect session route currently returns `{ success: true }`. We need it to return the session ID. The ReflectClient component then stores the ID and shows `FeedbackWidget` after a successful save.

- [ ] **Step 1: Update reflect session route to return session ID**

In `src/app/api/reflect/session/route.ts`, the insert currently does not select. Change:

```typescript
    const { error: insertError } = await supabase.from('reflection_sessions').insert({
```

To:

```typescript
    const { data: inserted, error: insertError } = await supabase.from('reflection_sessions').insert({
      machine_reflection: body.machine_reflection ?? {},
      human_responses: body.human_responses,
      decisions: body.decisions,
      convergence_snapshot: body.convergence_snapshot ?? {},
      participants: body.participants ?? [user.id],
      node_count_at_reflection: body.node_count_at_reflection ?? 0,
      triggered_by: 'on_demand',
      run_by: user.id,
    }).select('id').single();
```

And change the success return:

```typescript
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: (inserted as { id: string }).id });
```

- [ ] **Step 2: Update ReflectClient to capture session ID and show FeedbackWidget**

In `src/app/reflect/ReflectClient.tsx`:

1. Add import: `import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';`

2. Add state variable:
```typescript
const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
```

3. In `handleSave`, update the success branch from:
```typescript
      setSaveResult(res.ok ? 'success' : 'error');
```
To:
```typescript
      if (res.ok) {
        const body = await res.json() as { success: boolean; id?: string };
        setSaveResult('success');
        if (body.id) setSavedSessionId(body.id);
      } else {
        setSaveResult('error');
      }
```

4. After the save button section (after `{saveResult === 'error' && ...}`), add:
```tsx
{savedSessionId && (
  <FeedbackWidget sourceType="reflection" sourceId={savedSessionId} />
)}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
cd /Users/gurden/Documents/code/cof-learning-system && npx vitest run 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reflect/session/route.ts src/app/reflect/ReflectClient.tsx
git commit -m "feat: return session ID from reflect route, add feedback widget to reflect UI"
```

---

## Self-Review Checklist

After all tasks are complete, verify:

- [ ] `supabase/v0.10-feedback.sql` exists and has all three schema changes
- [ ] `correction` agent is in AgentName type and AGENT_DEFAULT_MODELS
- [ ] `buildCorrectionPrompt` and `parseCorrectionActions` are pure and tested
- [ ] `applyCorrection` uses Supabase directly (not internal HTTP routes)
- [ ] Feedback API returns 201 and calls `after()` for background correction
- [ ] Newsletter route stores `node_refs` array (deduplicated) on insert
- [ ] Query route generates session UUID before streaming, saves session after stream completes
- [ ] Query `X-Query-Session-Id` header present in response
- [ ] `FeedbackWidget` appears under generated output on all 3 surfaces (newsletter, query, reflect)
- [ ] `FeedbackWidget` only shown when a source ID exists (won't render on history items or before generation)
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
