# Commitment Page & Graph Square Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `CommitmentPanel` sidebar from the graph canvas, render commitment nodes as 80×80 blue squares, and create a dedicated `/commitments` page showing the full goal-space hierarchy.

**Architecture:** `GraphCanvas` gets an `onSelectCommitment` prop and branches D3 rendering by node type. `GraphOSSurface` drops all commitment/tension state and passes `router.push('/commitments?id=X')` as the commitment click handler. A new server-rendered `/commitments` page reuses the existing `GoalSpaceSection`, `CommitmentCard`, and `TensionAlertItem` components.

**Tech Stack:** Next.js 16 App Router, React, D3 v7, Supabase, Vitest + React Testing Library

**Working directory:** `/Users/gurden/Documents/code/cof-learning-system/.worktrees/cof-v06-pipeline`

---

### Task 1: Add COMMIT_SIZE constant to layout.ts

**Files:**
- Modify: `src/lib/graph/layout.ts`
- Create: `src/lib/graph/__tests__/layout.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/graph/__tests__/layout.test.ts
import { describe, it, expect } from 'vitest';
import { CARD_WIDTH, CARD_HEIGHT, COMMIT_SIZE } from '../layout';

describe('layout constants', () => {
  it('CARD_WIDTH is 200', () => {
    expect(CARD_WIDTH).toBe(200);
  });

  it('CARD_HEIGHT is 80', () => {
    expect(CARD_HEIGHT).toBe(80);
  });

  it('COMMIT_SIZE is 80', () => {
    expect(COMMIT_SIZE).toBe(80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/gurden/Documents/code/cof-learning-system/.worktrees/cof-v06-pipeline
npx vitest run src/lib/graph/__tests__/layout.test.ts --reporter=verbose
```

Expected: FAIL — `COMMIT_SIZE` not exported

- [ ] **Step 3: Add COMMIT_SIZE to layout.ts**

Open `src/lib/graph/layout.ts` and add after line 7 (`export const CARD_COLLIDE_RADIUS = 120;`):

```ts
export const COMMIT_SIZE = 80;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/graph/__tests__/layout.test.ts --reporter=verbose
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/layout.ts src/lib/graph/__tests__/layout.test.ts
git commit -m "feat(v06): add COMMIT_SIZE constant to graph layout"
```

---

### Task 2: CommitmentsClient component

**Files:**
- Create: `src/app/commitments/CommitmentsClient.tsx`
- Create: `src/app/commitments/__tests__/CommitmentsClient.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/app/commitments/__tests__/CommitmentsClient.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/commitment/GoalSpaceSection', () => ({
  GoalSpaceSection: ({ goalSpace }: { goalSpace: { title: string } }) =>
    React.createElement('div', { 'data-testid': 'goal-space-section' }, goalSpace.title),
}));

vi.mock('@/components/commitment/CommitmentCard', () => ({
  CommitmentCard: ({ commitment }: { commitment: { title: string; id: string } }) =>
    React.createElement('div', { 'data-testid': 'commitment-card' }, commitment.title),
}));

vi.mock('@/components/commitment/TensionAlertItem', () => ({
  TensionAlertItem: ({ alert }: { alert: { id: string; description: string } }) =>
    React.createElement('div', { 'data-testid': 'tension-item' }, alert.description),
}));

import { CommitmentsClient } from '../CommitmentsClient';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';

const emptyProps = {
  goalSpaces: [] as Node[],
  triggerOutcomes: [] as Node[],
  commitments: [] as Node[],
  allNodes: [] as Node[],
  edges: [] as Edge[],
  tensions: [] as TensionAlert[],
};

const baseNode = (id: string, title: string, node_type: string): Node => ({
  id,
  title,
  node_type,
  description: null,
  status: 'promoted',
  llm_extraction: null,
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
});

describe('CommitmentsClient', () => {
  it('shows empty state when no commitments or goal spaces', () => {
    render(<CommitmentsClient {...emptyProps} />);
    expect(screen.getByText('No commitments yet.')).toBeTruthy();
  });

  it('renders a GoalSpaceSection for each goal space', () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        goalSpaces={[baseNode('gs1', 'Climate resilience', 'goal_space')]}
      />
    );
    expect(screen.getByTestId('goal-space-section')).toBeTruthy();
    expect(screen.getByText('Climate resilience')).toBeTruthy();
  });

  it('renders unlinked commitments (no edge to any goal space)', () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        commitments={[baseNode('c1', 'Fund Madrid pilot', 'commitment')]}
      />
    );
    expect(screen.getByTestId('commitment-card')).toBeTruthy();
    expect(screen.getByText('Fund Madrid pilot')).toBeTruthy();
  });

  it('renders tension alerts section when active tensions exist', () => {
    const tension: TensionAlert = {
      id: 't1',
      type: 'assumption_challenged',
      severity: 'high',
      description: 'Madrid assumption challenged',
      status: 'active',
      source_node_id: null,
      affected_assumption_id: null,
      affected_commitment_ids: [],
      resolved_action: null,
      resolved_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    render(<CommitmentsClient {...emptyProps} tensions={[tension]} />);
    expect(screen.getByTestId('tension-item')).toBeTruthy();
  });

  it('does not render tensions section when empty', () => {
    render(<CommitmentsClient {...emptyProps} />);
    expect(screen.queryByTestId('tension-item')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/commitments/__tests__/CommitmentsClient.test.tsx --reporter=verbose
```

