# Graph Query System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/query` page with two modes — Ask (iterative NL chat against the knowledge graph) and Guided Tour (LLM-narrated chapter walkthrough for onboarding).

**Architecture:** Server page fetches nodes and passes them to a client QueryClient component with Ask/Tour tabs. Ask mode calls `POST /api/query` which keyword-searches nodes, BFS-expands one hop, and streams an LLM response. Tour mode calls `POST /api/query/tour` which fetches the full graph and returns structured JSON chapters from a single LLM call.

**Tech Stack:** Next.js 15 App Router, Supabase SSR, Anthropic SDK (streaming + non-streaming), Vitest + React Testing Library, TypeScript.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/agents/query.ts` | Create | Types, prompt builders, node serializer |
| `src/lib/agents/__tests__/query.test.ts` | Create | Unit tests for query agent |
| `src/app/api/query/route.ts` | Create | Ask mode API: search + BFS + stream |
| `src/app/api/query/__tests__/route.test.ts` | Create | API route tests |
| `src/app/api/query/tour/route.ts` | Create | Tour API: full graph → JSON chapters |
| `src/app/api/query/tour/__tests__/route.test.ts` | Create | Tour route tests |
| `src/app/query/NodeCard.tsx` | Create | Reusable node card component |
| `src/app/query/AskMode.tsx` | Create | Chat thread UI with node reference panel |
| `src/app/query/GuidedTour.tsx` | Create | Chapter-based walkthrough UI |
| `src/app/query/QueryClient.tsx` | Create | Tab container (Ask / Guided Tour) |
| `src/app/query/page.tsx` | Create | Server page: auth check + node prefetch |
| `src/app/query/__tests__/NodeCard.test.tsx` | Create | NodeCard component tests |
| `src/app/query/__tests__/AskMode.test.tsx` | Create | AskMode component tests |
| `src/app/query/__tests__/GuidedTour.test.tsx` | Create | GuidedTour component tests |
| `src/app/query/__tests__/QueryClient.test.tsx` | Create | QueryClient tab tests |
| `src/components/layout/NavBar.tsx` | Modify | Add Query to nav links |

---

## Task 1: Query Agent — Types, Prompt Builders, Serializer

**Files:**
- Create: `src/lib/agents/query.ts`
- Create: `src/lib/agents/__tests__/query.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/agents/__tests__/query.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  serializeNodesForQuery,
  buildQuerySystemPrompt,
  buildTourPrompt,
} from '../query';

describe('serializeNodesForQuery', () => {
  it('formats a node as [type] title: description (id: uuid)', () => {
    const nodes = [{ id: 'abc', node_type: 'hunch', title: 'My hunch', description: 'A description', status: 'raw' }];
    expect(serializeNodesForQuery(nodes)).toBe('[hunch] My hunch: A description (id: abc)');
  });

  it('omits description when null', () => {
    const nodes = [{ id: 'abc', node_type: 'hunch', title: 'My hunch', description: null, status: 'raw' }];
    expect(serializeNodesForQuery(nodes)).toBe('[hunch] My hunch (id: abc)');
  });

  it('joins multiple nodes with newlines', () => {
    const nodes = [
      { id: 'a', node_type: 'hunch', title: 'Hunch 1', description: null, status: 'raw' },
      { id: 'b', node_type: 'learning', title: 'Learning 1', description: 'desc', status: 'promoted' },
    ];
    expect(serializeNodesForQuery(nodes)).toBe('[hunch] Hunch 1 (id: a)\n[learning] Learning 1: desc (id: b)');
  });

  it('returns empty string for empty array', () => {
    expect(serializeNodesForQuery([])).toBe('');
  });
});

describe('buildQuerySystemPrompt', () => {
  it('returns a non-empty prompt when no background provided', () => {
    const result = buildQuerySystemPrompt();
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain('undefined');
  });

  it('includes background framing when provided', () => {
    const result = buildQuerySystemPrompt('finance and investment');
    expect(result).toContain('finance and investment');
  });

  it('omits framing sentence when background is empty string', () => {
    const withEmpty = buildQuerySystemPrompt('');
    const withoutBg = buildQuerySystemPrompt();
    expect(withEmpty).toBe(withoutBg);
  });
});

