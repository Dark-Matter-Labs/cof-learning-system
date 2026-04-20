# Filterable System Reflection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/review` page with "System Health" — 4 sections: flagged items, tension alerts, filterable LLM reflection, unprocessed learnings.

**Architecture:** `page.tsx` stays a server component fetching 6 data sets. `SystemHealthClient.tsx` is a new client component owning Accept/Archive state. `ReflectionSection.tsx` owns filter + synthesis state, calling a new `/api/reflect/analyse` endpoint. The existing `ReflectionPanel.tsx` is deleted.

**Tech Stack:** Next.js App Router, React, Supabase, Anthropic SDK (`@anthropic-ai/sdk`), Vitest + React Testing Library

**Working directory:** `/Users/gurden/Documents/code/cof-learning-system/.worktrees/cof-v06-pipeline`

---

### Task 1: FlaggedItem component

**Files:**
- Create: `src/components/review/FlaggedItem.tsx`
- Create: `src/components/review/__tests__/FlaggedItem.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/review/__tests__/FlaggedItem.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

import { FlaggedItem } from '../FlaggedItem';
import type { Node } from '@/lib/types/nodes';

const baseNode: Node = {
  id: 'n1',
  node_type: 'hunch',
  title: 'Uncertain Hunch',
  description: 'A test description',
  status: 'flagged_for_review',
  llm_extraction: { maturity: 'watch_closely' } as unknown as Node['llm_extraction'],
  hunch_type: null,
  confidence_level: null,
  confidence_basis: null,
  content: null,
  llm_review: null,
  human_review: null,
  author_id: null,
  parent_node_id: null,
  insight_date: null,
  domain_tags: [],
  external_links: [],
  attachments: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('FlaggedItem', () => {
  it('renders the node title', () => {
    render(<FlaggedItem node={baseNode} onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Uncertain Hunch')).toBeTruthy();
  });

  it('renders flag reason label for watch_closely', () => {
    render(<FlaggedItem node={baseNode} onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Needs more evidence')).toBeTruthy();
  });

  it('renders flag reason for needs_development', () => {
    const node: Node = { ...baseNode, llm_extraction: { maturity: 'needs_development' } as unknown as Node['llm_extraction'] };
    render(<FlaggedItem node={node} onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Needs development')).toBeTruthy();
  });

  it('renders all three action buttons/links', () => {
    render(<FlaggedItem node={baseNode} onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Accept as-is')).toBeTruthy();
    expect(screen.getByText('Edit & promote')).toBeTruthy();
    expect(screen.getByText('Archive')).toBeTruthy();
  });

  it('Edit & promote links to /capture/[id]/review', () => {
    render(<FlaggedItem node={baseNode} onAccept={vi.fn()} onArchive={vi.fn()} />);
    const link = screen.getByText('Edit & promote').closest('a');
    expect(link?.getAttribute('href')).toBe('/capture/n1/review');
  });

  it('calls onAccept with node id when Accept is clicked', () => {
    const onAccept = vi.fn();
    render(<FlaggedItem node={baseNode} onAccept={onAccept} onArchive={vi.fn()} />);
    fireEvent.click(screen.getByText('Accept as-is'));
    expect(onAccept).toHaveBeenCalledWith('n1');
  });

  it('calls onArchive with node id when Archive is clicked', () => {
    const onArchive = vi.fn();
    render(<FlaggedItem node={baseNode} onAccept={vi.fn()} onArchive={onArchive} />);
    fireEvent.click(screen.getByText('Archive'));
    expect(onArchive).toHaveBeenCalledWith('n1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/gurden/Documents/code/cof-learning-system/.worktrees/cof-v06-pipeline
npx vitest run src/components/review/__tests__/FlaggedItem.test.tsx --reporter=verbose
```
Expected: FAIL — `Cannot find module '../FlaggedItem'`

- [ ] **Step 3: Implement FlaggedItem**