Expected: FAIL — `Cannot find module '../CommitmentsClient'`

- [ ] **Step 3: Create CommitmentsClient**

Check the `TensionAlert` type to verify fields match. Run:

```bash
grep -n "interface TensionAlert" src/lib/types/tension.ts
```

Then create `src/app/commitments/CommitmentsClient.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';
import { CommitmentCard } from '@/components/commitment/CommitmentCard';
import { TensionAlertItem } from '@/components/commitment/TensionAlertItem';
import { GoalSpaceSection } from '@/components/commitment/GoalSpaceSection';

interface CommitmentsClientProps {
  readonly goalSpaces: readonly Node[];
  readonly triggerOutcomes: readonly Node[];
  readonly commitments: readonly Node[];
  readonly allNodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly tensions: readonly TensionAlert[];
  readonly highlightId?: string;
}

function getStatus(node: Node): string {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    if (typeof c.status === 'string') return c.status;
  }
  return 'active';
}

function sortCommitments(nodes: readonly Node[]): readonly Node[] {
  const order: Record<string, number> = { active: 0, proposed: 1 };
  return [...nodes].sort((a, b) => {
    const oa = order[getStatus(a)] ?? 2;
    const ob = order[getStatus(b)] ?? 2;
    if (oa !== ob) return oa - ob;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function CommitmentsClient({
  goalSpaces,
  triggerOutcomes,
  commitments,
  allNodes,
  edges,
  tensions,
  highlightId,
}: CommitmentsClientProps) {
  // Build same hierarchy as CommitmentPanel
  const outcomesByGoalSpace: Record<string, Node[]> = {};
  const commitmentsByOutcome: Record<string, Node[]> = {};
  const commitmentsByGoalSpace: Record<string, Node[]> = {};
  const linkedCommitmentIds = new Set<string>();

  for (const edge of edges) {
    if (edge.edge_type === 'advances_goal') {
      const outcome = triggerOutcomes.find(n => n.id === edge.source_id);
      if (outcome) {
        outcomesByGoalSpace[edge.target_id] = [...(outcomesByGoalSpace[edge.target_id] ?? []), outcome];
      }
    }
    if (edge.edge_type === 'assigned_to_outcome') {
      const commitment = commitments.find(n => n.id === edge.source_id);
      if (commitment) {
        commitmentsByOutcome[edge.target_id] = [...(commitmentsByOutcome[edge.target_id] ?? []), commitment];
        linkedCommitmentIds.add(commitment.id);
      }
    }
    if (edge.edge_type === 'belongs_to_goalspace') {
      const commitment = commitments.find(n => n.id === edge.source_id);
      if (commitment) {
        commitmentsByGoalSpace[edge.target_id] = [...(commitmentsByGoalSpace[edge.target_id] ?? []), commitment];
      }
    }
  }

  const goalSpaceOnlyCommitments: Record<string, readonly Node[]> = {};
  for (const gs of goalSpaces) {
    const gsCommitments = commitmentsByGoalSpace[gs.id] ?? [];
    goalSpaceOnlyCommitments[gs.id] = gsCommitments.filter(c => !linkedCommitmentIds.has(c.id));
  }

  const allGoalSpaceCommitmentIds = new Set(
    Object.values(commitmentsByGoalSpace).flat().map(c => c.id)
  );
  const unlinkedCommitments = sortCommitments(
    commitments.filter(c => !linkedCommitmentIds.has(c.id) && !allGoalSpaceCommitmentIds.has(c.id))
  );

  const activeTensions = tensions.filter(t => t.status === 'active');

  useEffect(() => {
    if (!highlightId) return;
    // Try direct scroll first (unlinked commitment cards have this id)
    const el = document.getElementById(highlightId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Fall back to scrolling to the containing goal space section
    const containingGsId = Object.entries(commitmentsByGoalSpace)
      .find(([, commits]) => commits.some(c => c.id === highlightId))?.[0];
    if (containingGsId) {
      document.getElementById(`gs-${containingGsId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [highlightId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty = goalSpaces.length === 0 && commitments.length === 0;

  return (
    <div>
      {isEmpty ? (
        <p className="text-sm text-gray-500 dark:text-gray-600">No commitments yet.</p>
      ) : (
        <>
          {goalSpaces.map(gs => (
            <div key={gs.id} id={`gs-${gs.id}`}>
              <GoalSpaceSection
                goalSpace={gs}
                triggerOutcomes={outcomesByGoalSpace[gs.id] ?? []}
                commitmentsByOutcome={commitmentsByOutcome}
                unlinkedCommitments={goalSpaceOnlyCommitments[gs.id] ?? []}
                allNodes={allNodes}
                edges={edges}
                tensions={tensions}
                selectedCommitmentId={highlightId ?? null}
                onSelectCommitment={() => {}}
                onAssumptionClick={() => {}}
              />
            </div>
          ))}

          {unlinkedCommitments.length > 0 && (
            <section className="mt-6">
              {goalSpaces.length > 0 && (
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Unlinked commitments
                </h2>
              )}
              <div className="space-y-2">
                {unlinkedCommitments.map(c => (
                  <div
                    key={c.id}
                    id={c.id}
                    className={highlightId === c.id ? 'ring-2 ring-[#185FA5] rounded-md' : ''}
                  >
                    <CommitmentCard
                      commitment={c}
                      allNodes={allNodes}
                      edges={edges}
                      tensions={tensions}
                      isSelected={highlightId === c.id}
                      onSelect={() => {}}
                      onAssumptionClick={() => {}}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {activeTensions.length > 0 && (
        <section className="mt-8 border-t border-gray-200 dark:border-gray-800 pt-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Tension alerts ({activeTensions.length})
          </h2>
          <div className="space-y-2">
            {activeTensions.map(alert => (
              <TensionAlertItem
                key={alert.id}
                alert={alert}
                onSelect={() => {}}
                onAcknowledge={() => {}}
                onResolve={() => {}}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/commitments/__tests__/CommitmentsClient.test.tsx --reporter=verbose
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/commitments/CommitmentsClient.tsx src/app/commitments/__tests__/CommitmentsClient.test.tsx
git commit -m "feat(v06): CommitmentsClient — goal-space hierarchy with scroll-to-highlight"
```

---

### Task 3: /commitments server page

**Files:**
- Create: `src/app/commitments/page.tsx`
- Create: `src/app/commitments/__tests__/page.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/app/commitments/__tests__/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/app/commitments/CommitmentsClient', () => ({
  CommitmentsClient: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'commitments-client' },
      `commitments:${(props.commitments as unknown[]).length}`
    ),
}));

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

function buildChain(data: unknown[]) {
  const resolveWith = { data, error: null };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.neq = self;
  chain.in = self;
  chain.order = vi.fn().mockResolvedValue(resolveWith);
  chain.then = (fn: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(fn);
  return chain;
}

function buildMockClient(datasets: unknown[][]) {
  let idx = 0;
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    from: vi.fn().mockImplementation(() => buildChain(datasets[idx++] ?? [])),
  };
}

async function renderPage(searchParams: Record<string, string> = {}) {
  const mod = await import('../page');
  const Page = mod.default;
  const element = await Page({ searchParams: Promise.resolve(searchParams) });
  const { container } = render(element as React.ReactElement);
  return container;
}

describe('CommitmentsPage', () => {
  beforeEach(() => { vi.resetModules(); });

  it('renders page heading "Commitments"', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildMockClient([[], [], [], [], [], []]) as never
    );
    const container = await renderPage();
    expect(container.textContent).toContain('Commitments');
  });

  it('passes commitment nodes to CommitmentsClient', async () => {
    const commitment = { id: 'c1', node_type: 'commitment', title: 'Fund Madrid' };
    vi.mocked(createClient).mockResolvedValue(
      buildMockClient([[commitment], [], [], [], [], []]) as never
    );
    const container = await renderPage();
    expect(container.textContent).toContain('commitments:1');
  });

  it('redirects to /login when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('no user') }) },
      from: vi.fn(),
    } as never);
    await import('../page').then(m => m.default({ searchParams: Promise.resolve({}) })).catch(() => {});
    expect(vi.mocked(redirect)).toHaveBeenCalledWith('/login');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/commitments/__tests__/page.test.tsx --reporter=verbose
```

Expected: FAIL — `Cannot find module '../page'`

- [ ] **Step 3: Create page.tsx**

```tsx
// src/app/commitments/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CommitmentsClient } from './CommitmentsClient';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';

export default async function CommitmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { id: highlightId } = await searchParams;

  const [
    commitmentsRes,
    goalSpacesRes,
    triggerOutcomesRes,
    allNodesRes,
    edgesRes,
    tensionsRes,
  ] = await Promise.all([
    supabase.from('nodes').select('*').eq('node_type', 'commitment'),
    supabase.from('nodes').select('*').eq('node_type', 'goal_space').neq('status', 'archived'),
    supabase.from('nodes').select('*').eq('node_type', 'trigger_outcome'),
    supabase.from('nodes').select('*'),
    supabase.from('edges').select('*'),
    supabase.from('tension_alerts').select('*').eq('status', 'active'),
  ]);

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-8">Commitments</h1>
        <CommitmentsClient
          commitments={(commitmentsRes.data ?? []) as unknown as Node[]}
          goalSpaces={(goalSpacesRes.data ?? []) as unknown as Node[]}
          triggerOutcomes={(triggerOutcomesRes.data ?? []) as unknown as Node[]}
          allNodes={(allNodesRes.data ?? []) as unknown as Node[]}
          edges={(edgesRes.data ?? []) as unknown as Edge[]}
          tensions={(tensionsRes.data ?? []) as unknown as TensionAlert[]}
          highlightId={highlightId}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/commitments/__tests__/page.test.tsx --reporter=verbose
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/commitments/page.tsx src/app/commitments/__tests__/page.test.tsx
git commit -m "feat(v06): /commitments page — server-rendered commitment hierarchy"
```

---

### Task 4: GraphCanvas commitment square rendering + click routing

**Files:**
- Modify: `src/components/graph/GraphCanvas.tsx`
- Create: `src/components/graph/__tests__/GraphCanvas.test.tsx`

**Background:** `GraphCanvas` uses D3 to render nodes as SVG `<rect>` cards. All nodes currently use 200×80 rounded-rect cards. Commitment nodes must instead render as 80×80 sharp-cornered (`rx:0`) filled squares in blue (`#185FA5`). The D3 click handler must route commitment clicks to `onSelectCommitment` and all other clicks to `onSelectNode`.

Key constants from `src/lib/graph/layout.ts`:
- `CARD_WIDTH = 200`, `CARD_HEIGHT = 80` — standard node card
- `COMMIT_SIZE = 80` (added in Task 1) — commitment square

Key sections to edit in `GraphCanvas.tsx`:
1. Interface — add `onSelectCommitment?: (id: string) => void`
2. Import — add `COMMIT_SIZE` from `@/lib/graph/layout`
3. D3 node rendering block (approx lines 360–375) — filter by node_type
4. Click handler (approx line 357) — branch on node_type
5. `applyStaticPositions` transform (approx line 404) — conditional offset
6. Force tick transform (approx line 426) — conditional offset

- [ ] **Step 1: Write failing test**

```tsx
// src/components/graph/__tests__/GraphCanvas.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// D3 does real DOM work in SVG that JSDOM handles poorly.
// We verify: the component accepts onSelectCommitment and renders without throwing.
vi.mock('d3', () => {
  const noop = () => mockChain;
  const mockChain: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'selectAll', 'append', 'attr', 'call', 'on', 'each', 'data', 'join',
    'filter', 'text', 'zoom', 'zoomIdentity', 'force', 'forceSimulation', 'forceLink',
    'forceManyBody', 'forceCenter', 'forceCollide', 'drag', 'hierarchy', 'tree',
    'scaleLinear', 'axisBottom', 'zoomTransform',
  ];
  chainMethods.forEach(m => { mockChain[m] = noop; });
  mockChain.invert = () => [0, 0];
  mockChain.alphaTarget = noop;
  mockChain.restart = noop;
  mockChain.strength = noop;
  mockChain.distance = noop;
  mockChain.radius = noop;
  mockChain.id = noop;
  mockChain.stop = noop;
  mockChain.remove = noop;
  mockChain.style = noop;
  mockChain.size = noop;
  return mockChain;
});

import { GraphCanvas } from '../GraphCanvas';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

const makeNode = (id: string, node_type: string): Node => ({
  id,
  node_type,
  title: `Node ${id}`,
  description: null,
  status: 'promoted',
  llm_extraction: null,
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
});

describe('GraphCanvas', () => {
  it('renders without throwing when commitment nodes are present', () => {
    const nodes: Node[] = [makeNode('c1', 'commitment'), makeNode('h1', 'hunch')];
    const onSelectNode = vi.fn();
    const onSelectCommitment = vi.fn();

    expect(() =>
      render(
        <GraphCanvas
          nodes={nodes}
          edges={[] as Edge[]}
          activeTypes={['commitment', 'hunch']}
          view="force"
          onSelectNode={onSelectNode}
          onSelectCommitment={onSelectCommitment}
        />
      )
    ).not.toThrow();
  });

  it('renders without onSelectCommitment prop (backward compatible)', () => {
    expect(() =>
      render(
        <GraphCanvas
          nodes={[makeNode('h1', 'hunch')]}
          edges={[] as Edge[]}
          activeTypes={['hunch']}
          view="force"
          onSelectNode={vi.fn()}
        />
      )
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/graph/__tests__/GraphCanvas.test.tsx --reporter=verbose
```

Expected: FAIL — component may throw or prop types mismatch

- [ ] **Step 3: Edit GraphCanvas.tsx — add import and prop**

Open `src/components/graph/GraphCanvas.tsx`.

**3a.** In the imports, add `COMMIT_SIZE` to the layout import:

Change:
```ts
import {
  toGraphNode, toGraphLink, FORCE_CONFIG,
  CARD_WIDTH, CARD_HEIGHT,
  type GraphNode, type GraphLink,
} from '@/lib/graph/layout';
```

To:
```ts
import {
  toGraphNode, toGraphLink, FORCE_CONFIG,
  CARD_WIDTH, CARD_HEIGHT, COMMIT_SIZE,
  type GraphNode, type GraphLink,
} from '@/lib/graph/layout';
```

**3b.** In `GraphCanvasProps`, add the new optional prop after `highlight`:

Change:
```tsx
interface GraphCanvasProps {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly activeTypes: readonly string[];
  readonly view: GraphView;
  readonly onSelectNode: (node: Node | null) => void;
  readonly onCanvasClick?: (screenX: number, screenY: number, canvasX: number, canvasY: number) => void;
  readonly highlight?: HighlightState;
}
```

To:
```tsx
interface GraphCanvasProps {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly activeTypes: readonly string[];
  readonly view: GraphView;
  readonly onSelectNode: (node: Node | null) => void;
  readonly onCanvasClick?: (screenX: number, screenY: number, canvasX: number, canvasY: number) => void;
  readonly highlight?: HighlightState;
  readonly onSelectCommitment?: (id: string) => void;
}
```

**3c.** Destructure the new prop in the function signature:

Change:
```tsx
export function GraphCanvas({ nodes, edges, activeTypes, view, onSelectNode, onCanvasClick, highlight }: GraphCanvasProps) {
```

To:
```tsx
export function GraphCanvas({ nodes, edges, activeTypes, view, onSelectNode, onCanvasClick, highlight, onSelectCommitment }: GraphCanvasProps) {
```

- [ ] **Step 4: Edit GraphCanvas.tsx — branch click handler**

Find the click handler inside the D3 useEffect (approx line 357):

Change:
```js
.on('click', (ev, d) => { ev.stopPropagation(); onSelectNode(d.data); })
```

To:
```js
.on('click', (ev, d) => {
  ev.stopPropagation();
  if (d.data.node_type === 'commitment' && onSelectCommitment) {
    onSelectCommitment(d.data.id);
  } else {
    onSelectNode(d.data);
  }
})
```

- [ ] **Step 5: Edit GraphCanvas.tsx — branch node rendering**

Find the node card rendering block (approx lines 360–399). Replace the entire block starting from `cardG.append('rect').attr('width', CARD_WIDTH)` through the end of `cardG.each(function(d) {...})` (the confidence dots `.each`) with the following filtered version:

```js
// Standard card background — non-commitment nodes only
cardG.filter(d => d.data.node_type !== 'commitment')
  .append('rect').attr('width', CARD_WIDTH).attr('height', CARD_HEIGHT)
  .attr('rx', 8).attr('fill', NODE_CARD_BG).attr('stroke', NODE_CARD_BORDER).attr('stroke-width', 1);

// Left colour strip — non-commitment nodes only
cardG.filter(d => d.data.node_type !== 'commitment')
  .append('rect').attr('width', 3).attr('height', CARD_HEIGHT).attr('rx', 2).attr('fill', d => d.color);

// Node type label — non-commitment nodes only
cardG.filter(d => d.data.node_type !== 'commitment')
  .append('text').text(d => d.node_type.replace(/_/g, ' '))
  .attr('x', 12).attr('y', 20).attr('font-size', 9).attr('fill', d => d.color)
  .attr('font-weight', '600').attr('letter-spacing', '0.05em');

// Title — non-commitment nodes only
cardG.filter(d => d.data.node_type !== 'commitment')
  .append('text').text(d => truncate(d.title, 28))
  .attr('x', 12).attr('y', 38).attr('font-size', 11).attr('fill', NODE_TITLE_FILL).attr('font-weight', '500');

// Confidence dots — non-commitment nodes only
cardG.filter(d => d.data.node_type !== 'commitment').each(function(d) {
  const level = d.data.confidence_level ?? 0;
  for (let i = 0; i < 5; i++) {
    d3.select(this).append('circle').attr('cx', 12 + i * 10).attr('cy', 60).attr('r', 3)
      .attr('fill', i < level ? d.color : NODE_DOTS_EMPTY);
  }
});

// Commitment square background
cardG.filter(d => d.data.node_type === 'commitment')
  .append('rect').attr('width', COMMIT_SIZE).attr('height', COMMIT_SIZE)
  .attr('rx', 0).attr('fill', d => d.color);

// Commitment title — white, centred
cardG.filter(d => d.data.node_type === 'commitment')
  .append('text').text(d => truncate(d.title, 14))
  .attr('x', COMMIT_SIZE / 2).attr('y', COMMIT_SIZE / 2 - 4)
  .attr('font-size', 10).attr('fill', 'white').attr('font-weight', '500')
  .attr('text-anchor', 'middle');
```

Keep the existing dual-model indicators block (commitment/intervention/signal/entity `.each`) that comes after. That block already has a `if (nt === 'commitment')` branch with text for assumption count — you may leave it or remove that branch since commitment nodes now have a different layout. Leave it as-is to avoid breaking the arrowhead text.

- [ ] **Step 6: Edit GraphCanvas.tsx — fix positioning transforms**

There are two places where the card centering transform is computed.

**6a.** In `applyStaticPositions` (approx line 404):

Change:
```js
return `translate(${p.x - CARD_WIDTH / 2}, ${p.y - CARD_HEIGHT / 2})`;
```

To:
```js
const isCommit = d.data.node_type === 'commitment';
return `translate(${p.x - (isCommit ? COMMIT_SIZE : CARD_WIDTH) / 2}, ${p.y - (isCommit ? COMMIT_SIZE : CARD_HEIGHT) / 2})`;
```

**6b.** In the force tick callback (approx line 426):

Change:
```js
cardG.attr('transform', d => `translate(${(d.x ?? 0) - CARD_WIDTH / 2}, ${(d.y ?? 0) - CARD_HEIGHT / 2})`);
```

To:
```js
cardG.attr('transform', d => {
  const isCommit = d.data.node_type === 'commitment';
  const w = isCommit ? COMMIT_SIZE : CARD_WIDTH;
  const h = isCommit ? COMMIT_SIZE : CARD_HEIGHT;
  return `translate(${(d.x ?? 0) - w / 2}, ${(d.y ?? 0) - h / 2})`;
});
```

- [ ] **Step 7: Run tests**

```bash
npx vitest run src/components/graph/__tests__/GraphCanvas.test.tsx --reporter=verbose
```

Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add src/components/graph/GraphCanvas.tsx src/components/graph/__tests__/GraphCanvas.test.tsx
git commit -m "feat(v06): commitment nodes render as 80x80 squares on graph canvas"
```

---

### Task 5: GraphOSSurface cleanup + NavBar + delete CommitmentPanel

**Files:**
- Modify: `src/components/graph/GraphOSSurface.tsx`
- Modify: `src/components/layout/NavBar.tsx`
- Delete: `src/components/commitment/CommitmentPanel.tsx`
- Modify: `src/components/layout/__tests__/NavBar.test.tsx` (create if not exists)

**Background on GraphOSSurface:** Currently imports and renders `CommitmentPanel` with 10+ props. Also maintains `tensions` state with a Supabase realtime channel. All of this must be removed. The `commitments` variable (used only by CommitmentPanel) is also removed. `goalSpaces` and `triggerOutcomes` are kept — they're still passed to `InlineCaptureCard`.

- [ ] **Step 1: Write failing NavBar test**

Check if `src/components/layout/__tests__/NavBar.test.tsx` already exists:

```bash
ls src/components/layout/__tests__/ 2>/dev/null || echo "no test dir"
```

If it does not exist, create:

```tsx
// src/components/layout/__tests__/NavBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' } }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

import { NavBar } from '../NavBar';

describe('NavBar', () => {
  it('renders Graph link', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.getByText('Graph')).toBeTruthy();
  });

  it('renders Commitments link', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.getByText('Commitments')).toBeTruthy();
  });

  it('renders Review link', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.getByText('Review')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify Commitments link fails**

```bash
npx vitest run src/components/layout/__tests__/NavBar.test.tsx --reporter=verbose
```

Expected: FAIL — "Commitments" text not found (link not yet added)

- [ ] **Step 3: Add Commitments to NavBar**

Open `src/components/layout/NavBar.tsx`. Find the `links` array:

Change:
```ts
const links = [
  { href: '/', label: 'Graph' },
  { href: '/capture', label: 'Capture' },
  { href: '/review', label: 'Review' },
  { href: '/reflect', label: 'Reflect' },
  { href: '/settings', label: 'Settings' },
];
```

To:
```ts
const links = [
  { href: '/', label: 'Graph' },
  { href: '/capture', label: 'Capture' },
  { href: '/commitments', label: 'Commitments' },
  { href: '/review', label: 'Review' },
  { href: '/reflect', label: 'Reflect' },
  { href: '/settings', label: 'Settings' },
];
```

- [ ] **Step 4: Run NavBar test to verify it passes**

```bash
npx vitest run src/components/layout/__tests__/NavBar.test.tsx --reporter=verbose
```

Expected: PASS (3 tests)

- [ ] **Step 5: Edit GraphOSSurface.tsx — remove imports**

Open `src/components/graph/GraphOSSurface.tsx`.

**5a.** Remove the `CommitmentPanel` import:
```ts
import { CommitmentPanel } from '@/components/commitment/CommitmentPanel';
```

**5b.** Remove from the type imports line:
```ts
import type { TensionAlert, TensionResolutionAction } from '@/lib/types/tension';
```

**5c.** Remove the `HighlightState` import:
```ts
import type { HighlightState } from '@/lib/types/highlight';
```

**5d.** Add `useRouter` to the existing `next/navigation` import. Add after the existing imports:
```ts
import { useRouter } from 'next/navigation';
```

- [ ] **Step 6: Edit GraphOSSurface.tsx — remove state and helpers**

Remove the following state declarations from the component body:

```ts
const [tensions, setTensions] = useState<TensionAlert[]>([]);
const [highlight, setHighlight] = useState<HighlightState>({ type: 'none' });
const [selectedCommitmentId, setSelectedCommitmentId] = useState<string | null>(null);
```

Remove the three helper functions entirely (they appear before `GraphOSSurface` component function):
- `getCommitmentConnectedNodes`
- `getTensionChain`
- `getAssumptionTree`

Add `const router = useRouter();` after the other `useState` calls.

- [ ] **Step 7: Edit GraphOSSurface.tsx — remove tensions from fetchData**

In the `useEffect` → `fetchData` function, change:

```ts
const [nodesResult, edgesResult, tensionsResult] = await Promise.all([
  supabase.from('nodes').select('*'),
  supabase.from('edges').select('*'),
  supabase.from('tension_alerts').select('*').eq('status', 'active').order('created_at', { ascending: false }),
]);

if (nodesResult.error) throw nodesResult.error;
if (edgesResult.error) throw edgesResult.error;
// tension_alerts table may not exist yet — ignore error gracefully
if (!tensionsResult.error) {
  setTensions((tensionsResult.data ?? []) as TensionAlert[]);
}
```

To:

```ts
const [nodesResult, edgesResult] = await Promise.all([
  supabase.from('nodes').select('*'),
  supabase.from('edges').select('*'),
]);

if (nodesResult.error) throw nodesResult.error;
if (edgesResult.error) throw edgesResult.error;
```

Remove `tensionsChannel` setup and cleanup. Change:

```ts
const tensionsChannel = supabase
  .channel('tensions-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tension_alerts' }, payload => {
    if (payload.eventType === 'INSERT') {
      const alert = payload.new as TensionAlert;
      if (alert.status === 'active') {
        setTensions(prev => [alert, ...prev]);
      }
    } else if (payload.eventType === 'UPDATE') {
      const alert = payload.new as TensionAlert;
      setTensions(prev =>
        alert.status === 'active'
          ? prev.map(t => (t.id === alert.id ? alert : t))
          : prev.filter(t => t.id !== alert.id)
      );
    } else if (payload.eventType === 'DELETE') {
      setTensions(prev => prev.filter(t => t.id !== (payload.old as { id: string }).id));
    }
  })
  .subscribe();

return () => {
  supabase.removeChannel(nodesChannel);
  supabase.removeChannel(tensionsChannel);
};
```

To:

```ts
return () => {
  supabase.removeChannel(nodesChannel);
};
```

- [ ] **Step 8: Edit GraphOSSurface.tsx — remove commitment handlers**

Remove these callback functions entirely:

```ts
const handleSelectCommitment = useCallback(...)
const handleSelectTension = useCallback(...)
const handleAssumptionClick = useCallback(...)
const handleAcknowledgeTension = useCallback(...)
const handleResolveTension = useCallback(...)
```

Remove the `commitments` variable:
```ts
const commitments = nodes.filter(n => n.node_type === 'commitment');
```

(`goalSpaces` and `triggerOutcomes` remain — used by InlineCaptureCard)

- [ ] **Step 9: Edit GraphOSSurface.tsx — update render**

**9a.** Remove the entire `<CommitmentPanel ... />` JSX block (approx 18 lines).

**9b.** Remove the `highlight={highlight}` prop from `<GraphCanvas ... />`.

**9c.** Add `onSelectCommitment` prop to `<GraphCanvas ... />`:

```tsx
onSelectCommitment={(id) => router.push(`/commitments?id=${id}`)}
```

**9d.** In `handleCanvasClick`, remove:
```ts
setHighlight({ type: 'none' });
setSelectedCommitmentId(null);
```

**9e.** In `handleSelectNode`, remove:
```ts
setCapturePos(null);
```
Wait — `handleSelectNode` currently does:
```ts
const handleSelectNode = useCallback((node: Node | null) => {
  setSelectedNode(node);
  setCapturePos(null);
}, []);
```
Keep this as-is.

- [ ] **Step 10: Delete CommitmentPanel.tsx**

```bash
git rm src/components/commitment/CommitmentPanel.tsx
```

Check for any remaining imports:

```bash
grep -r "CommitmentPanel" src/ --include="*.tsx" --include="*.ts"
```

If any files still import it, remove those imports.

- [ ] **Step 11: Run full test suite**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: All existing tests still pass. New tests (layout, CommitmentsClient, page, GraphCanvas, NavBar) all pass. Total should be ≥ 241 passing (236 existing + 5 new tasks).

- [ ] **Step 12: Commit**

```bash
git add src/components/graph/GraphOSSurface.tsx src/components/layout/NavBar.tsx src/components/layout/__tests__/NavBar.test.tsx
git commit -m "feat(v06): remove CommitmentPanel from graph, add /commitments nav link, route commitment clicks"
```

---

## Final check

After all tasks complete, run:

```bash
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "test" | head -10
git log --oneline -7
```

Confirm: all new tests pass, no new TypeScript errors beyond pre-existing, 7 feature commits visible.
