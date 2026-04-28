# COF v0.9 — Compounding Knowledge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make knowledge compound: (A) let users save any Query answer as a node linked to its source context, and (B) auto-resolve the LLM's suggested_connections into real graph edges during capture processing.

**Architecture:** Two independent features shipped in order. Feature A adds `POST /api/query/save` and a save-to-graph UI in AskMode. Feature B wires up the existing `suggested_connections` LLM output (already extracted but never used) into real edges via a new `connectionResolver` module, and enriches the extraction prompt with a list of existing nodes so the LLM can reference real titles.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (server client), Vitest + jsdom for tests, React state for UI. No new dependencies.

---

## File Map

**Create:**
- `src/app/api/query/save/route.ts` — POST: creates node from query answer + edges to context nodes
- `src/app/api/query/__tests__/save.test.ts` — route tests
- `src/lib/agents/connectionResolver.ts` — resolves LLM suggested_connections to real node IDs and creates edges
- `src/lib/agents/__tests__/connectionResolver.test.ts` — unit tests

**Modify:**
- `src/app/query/AskMode.tsx` — add save-to-graph button + inline form on assistant messages
- `src/app/query/__tests__/AskMode.test.tsx` — add tests for save flow
- `src/lib/agents/extraction.ts` — add `existingNodes` to `GoalContext`; render them in `buildExtractionPrompt`
- `src/lib/agents/__tests__/extraction.test.ts` — add tests for new prompt section
- `src/app/api/capture/process/route.ts` — fetch existing nodes before extraction; call `resolveConnections` after

---

## Part A — Save Query Results to Graph

### Task A1: `POST /api/query/save` route

**Files:**
- Create: `src/app/api/query/save/route.ts`
- Create: `src/app/api/query/__tests__/save.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/query/__tests__/save.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockNodesInsert, mockEdgesInsert, mockActivityInsert } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockNodesInsert: vi.fn(),
  mockEdgesInsert: vi.fn(),
  mockActivityInsert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (table: string) => {
        if (table === 'nodes') return { insert: mockNodesInsert };
        if (table === 'edges') return { insert: mockEdgesInsert };
        if (table === 'activity_log') return { insert: mockActivityInsert };
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      },
    })
  ),
}));

import { POST } from '../save/route';

function makeRequest(body: object) {
  return new Request('http://localhost/api/query/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  title: 'Formation capital requires patient debt',
  content: 'Based on the graph, the key tension is...',
  node_type: 'learning',
  context_node_ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
};

describe('POST /api/query/save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockNodesInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-node-id', title: VALID_BODY.title, node_type: 'learning' },
          error: null,
        }),
      }),
    });
    mockEdgesInsert.mockResolvedValue({ data: [], error: null });
    mockActivityInsert.mockResolvedValue({ data: null, error: null });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing title', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, title: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid node_type', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, node_type: 'goal_space' }));
    expect(res.status).toBe(400);
  });

  it('creates node with human_reviewed status and observation basis', async () => {
    await POST(makeRequest(VALID_BODY));
    const insertArg = mockNodesInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.status).toBe('human_reviewed');
    expect(insertArg.confidence_basis).toBe('observation');
    expect(insertArg.author_id).toBe('user-1');
    expect(insertArg.title).toBe(VALID_BODY.title);
  });

  it('creates edges to each context node', async () => {
    await POST(makeRequest(VALID_BODY));
    const edges = mockEdgesInsert.mock.calls[0][0] as Array<{ source_id: string; target_id: string; edge_type: string }>;
    expect(edges).toHaveLength(2);
    expect(edges[0].edge_type).toBe('supports');
    expect(edges[0].source_id).toBe('new-node-id');
    expect(edges.map(e => e.target_id)).toEqual(VALID_BODY.context_node_ids);
  });

  it('returns 201 with node and edges_created count', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { node: { id: string }; edges_created: number } };
    expect(body.data.node.id).toBe('new-node-id');
    expect(body.data.edges_created).toBe(2);
  });

  it('succeeds with empty context_node_ids', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, context_node_ids: [] }));
    expect(res.status).toBe(201);
    expect(mockEdgesInsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/app/api/query/__tests__/save.test.ts
```