```tsx
// src/components/review/FlaggedItem.tsx
'use client';

import Link from 'next/link';
import type { Node } from '@/lib/types/nodes';

interface FlaggedItemProps {
  readonly node: Node;
  readonly onAccept: (id: string) => void;
  readonly onArchive: (id: string) => void;
}

const FLAG_REASON_LABELS: Record<string, string> = {
  watch_closely: 'Needs more evidence',
  needs_development: 'Needs development',
  cluster_dependent: 'Depends on other entries',
};

export function FlaggedItem({ node, onAccept, onArchive }: FlaggedItemProps) {
  const extraction = node.llm_extraction as (Record<string, unknown> | null);
  const maturity = typeof extraction?.maturity === 'string' ? extraction.maturity : null;
  const reason = maturity ? (FLAG_REASON_LABELS[maturity] ?? maturity) : 'Flagged by LLM';

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border border-amber-900/30 rounded-lg p-3">
      <div className="mb-1.5">
        <p className="text-xs text-gray-800 dark:text-gray-200 font-medium truncate">{node.title}</p>
        {node.description && (
          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{node.description}</p>
        )}
        <p className="text-[10px] text-amber-500 mt-1">{reason}</p>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => onAccept(node.id)}
          className="text-[10px] px-2 py-1 bg-teal-900/20 border border-teal-900/30 text-teal-400 rounded hover:bg-teal-900/40"
        >
          Accept as-is
        </button>
        <Link
          href={`/capture/${node.id}/review`}
          className="text-[10px] px-2 py-1 bg-gray-800 border border-gray-700 text-gray-300 rounded hover:bg-gray-700"
        >
          Edit & promote
        </Link>
        <button
          onClick={() => onArchive(node.id)}
          className="text-[10px] px-2 py-1 text-gray-500 hover:text-gray-400"
        >
          Archive
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/review/__tests__/FlaggedItem.test.tsx --reporter=verbose
```
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/review/FlaggedItem.tsx src/components/review/__tests__/FlaggedItem.test.tsx
git commit -m "feat(v06): FlaggedItem component with Accept/Edit/Archive actions"
```

---

### Task 2: ReflectionSection component

**Files:**
- Create: `src/components/review/ReflectionSection.tsx`
- Create: `src/components/review/__tests__/ReflectionSection.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/review/__tests__/ReflectionSection.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { ReflectionSection } from '../ReflectionSection';