describe('buildTourPrompt', () => {
  it('includes the serialized graph in the prompt', () => {
    const result = buildTourPrompt('my graph content');
    expect(result).toContain('my graph content');
  });

  it('requests JSON output with chapters array structure', () => {
    const result = buildTourPrompt('graph');
    expect(result).toContain('"chapters"');
    expect(result).toContain('"nodeIds"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/agents/__tests__/query.test.ts
```

Expected: FAIL — `Cannot find module '../query'`

- [ ] **Step 3: Implement the query agent**

Create `src/lib/agents/query.ts`:

```typescript
export interface TourChapter {
  readonly title: string;
  readonly narrative: string;
  readonly nodeIds: readonly string[];
}

export interface TourResponse {
  readonly chapters: readonly TourChapter[];
}

export interface QuerySerializedNode {
  readonly id: string;
  readonly node_type: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: string;
}

const BASE_SYSTEM_PROMPT = `You are a knowledge graph assistant for a learning organization using the COF (Cycles of Feedback) method. The graph contains nodes representing hunches, assumptions, tests, learnings, commitments, signals, goal spaces, and more.

Answer the user's question based on the graph context provided. Be specific — reference node titles directly. Keep answers to 2–4 paragraphs. Write in plain language.`;

export function serializeNodesForQuery(nodes: QuerySerializedNode[]): string {
  return nodes
    .map(n => `[${n.node_type}] ${n.title}${n.description ? `: ${n.description}` : ''} (id: ${n.id})`)
    .join('\n');
}

export function buildQuerySystemPrompt(userBackground?: string): string {
  if (!userBackground) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT} The person asking has a ${userBackground} background — frame your answer accordingly.`;
}

export function buildTourPrompt(serializedGraph: string): string {
  return `Here is the full knowledge graph:\n\n${serializedGraph}\n\nGenerate a guided tour with these 5 chapters (do NOT include a chapter about "What is this system?" — that is handled separately):

Chapter titles must be exactly:
- "Our goals"
- "Key assumptions"
- "What we're testing"
- "What we've learned"
- "Where attention is needed"

For each chapter, write 2–4 sentences of plain-language narrative and list the IDs of the nodes you referenced.

Return ONLY a JSON object with this exact structure and no other text:
{"chapters":[{"title":"Our goals","narrative":"...","nodeIds":["id1","id2"]},{"title":"Key assumptions","narrative":"...","nodeIds":[]},{"title":"What we're testing","narrative":"...","nodeIds":[]},{"title":"What we've learned","narrative":"...","nodeIds":[]},{"title":"Where attention is needed","narrative":"...","nodeIds":[]}]}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/agents/__tests__/query.test.ts
```

Expected: PASS — all 9 tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/query.ts src/lib/agents/__tests__/query.test.ts
git commit -m "feat: add query agent — types, prompt builders, node serializer"
```

---

## Task 2: Ask Mode API Route — Keyword Search + BFS + Streaming LLM

**Files:**
- Create: `src/app/api/query/route.ts`
- Create: `src/app/api/query/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/query/__tests__/route.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockNodesSelect, mockEdgesSelect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockNodesSelect: vi.fn(),
  mockEdgesSelect: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (table: string) => {
        if (table === 'nodes') return { select: mockNodesSelect };
        if (table === 'edges') return { select: mockEdgesSelect };
        return { select: vi.fn().mockResolvedValue({ data: [] }) };
      },
    })
  ),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      stream: vi.fn(() =>
        (async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } };
        })()
      ),
    },
  })),
}));

import { POST } from '../route';

const mockNodes = [
  { id: 'n1', node_type: 'hunch', title: 'Madrid financial risk', description: 'Funding uncertainty', status: 'raw' },
  { id: 'n2', node_type: 'commitment', title: 'Partner with IES', description: null, status: 'promoted' },
  { id: 'n3', node_type: 'learning', title: 'Unrelated learning', description: null, status: 'promoted' },
];
const mockEdges = [{ source_id: 'n1', target_id: 'n2' }];

function makeRequest(body: object) {
  return new Request('http://localhost/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockNodesSelect.mockReturnValue({
      neq: vi.fn().mockResolvedValue({ data: mockNodes }),
    });
    mockEdgesSelect.mockResolvedValue({ data: mockEdges });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await POST(makeRequest({ query: 'test' }));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when query is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when query is blank whitespace', async () => {
    const res = await POST(makeRequest({ query: '   ' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 streaming response with correct Content-Type', async () => {
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
  });

  it('sets X-Context-Nodes header with matching node IDs', async () => {
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    const nodeIds = JSON.parse(res.headers.get('X-Context-Nodes') ?? '[]') as string[];
    expect(nodeIds).toContain('n1');
  });

  it('includes BFS-expanded neighbour in X-Context-Nodes', async () => {
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    const nodeIds = JSON.parse(res.headers.get('X-Context-Nodes') ?? '[]') as string[];
    // n2 is connected to n1 via edge — should be BFS-expanded
    expect(nodeIds).toContain('n2');
  });

  it('excludes unrelated nodes from context header', async () => {
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    const nodeIds = JSON.parse(res.headers.get('X-Context-Nodes') ?? '[]') as string[];
    expect(nodeIds).not.toContain('n3');
  });

  it('streams text content in response body', async () => {
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    const text = await res.text();
    expect(text).toBe('Hello world');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/api/query/__tests__/route.test.ts
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the route**

Create `src/app/api/query/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { buildQuerySystemPrompt, serializeNodesForQuery } from '@/lib/agents/query';
import type { QuerySerializedNode } from '@/lib/agents/query';

interface QueryBody {
  query: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface EdgeRow {
  source_id: string;
  target_id: string;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as QueryBody;
  const { query, history = [] } = body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return Response.json({ error: 'Query is required' }, { status: 400 });
  }

  const [{ data: nodesData }, { data: edgesData }] = await Promise.all([
    supabase.from('nodes').select('id, node_type, title, description, status').neq('status', 'archived'),
    supabase.from('edges').select('source_id, target_id'),
  ]);

  const allNodes = (nodesData ?? []) as QuerySerializedNode[];
  const allEdges = (edgesData ?? []) as EdgeRow[];

  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const matchingIds = new Set<string>(
    allNodes
      .filter(n => {
        const text = `${n.title} ${n.description ?? ''}`.toLowerCase();
        return searchTerms.length === 0 || searchTerms.some(term => text.includes(term));
      })
      .map(n => n.id)
  );

  const expandedIds = new Set<string>(matchingIds);
  for (const edge of allEdges) {
    if (matchingIds.has(edge.source_id)) expandedIds.add(edge.target_id);
    if (matchingIds.has(edge.target_id)) expandedIds.add(edge.source_id);
  }

  const contextNodes = allNodes.filter(n => expandedIds.has(n.id));
  const contextNodeIds = contextNodes.map(n => n.id);
  const serialized = serializeNodesForQuery(contextNodes);

  const systemPrompt = buildQuerySystemPrompt();
  const contextMessage = serialized
    ? `Knowledge graph context:\n${serialized}\n\nAnswer the following question:`
    : 'Answer the following question (the knowledge graph is currently empty):';

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history,
    { role: 'user', content: `${contextMessage}\n\n${query}` },
  ];

  const encoder = new TextEncoder();
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      const messageStream = anthropic.messages.stream({
        model: process.env.QUERY_LLM_MODEL ?? 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      for await (const chunk of messageStream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Context-Nodes': JSON.stringify(contextNodeIds),
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/query/__tests__/route.test.ts
```

Expected: PASS — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add src/app/api/query/route.ts src/app/api/query/__tests__/route.test.ts
git commit -m "feat: add /api/query route — keyword BFS search and streaming LLM"
```

---

## Task 3: Tour API Route — Full Graph → JSON Chapters

**Files:**
- Create: `src/app/api/query/tour/route.ts`
- Create: `src/app/api/query/tour/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/query/tour/__tests__/route.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockNodesSelect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockNodesSelect: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: () => ({ select: mockNodesSelect }),
    })
  ),
}));

const mockLlmResponse = {
  chapters: [
    { title: 'Our goals', narrative: 'We have one goal space.', nodeIds: ['gs1'] },
    { title: 'Key assumptions', narrative: 'No assumptions yet.', nodeIds: [] },
    { title: "What we're testing", narrative: 'No active tests.', nodeIds: [] },
    { title: "What we've learned", narrative: 'Nothing learned yet.', nodeIds: [] },
    { title: 'Where attention is needed', narrative: 'Nothing pending.', nodeIds: [] },
  ],
};

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockLlmResponse) }],
      }),
    },
  })),
}));

import { POST } from '../route';

function makeRequest() {
  return new Request('http://localhost/api/query/tour', { method: 'POST' });
}

describe('POST /api/query/tour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockNodesSelect.mockReturnValue({
      neq: vi.fn().mockResolvedValue({
        data: [{ id: 'gs1', node_type: 'goal_space', title: 'Madrid Goal', description: null, status: 'raw' }],
      }),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 5 chapters from the LLM response', async () => {
    const res = await POST(makeRequest());
    const body = await res.json() as { chapters: unknown[] };
    expect(res.status).toBe(200);
    expect(body.chapters).toHaveLength(5);
  });

  it('returns chapter titles from LLM', async () => {
    const res = await POST(makeRequest());
    const body = await res.json() as { chapters: Array<{ title: string }> };
    expect(body.chapters[0].title).toBe('Our goals');
    expect(body.chapters[4].title).toBe('Where attention is needed');
  });

  it('returns 5 fallback chapters when no nodes exist', async () => {
    mockNodesSelect.mockReturnValue({
      neq: vi.fn().mockResolvedValue({ data: [] }),
    });
    const res = await POST(makeRequest());
    const body = await res.json() as { chapters: unknown[] };
    expect(res.status).toBe(200);
    expect(body.chapters).toHaveLength(5);
  });

  it('handles LLM response wrapped in markdown code fences', async () => {
    const wrapped = `\`\`\`json\n${JSON.stringify(mockLlmResponse)}\n\`\`\``;
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    (Anthropic as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: wrapped }],
        }),
      },
    }));
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { chapters: unknown[] };
    expect(body.chapters).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/api/query/tour/__tests__/route.test.ts
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the tour route**

Create `src/app/api/query/tour/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { serializeNodesForQuery, buildTourPrompt } from '@/lib/agents/query';
import type { TourResponse, QuerySerializedNode } from '@/lib/agents/query';

const EMPTY_TOUR: TourResponse = {
  chapters: [
    { title: 'Our goals', narrative: 'No goal spaces have been captured yet. Start by adding content in the Capture page.', nodeIds: [] },
    { title: 'Key assumptions', narrative: 'Nothing here yet.', nodeIds: [] },
    { title: "What we're testing", narrative: 'Nothing here yet.', nodeIds: [] },
    { title: "What we've learned", narrative: 'Nothing here yet.', nodeIds: [] },
    { title: 'Where attention is needed', narrative: 'Nothing here yet.', nodeIds: [] },
  ],
};

export async function POST(_request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: nodesData } = await supabase
    .from('nodes')
    .select('id, node_type, title, description, status')
    .neq('status', 'archived');

  const nodes = (nodesData ?? []) as QuerySerializedNode[];

  if (nodes.length === 0) {
    return Response.json(EMPTY_TOUR);
  }

  const serialized = serializeNodesForQuery(nodes);
  const prompt = buildTourPrompt(serialized);

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: process.env.QUERY_LLM_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return Response.json({ error: 'Failed to generate tour' }, { status: 500 });
  }

  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const tour = JSON.parse(jsonMatch[0]) as TourResponse;
    return Response.json(tour);
  } catch {
    return Response.json({ error: 'Failed to parse tour response' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/query/tour/__tests__/route.test.ts
```

Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add src/app/api/query/tour/route.ts src/app/api/query/tour/__tests__/route.test.ts
git commit -m "feat: add /api/query/tour route — full graph to JSON chapters"
```

---

## Task 4: NodeCard Component

**Files:**
- Create: `src/app/query/NodeCard.tsx`
- Create: `src/app/query/__tests__/NodeCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/app/query/__tests__/NodeCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeCard } from '../NodeCard';

