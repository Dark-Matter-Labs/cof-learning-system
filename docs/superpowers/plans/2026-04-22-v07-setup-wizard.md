# v0.7 Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 6-step onboarding wizard at /setup that creates the structural backbone of the knowledge graph, automatically shown to new users with no goal spaces.

**Architecture:** Multi-step client wizard backed by dedicated API routes. Each step persists to the DB on "Next". The home page server component checks for goal_space nodes and redirects if none exist. Step 5 seeds knowledge via three modes: free-text (calls existing extraction pipeline), file upload (reuses FileCaptureMode), or guided chat (new /api/setup/seed route).

**Tech Stack:** Next.js 16 App Router, Supabase (server client), @anthropic-ai/sdk via `callLLM`, React 19, Tailwind CSS 4, Vitest + React Testing Library

---

## File Structure

**Create:**
- `supabase/v0.7-contexts.sql`
- `src/app/setup/page.tsx`
- `src/app/setup/SetupWizardClient.tsx`
- `src/app/setup/steps/Step1Workspace.tsx`
- `src/app/setup/steps/Step2Team.tsx`
- `src/app/setup/steps/Step3Goals.tsx`
- `src/app/setup/steps/Step4Sites.tsx`
- `src/app/setup/steps/Step5SeedKnowledge.tsx`
- `src/app/setup/steps/Step5Write.tsx`
- `src/app/setup/steps/Step5Upload.tsx`
- `src/app/setup/steps/Step5Chat.tsx`
- `src/app/setup/steps/Step6Complete.tsx`
- `src/app/api/setup/workspace/route.ts`
- `src/app/api/setup/team/route.ts`
- `src/app/api/setup/goals/route.ts`
- `src/app/api/setup/goal-suggest/route.ts`
- `src/app/api/setup/sites/route.ts`
- `src/app/api/setup/seed/route.ts`
- `src/app/api/setup/stats/route.ts`
- `src/lib/agents/setup.ts`
- `src/app/setup/__tests__/SetupWizardClient.test.tsx`
- `src/app/api/setup/__tests__/workspace.test.ts`
- `src/app/api/setup/__tests__/team.test.ts`
- `src/app/api/setup/__tests__/goals.test.ts`
- `src/app/api/setup/__tests__/sites.test.ts`
- `src/app/api/setup/__tests__/seed.test.ts`
- `src/lib/agents/__tests__/setup.test.ts`

**Modify:**
- `src/app/page.tsx` — add goal_space check + redirect
- `src/lib/llm/index.ts` — add `'setup'` to `AgentName` union

---

## Task 1: DB Migration — contexts table

**Files:**
- Create: `supabase/v0.7-contexts.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/v0.7-contexts.sql
CREATE TABLE IF NOT EXISTS contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS context_id UUID REFERENCES contexts(id);

ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage contexts" ON contexts
  FOR ALL USING (auth.role() = 'authenticated');
```

- [ ] **Step 2: Run migration in Supabase Dashboard**

Open Supabase Dashboard → SQL Editor → paste and execute the file.
Expected: "Success. No rows returned."

Verify: `SELECT * FROM contexts;` → empty table, no error.
Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'context_id';` → returns 1 row.

- [ ] **Step 3: Commit**

```bash
git add supabase/v0.7-contexts.sql
git commit -m "feat: add contexts table and context_id to nodes for multi-workspace support"
```

---

## Task 2: Add 'setup' agent type to callLLM

**Files:**
- Modify: `src/lib/llm/index.ts:22`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/llm/__tests__/index.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('./providers/anthropic', () => ({
  callAnthropic: vi.fn().mockResolvedValue({ content: 'ok', model: 'claude-test', usage: { input_tokens: 1, output_tokens: 1 } }),
}));

import { callLLM } from '../index';

describe('callLLM', () => {
  it('accepts setup as a valid agent name', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const result = await callLLM('setup', {
      systemPrompt: 'You are a setup helper.',
      userMessage: 'Help me set up.',
    });
    expect(result.content).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/lib/llm/__tests__/index.test.ts
```

Expected: TypeScript error — `'setup'` not assignable to `AgentName`.

- [ ] **Step 3: Update AgentName union**

In `src/lib/llm/index.ts` line 22, change:
```typescript
type AgentName = 'extraction' | 'review' | 'create' | 'reflection' | 'process';
```
to:
```typescript
type AgentName = 'extraction' | 'review' | 'create' | 'reflection' | 'process' | 'setup';
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/lib/llm/__tests__/index.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/index.ts src/lib/llm/__tests__/index.test.ts
git commit -m "feat: add setup agent type to callLLM"
```

---

## Task 3: Setup LLM agent (goal suggestion + seed chat)

**Files:**
- Create: `src/lib/agents/setup.ts`
- Create: `src/lib/agents/__tests__/setup.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/agents/__tests__/setup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '@/lib/llm';
import { suggestGoal, processSeedChat } from '../setup';

const mockCallLLM = vi.mocked(callLLM);

describe('suggestGoal', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns title and description from LLM response', async () => {
    mockCallLLM.mockResolvedValue({
      content: JSON.stringify({ title: 'Establish formation capital model', description: 'A multi-capital vehicle operating at scale.' }),
      model: 'claude-test',
    });
    const result = await suggestGoal('We want to create a fund that works differently...');
    expect(result.title).toBe('Establish formation capital model');
    expect(result.description).toBe('A multi-capital vehicle operating at scale.');
  });

  it('throws on invalid JSON response', async () => {
    mockCallLLM.mockResolvedValue({ content: 'not json', model: 'claude-test' });
    await expect(suggestGoal('something')).rejects.toThrow('Failed to parse goal suggestion');
  });
});

describe('processSeedChat', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns reply and extracted nodes', async () => {
    mockCallLLM.mockResolvedValue({
      content: JSON.stringify({
        reply: 'Great, I captured that hunch.',
        extracted: [{ title: 'Warming requires new capital tools', node_type: 'hunch' }],
      }),
      model: 'claude-test',
    });
    const result = await processSeedChat({
      message: 'I think warming will drive new capital formation',
      history: [],
      goals: [{ title: 'Establish formation capital model' }],
    });
    expect(result.reply).toBe('Great, I captured that hunch.');
    expect(result.extracted).toHaveLength(1);
    expect(result.extracted[0].title).toBe('Warming requires new capital tools');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/lib/agents/__tests__/setup.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement setup agent**

```typescript
// src/lib/agents/setup.ts
import { callLLM } from '@/lib/llm';