describe('ReflectionSection', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Run reflection button', () => {
    render(<ReflectionSection sites={[]} options={[]} goalSpaces={[]} />);
    expect(screen.getByRole('button', { name: /run reflection/i })).toBeTruthy();
  });

  it('renders filter dropdown when options exist', () => {
    render(
      <ReflectionSection
        sites={[{ id: 's1', label: 'Madrid', type: 'site' }]}
        options={[]}
        goalSpaces={[]}
      />
    );
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByText('Madrid')).toBeTruthy();
  });

  it('shows no-filters message when all lists are empty', () => {
    render(<ReflectionSection sites={[]} options={[]} goalSpaces={[]} />);
    expect(screen.getByText(/No filters available/)).toBeTruthy();
  });

  it('disables Run button while loading', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
    render(<ReflectionSection sites={[]} options={[]} goalSpaces={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /run reflection/i }));
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  it('renders synthesis text on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ synthesis: 'Madrid has 3 active hunches.' }),
    } as Response);

    render(
      <ReflectionSection
        sites={[{ id: 's1', label: 'Madrid', type: 'site' }]}
        options={[]}
        goalSpaces={[]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /run reflection/i }));
    await waitFor(() => {
      expect(screen.getByText('Madrid has 3 active hunches.')).toBeTruthy();
    });
  });

  it('shows error message on fetch failure', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'LLM call failed' }),
    } as Response);

    render(<ReflectionSection sites={[]} options={[]} goalSpaces={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /run reflection/i }));
    await waitFor(() => {
      expect(screen.getByText(/Reflection failed/)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/review/__tests__/ReflectionSection.test.tsx --reporter=verbose
```
Expected: FAIL — `Cannot find module '../ReflectionSection'`

- [ ] **Step 3: Implement ReflectionSection**

```tsx
// src/components/review/ReflectionSection.tsx
'use client';

import { useState } from 'react';

interface FilterOption {
  readonly id: string;
  readonly label: string;
  readonly type: 'site' | 'option' | 'goal_space';
}

interface ReflectionSectionProps {
  readonly sites: readonly FilterOption[];
  readonly options: readonly FilterOption[];
  readonly goalSpaces: readonly FilterOption[];
}

type FilterState =
  | { readonly type: 'system' }
  | { readonly type: 'site' | 'option' | 'goal_space'; readonly id: string; readonly label: string };

export function ReflectionSection({ sites, options, goalSpaces }: ReflectionSectionProps) {
  const [filter, setFilter] = useState<FilterState>({ type: 'system' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [synthesis, setSynthesis] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const hasFilters = sites.length > 0 || options.length > 0 || goalSpaces.length > 0;

  async function handleRunReflection() {
    setStatus('loading');
    setSynthesis('');
    setErrorMsg('');

    const body =
      filter.type === 'system'
        ? { type: 'system', label: 'Whole system' }
        : { type: filter.type, value: filter.id, label: filter.label };

    try {
      const res = await fetch('/api/reflect/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setErrorMsg('Reflection failed — try again');
        setStatus('error');
        return;
      }
      const json = await res.json() as { synthesis?: string };
      setSynthesis(json.synthesis ?? '');
      setStatus('done');
    } catch {
      setErrorMsg('Failed to reach reflection service');
      setStatus('error');
    }
  }

  function handleFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === 'system') {
      setFilter({ type: 'system' });
    } else {
      const colonIdx = val.indexOf('::');
      const type = val.slice(0, colonIdx) as 'site' | 'option' | 'goal_space';
      const id = val.slice(colonIdx + 2);
      const all = [...sites, ...options, ...goalSpaces];
      const opt = all.find(o => o.id === id);
      setFilter({ type, id, label: opt?.label ?? id });
    }
    setStatus('idle');
    setSynthesis('');
  }

  const selectValue =
    filter.type === 'system' ? 'system' : `${filter.type}::${filter.id}`;

  const filterLabel = filter.type === 'system' ? 'System' : filter.label;

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        System Reflection
      </h2>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {hasFilters ? (
          <select
            value={selectValue}
            onChange={handleFilterChange}
            className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-teal-500"
          >
            <option value="system">Whole system</option>
            {sites.length > 0 && (
              <optgroup label="Sites">
                {sites.map(s => (
                  <option key={s.id} value={`site::${s.id}`}>{s.label}</option>
                ))}
              </optgroup>
            )}
            {options.length > 0 && (
              <optgroup label="Options">
                {options.map(o => (
                  <option key={o.id} value={`option::${o.id}`}>{o.label}</option>
                ))}
              </optgroup>
            )}
            {goalSpaces.length > 0 && (
              <optgroup label="Goal spaces">
                {goalSpaces.map(g => (
                  <option key={g.id} value={`goal_space::${g.id}`}>{g.label}</option>
                ))}
              </optgroup>
            )}
          </select>
        ) : (
          <p className="text-[10px] text-gray-500">
            No filters available yet — add more captures first
          </p>
        )}

        <button
          onClick={handleRunReflection}
          disabled={status === 'loading'}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-1.5 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? 'Analysing...' : 'Run reflection'}
        </button>
      </div>

      {status === 'error' && (
        <p className="text-xs text-red-400 mb-3">{errorMsg}</p>
      )}

      {status === 'done' && synthesis && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">
            {filterLabel}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {synthesis}
          </p>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/review/__tests__/ReflectionSection.test.tsx --reporter=verbose
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/review/ReflectionSection.tsx src/components/review/__tests__/ReflectionSection.test.tsx
git commit -m "feat(v06): ReflectionSection with filterable LLM synthesis"
```

---

### Task 3: /api/reflect/analyse route

**Files:**
- Create: `src/app/api/reflect/analyse/route.ts`
- Create: `src/app/api/reflect/analyse/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/api/reflect/analyse/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Madrid has 2 active hunches and 1 test.' }],
      }),
    },
  })),
}));