const mockNode = {
  id: 'n1',
  node_type: 'hunch',
  title: 'My test hunch',
  description: 'A description of the hunch',
  status: 'raw' as const,
};

describe('NodeCard', () => {
  it('renders node title', () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByText('My test hunch')).toBeDefined();
  });

  it('renders node type with underscores replaced by spaces', () => {
    render(<NodeCard node={{ ...mockNode, node_type: 'assumption_background' }} />);
    expect(screen.getByText('assumption background')).toBeDefined();
  });

  it('renders description when present', () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByText('A description of the hunch')).toBeDefined();
  });

  it('omits description element when description is null', () => {
    render(<NodeCard node={{ ...mockNode, description: null }} />);
    expect(screen.queryByText('A description of the hunch')).toBeNull();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<NodeCard node={mockNode} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders as button element', () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByRole('button')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/query/__tests__/NodeCard.test.tsx
```

Expected: FAIL — `Cannot find module '../NodeCard'`

- [ ] **Step 3: Implement NodeCard**

Create `src/app/query/NodeCard.tsx`:

```typescript
'use client';

import type { Node } from '@/lib/types/nodes';

const TYPE_COLORS: Record<string, string> = {
  hunch: '#7F77DD',
  assumption_background: '#1D9E75',
  assumption_foreground: '#D85A30',
  test: '#D4537E',
  learning: '#378ADD',
  option: '#BA7517',
  entity: '#888780',
  site: '#639922',
  commitment: '#185FA5',
  intervention: '#534AB7',
  signal: '#A32D2D',
  goal_space: '#0F6E56',
  trigger_outcome: '#085041',
};

interface NodeCardProps {
  readonly node: Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>;
  readonly onClick?: () => void;
}

export function NodeCard({ node, onClick }: NodeCardProps) {
  const color = TYPE_COLORS[node.node_type] ?? '#888780';
  const label = node.node_type.replace(/_/g, ' ');

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded text-white uppercase tracking-wide"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      </div>
      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">{node.title}</p>
      {node.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5 line-clamp-2">
          {node.description}
        </p>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/query/__tests__/NodeCard.test.tsx
```

Expected: PASS — all 6 tests green

- [ ] **Step 5: Commit**

```bash
git add src/app/query/NodeCard.tsx src/app/query/__tests__/NodeCard.test.tsx
git commit -m "feat: add NodeCard component for query results"
```

---

## Task 5: AskMode Component — Chat Thread with Node Panel

**Files:**
- Create: `src/app/query/AskMode.tsx`
- Create: `src/app/query/__tests__/AskMode.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/app/query/__tests__/AskMode.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AskMode } from '../AskMode';

const mockNodes = [
  { id: 'n1', node_type: 'hunch', title: 'Madrid hunch', description: null, status: 'raw' as const },
];

function makeStreamResponse(text: string, nodeIds: string[] = []) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'X-Context-Nodes': JSON.stringify(nodeIds),
    },
  });
}