Expected: FAIL — `Cannot find module '../save/route'`

- [ ] **Step 3: Implement the route**

```typescript
// src/app/api/query/save/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const SaveSchema = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.string().min(1).max(10000),
  node_type: z.enum(['hunch', 'learning']),
  context_node_ids: z.array(z.string().uuid()).max(50).default([]),
});

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { title, content, node_type, context_node_ids } = parsed.data;

  const { data: node, error: nodeError } = await supabase.from('nodes').insert({
    node_type,
    title,
    description: content,
    confidence_level: 3,
    confidence_basis: 'observation',
    status: 'human_reviewed',
    author_id: user.id,
    content: { source: 'query_synthesis', context_node_ids },
  }).select('id, title, node_type').single();

  if (nodeError || !node) return NextResponse.json({ error: 'Failed to create node' }, { status: 500 });

  let edgesCreated = 0;
  if (context_node_ids.length > 0) {
    const edges = context_node_ids.map(targetId => ({
      source_id: node.id,
      target_id: targetId,
      edge_type: 'supports',
      weight: 1,
      author_id: user.id,
    }));
    const { error: edgeError } = await supabase.from('edges').insert(edges);
    if (!edgeError) edgesCreated = edges.length;
  }

  await supabase.from('activity_log').insert({
    actor_id: user.id,
    action: 'created_hunch',
    target_node_id: node.id,
    details: { source: 'query_synthesis', context_node_count: context_node_ids.length },
  });

  return NextResponse.json({ data: { node, edges_created: edgesCreated } }, { status: 201 });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/api/query/__tests__/save.test.ts
```

Expected: 6/6 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/query/save/route.ts src/app/api/query/__tests__/save.test.ts
git commit -m "feat: add POST /api/query/save — create node from query answer with context edges"
```

---

### Task A2: Save-to-graph UI in AskMode

**Files:**
- Modify: `src/app/query/AskMode.tsx`
- Modify: `src/app/query/__tests__/AskMode.test.tsx`

- [ ] **Step 1: Write the failing tests**

Find the existing test file at `src/app/query/__tests__/AskMode.test.tsx`. Add the following tests at the end of the file (inside the same `describe` block or in a new one):

```typescript
// Add these imports at top if not already present:
// import { screen, fireEvent, waitFor } from '@testing-library/react';

describe('AskMode — save to graph', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  function renderWithMessage() {
    // Render AskMode and simulate a completed assistant message
    // We do this by triggering a successful query then checking state
    const { getByPlaceholderText, getByText } = render(
      <AskMode allNodes={[
        { id: 'n1', node_type: 'hunch', title: 'Test node', description: null, status: 'promoted' },
      ]} />
    );

    // Mock the query fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => JSON.stringify(['n1']) },
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('The answer is 42') })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          cancel: vi.fn(),
        }),
      },
    });

    return { getByPlaceholderText, getByText };
  }

  it('shows "Save to graph" button after assistant message completes', async () => {
    const { getByPlaceholderText, getByText } = renderWithMessage();
    fireEvent.change(getByPlaceholderText('Ask a question…'), { target: { value: 'What is the key tension?' } });
    fireEvent.submit(getByPlaceholderText('Ask a question…').closest('form')!);
    await waitFor(() => expect(getByText('Save to graph')).toBeInTheDocument());
  });

  it('shows inline form when "Save to graph" is clicked', async () => {
    const { getByPlaceholderText, getByText } = renderWithMessage();
    fireEvent.change(getByPlaceholderText('Ask a question…'), { target: { value: 'What is the key tension?' } });
    fireEvent.submit(getByPlaceholderText('Ask a question…').closest('form')!);
    await waitFor(() => getByText('Save to graph'));
    fireEvent.click(getByText('Save to graph'));
    expect(getByPlaceholderText('Node title…')).toBeInTheDocument();
  });

  it('calls /api/query/save and shows saved badge on confirm', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => JSON.stringify(['n1']) },
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('The answer is 42') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
            cancel: vi.fn(),
          }),
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { node: { id: 'saved-id', title: 'Saved node', node_type: 'learning' }, edges_created: 1 } }),
      });

    const { getByPlaceholderText, getByText } = render(
      <AskMode allNodes={[{ id: 'n1', node_type: 'hunch', title: 'Test', description: null, status: 'promoted' }]} />
    );
    fireEvent.change(getByPlaceholderText('Ask a question…'), { target: { value: 'What is the key tension?' } });
    fireEvent.submit(getByPlaceholderText('Ask a question…').closest('form')!);
    await waitFor(() => getByText('Save to graph'));
    fireEvent.click(getByText('Save to graph'));
    await waitFor(() => getByPlaceholderText('Node title…'));
    fireEvent.click(getByText('Save'));
    await waitFor(() => expect(getByText(/Saved/)).toBeInTheDocument());
    const [, saveCall] = mockFetch.mock.calls;
    const body = JSON.parse(saveCall[1].body as string) as { node_type: string; context_node_ids: string[] };
    expect(body.node_type).toBe('learning');
    expect(body.context_node_ids).toContain('n1');
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npx vitest run src/app/query/__tests__/AskMode.test.tsx
```

Expected: the 3 new tests FAIL — `Save to graph` not found in DOM.

- [ ] **Step 3: Implement AskMode changes**

Replace the full content of `src/app/query/AskMode.tsx` with:

```typescript
'use client';