import { createClient } from '@/lib/supabase/server';

function buildMockSupabase(overrides: {
  user?: unknown;
  edges?: unknown[];
  startNode?: unknown;
  nodes?: unknown[];
} = {}) {
  const user = overrides.user ?? { id: 'user-1' };
  const edges = overrides.edges ?? [];
  const startNode = overrides.startNode ?? { id: 'node-1', title: 'Madrid', node_type: 'site', description: null };
  const nodes = overrides.nodes ?? [{ id: 'node-1', title: 'Madrid', node_type: 'site', description: null }];

  let callCount = 0;
  const results = [
    { data: edges, error: null },     // edges fetch
    { data: startNode, error: null }, // single start node
    { data: nodes, error: null },     // connected nodes
  ];

  const chain: Record<string, unknown> = {};
  const selfReturn = () => chain;
  chain.select = selfReturn;
  chain.eq = selfReturn;
  chain.neq = selfReturn;
  chain.in = selfReturn;
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(results[callCount++] ?? { data: null, error: null }));
  chain.order = selfReturn;
  chain.then = (fn: (v: unknown) => unknown) => {
    const result = results[callCount++] ?? { data: [], error: null };
    return Promise.resolve(result).then(fn);
  };

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

describe('POST /api/reflect/analyse', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildMockSupabase({ user: null }) as never
    );
    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/reflect/analyse', {
      method: 'POST',
      body: JSON.stringify({ type: 'system', label: 'Whole system' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when type is missing', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMockSupabase() as never);
    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/reflect/analyse', {
      method: 'POST',
      body: JSON.stringify({ label: 'Whole system' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns synthesis text for system type', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMockSupabase() as never);
    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/reflect/analyse', {
      method: 'POST',
      body: JSON.stringify({ type: 'system', label: 'Whole system' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { synthesis?: string };
    expect(typeof body.synthesis).toBe('string');
    expect(body.synthesis!.length).toBeGreaterThan(0);
  });

  it('returns 400 when site filter has no value', async () => {
    vi.mocked(createClient).mockResolvedValue(buildMockSupabase() as never);
    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/reflect/analyse', {
      method: 'POST',
      body: JSON.stringify({ type: 'site', label: 'Madrid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/api/reflect/analyse/__tests__/route.test.ts --reporter=verbose
```
Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the analyse route**

```ts
// src/app/api/reflect/analyse/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = (label: string) =>
  `You are a strategic analyst for the Civilization Options Fund (COF). ` +
  `You are running a focused knowledge graph reflection on: "${label}". ` +
  `Return a synthesis answering the provided questions. Be direct and specific. Use plain language.`;

const USER_PROMPT = (label: string, nodeLines: string) =>
  `You are reflecting on activity related to: "${label}"\n\n` +
  `Analyse only the nodes provided. Answer each in 3-5 sentences:\n` +
  `- What is the current state of work related to ${label}?\n` +
  `- What assumptions are being tested? What results have we seen?\n` +
  `- What hunches are active but untested?\n` +
  `- What commitments exist and are they progressing?\n` +
  `- What tensions or contradictions exist in this space?\n` +
  `- What should be stopped, strengthened, or reframed?\n\n` +
  `Nodes (${nodeLines.split('\n').length}):\n${nodeLines}`;

function bfsConnectedIds(
  startId: string,
  edges: ReadonlyArray<{ readonly source_id: string; readonly target_id: string }>,
  maxDepth: number,
): Set<string> {
  const visited = new Set<string>([startId]);
  let frontier = new Set<string>([startId]);
  for (let depth = 0; depth < maxDepth; depth++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const edge of edges) {
        if (edge.source_id === id && !visited.has(edge.target_id)) next.add(edge.target_id);
        if (edge.target_id === id && !visited.has(edge.source_id)) next.add(edge.source_id);
      }
    }
    if (next.size === 0) break;
    for (const id of next) visited.add(id);
    frontier = next;
  }
  return visited;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { type?: string; value?: string; label?: string };
  try {
    body = await request.json() as { type?: string; value?: string; label?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, value, label } = body;
  if (!type || !label) {
    return NextResponse.json({ error: 'type and label are required' }, { status: 400 });
  }
  if (type !== 'system' && !value) {
    return NextResponse.json({ error: 'value is required for non-system filters' }, { status: 400 });
  }

  type NodeRow = { id: string; title: string; node_type: string; description: string | null };
  let nodes: NodeRow[];

  if (type === 'system') {
    const { data } = await supabase
      .from('nodes')
      .select('id, title, node_type, description')
      .in('status', ['promoted', 'human_reviewed']);
    nodes = (data ?? []) as NodeRow[];
  } else {
    const [{ data: edgesData }, { data: startNode }] = await Promise.all([
      supabase.from('edges').select('source_id, target_id'),
      supabase.from('nodes').select('id, title, node_type, description').eq('id', value!).single(),
    ]);

    if (!startNode) {
      return NextResponse.json({ error: 'Filter node not found' }, { status: 404 });
    }

    const edges = (edgesData ?? []) as Array<{ source_id: string; target_id: string }>;
    const connectedIds = bfsConnectedIds(value!, edges, 3);

    const { data: connectedNodes } = await supabase
      .from('nodes')
      .select('id, title, node_type, description')
      .in('id', [...connectedIds]);
    nodes = (connectedNodes ?? []) as NodeRow[];
  }

  if (nodes.length === 0) {
    return NextResponse.json({ synthesis: `No nodes found connected to ${label} yet.` });
  }

  const nodeLines = nodes
    .map(n => `[${n.node_type}] ${n.title}${n.description ? ': ' + n.description : ''}`)
    .join('\n');

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: process.env.REFLECTION_LLM_MODEL ?? 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT(label),
      messages: [{ role: 'user', content: USER_PROMPT(label, nodeLines) }],
    });

    const synthesis = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return NextResponse.json({ synthesis });
  } catch {
    return NextResponse.json({ error: 'LLM call failed' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/reflect/analyse/__tests__/route.test.ts --reporter=verbose
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reflect/analyse/route.ts src/app/api/reflect/analyse/__tests__/route.test.ts
git commit -m "feat(v06): /api/reflect/analyse — scoped LLM reflection endpoint"
```

---

### Task 4: SystemHealthClient + replace page.tsx + delete ReflectionPanel

**Files:**
- Create: `src/app/review/SystemHealthClient.tsx`
- Modify: `src/app/review/page.tsx`
- Delete: `src/app/review/ReflectionPanel.tsx`
- Modify: `src/app/review/__tests__/ReviewPage.test.tsx` (full replacement)

- [ ] **Step 1: Write failing tests for the new page**

Replace the entire contents of `src/app/review/__tests__/ReviewPage.test.tsx`:

```tsx
// src/app/review/__tests__/ReviewPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/app/review/SystemHealthClient', () => ({
  SystemHealthClient: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'system-health-client' },
      React.createElement('span', null, `flagged:${(props.flagged as unknown[]).length}`),
      React.createElement('span', null, `tensions:${(props.tensions as unknown[]).length}`),
    ),
}));

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

type SupabaseChain = {
  select: () => SupabaseChain;
  eq: () => SupabaseChain;
  neq: () => SupabaseChain;
  in: () => SupabaseChain;
  order: () => Promise<{ data: unknown[]; error: null }>;
  then: (fn: (v: { data: unknown[]; error: null }) => unknown) => Promise<unknown>;
};

function buildChain(data: unknown[]): SupabaseChain {
  const resolveWith = { data, error: null };
  const chain: SupabaseChain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    order: vi.fn().mockResolvedValue(resolveWith),
    then: (fn) => Promise.resolve(resolveWith).then(fn),
  };
  return chain;
}

function buildMockClient(datasets: unknown[][]) {
  let idx = 0;
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    from: vi.fn().mockImplementation(() => buildChain(datasets[idx++] ?? [])),
  };
}

async function renderPage() {
  const mod = await import('../page');
  const Page = mod.default;
  const element = await Page();
  const { container } = render(element as React.ReactElement);
  return container;
}

describe('SystemHealthPage', () => {
  beforeEach(() => { vi.resetModules(); });

  it('renders page title "System Health"', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildMockClient([[], [], [], [], [], []]) as never
    );
    const container = await renderPage();
    expect(container.textContent).toContain('System Health');
  });

  it('passes flagged nodes to SystemHealthClient', async () => {
    const flaggedNode = { id: 'f1', title: 'Flagged node', status: 'flagged_for_review' };
    vi.mocked(createClient).mockResolvedValue(
      buildMockClient([[flaggedNode], [], [], [], [], []]) as never
    );
    const container = await renderPage();
    expect(container.textContent).toContain('flagged:1');
  });

  it('redirects to /login when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('no user') }) },
      from: vi.fn(),
    } as never);
    await import('../page').then(m => m.default()).catch(() => {});
    expect(vi.mocked(redirect)).toHaveBeenCalledWith('/login');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/review/__tests__/ReviewPage.test.tsx --reporter=verbose