const GOAL_SUGGEST_PROMPT = `You are helping a team articulate their strategic goals for a knowledge management system.
The user will describe what they're trying to do in plain language.
Your job is to distill it into a clear goal title and description.

Return ONLY valid JSON with no other text:
{
  "title": "Concise goal title (max 10 words)",
  "description": "2-sentence description of what success looks like"
}`;

const SEED_CHAT_PROMPT = (goals: ReadonlyArray<{ title: string }>) =>
  `You are helping a team seed their knowledge system. They have defined these goals:
${goals.map(g => `- ${g.title}`).join('\n')}

Ask about their hunches, assumptions, and learnings. After each response, extract 1-3 nodes.

Return ONLY valid JSON:
{
  "reply": "Your conversational response (1-2 sentences)",
  "extracted": [
    { "title": "Concise node title (max 10 words)", "node_type": "hunch|assumption_background|assumption_foreground|learning|signal" }
  ]
}

If the user hasn't shared enough yet, return extracted as [].`;

export interface GoalSuggestion {
  readonly title: string;
  readonly description: string;
}

export interface SeedChatInput {
  readonly message: string;
  readonly history: ReadonlyArray<{ readonly role: 'user' | 'assistant'; readonly content: string }>;
  readonly goals: ReadonlyArray<{ readonly title: string }>;
}

export interface SeedChatResult {
  readonly reply: string;
  readonly extracted: ReadonlyArray<{ readonly title: string; readonly node_type: string }>;
}