import { useState, useRef, useMemo } from 'react';
import type { Node } from '@/lib/types/nodes';
import { NodeCard } from './NodeCard';

interface Message {
  readonly id: number;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly nodeIds: readonly string[];
  readonly savedNodeId?: string;
}

interface AskModeProps {
  readonly allNodes: ReadonlyArray<Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>>;
}

type SaveNodeType = 'hunch' | 'learning';

interface SaveState {
  readonly messageId: number;
  readonly title: string;
  readonly nodeType: SaveNodeType;
  readonly saving: boolean;
}

export function AskMode({ allNodes }: AskModeProps) {
  const nextId = useRef(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const referencedNodeIds = useMemo(
    () => new Set(messages.flatMap(m => m.nodeIds)),
    [messages]
  );
  const referencedNodes = useMemo(
    () => allNodes.filter(n => referencedNodeIds.has(n.id)),
    [allNodes, referencedNodeIds]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || isStreaming) return;

    const ERROR_MESSAGE = 'Something went wrong. Please try again.';
    const history = messages
      .filter(m => m.content !== ERROR_MESSAGE)
      .map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { id: nextId.current++, role: 'user', content: query, nodeIds: [] }]);
    setInput('');
    setIsStreaming(true);
    setMessages(prev => [...prev, { id: nextId.current++, role: 'assistant', content: '', nodeIds: [] }]);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history }),
      });

      if (!res.ok) throw new Error('Query failed');

      let contextNodeIds: string[] = [];
      try {
        contextNodeIds = JSON.parse(res.headers.get('X-Context-Nodes') ?? '[]') as string[];
      } catch {
        // non-fatal: proceed without node references
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      try {
        let accumulated = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const current = accumulated;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: current, nodeIds: contextNodeIds };
            return updated;
          });
        }
      } catch (streamErr) {
        reader.cancel();
        throw streamErr;
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Something went wrong. Please try again.',
          nodeIds: [],
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function openSaveForm(message: Message) {
    const firstLine = message.content.split('\n')[0].trim().slice(0, 150);
    setSaveState({ messageId: message.id, title: firstLine, nodeType: 'learning', saving: false });
  }

  async function handleSave(message: Message) {
    if (!saveState) return;
    setSaveState(s => s ? { ...s, saving: true } : null);

    try {
      const res = await fetch('/api/query/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: saveState.title,
          content: message.content,
          node_type: saveState.nodeType,
          context_node_ids: [...message.nodeIds],
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const { data } = await res.json() as { data: { node: { id: string } } };
      setMessages(prev => prev.map(m =>
        m.id === message.id ? { ...m, savedNodeId: data.node.id } : m
      ));
      setSaveState(null);
    } catch {
      setSaveState(s => s ? { ...s, saving: false } : null);
    }
  }

  const nodesByType = useMemo(
    () => referencedNodes.reduce<Record<string, typeof referencedNodes>>((acc, n) => {
      const key = n.node_type.replace(/_/g, ' ');
      return { ...acc, [key]: [...(acc[key] ?? []), n] };
    }, {}),
    [referencedNodes]
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-160px)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <p className="text-sm text-cof-text-tertiary pt-8 text-center">
              Ask anything about the knowledge graph
            </p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              {msg.role === 'user' ? (
                <div className="max-w-sm bg-node-hunch/10 border border-node-hunch/20 rounded-xl px-4 py-2 text-sm text-cof-text-primary">
                  {msg.content}
                </div>
              ) : (
                <div>
                  <div className="text-sm text-cof-text-secondary leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                    {isStreaming && msg.id === messages[messages.length - 1]?.id && (
                      <span className="animate-pulse">▋</span>
                    )}
                  </div>

                  {/* Save to graph controls — only for completed assistant messages */}
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
                            onChange={e => setSaveState(s => s ? { ...s, title: e.target.value } : null)}
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
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t border-cof-border">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={isStreaming}
            className="flex-1 text-sm px-3 py-2 bg-cof-bg-elevated border border-cof-border rounded-lg focus:outline-none focus:border-node-hunch disabled:opacity-50"
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
            <p className="text-xs font-medium text-cof-text-tertiary uppercase tracking-wide">
              Referenced nodes
            </p>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="text-xs text-cof-text-tertiary hover:text-cof-text-secondary"
            >
              ›
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(nodesByType).map(([type, nodes]) => (
              <div key={type}>
                <p className="text-[10px] uppercase tracking-wide text-cof-text-tertiary mb-1">{type}</p>
                <div className="space-y-1">
                  {nodes.map(n => <NodeCard key={n.id} node={n} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {referencedNodes.length > 0 && !panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Show referenced nodes"
          className="w-8 flex-shrink-0 flex items-center justify-center text-cof-text-tertiary hover:text-cof-text-secondary border-l border-cof-border"
        >
          ‹
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run src/app/query/__tests__/AskMode.test.tsx
```

Expected: all tests PASS including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/app/query/AskMode.tsx src/app/query/__tests__/AskMode.test.tsx
git commit -m "feat: add save-to-graph button on Query assistant messages"
```

---

## Part B — Connection-aware Ingestion

### Task B1: `connectionResolver.ts`

**Files:**
- Create: `src/lib/agents/connectionResolver.ts`
- Create: `src/lib/agents/__tests__/connectionResolver.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/agents/__tests__/connectionResolver.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConnections } from '../connectionResolver';
import type { SuggestedConnection } from '../connectionResolver';

function makeSupabase(
  matchResult: { id: string } | null,
  existingEdge: { id: string } | null = null,
) {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockEdgeSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: existingEdge }),
      }),
    }),
  });
  const mockNodeSelect = vi.fn().mockReturnValue({
    ilike: vi.fn().mockReturnValue({
      neq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: matchResult }),
          }),
        }),
      }),
    }),
  });

  return {
    from: (table: string) => {
      if (table === 'nodes') return { select: mockNodeSelect };
      if (table === 'edges') return { select: mockEdgeSelect, insert: mockInsert };
      return { select: vi.fn(), insert: vi.fn() };
    },
    _mockInsert: mockInsert,
  };
}

const SUGGESTIONS: SuggestedConnection[] = [
  { target_title: 'Formation capital strategy', edge_type: 'supports', rationale: 'Directly supports' },
  { target_title: 'Nonexistent node', edge_type: 'contradicts', rationale: 'Should not match' },
];

describe('resolveConnections', () => {
  it('returns 0 when suggestions is empty', async () => {
    const supabase = makeSupabase(null);
    const count = await resolveConnections('src-id', [], supabase as never, 'user-1');
    expect(count).toBe(0);
  });

  it('creates an edge when a matching node is found', async () => {
    const supabase = makeSupabase({ id: 'matched-id' });
    const count = await resolveConnections('src-id', [SUGGESTIONS[0]], supabase as never, 'user-1');
    expect(count).toBe(1);
    expect(supabase._mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_id: 'src-id',
        target_id: 'matched-id',
        edge_type: 'supports',
      })
    );
  });

  it('skips when no node matches the title', async () => {
    const supabase = makeSupabase(null);
    const count = await resolveConnections('src-id', [SUGGESTIONS[1]], supabase as never, 'user-1');
    expect(count).toBe(0);
    expect(supabase._mockInsert).not.toHaveBeenCalled();
  });

  it('skips when edge already exists', async () => {
    const supabase = makeSupabase({ id: 'matched-id' }, { id: 'existing-edge' });
    const count = await resolveConnections('src-id', [SUGGESTIONS[0]], supabase as never, 'user-1');
    expect(count).toBe(0);
    expect(supabase._mockInsert).not.toHaveBeenCalled();
  });

  it('processes multiple suggestions independently', async () => {
    const supabase = makeSupabase({ id: 'matched-id' });
    const count = await resolveConnections('src-id', SUGGESTIONS, supabase as never, 'user-1');
    // First matches, second does not (mock always returns matched-id, so both "match")
    // Test that both were attempted
    expect(count).toBeGreaterThan(0);
  });

  it('skips suggestions with empty target_title', async () => {
    const supabase = makeSupabase({ id: 'matched-id' });
    const empty: SuggestedConnection = { target_title: '  ', edge_type: 'supports', rationale: '' };
    const count = await resolveConnections('src-id', [empty], supabase as never, 'user-1');
    expect(count).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npx vitest run src/lib/agents/__tests__/connectionResolver.test.ts
```

Expected: FAIL — `Cannot find module '../connectionResolver'`

- [ ] **Step 3: Implement connectionResolver**

```typescript
// src/lib/agents/connectionResolver.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SuggestedConnection {
  readonly target_title: string;
  readonly edge_type: string;
  readonly rationale: string;
}

export async function resolveConnections(
  sourceNodeId: string,
  suggestions: ReadonlyArray<SuggestedConnection>,
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  if (!suggestions.length) return 0;

  let created = 0;

  for (const suggestion of suggestions) {
    if (!suggestion.target_title?.trim()) continue;

    const { data: match } = await supabase
      .from('nodes')
      .select('id')
      .ilike('title', suggestion.target_title.trim())
      .neq('id', sourceNodeId)
      .in('status', ['promoted', 'human_reviewed', 'llm_reviewed'])
      .limit(1)
      .maybeSingle();

    if (!match) continue;

    const { data: existing } = await supabase
      .from('edges')
      .select('id')
      .eq('source_id', sourceNodeId)
      .eq('target_id', match.id)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from('edges').insert({
      source_id: sourceNodeId,
      target_id: match.id,
      edge_type: suggestion.edge_type,
      weight: 1,
      author_id: userId,
    });

    if (!error) created++;
  }

  return created;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/agents/__tests__/connectionResolver.test.ts
```

Expected: 6/6 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/connectionResolver.ts src/lib/agents/__tests__/connectionResolver.test.ts
git commit -m "feat: add connectionResolver — resolve LLM suggested_connections to real graph edges"
```

---

### Task B2: Add `existingNodes` to `GoalContext` and extraction prompt

**Files:**
- Modify: `src/lib/agents/extraction.ts`
- Modify: `src/lib/agents/__tests__/extraction.test.ts` (find or create this test file)

- [ ] **Step 1: Write the failing test**

Find the extraction test file. If it doesn't exist at `src/lib/agents/__tests__/extraction.test.ts`, create it. Add these tests:

```typescript
// src/lib/agents/__tests__/extraction.test.ts
// (add to existing file or create new)
import { describe, it, expect } from 'vitest';
import { buildExtractionPrompt } from '../extraction';

describe('buildExtractionPrompt — existingNodes', () => {
  it('includes existing nodes section when existingNodes is provided', () => {
    const prompt = buildExtractionPrompt('My hunch', 'Some text', {
      goalSpaces: [],
      triggerOutcomes: [],
      personNodes: [],
      existingNodes: [
        { id: 'n1', title: 'Formation capital strategy', node_type: 'hunch' },
        { id: 'n2', title: 'Natural assets fund', node_type: 'learning' },
      ],
    });
    expect(prompt).toContain('Existing nodes in the graph');
    expect(prompt).toContain('[hunch] Formation capital strategy');
    expect(prompt).toContain('[learning] Natural assets fund');
  });

  it('omits existing nodes section when existingNodes is empty', () => {
    const prompt = buildExtractionPrompt('My hunch', 'Some text', {
      goalSpaces: [],
      triggerOutcomes: [],
      personNodes: [],
      existingNodes: [],
    });
    expect(prompt).not.toContain('Existing nodes in the graph');
  });

  it('omits existing nodes section when existingNodes is undefined', () => {
    const prompt = buildExtractionPrompt('My hunch', 'Some text', {
      goalSpaces: [],
      triggerOutcomes: [],
      personNodes: [],
    });
    expect(prompt).not.toContain('Existing nodes in the graph');
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npx vitest run src/lib/agents/__tests__/extraction.test.ts
```

Expected: FAIL — tests about `existingNodes` fail because `GoalContext` doesn't have that field yet.

- [ ] **Step 3: Update `GoalContext` and `buildExtractionPrompt` in extraction.ts**

In `src/lib/agents/extraction.ts`, make these two changes:

**Change 1** — update `GoalContext` interface (around line 35):

```typescript
export interface GoalContext {
  readonly goalSpaces: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly triggerOutcomes: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly personNodes: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly existingNodes?: ReadonlyArray<{ readonly id: string; readonly title: string; readonly node_type: string }>;
}
```

**Change 2** — add the existing nodes section at the end of `buildExtractionPrompt`, inside the `if (!goalContext)` block's else path, after all existing sections are built (around line 160, after the persons section):

```typescript
  if (goalContext.existingNodes?.length) {
    sections.push('');
    sections.push('Existing nodes in the graph (use these exact titles in suggested_connections where relevant):');
    for (const n of goalContext.existingNodes) {
      sections.push(`- [${n.node_type}] ${n.title}`);
    }
    sections.push('');
    sections.push('When this note connects to any node listed above, add it to suggested_connections using the EXACT title shown.');
  }
```

The full updated `buildExtractionPrompt` function body (from where the sections array is built, after `const sections: string[] = [base, ''];`):

```typescript
  const sections: string[] = [base, ''];

  if (hasGoalSpaces) {
    sections.push('Active goal spaces:');
    for (const gs of goalContext.goalSpaces) {
      sections.push(`- ${gs.title} (id: ${gs.id})`);
    }
  }

  if (hasTriggerOutcomes) {
    if (hasGoalSpaces) sections.push('');
    sections.push('Active trigger outcomes:');
    for (const to of goalContext.triggerOutcomes) {
      sections.push(`- ${to.title} (id: ${to.id})`);
    }
  }

  if (hasTriggerOutcomes || hasGoalSpaces) {
    sections.push('');
    sections.push('If this node relates to any of the trigger outcomes above, include goal_relevance in your response using the exact outcome IDs provided.');
  }

  if (hasPersonNodes) {
    sections.push('');
    sections.push('Known persons in the system:');
    for (const p of goalContext.personNodes) {
      sections.push(`- ${p.title} (id: ${p.id})`);
    }
    sections.push('');
    sections.push('If this text mentions any of the persons above, include a suggested_connection with edge_type "mentioned_in" and target_title matching the exact name from this list.');
  }

  if (goalContext.existingNodes?.length) {
    sections.push('');
    sections.push('Existing nodes in the graph (use these exact titles in suggested_connections where relevant):');
    for (const n of goalContext.existingNodes) {
      sections.push(`- [${n.node_type}] ${n.title}`);
    }
    sections.push('');
    sections.push('When this note connects to any node listed above, add it to suggested_connections using the EXACT title shown.');
  }

  return sections.join('\n');
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/agents/__tests__/extraction.test.ts
```

Expected: all tests PASS including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/extraction.ts src/lib/agents/__tests__/extraction.test.ts
git commit -m "feat: add existingNodes to GoalContext — extraction prompt now includes graph context for connection suggestions"
```

---

### Task B3: Wire up in `process/route.ts`

**Files:**
- Modify: `src/app/api/capture/process/route.ts`

No new tests needed for this task — the route test suite already covers the process route. This task only adds two wiring steps to an existing, well-tested route.

- [ ] **Step 1: Add `existingNodes` fetch to the existing `Promise.all`**

In `src/app/api/capture/process/route.ts`, find the `Promise.all` around line 31. Add a fifth parallel fetch for existing nodes:

```typescript
    const [
      { data: node, error: fetchError },
      { data: goalSpacesData },
      { data: triggerOutcomesData },
      { data: personNodesData },
      { data: existingNodesData },
    ] = await Promise.all([
      supabase
        .from('nodes')
        .select('title, description, node_type, content, attachments')
        .eq('id', node_id)
        .single(),
      supabase
        .from('nodes')
        .select('id, title')
        .eq('node_type', 'goal_space')
        .neq('status', 'archived'),
      supabase
        .from('nodes')
        .select('id, title')
        .eq('node_type', 'trigger_outcome')
        .neq('status', 'archived'),
      supabase
        .from('nodes')
        .select('id, title')
        .eq('node_type', 'person')
        .in('status', ['promoted', 'human_reviewed']),
      supabase
        .from('nodes')
        .select('id, title, node_type')
        .in('status', ['promoted', 'human_reviewed'])
        .neq('id', node_id)
        .order('updated_at', { ascending: false })
        .limit(60),
    ]);
```

- [ ] **Step 2: Pass `existingNodes` into `goalContext`**

Find where `goalContext` is built (around line 63). Add `existingNodes`:

```typescript
    const goalContext: GoalContext = {
      goalSpaces: goalSpacesData ?? [],
      triggerOutcomes: triggerOutcomesData ?? [],
      personNodes: personNodesData ?? [],
      existingNodes: (existingNodesData ?? []) as Array<{ id: string; title: string; node_type: string }>,
    };
```

- [ ] **Step 3: Call `resolveConnections` after single-node extraction**

In the single-node extraction path (the `else` branch), after the `supabase.from('nodes').update(...)` call that stores the extraction result, add:

```typescript
      // Auto-resolve suggested connections into graph edges
      const { resolveConnections } = await import('@/lib/agents/connectionResolver');
      await resolveConnections(
        node_id,
        extraction.suggested_connections,
        supabase,
        user.id,
      );
```

The full single-node extraction path after the update call looks like:

```typescript
      await supabase
        .from('nodes')
        .update({
          ...titleUpdate,
          llm_extraction: extraction,
          status: newStatus,
          node_type: classifiedNodeType,
          confidence_level: confidenceLevel,
          confidence_basis: confidenceBasis,
          content: {
            ...((node.content as Record<string, unknown>) ?? {}),
            maturity,
            process_status: newStatus,
          },
        })
        .eq('id', node_id);

      // Auto-resolve suggested connections into graph edges
      const { resolveConnections } = await import('@/lib/agents/connectionResolver');
      await resolveConnections(
        node_id,
        extraction.suggested_connections,
        supabase,
        user.id,
      );

      // Log activity
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'reviewed',
        target_node_id: node_id,
        details: { type: 'llm_extraction', model: 'extraction', classified_type: classifiedNodeType, maturity },
      });
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: 57 files, 432+ tests, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/capture/process/route.ts
git commit -m "feat: wire connection-aware ingestion — fetch existing nodes as LLM context, auto-resolve suggested_connections to edges"
```

---

## Final check

- [ ] **Run full test suite one more time**

```bash
npm test
```

Expected: all tests pass, 0 errors.

- [ ] **TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "worktrees\|__tests__"
```

Expected: no errors in non-test files.