```
Expected: FAIL — module mocks referencing old page structure

- [ ] **Step 3: Create SystemHealthClient**

```tsx
// src/app/review/SystemHealthClient.tsx
'use client';

import { useState, useCallback } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { TensionAlert } from '@/lib/types/tension';
import { FlaggedItem } from '@/components/review/FlaggedItem';
import { ReflectionSection } from '@/components/review/ReflectionSection';

interface FilterOption {
  readonly id: string;
  readonly label: string;
  readonly type: 'site' | 'option' | 'goal_space';
}

interface SystemHealthClientProps {
  readonly flagged: readonly Node[];
  readonly tensions: readonly TensionAlert[];
  readonly learnings: readonly Node[];
  readonly sites: readonly FilterOption[];
  readonly options: readonly FilterOption[];
  readonly goalSpaces: readonly FilterOption[];
}

const SEVERITY_COLORS: Record<string, string> = {
  high: 'text-red-400 border-red-900/50',
  medium: 'text-amber-400 border-amber-900/50',
  low: 'text-gray-500 border-gray-200 dark:border-gray-800',
};

export function SystemHealthClient({
  flagged: initialFlagged,
  tensions,
  learnings,
  sites,
  options,
  goalSpaces,
}: SystemHealthClientProps) {
  const [flagged, setFlagged] = useState<readonly Node[]>(initialFlagged);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const handleAccept = useCallback(async (id: string) => {
    const res = await fetch(`/api/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'promoted' }),
    });
    if (res.ok) {
      setFlagged(prev => prev.filter(n => n.id !== id));
    } else {
      setItemErrors(prev => ({ ...prev, [id]: 'Failed to accept — try again' }));
    }
  }, []);

  const handleArchive = useCallback(async (id: string) => {
    const res = await fetch(`/api/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    if (res.ok) {
      setFlagged(prev => prev.filter(n => n.id !== id));
    } else {
      setItemErrors(prev => ({ ...prev, [id]: 'Failed to archive — try again' }));
    }
  }, []);

  return (
    <div className="space-y-10">

      {/* Section 1: Flagged for review */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Flagged for review
        </h2>
        {flagged.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-600">
            Nothing flagged — system is running cleanly.
          </p>
        ) : (
          <div className="space-y-2">
            {flagged.map(node => (
              <div key={node.id}>
                <FlaggedItem node={node} onAccept={handleAccept} onArchive={handleArchive} />
                {itemErrors[node.id] && (
                  <p className="text-[10px] text-red-400 mt-1 ml-1">{itemErrors[node.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Tension alerts (omit if empty) */}
      {tensions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Tension alerts
          </h2>
          <div className="space-y-2">
            {tensions.map(alert => (
              <div
                key={alert.id}
                className={`bg-gray-50 dark:bg-gray-900 border rounded-lg p-3 ${SEVERITY_COLORS[alert.severity] ?? 'border-gray-200 dark:border-gray-800'}`}
              >
                <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${(SEVERITY_COLORS[alert.severity] ?? '').split(' ')[0] ?? 'text-gray-500'}`}>
                  {alert.severity} · {alert.type.replace(/_/g, ' ')}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
                  {alert.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: System reflection */}
      <ReflectionSection sites={sites} options={options} goalSpaces={goalSpaces} />

      {/* Section 4: Unprocessed learnings (omit if empty) */}
      {learnings.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Unprocessed learnings
          </h2>
          <div className="space-y-1.5">
            {learnings.map(node => (
              <div key={node.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{node.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {new Date(node.created_at).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={`/capture/${node.id}/review`}
                  className="text-[10px] text-teal-400 hover:text-teal-300 shrink-0 ml-2"
                >
                  Process this
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace page.tsx**

```tsx
// src/app/review/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SystemHealthClient } from './SystemHealthClient';
import type { Node } from '@/lib/types/nodes';
import type { TensionAlert } from '@/lib/types/tension';

export default async function SystemHealthPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [
    flaggedRes,
    tensionsRes,
    learningsRes,
    sitesRes,
    optionsRes,
    goalSpacesRes,
  ] = await Promise.all([
    supabase
      .from('nodes')
      .select('*')
      .eq('status', 'flagged_for_review')
      .order('created_at', { ascending: true }),
    supabase
      .from('tension_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('nodes')
      .select('id, title, node_type, created_at')
      .in('node_type', ['learning', 'signal'])
      .eq('status', 'promoted')
      .order('created_at', { ascending: false }),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'site')
      .neq('status', 'archived'),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'option')
      .in('status', ['promoted', 'human_reviewed']),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'goal_space')
      .neq('status', 'archived'),
  ]);

  const sites = (sitesRes.data ?? []).map(n => ({ id: n.id, label: n.title, type: 'site' as const }));
  const options = (optionsRes.data ?? []).map(n => ({ id: n.id, label: n.title, type: 'option' as const }));
  const goalSpaces = (goalSpacesRes.data ?? []).map(n => ({ id: n.id, label: n.title, type: 'goal_space' as const }));

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-8">System Health</h1>
        <SystemHealthClient
          flagged={(flaggedRes.data ?? []) as unknown as Node[]}
          tensions={(tensionsRes.data ?? []) as unknown as TensionAlert[]}
          learnings={(learningsRes.data ?? []) as unknown as Node[]}
          sites={sites}
          options={options}
          goalSpaces={goalSpaces}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Delete ReflectionPanel.tsx**

```bash
rm src/app/review/ReflectionPanel.tsx
```

Check for any imports of `ReflectionPanel` that need removing:

```bash
grep -r "ReflectionPanel" src/ --include="*.tsx" --include="*.ts"
```

If any import is found outside `src/app/review/`, update that file to remove the import. The only expected reference was inside `page.tsx` which we just replaced.

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/app/review/__tests__/ReviewPage.test.tsx --reporter=verbose
```
Expected: PASS (3 tests)

- [ ] **Step 7: Run full test suite to check for regressions**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -30
```
Expected: No new failures beyond the pre-existing 107 failures. Note: old `ReviewPage` tests that relied on the former page structure are now replaced — that reduction in failures is expected.

- [ ] **Step 8: Commit**

```bash
git add src/app/review/SystemHealthClient.tsx src/app/review/page.tsx src/app/review/__tests__/ReviewPage.test.tsx
git rm src/app/review/ReflectionPanel.tsx
git commit -m "feat(v06): replace review page with System Health — flagged items, tension alerts, filterable reflection, unprocessed learnings"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run --reporter=verbose 2>&1 | grep -E "PASS|FAIL|Error" | tail -30
```
Expected: All new tests pass. Pre-existing failures (from review page tests and other unrelated tests) should be same count or lower.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: No new type errors.

- [ ] **Step 3: Final commit if clean**

```bash
git log --oneline -5
```
Confirm all 4 feature commits are present in order.