describe('AskMode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty-state prompt', () => {
    render(<AskMode allNodes={mockNodes} />);
    expect(screen.getByText('Ask anything about the knowledge graph')).toBeDefined();
  });

  it('renders text input with placeholder', () => {
    render(<AskMode allNodes={mockNodes} />);
    expect(screen.getByPlaceholderText('Ask a question…')).toBeDefined();
  });

  it('Ask button is disabled when input is empty', () => {
    render(<AskMode allNodes={mockNodes} />);
    const btn = screen.getByRole('button', { name: 'Ask' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Ask button becomes enabled when input has text', () => {
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…');
    fireEvent.change(input, { target: { value: 'What is Madrid?' } });
    const btn = screen.getByRole('button', { name: 'Ask' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('displays user message in chat after submitting', async () => {
    global.fetch = vi.fn().mockResolvedValue(makeStreamResponse('The answer.', []));
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…');
    fireEvent.change(input, { target: { value: 'What is Madrid?' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('What is Madrid?')).toBeDefined();
    });
  });

  it('displays assistant response after stream completes', async () => {
    global.fetch = vi.fn().mockResolvedValue(makeStreamResponse('The answer is 42.', []));
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…');
    fireEvent.change(input, { target: { value: 'Tell me something' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('The answer is 42.')).toBeDefined();
    });
  });

  it('shows referenced node cards after response with matching node IDs', async () => {
    global.fetch = vi.fn().mockResolvedValue(makeStreamResponse('Here is what I found.', ['n1']));
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…');
    fireEvent.change(input, { target: { value: 'Tell me about Madrid' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('Madrid hunch')).toBeDefined();
    });
  });

  it('clears input after submitting', async () => {
    global.fetch = vi.fn().mockResolvedValue(makeStreamResponse('Response.', []));
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My question' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/query/__tests__/AskMode.test.tsx
```

Expected: FAIL — `Cannot find module '../AskMode'`

- [ ] **Step 3: Implement AskMode**

Create `src/app/query/AskMode.tsx`:

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import type { Node } from '@/lib/types/nodes';
import { NodeCard } from './NodeCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  nodeIds: string[];
}

interface AskModeProps {
  readonly allNodes: Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>[];
}

export function AskMode({ allNodes }: AskModeProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const referencedNodeIds = new Set(messages.flatMap(m => m.nodeIds));
  const referencedNodes = allNodes.filter(n => referencedNodeIds.has(n.id));

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || isStreaming) return;

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: query, nodeIds: [] }]);
    setInput('');
    setIsStreaming(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', nodeIds: [] }]);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history }),
      });

      if (!res.ok) throw new Error('Query failed');

      const contextNodeIds = JSON.parse(res.headers.get('X-Context-Nodes') ?? '[]') as string[];
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: current, nodeIds: contextNodeIds };
          return updated;
        });
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          nodeIds: [],
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [input, isStreaming, messages]);

  return (
    <div className="flex gap-4 h-[calc(100vh-160px)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 pt-8 text-center">
              Ask anything about the knowledge graph
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              {msg.role === 'user' ? (
                <div className="max-w-sm bg-node-hunch/10 border border-node-hunch/20 rounded-xl px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                  {msg.content}
                </div>
              ) : (
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                  {isStreaming && i === messages.length - 1 && (
                    <span className="animate-pulse">▋</span>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={isStreaming}
            className="flex-1 text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-indigo-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2 text-sm bg-node-hunch text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {isStreaming ? '…' : 'Ask'}
          </button>
        </form>
      </div>

      {referencedNodes.length > 0 && panelOpen && (
        <div className="w-56 flex-shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Referenced nodes
            </p>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ›
            </button>
          </div>
          <div className="space-y-2">
            {referencedNodes.map(n => (
              <NodeCard key={n.id} node={n} />
            ))}
          </div>
        </div>
      )}
      {referencedNodes.length > 0 && !panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Show referenced nodes"
          className="w-8 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-600 border-l border-gray-200 dark:border-gray-800"
        >
          ‹
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/query/__tests__/AskMode.test.tsx
```

Expected: PASS — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add src/app/query/AskMode.tsx src/app/query/__tests__/AskMode.test.tsx
git commit -m "feat: add AskMode component — chat thread with streaming and node panel"
```

---

## Task 6: GuidedTour Component — Chapter Walkthrough

**Files:**
- Create: `src/app/query/GuidedTour.tsx`
- Create: `src/app/query/__tests__/GuidedTour.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/app/query/__tests__/GuidedTour.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuidedTour } from '../GuidedTour';

const mockNodes = [
  { id: 'gs1', node_type: 'goal_space', title: 'Madrid Goal', description: null, status: 'raw' as const },
];

const mockTourResponse = {
  chapters: [
    { title: 'Our goals', narrative: 'We have one goal space.', nodeIds: ['gs1'] },
    { title: 'Key assumptions', narrative: 'No assumptions yet.', nodeIds: [] },
    { title: "What we're testing", narrative: 'No active tests.', nodeIds: [] },
    { title: "What we've learned", narrative: 'Nothing learned yet.', nodeIds: [] },
    { title: 'Where attention is needed', narrative: 'Nothing pending.', nodeIds: [] },
  ],
};

describe('GuidedTour', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Start guided tour button in idle state', () => {
    render(<GuidedTour allNodes={mockNodes} />);
    expect(screen.getByRole('button', { name: 'Start guided tour' })).toBeDefined();
  });

  it('shows loading skeleton after clicking Start', async () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => {
      expect(document.querySelector('.animate-pulse')).toBeTruthy();
    });
  });

  it('shows static chapter 1 "What is this system?" after load', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTourResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => {
      expect(screen.getByText('What is this system?')).toBeDefined();
    });
  });

  it('shows all 6 chapter buttons in sidebar after load', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTourResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getByText('Our goals'));
    expect(screen.getByText('Key assumptions')).toBeDefined();
    expect(screen.getByText('Where attention is needed')).toBeDefined();
  });

  it('shows node card for node referenced in active chapter', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTourResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getByText('Our goals'));
    fireEvent.click(screen.getByText('Our goals'));
    await waitFor(() => {
      expect(screen.getByText('Madrid Goal')).toBeDefined();
    });
  });

  it('shows Retry button on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/query/__tests__/GuidedTour.test.tsx
```

Expected: FAIL — `Cannot find module '../GuidedTour'`

- [ ] **Step 3: Implement GuidedTour**

Create `src/app/query/GuidedTour.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { TourResponse, TourChapter } from '@/lib/agents/query';
import { NodeCard } from './NodeCard';

const STATIC_CHAPTER_1: TourChapter = {
  title: 'What is this system?',
  narrative: "This is a COF (Cycles of Feedback) knowledge graph. It captures the team's hunches, assumptions, tests, learnings, and commitments as interconnected nodes. The graph evolves as the team learns — hunches get tested, assumptions get validated or falsified, and insights become commitments. Use it to understand what the team believes, what it's testing, and what it has learned.",
  nodeIds: [],
};

interface GuidedTourProps {
  readonly allNodes: Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>[];
}

export function GuidedTour({ allNodes }: GuidedTourProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [llmChapters, setLlmChapters] = useState<TourChapter[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const allChapters: TourChapter[] = status === 'ready' ? [STATIC_CHAPTER_1, ...llmChapters] : [];
  const activeChapter = allChapters[activeIndex];
  const chapterNodes = activeChapter
    ? allNodes.filter(n => activeChapter.nodeIds.includes(n.id))
    : [];

  const handleStart = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/query/tour', { method: 'POST' });
      if (!res.ok) throw new Error('Tour failed');
      const data = await res.json() as TourResponse;
      setLlmChapters([...data.chapters]);
      setActiveIndex(0);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-sm">
          Get a guided walkthrough of the knowledge graph — what the team is working on, what it believes, and where attention is needed.
        </p>
        <button
          type="button"
          onClick={handleStart}
          className="px-6 py-2.5 bg-node-hunch text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          Start guided tour
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-6 pt-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full mb-1" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-red-500 mb-4">Failed to generate tour. Please try again.</p>
        <button
          type="button"
          onClick={handleStart}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-160px)]">
      <div className="w-44 flex-shrink-0 space-y-1 overflow-y-auto">
        {allChapters.map((ch, i) => (
          <button
            key={ch.title}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
              i === activeIndex
                ? 'bg-node-hunch/10 text-node-hunch font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {ch.title}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeChapter && (
          <>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {activeChapter.title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              {activeChapter.narrative}
            </p>
            {chapterNodes.length > 0 && (
              <div className="space-y-2 mb-6">
                {chapterNodes.map(n => (
                  <NodeCard key={n.id} node={n} />
                ))}
              </div>
            )}
            {activeIndex < allChapters.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveIndex(prev => prev + 1)}
                className="text-sm text-node-hunch hover:opacity-80"
              >
                Next chapter →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/query/__tests__/GuidedTour.test.tsx
```

Expected: PASS — all 6 tests green

- [ ] **Step 5: Commit**

```bash
git add src/app/query/GuidedTour.tsx src/app/query/__tests__/GuidedTour.test.tsx
git commit -m "feat: add GuidedTour component — chapter walkthrough with node cards"
```

---

## Task 7: QueryClient + Page — Tabs, Auth, Data Fetch

**Files:**
- Create: `src/app/query/QueryClient.tsx`
- Create: `src/app/query/page.tsx`
- Create: `src/app/query/__tests__/QueryClient.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/app/query/__tests__/QueryClient.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient } from '../QueryClient';

vi.mock('../AskMode', () => ({
  AskMode: () => <div data-testid="ask-mode">AskMode</div>,
}));

vi.mock('../GuidedTour', () => ({
  GuidedTour: () => <div data-testid="guided-tour">GuidedTour</div>,
}));

describe('QueryClient', () => {
  it('renders page title', () => {
    render(<QueryClient nodes={[]} />);
    expect(screen.getByText('Query')).toBeDefined();
  });

  it('renders Ask and Guided Tour tabs', () => {
    render(<QueryClient nodes={[]} />);
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Guided Tour' })).toBeDefined();
  });

  it('shows AskMode by default', () => {
    render(<QueryClient nodes={[]} />);
    expect(screen.getByTestId('ask-mode')).toBeDefined();
  });

  it('switches to GuidedTour on tab click', () => {
    render(<QueryClient nodes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guided Tour' }));
    expect(screen.getByTestId('guided-tour')).toBeDefined();
    expect(screen.queryByTestId('ask-mode')).toBeNull();
  });

  it('switches back to Ask mode when Ask tab is clicked', () => {
    render(<QueryClient nodes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guided Tour' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByTestId('ask-mode')).toBeDefined();
    expect(screen.queryByTestId('guided-tour')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/query/__tests__/QueryClient.test.tsx
```

Expected: FAIL — `Cannot find module '../QueryClient'`

- [ ] **Step 3: Implement QueryClient**

Create `src/app/query/QueryClient.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import { AskMode } from './AskMode';
import { GuidedTour } from './GuidedTour';

type Tab = 'ask' | 'tour';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ask', label: 'Ask' },
  { id: 'tour', label: 'Guided Tour' },
];

interface QueryClientProps {
  readonly nodes: Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>[];
}

export function QueryClient({ nodes }: QueryClientProps) {
  const [tab, setTab] = useState<Tab>('ask');

  return (
    <div className="page-with-nav">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Query</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Ask questions about the knowledge graph or take a guided tour.
        </p>

        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                tab === id
                  ? 'border-node-hunch text-node-hunch font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'ask' ? <AskMode allNodes={nodes} /> : <GuidedTour allNodes={nodes} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement the server page**

Create `src/app/query/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { QueryClient } from './QueryClient';
import type { Node } from '@/lib/types/nodes';

export default async function QueryPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: nodesData } = await supabase
    .from('nodes')
    .select('id, node_type, title, description, status')
    .neq('status', 'archived');

  const nodes = (nodesData ?? []) as Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>[];

  return <QueryClient nodes={nodes} />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/app/query/__tests__/QueryClient.test.tsx
```

Expected: PASS — all 5 tests green

- [ ] **Step 6: Commit**

```bash
git add src/app/query/QueryClient.tsx src/app/query/page.tsx src/app/query/__tests__/QueryClient.test.tsx
git commit -m "feat: add /query page with Ask and Guided Tour tabs"
```

---

## Task 8: Add Query to NavBar

**Files:**
- Modify: `src/components/layout/NavBar.tsx`

- [ ] **Step 1: Open the file and locate the links array**

The links array is at line ~22 of `src/components/layout/NavBar.tsx`. Current array:

```typescript
const links = [
  { href: '/', label: 'Graph' },
  { href: '/capture', label: 'Capture' },
  { href: '/commitments', label: 'Commitments' },
  { href: '/review', label: 'Review' },
  { href: '/reflect', label: 'Reflect' },
  { href: '/settings', label: 'Settings' },
];
```

- [ ] **Step 2: Add the Query nav item**

Replace the links array with:

```typescript
const links = [
  { href: '/', label: 'Graph' },
  { href: '/capture', label: 'Capture' },
  { href: '/commitments', label: 'Commitments' },
  { href: '/query', label: 'Query' },
  { href: '/review', label: 'Review' },
  { href: '/reflect', label: 'Reflect' },
  { href: '/settings', label: 'Settings' },
];
```

- [ ] **Step 3: Run full test suite to verify no regressions**

```bash
npx vitest run
```

Expected: all existing tests still pass + all new tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/NavBar.tsx
git commit -m "feat: add Query to main navigation"
```

---

## Verification Checklist

After all tasks complete, verify end-to-end:

- [ ] Navigate to `/query` — page loads, two tabs visible
- [ ] Ask tab: type a query, submit — user message appears, streaming response appears, node cards appear in right panel
- [ ] Ask tab: follow-up question — new Q&A appended, referenced nodes accumulate
- [ ] Ask tab: collapse node panel — panel hides, toggle button appears
- [ ] Guided Tour tab: click "Start guided tour" — loading skeleton appears
- [ ] Guided Tour: chapters render, sidebar shows all 6, clicking chapter switches content
- [ ] Guided Tour: node cards appear for chapters that reference nodes
- [ ] Guided Tour: "Next chapter →" button advances through chapters
- [ ] Unauthenticated access to `/query` redirects to `/login`
- [ ] `/api/query` returns 401 without auth, 400 without query body
- [ ] `/api/query/tour` returns 401 without auth