export async function suggestGoal(userInput: string): Promise<GoalSuggestion> {
  const response = await callLLM('setup', {
    systemPrompt: GOAL_SUGGEST_PROMPT,
    userMessage: userInput,
    maxTokens: 300,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    throw new Error('Failed to parse goal suggestion');
  }

  const { title, description } = parsed as { title: string; description: string };
  if (!title || !description) {
    throw new Error('Failed to parse goal suggestion');
  }
  return { title, description };
}

export async function processSeedChat(input: SeedChatInput): Promise<SeedChatResult> {
  const historyText = input.history
    .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n');

  const userMessage = historyText
    ? `${historyText}\nUser: ${input.message}`
    : input.message;

  const response = await callLLM('setup', {
    systemPrompt: SEED_CHAT_PROMPT(input.goals),
    userMessage,
    maxTokens: 600,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    throw new Error('Failed to parse seed chat response');
  }

  const { reply, extracted } = parsed as { reply: string; extracted: ReadonlyArray<{ title: string; node_type: string }> };
  return { reply: reply ?? '', extracted: extracted ?? [] };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/agents/__tests__/setup.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/setup.ts src/lib/agents/__tests__/setup.test.ts
git commit -m "feat: add setup LLM agent for goal suggestion and seed chat"
```

---

## Task 4: API routes — workspace, team, goals

**Files:**
- Create: `src/app/api/setup/workspace/route.ts`
- Create: `src/app/api/setup/team/route.ts`
- Create: `src/app/api/setup/goals/route.ts`
- Create: `src/app/api/setup/__tests__/workspace.test.ts`
- Create: `src/app/api/setup/__tests__/team.test.ts`
- Create: `src/app/api/setup/__tests__/goals.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/api/setup/__tests__/workspace.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { POST } from '../workspace/route';

describe('POST /api/setup/workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSingle.mockResolvedValue({ data: { id: 'ctx-1', name: 'Test Workspace' }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('creates a context and returns its id', async () => {
    const req = new Request('http://localhost/api/setup/workspace', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Workspace', description: 'A test workspace' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe('ctx-1');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Workspace' }));
  });

  it('returns 400 when name is missing', async () => {
    const req = new Request('http://localhost/api/setup/workspace', {
      method: 'POST',
      body: JSON.stringify({ description: 'No name' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const req = new Request('http://localhost/api/setup/workspace', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

```typescript
// src/app/api/setup/__tests__/team.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'p-1' }, { id: 'p-2' }], error: null }) });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser }, from: mockFrom })),
}));

import { POST } from '../team/route';

describe('POST /api/setup/team', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }); mockInsert.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'p-1' }], error: null }) }); mockFrom.mockReturnValue({ insert: mockInsert }); });

  it('creates person nodes for each member', async () => {
    const req = new Request('http://localhost/api/setup/team', {
      method: 'POST',
      body: JSON.stringify({ members: [{ name: 'Indy Johar', role: 'Founder' }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ node_type: 'person', title: 'Indy Johar' })])
    );
  });

  it('returns 400 for empty members array', async () => {
    const req = new Request('http://localhost/api/setup/team', {
      method: 'POST',
      body: JSON.stringify({ members: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

```typescript
// src/app/api/setup/__tests__/goals.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'g-1' }], error: null }) });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser }, from: mockFrom })),
}));

import { POST } from '../goals/route';

describe('POST /api/setup/goals', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }); mockInsert.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'g-1' }], error: null }) }); mockFrom.mockReturnValue({ insert: mockInsert }); });

  it('creates goal_space nodes', async () => {
    const req = new Request('http://localhost/api/setup/goals', {
      method: 'POST',
      body: JSON.stringify({ goals: [{ title: 'Establish capital model', description: 'Success is...' }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ node_type: 'goal_space', title: 'Establish capital model' })])
    );
  });

  it('returns 400 for empty goals', async () => {
    const req = new Request('http://localhost/api/setup/goals', {
      method: 'POST',
      body: JSON.stringify({ goals: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/app/api/setup/__tests__/
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement workspace route**

```typescript
// src/app/api/setup/workspace/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('contexts')
    .insert({ name: parsed.data.name, description: parsed.data.description ?? null, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
```

- [ ] **Step 4: Implement team route**

```typescript
// src/app/api/setup/team/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  members: z.array(z.object({ name: z.string().min(1), role: z.string().optional() })).min(1),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'At least one member required' }, { status: 400 });

  const nodes = parsed.data.members.map(m => ({
    node_type: 'person',
    title: m.name,
    description: m.role ?? null,
    status: 'promoted',
    confidence_level: 5,
    confidence_basis: 'strong_evidence',
    hunch_type: 'new',
    author_id: user.id,
  }));

  const { data, error } = await supabase.from('nodes').insert(nodes).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
```

- [ ] **Step 5: Implement goals route**

```typescript
// src/app/api/setup/goals/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  goals: z.array(z.object({ title: z.string().min(1), description: z.string().optional() })).min(1),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'At least one goal required' }, { status: 400 });

  const nodes = parsed.data.goals.map(g => ({
    node_type: 'goal_space',
    title: g.title,
    description: g.description ?? null,
    status: 'promoted',
    confidence_level: 3,
    confidence_basis: 'intuition',
    hunch_type: 'new',
    author_id: user.id,
  }));

  const { data, error } = await supabase.from('nodes').insert(nodes).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npx vitest run src/app/api/setup/__tests__/workspace.test.ts src/app/api/setup/__tests__/team.test.ts src/app/api/setup/__tests__/goals.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/setup/workspace/ src/app/api/setup/team/ src/app/api/setup/goals/ src/app/api/setup/__tests__/
git commit -m "feat: add setup API routes for workspace, team, and goals"
```

---

## Task 5: API routes — goal-suggest, sites, seed, stats

**Files:**
- Create: `src/app/api/setup/goal-suggest/route.ts`
- Create: `src/app/api/setup/sites/route.ts`
- Create: `src/app/api/setup/seed/route.ts`
- Create: `src/app/api/setup/stats/route.ts`
- Create: `src/app/api/setup/__tests__/sites.test.ts`
- Create: `src/app/api/setup/__tests__/seed.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/api/setup/__tests__/sites.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser }, from: mockFrom })),
}));

import { POST } from '../sites/route';

describe('POST /api/setup/sites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockInsert.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'n-1' }], error: null }) });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('creates site nodes', async () => {
    const req = new Request('http://localhost/api/setup/sites', {
      method: 'POST',
      body: JSON.stringify({
        sites: [{ name: 'Madrid', description: 'Urban heat' }],
        options: [],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ node_type: 'site', title: 'Madrid' })])
    );
  });

  it('creates option nodes with edges to goals', async () => {
    const req = new Request('http://localhost/api/setup/sites', {
      method: 'POST',
      body: JSON.stringify({
        sites: [],
        options: [{ name: 'Formation Capital', description: 'Bet on capital', goal_id: 'goal-1' }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('accepts empty sites and options (skip case)', async () => {
    const req = new Request('http://localhost/api/setup/sites', {
      method: 'POST',
      body: JSON.stringify({ sites: [], options: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
```

```typescript
// src/app/api/setup/__tests__/seed.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser }, from: mockFrom })),
}));

vi.mock('@/lib/agents/setup', () => ({
  processSeedChat: vi.fn().mockResolvedValue({
    reply: 'I captured your hunch.',
    extracted: [{ title: 'Capital formation is broken', node_type: 'hunch' }],
  }),
}));

import { POST } from '../seed/route';

describe('POST /api/setup/seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockInsert.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'n-1' }], error: null }) });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('chat mode: processes message, creates nodes, returns reply', async () => {
    const req = new Request('http://localhost/api/setup/seed', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'chat',
        message: 'I think the capital system is fundamentally broken',
        history: [],
        goals: [{ title: 'Establish capital model' }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe('I captured your hunch.');
    expect(body.extracted).toHaveLength(1);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('write mode: creates a raw node and triggers processing', async () => {
    const req = new Request('http://localhost/api/setup/seed', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'write',
        content: 'Key assumption: warming will drive new institutional demand.',
        goals: [],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.node_id).toBeDefined();
  });

  it('returns 400 for unknown mode', async () => {
    const req = new Request('http://localhost/api/setup/seed', {
      method: 'POST',
      body: JSON.stringify({ mode: 'unknown', content: 'foo', goals: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/app/api/setup/__tests__/sites.test.ts src/app/api/setup/__tests__/seed.test.ts
```

- [ ] **Step 3: Implement sites route**

```typescript
// src/app/api/setup/sites/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  sites: z.array(z.object({ name: z.string().min(1), description: z.string().optional() })),
  options: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    goal_id: z.string().uuid().optional(),
  })),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { sites, options } = parsed.data;
  const createdNodeIds: string[] = [];

  if (sites.length > 0) {
    const siteNodes = sites.map(s => ({
      node_type: 'site',
      title: s.name,
      description: s.description ?? null,
      status: 'promoted',
      confidence_level: 5,
      confidence_basis: 'strong_evidence',
      hunch_type: 'new',
      author_id: user.id,
    }));
    const { data, error } = await supabase.from('nodes').insert(siteNodes).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    createdNodeIds.push(...(data ?? []).map((n: { id: string }) => n.id));
  }

  if (options.length > 0) {
    const optionNodes = options.map(o => ({
      node_type: 'option',
      title: o.name,
      description: o.description ?? null,
      status: 'promoted',
      confidence_level: 3,
      confidence_basis: 'intuition',
      hunch_type: 'new',
      author_id: user.id,
    }));
    const { data, error } = await supabase.from('nodes').insert(optionNodes).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const optionData = data ?? [];
    createdNodeIds.push(...optionData.map((n: { id: string }) => n.id));

    const edges = optionData
      .map((optNode: { id: string }, idx: number) => {
        const goalId = options[idx]?.goal_id;
        if (!goalId) return null;
        return { source_id: optNode.id, target_id: goalId, edge_type: 'belongs_to_goalspace', weight: 1, author_id: user.id };
      })
      .filter(Boolean);

    if (edges.length > 0) {
      const { error: edgeError } = await supabase.from('edges').insert(edges);
      if (edgeError) return NextResponse.json({ error: edgeError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ data: { created: createdNodeIds.length } }, { status: 201 });
}
```

- [ ] **Step 4: Implement seed route**

```typescript
// src/app/api/setup/seed/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { processSeedChat } from '@/lib/agents/setup';

const chatSchema = z.object({
  mode: z.literal('chat'),
  message: z.string().min(1),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
  goals: z.array(z.object({ title: z.string() })),
});

const writeSchema = z.object({
  mode: z.literal('write'),
  content: z.string().min(1),
  goals: z.array(z.object({ title: z.string() })),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  if (body.mode === 'chat') {
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const result = await processSeedChat(parsed.data);

    if (result.extracted.length > 0) {
      const nodes = result.extracted.map(e => ({
        node_type: e.node_type,
        title: e.title,
        status: 'promoted',
        confidence_level: 2,
        confidence_basis: 'intuition',
        hunch_type: 'new',
        author_id: user.id,
      }));
      await supabase.from('nodes').insert(nodes);
    }

    return NextResponse.json({ reply: result.reply, extracted: result.extracted }, { status: 200 });
  }

  if (body.mode === 'write') {
    const parsed = writeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const { data: node, error } = await supabase
      .from('nodes')
      .insert({
        node_type: 'hunch',
        title: 'Initial assumptions',
        description: parsed.data.content,
        status: 'raw',
        confidence_level: 2,
        confidence_basis: 'intuition',
        hunch_type: 'new',
        author_id: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Trigger async extraction (fire-and-forget)
    const processUrl = new URL('/api/capture/process', request.url);
    fetch(processUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') ?? '' },
      body: JSON.stringify({ node_id: node.id }),
    }).catch(() => {});

    return NextResponse.json({ node_id: node.id }, { status: 200 });
  }

  return NextResponse.json({ error: 'Invalid mode. Expected chat or write.' }, { status: 400 });
}
```

- [ ] **Step 5: Implement goal-suggest route**

```typescript
// src/app/api/setup/goal-suggest/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { suggestGoal } from '@/lib/agents/setup';

const schema = z.object({ input: z.string().min(1) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Input is required' }, { status: 400 });

  try {
    const suggestion = await suggestGoal(parsed.data.input);
    return NextResponse.json({ data: suggestion }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to generate suggestion' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Implement stats route**

```typescript
// src/app/api/setup/stats/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const nodeTypeGroups = ['goal_space', 'site', 'option', 'person', 'hunch', 'assumption_background', 'assumption_foreground', 'learning', 'signal'];

  const counts: Record<string, number> = {};
  for (const nodeType of nodeTypeGroups) {
    const { count } = await supabase
      .from('nodes')
      .select('*', { count: 'exact', head: true })
      .eq('node_type', nodeType)
      .neq('status', 'archived');
    counts[nodeType] = count ?? 0;
  }

  const { count: edgeCount } = await supabase
    .from('edges')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({ data: { nodes: counts, edges: edgeCount ?? 0 } }, { status: 200 });
}
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
npx vitest run src/app/api/setup/__tests__/
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/setup/
git commit -m "feat: add setup API routes for sites, seed content, goal suggestion, and stats"
```

---

## Task 6: Home page redirect + /setup server page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/setup/page.tsx`

- [ ] **Step 1: Update home page to redirect new users**

Replace the entire content of `src/app/page.tsx`:

```typescript
// src/app/page.tsx
import { GraphOSSurface } from '@/components/graph/GraphOSSurface';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: goalSpaces } = await supabase
      .from('nodes')
      .select('id')
      .eq('node_type', 'goal_space')
      .neq('status', 'archived')
      .limit(1);

    if (!goalSpaces || goalSpaces.length === 0) {
      redirect('/setup');
    }
  }

  return <GraphOSSurface />;
}
```

- [ ] **Step 2: Create /setup server page**

```typescript
// src/app/setup/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SetupWizardClient } from './SetupWizardClient';

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  return <SetupWizardClient />;
}
```

- [ ] **Step 3: Verify manually**

Start dev server: `npm run dev`
Navigate to `http://localhost:3000` while logged in with no goal_space nodes.
Expected: redirect to `/setup`.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/setup/page.tsx
git commit -m "feat: redirect new users to setup wizard when no goal spaces exist"
```

---

## Task 7: SetupWizardClient — step state machine

**Files:**
- Create: `src/app/setup/SetupWizardClient.tsx`
- Create: `src/app/setup/__tests__/SetupWizardClient.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/setup/__tests__/SetupWizardClient.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('../steps/Step1Workspace', () => ({ Step1Workspace: ({ onNext }: { onNext: () => void }) => React.createElement('button', { onClick: onNext, 'data-testid': 'step1-next' }, 'Step 1 Next') }));
vi.mock('../steps/Step2Team', () => ({ Step2Team: ({ onNext }: { onNext: () => void }) => React.createElement('button', { onClick: onNext, 'data-testid': 'step2-next' }, 'Step 2 Next') }));
vi.mock('../steps/Step3Goals', () => ({ Step3Goals: ({ onNext }: { onNext: () => void }) => React.createElement('button', { onClick: onNext, 'data-testid': 'step3-next' }, 'Step 3 Next') }));
vi.mock('../steps/Step4Sites', () => ({ Step4Sites: ({ onNext }: { onNext: () => void }) => React.createElement('button', { onClick: onNext, 'data-testid': 'step4-next' }, 'Step 4 Next') }));
vi.mock('../steps/Step5SeedKnowledge', () => ({ Step5SeedKnowledge: ({ onNext }: { onNext: () => void }) => React.createElement('button', { onClick: onNext, 'data-testid': 'step5-next' }, 'Step 5 Next') }));
vi.mock('../steps/Step6Complete', () => ({ Step6Complete: () => React.createElement('div', { 'data-testid': 'step6' }, 'Complete') }));

import { SetupWizardClient } from '../SetupWizardClient';

describe('SetupWizardClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts on step 1', () => {
    render(React.createElement(SetupWizardClient));
    expect(screen.getByTestId('step1-next')).toBeInTheDocument();
  });

  it('advances to step 2 when step 1 calls onNext', async () => {
    const user = userEvent.setup();
    render(React.createElement(SetupWizardClient));
    await user.click(screen.getByTestId('step1-next'));
    expect(screen.getByTestId('step2-next')).toBeInTheDocument();
  });

  it('shows progress bar', () => {
    render(React.createElement(SetupWizardClient));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('saves progress to localStorage on step advance', async () => {
    const user = userEvent.setup();
    render(React.createElement(SetupWizardClient));
    await user.click(screen.getByTestId('step1-next'));
    expect(localStorage.getItem('setup_step')).toBe('2');
  });

  it('resumes from saved localStorage step', () => {
    localStorage.setItem('setup_step', '3');
    render(React.createElement(SetupWizardClient));
    expect(screen.getByTestId('step3-next')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/app/setup/__tests__/SetupWizardClient.test.tsx
```

- [ ] **Step 3: Implement SetupWizardClient**

```typescript
// src/app/setup/SetupWizardClient.tsx
'use client';

import { useState, useEffect } from 'react';
import { Step1Workspace } from './steps/Step1Workspace';
import { Step2Team } from './steps/Step2Team';
import { Step3Goals } from './steps/Step3Goals';
import { Step4Sites } from './steps/Step4Sites';
import { Step5SeedKnowledge } from './steps/Step5SeedKnowledge';
import { Step6Complete } from './steps/Step6Complete';

const TOTAL_STEPS = 6;

export function SetupWizardClient() {
  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState<ReadonlyArray<{ id: string; title: string }>>([]);

  useEffect(() => {
    const saved = localStorage.getItem('setup_step');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 1 && parsed <= TOTAL_STEPS) setStep(parsed);
    }
  }, []);

  const advance = (nextStep: number) => {
    setStep(nextStep);
    localStorage.setItem('setup_step', String(nextStep));
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
      <div
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        className="h-0.5 bg-gray-100 dark:bg-gray-800"
      >
        <div
          className="h-full bg-node-hunch transition-all duration-300"
          style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          {step === 1 && <Step1Workspace onNext={() => advance(2)} />}
          {step === 2 && <Step2Team onNext={() => advance(3)} onBack={() => advance(1)} />}
          {step === 3 && <Step3Goals onNext={(createdGoals) => { setGoals(createdGoals); advance(4); }} onBack={() => advance(2)} />}
          {step === 4 && <Step4Sites goals={goals} onNext={() => advance(5)} onBack={() => advance(3)} onSkip={() => advance(5)} />}
          {step === 5 && <Step5SeedKnowledge goals={goals} onNext={() => advance(6)} onBack={() => advance(4)} />}
          {step === 6 && <Step6Complete />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/app/setup/__tests__/SetupWizardClient.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/app/setup/SetupWizardClient.tsx src/app/setup/__tests__/SetupWizardClient.test.tsx
git commit -m "feat: SetupWizardClient step state machine with localStorage resume"
```

---

## Task 8: Steps 1–2 (Workspace + Team)

**Files:**
- Create: `src/app/setup/steps/Step1Workspace.tsx`
- Create: `src/app/setup/steps/Step2Team.tsx`

- [ ] **Step 1: Implement Step1Workspace**

```typescript
// src/app/setup/steps/Step1Workspace.tsx
'use client';

import { useState } from 'react';

interface Props {
  readonly onNext: () => void;
}

export function Step1Workspace({ onNext }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Failed to save workspace');
      const { data } = await res.json();
      localStorage.setItem('setup_context_id', data.id);
      localStorage.setItem('setup_workspace_name', name.trim());
      onNext();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">
        What are you working on?
      </h1>

      <div className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name this workspace"
          className="w-full px-4 py-3 text-lg border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30"
        />
        <div className="space-y-1">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the mission in a few sentences"
            rows={4}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30 resize-none"
          />
          <p className="text-xs text-gray-400">What is this team trying to achieve? This can evolve.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={!name.trim() || isLoading}
          className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {isLoading ? 'Saving...' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement Step2Team**

```typescript
// src/app/setup/steps/Step2Team.tsx
'use client';

import { useState } from 'react';

interface Member {
  readonly name: string;
  readonly role: string;
}

interface Props {
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step2Team({ onNext, onBack }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMember = () => {
    if (!name.trim()) return;
    setMembers(prev => [...prev, { name: name.trim(), role: role.trim() }]);
    setName('');
    setRole('');
  };

  const removeMember = (index: number) => {
    setMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    if (members.length === 0) { onNext(); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members }),
      });
      if (!res.ok) throw new Error('Failed to save team');
      onNext();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Who&apos;s on the team?</h1>

      <div className="space-y-2">
        {members.map((m, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{m.name}</span>
            {m.role && <span className="text-xs text-gray-400">{m.role}</span>}
            <button onClick={() => removeMember(i)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
        ))}

        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMember()}
            placeholder="Name"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30"
          />
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMember()}
            placeholder="Role (optional)"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30"
          />
          <button
            onClick={addMember}
            disabled={!name.trim()}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-40"
          >
            + Add
          </button>
        </div>
        <p className="text-xs text-gray-400">Everyone who'll use this system or frequently comes up in your work.</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button
          onClick={handleNext}
          disabled={isLoading}
          className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90"
        >
          {isLoading ? 'Saving...' : members.length === 0 ? 'Skip →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/setup/steps/Step1Workspace.tsx src/app/setup/steps/Step2Team.tsx
git commit -m "feat: add setup wizard steps 1 (workspace) and 2 (team)"
```

---

## Task 9: Step 3 — Goals with LLM helper

**Files:**
- Create: `src/app/setup/steps/Step3Goals.tsx`

- [ ] **Step 1: Implement Step3Goals**

```typescript
// src/app/setup/steps/Step3Goals.tsx
'use client';

import { useState } from 'react';

interface Goal {
  readonly title: string;
  readonly description: string;
}

interface Props {
  readonly onNext: (goals: ReadonlyArray<{ id: string; title: string }>) => void;
  readonly onBack: () => void;
}

export function Step3Goals({ onNext, onBack }: Props) {
  const [goals, setGoals] = useState<Goal[]>([{ title: '', description: '' }]);
  const [showHelper, setShowHelper] = useState(false);
  const [helperInput, setHelperInput] = useState('');
  const [helperLoading, setHelperLoading] = useState(false);
  const [helperSuggestion, setHelperSuggestion] = useState<{ title: string; description: string } | null>(null);
  const [helperTargetIndex, setHelperTargetIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateGoal = (index: number, field: 'title' | 'description', value: string) => {
    setGoals(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
  };

  const addGoal = () => setGoals(prev => [...prev, { title: '', description: '' }]);

  const openHelper = (index: number) => {
    setHelperTargetIndex(index);
    setShowHelper(true);
    setHelperSuggestion(null);
    setHelperInput('');
  };

  const runHelper = async () => {
    if (!helperInput.trim()) return;
    setHelperLoading(true);
    try {
      const res = await fetch('/api/setup/goal-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: helperInput }),
      });
      const { data } = await res.json();
      setHelperSuggestion(data);
    } catch {
      // helper is optional, silently fail
    } finally {
      setHelperLoading(false);
    }
  };

  const acceptSuggestion = () => {
    if (helperSuggestion === null || helperTargetIndex === null) return;
    updateGoal(helperTargetIndex, 'title', helperSuggestion.title);
    updateGoal(helperTargetIndex, 'description', helperSuggestion.description);
    setShowHelper(false);
    setHelperSuggestion(null);
  };

  const handleNext = async () => {
    const validGoals = goals.filter(g => g.title.trim());
    if (validGoals.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals: validGoals }),
      });
      if (!res.ok) throw new Error('Failed to save goals');
      const { data } = await res.json();
      onNext(data.map((n: { id: string; title: string }) => ({ id: n.id, title: n.title })));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasValidGoals = goals.some(g => g.title.trim());

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">What are you trying to achieve?</h1>
      <p className="text-sm text-gray-500">List the 2–4 big goals that everything else orients around.</p>

      <div className="space-y-4">
        {goals.map((goal, i) => (
          <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Goal {i + 1}</p>
            <input
              type="text"
              value={goal.title}
              onChange={e => updateGoal(i, 'title', e.target.value)}
              placeholder="Goal title"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30"
            />
            <textarea
              value={goal.description}
              onChange={e => updateGoal(i, 'description', e.target.value)}
              placeholder="What would success look like?"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30 resize-none"
            />
          </div>
        ))}

        <button onClick={addGoal} className="text-sm text-gray-400 hover:text-gray-600">+ Add another goal</button>
      </div>

      <div className="border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50 space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Help me think through this</p>
        {!showHelper ? (
          <button onClick={() => openHelper(goals.length - 1)} className="text-xs text-gray-400 hover:text-gray-600 underline">
            Describe what you're trying to do and I'll help structure it
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={helperInput}
              onChange={e => setHelperInput(e.target.value)}
              placeholder="Describe what you're trying to do in plain language..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-transparent focus:outline-none resize-none"
            />
            <button
              onClick={runHelper}
              disabled={!helperInput.trim() || helperLoading}
              className="text-xs px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded disabled:opacity-40"
            >
              {helperLoading ? 'Thinking...' : 'Suggest a goal'}
            </button>
            {helperSuggestion && (
              <div className="p-3 border border-node-hunch/30 rounded-lg bg-node-hunch/5 space-y-1">
                <p className="text-sm font-medium">{helperSuggestion.title}</p>
                <p className="text-xs text-gray-500">{helperSuggestion.description}</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={acceptSuggestion} className="text-xs px-2 py-1 bg-node-hunch text-white rounded">Accept</button>
                  <button onClick={() => setHelperSuggestion(null)} className="text-xs px-2 py-1 border border-gray-200 rounded">Revise</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button
          onClick={handleNext}
          disabled={!hasValidGoals || isLoading}
          className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90"
        >
          {isLoading ? 'Saving...' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/setup/steps/Step3Goals.tsx
git commit -m "feat: add setup wizard step 3 (goals with LLM helper)"
```

---

## Task 10: Step 4 — Sites and Options

**Files:**
- Create: `src/app/setup/steps/Step4Sites.tsx`

- [ ] **Step 1: Implement Step4Sites**

```typescript
// src/app/setup/steps/Step4Sites.tsx
'use client';

import { useState } from 'react';

interface Site {
  readonly name: string;
  readonly description: string;
}

interface Option {
  readonly name: string;
  readonly description: string;
  readonly goal_id: string;
}

interface Props {
  readonly goals: ReadonlyArray<{ id: string; title: string }>;
  readonly onNext: () => void;
  readonly onBack: () => void;
  readonly onSkip: () => void;
}

export function Step4Sites({ goals, onNext, onBack, onSkip }: Props) {
  const [sites, setSites] = useState<Site[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [siteName, setSiteName] = useState('');
  const [siteDesc, setSiteDesc] = useState('');
  const [optName, setOptName] = useState('');
  const [optDesc, setOptDesc] = useState('');
  const [optGoalId, setOptGoalId] = useState(goals[0]?.id ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSite = () => {
    if (!siteName.trim()) return;
    setSites(prev => [...prev, { name: siteName.trim(), description: siteDesc.trim() }]);
    setSiteName('');
    setSiteDesc('');
  };

  const addOption = () => {
    if (!optName.trim()) return;
    setOptions(prev => [...prev, { name: optName.trim(), description: optDesc.trim(), goal_id: optGoalId }]);
    setOptName('');
    setOptDesc('');
  };

  const handleNext = async () => {
    if (sites.length === 0 && options.length === 0) { onNext(); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites, options }),
      });
      if (!res.ok) throw new Error('Failed to save');
      onNext();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Where is your work happening?</h1>

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sites (places where work is active)</p>
        {sites.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{s.name}</span>
            {s.description && <span className="text-gray-400">— {s.description}</span>}
          </div>
        ))}
        <div className="flex gap-2">
          <input type="text" value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="Name" className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none" />
          <input type="text" value={siteDesc} onChange={e => setSiteDesc(e.target.value)} placeholder="Brief description" className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none" />
          <button onClick={addSite} disabled={!siteName.trim()} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-900">+ Add</button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Strategic options (bets you&apos;re exploring)</p>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{o.name}</span>
            {goals.find(g => g.id === o.goal_id) && <span className="text-gray-400">→ {goals.find(g => g.id === o.goal_id)?.title}</span>}
          </div>
        ))}
        <div className="flex gap-2 flex-wrap">
          <input type="text" value={optName} onChange={e => setOptName(e.target.value)} placeholder="Name" className="flex-1 min-w-32 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none" />
          <input type="text" value={optDesc} onChange={e => setOptDesc(e.target.value)} placeholder="Description" className="flex-1 min-w-32 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none" />
          {goals.length > 0 && (
            <select value={optGoalId} onChange={e => setOptGoalId(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none">
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          )}
          <button onClick={addOption} disabled={!optName.trim()} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-900">+ Add</button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <div className="flex gap-3">
          <button onClick={onSkip} className="text-sm text-gray-400 hover:text-gray-600">Skip</button>
          <button onClick={handleNext} disabled={isLoading} className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90">
            {isLoading ? 'Saving...' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/setup/steps/Step4Sites.tsx
git commit -m "feat: add setup wizard step 4 (sites and options)"
```

---

## Task 11: Step 5 — Seed Knowledge (modes + write + upload)

**Files:**
- Create: `src/app/setup/steps/Step5SeedKnowledge.tsx`
- Create: `src/app/setup/steps/Step5Write.tsx`
- Create: `src/app/setup/steps/Step5Upload.tsx`

- [ ] **Step 1: Implement Step5SeedKnowledge (mode selector)**

```typescript
// src/app/setup/steps/Step5SeedKnowledge.tsx
'use client';

import { useState } from 'react';
import { Step5Write } from './Step5Write';
import { Step5Upload } from './Step5Upload';
import { Step5Chat } from './Step5Chat';

type SeedMode = 'write' | 'upload' | 'chat' | null;

interface Props {
  readonly goals: ReadonlyArray<{ id: string; title: string }>;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step5SeedKnowledge({ goals, onNext, onBack }: Props) {
  const [mode, setMode] = useState<SeedMode>(null);

  if (mode === 'write') return <Step5Write goals={goals} onNext={onNext} onBack={() => setMode(null)} />;
  if (mode === 'upload') return <Step5Upload onNext={onNext} onBack={() => setMode(null)} />;
  if (mode === 'chat') return <Step5Chat goals={goals} onNext={onNext} onBack={() => setMode(null)} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Seed your knowledge</h1>
        <p className="text-sm text-gray-500 mt-2">The system gets smarter the more it knows. Choose how you'd like to start.</p>
      </div>

      <div className="space-y-3">
        {[
          { id: 'write' as const, emoji: '📝', title: 'Write your key assumptions', desc: 'What do you believe to be true about the world that shapes your work?' },
          { id: 'upload' as const, emoji: '📄', title: 'Upload existing documents', desc: 'Drop in papers, strategy docs, or notes. The system will extract what matters.' },
          { id: 'chat' as const, emoji: '💬', title: 'Talk through it', desc: 'Describe your thinking in plain language. I'll help structure it into the system.' },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => setMode(opt.id)}
            className="w-full text-left p-5 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-node-hunch/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          >
            <div className="flex gap-3 items-start">
              <span className="text-xl">{opt.emoji}</span>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{opt.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </div>
          </button>
        ))}

        <button
          onClick={onNext}
          className="w-full text-left p-4 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
        >
          <div className="flex gap-3 items-center">
            <span className="text-xl">⏭</span>
            <p className="text-sm text-gray-400">I'll add things as I go</p>
          </div>
        </button>
      </div>

      <div className="flex items-center justify-between pt-4">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement Step5Write**

```typescript
// src/app/setup/steps/Step5Write.tsx
'use client';

import { useState } from 'react';

interface Props {
  readonly goals: ReadonlyArray<{ id: string; title: string }>;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step5Write({ goals, onNext, onBack }: Props) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'write', content: content.trim(), goals }),
      });
      if (!res.ok) throw new Error('Failed to process');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Processing your thinking</h1>
          <p className="text-sm text-gray-500 mt-2">Your assumptions are being connected to the knowledge graph. This happens in the background — you can keep going.</p>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
          <button onClick={onNext} className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:opacity-90">Continue →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Write your key assumptions</h1>
        <p className="text-sm text-gray-500 mt-2">What do you believe to be true about the world that shapes your work? Any format — list, prose, rough notes.</p>
      </div>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="e.g. 3-4° warming is now unavoidable. Existing capital structures are not designed for this. Formation finance requires new instruments..."
        rows={12}
        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30 resize-none text-sm"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isLoading}
          className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90"
        >
          {isLoading ? 'Processing...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement Step5Upload**

```typescript
// src/app/setup/steps/Step5Upload.tsx
'use client';

import { useState } from 'react';
import { FileCaptureMode } from '@/components/capture/FileCaptureMode';

interface Props {
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step5Upload({ onNext, onBack }: Props) {
  const [uploadedCount, setUploadedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileUpload = async (file: File) => {
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!uploadRes.ok) return;
      const { data: attachment } = await uploadRes.json();

      await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: file.name, node_type: 'hunch', attachment }),
      });
      setUploadedCount(prev => prev + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Upload existing documents</h1>
        <p className="text-sm text-gray-500 mt-2">Drop in papers, strategy docs, or notes. The system will extract what matters.</p>
      </div>

      <FileCaptureMode onFileSelect={handleFileUpload} />

      {uploadedCount > 0 && (
        <p className="text-sm text-gray-500">{uploadedCount} {uploadedCount === 1 ? 'document' : 'documents'} queued for processing.</p>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button
          onClick={onNext}
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90"
        >
          {uploadedCount > 0 ? 'Continue →' : 'Skip →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/setup/steps/Step5SeedKnowledge.tsx src/app/setup/steps/Step5Write.tsx src/app/setup/steps/Step5Upload.tsx
git commit -m "feat: add setup wizard step 5 seed modes (selector, write, upload)"
```

---

## Task 12: Step 5 Chat mode

**Files:**
- Create: `src/app/setup/steps/Step5Chat.tsx`

- [ ] **Step 1: Implement Step5Chat**

```typescript
// src/app/setup/steps/Step5Chat.tsx
'use client';

import { useState } from 'react';

interface Message {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

interface Captured {
  readonly title: string;
  readonly node_type: string;
}

interface Props {
  readonly goals: ReadonlyArray<{ id: string; title: string }>;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step5Chat({ goals, onNext, onBack }: Props) {
  const [history, setHistory] = useState<Message[]>([
    { role: 'assistant', content: 'What are the core hunches guiding your work right now?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [captured, setCaptured] = useState<Captured[]>([]);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/setup/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          message: userMessage,
          history: history.filter(h => h.role !== 'assistant' || history.indexOf(h) > 0),
          goals,
        }),
      });
      if (!res.ok) throw new Error('Failed to send');
      const { reply, extracted } = await res.json();
      setHistory(prev => [...prev, { role: 'assistant', content: reply }]);
      if (extracted?.length > 0) {
        setCaptured(prev => [...prev, ...extracted]);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Talk through it</h1>
        <p className="text-sm text-gray-500 mt-2">I'll help structure your thinking into the graph as we go.</p>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-2xl text-sm text-gray-400">Thinking...</div>
          </div>
        )}
      </div>

      {captured.length > 0 && (
        <div className="border border-gray-100 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Captured so far</p>
          <div className="space-y-1">
            {captured.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">{c.node_type}</span>
                <span className="text-gray-700 dark:text-gray-300">{c.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Type your response..."
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!input.trim() || isLoading}
          className="px-4 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button onClick={onNext} className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:opacity-90">
          {captured.length > 0 ? `Continue with ${captured.length} captured →` : 'Skip →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/setup/steps/Step5Chat.tsx
git commit -m "feat: add setup wizard step 5 chat mode for conversational knowledge seeding"
```

---

## Task 13: Step 6 — Completion screen

**Files:**
- Create: `src/app/setup/steps/Step6Complete.tsx`

- [ ] **Step 1: Implement Step6Complete**

```typescript
// src/app/setup/steps/Step6Complete.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Stats {
  readonly nodes: Record<string, number>;
  readonly edges: number;
}

export function Step6Complete() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    localStorage.setItem('setup_complete', 'true');
    fetch('/api/setup/stats')
      .then(r => r.json())
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, []);

  const totalNodes = stats
    ? Object.values(stats.nodes).reduce((a, b) => a + b, 0)
    : null;

  const enter = () => {
    localStorage.removeItem('setup_step');
    router.push('/');
  };

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <p className="text-4xl">✓</p>
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Your workspace is ready</h1>
      </div>

      {stats && (
        <div className="text-left space-y-1 border border-gray-100 dark:border-gray-800 rounded-xl p-6 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">You've set up:</p>
          {stats.nodes.goal_space > 0 && <p className="text-sm text-gray-600 dark:text-gray-400">• {stats.nodes.goal_space} {stats.nodes.goal_space === 1 ? 'goal' : 'goals'}</p>}
          {(stats.nodes.site ?? 0) > 0 && <p className="text-sm text-gray-600 dark:text-gray-400">• {stats.nodes.site} {stats.nodes.site === 1 ? 'site' : 'sites'}</p>}
          {(stats.nodes.option ?? 0) > 0 && <p className="text-sm text-gray-600 dark:text-gray-400">• {stats.nodes.option} {stats.nodes.option === 1 ? 'option' : 'options'}</p>}
          {(stats.nodes.person ?? 0) > 0 && <p className="text-sm text-gray-600 dark:text-gray-400">• {stats.nodes.person} team {stats.nodes.person === 1 ? 'member' : 'members'}</p>}
          {(totalNodes ?? 0) > 0 && <p className="text-sm text-gray-600 dark:text-gray-400">• {totalNodes} total nodes, {stats.edges} connections</p>}
        </div>
      )}

      <div className="text-left space-y-4 border border-gray-100 dark:border-gray-800 rounded-xl p-6">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">What to do next:</p>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">After your next meeting, capture the key takeaways — the system will connect them to what you already know.</p>
          <p className="text-sm text-gray-500">Check the Query page to ask questions about your knowledge.</p>
          <p className="text-sm text-gray-500">Run a system reflection once a week to see what's emerging.</p>
        </div>
      </div>

      <button
        onClick={enter}
        className="px-8 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Enter your workspace →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/setup/steps/Step6Complete.tsx
git commit -m "feat: add setup wizard step 6 completion screen with stats"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Full-screen wizard at /setup | Task 6 + Task 7 |
| Progress bar | Task 7 (SetupWizardClient) |
| Step 1: workspace name + description | Task 8 |
| Step 2: team members add/remove | Task 8 |
| Step 3: goals with LLM helper inline chat | Task 9 |
| Step 4: sites + options with goal links, skip | Task 10 |
| Step 5: mode selector | Task 11 |
| Step 5: write assumptions mode | Task 11 |
| Step 5: upload documents mode | Task 11 |
| Step 5: conversational chat mode | Task 12 |
| Step 6: completion summary + redirect | Task 13 |
| Each step saves to DB immediately | All API tasks (4, 5) |
| localStorage progress for resume | Task 7 |
| Redirect from home if no goal_spaces | Task 6 |
| /setup always accessible from settings | Not addressed — add Settings link to /setup |
| contexts table + context_id on nodes | Task 1 |
| 'setup' agent type for LLM calls | Task 2 |

**Gap found:** Settings page should link to /setup. This is a small change to existing settings page — add as a note for the implementer to handle when wiring up navigation in the daily-use plan.

**Placeholder scan:** No TBDs or placeholders found.

**Type consistency check:** `Goal` interface passed between Step3Goals `onNext` and Step4Sites/Step5 `goals` prop is `ReadonlyArray<{ id: string; title: string }>` — consistent throughout. `FileCaptureMode` is imported from existing component — verify its `onFileSelect` prop signature matches usage in Step5Upload (currently it receives a `File`, but the existing FileCaptureMode component uses `onFileSelect: (file: File | null) => void` — the null case is not handled in Step5Upload; implementer should handle null).

**Fix Step5Upload null handling:**
In `Step5Upload`, change the `FileCaptureMode` usage to:
```typescript
<FileCaptureMode onFileSelect={(file) => { if (file) handleFileUpload(file); }} />
```
