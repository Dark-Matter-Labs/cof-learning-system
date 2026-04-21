# Commitment Add & Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline "New commitment" form at the top of `/commitments` and pencil-icon inline editing on each `CommitmentCard`.

**Architecture:** `CommitmentCardEditor` is a new isolated edit-form component. `CommitmentCard` gains an optional `onEdit` prop that surfaces a pencil icon. `GoalSpaceSection` forwards `onEdit` down to its cards. `CommitmentsClient` gains local `commitments` state (from `initialCommitments` prop), an inline add form, `editingId` state, and a `handleSave` callback — swapping in `CommitmentCardEditor` wherever `editingId` matches. All API calls wait for a response before updating state (no optimistic updates needed given low latency).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest + React Testing Library, Tailwind CSS

**Working directory:** `/Users/gurden/Documents/code/cof-learning-system/.worktrees/cof-v06-pipeline`

---

## File map

| File | Action |
|---|---|
| `src/components/commitment/CommitmentCardEditor.tsx` | **Create** — inline edit form |
| `src/components/commitment/__tests__/CommitmentCardEditor.test.tsx` | **Create** |
| `src/components/commitment/CommitmentCard.tsx` | **Modify** — add `onEdit?` prop + pencil icon |
| `src/components/commitment/GoalSpaceSection.tsx` | **Modify** — forward `onEdit?` to each CommitmentCard |
| `src/app/commitments/CommitmentsClient.tsx` | **Modify** — local state, add form, edit wiring, rename prop |
| `src/app/commitments/__tests__/CommitmentsClient.test.tsx` | **Modify** — update mocks + new tests |
| `src/app/commitments/page.tsx` | **Modify** — rename prop `commitments` → `initialCommitments` |

---

## Task 1: CommitmentCardEditor component

**Files:**
- Create: `src/components/commitment/__tests__/CommitmentCardEditor.test.tsx`
- Create: `src/components/commitment/CommitmentCardEditor.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/commitment/__tests__/CommitmentCardEditor.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CommitmentCardEditor } from '../CommitmentCardEditor';
import type { Node } from '@/lib/types/nodes';

const baseCommitment: Node = {
  id: 'c1',
  title: 'Fund Madrid',
  description: 'Description here',
  node_type: 'commitment',
  status: 'promoted',
  content: { status: 'active', resource_allocation: 30 },
  llm_extraction: null,
  hunch_type: null,
  confidence_level: null,
  confidence_basis: null,
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

describe('CommitmentCardEditor', () => {
  it('renders with existing values pre-filled', () => {
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect((screen.getByPlaceholderText('Title') as HTMLInputElement).value).toBe('Fund Madrid');
    expect((screen.getByPlaceholderText('Description (optional)') as HTMLTextAreaElement).value).toBe('Description here');
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('active');
    expect((screen.getByPlaceholderText('0') as HTMLInputElement).value).toBe('30');
  });

  it('calls onSave with correct shape', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('c1', {
        title: 'Fund Madrid',
        description: 'Description here',
        content: { status: 'active', resource_allocation: 30 },
      });
    });
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables Save and shows Saving… while in flight', async () => {
    const onSave = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      const btn = screen.getByText('Saving…');
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('shows error message when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network'));
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/gurden/Documents/code/cof-learning-system/.worktrees/cof-v06-pipeline
npx vitest run src/components/commitment/__tests__/CommitmentCardEditor.test.tsx --reporter=verbose
```

Expected: FAIL — `Cannot find module '../CommitmentCardEditor'`

- [ ] **Step 3: Create CommitmentCardEditor.tsx**

```tsx
// src/components/commitment/CommitmentCardEditor.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import type { Node } from '@/lib/types/nodes';

export interface CommitmentUpdates {
  readonly title: string;
  readonly description: string | null;
  readonly content: {
    readonly status: string;
    readonly resource_allocation: number | null;
  };
}

interface CommitmentCardEditorProps {
  readonly commitment: Node;
  readonly onSave: (id: string, updates: CommitmentUpdates) => Promise<void>;
  readonly onCancel: () => void;
}

const STATUS_OPTIONS = ['active', 'proposed', 'achieved', 'abandoned'] as const;

function getInitialContent(node: Node): { status: string; resource_allocation: number | null } {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    return {
      status: typeof c.status === 'string' ? c.status : 'active',
      resource_allocation: typeof c.resource_allocation === 'number' ? c.resource_allocation : null,
    };
  }
  return { status: 'active', resource_allocation: null };
}

export function CommitmentCardEditor({ commitment, onSave, onCancel }: CommitmentCardEditorProps) {
  const initial = getInitialContent(commitment);
  const [title, setTitle] = useState(commitment.title);
  const [description, setDescription] = useState(commitment.description ?? '');
  const [status, setStatus] = useState(initial.status);
  const [allocation, setAllocation] = useState(initial.resource_allocation?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(commitment.id, {
        title: title.trim(),
        description: description.trim() || null,
        content: {
          status,
          resource_allocation: allocation !== '' ? Number(allocation) : null,
        },
      });
    } catch {
      setError('Failed to save');
      setSaving(false);
    }
  }

  return (
    <div className="w-full border-l-[3px] border-[#185FA5] bg-gray-50 dark:bg-gray-900 rounded-r-md mb-2 p-2.5 space-y-2">
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full text-xs font-semibold bg-transparent border-b border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#185FA5] pb-0.5"
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={3}
        className="w-full text-[10px] bg-transparent border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 focus:outline-none focus:border-[#185FA5] p-1 resize-none"
      />
      <div className="flex items-center gap-2">
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="text-[10px] bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-[#185FA5]"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            value={allocation}
            onChange={e => setAllocation(e.target.value)}
            placeholder="0"
            className="w-14 text-[10px] bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-[#185FA5]"
          />
          <span className="text-[10px] text-gray-500">%</span>
        </div>
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="text-[10px] bg-[#185FA5] text-white px-2.5 py-1 rounded disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1"
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
npx vitest run src/components/commitment/__tests__/CommitmentCardEditor.test.tsx --reporter=verbose
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/commitment/CommitmentCardEditor.tsx src/components/commitment/__tests__/CommitmentCardEditor.test.tsx
git commit -m "feat(v06): CommitmentCardEditor — inline edit form for commitments"
```

---

## Task 2: CommitmentCard — add onEdit prop and pencil icon

**Files:**
- Modify: `src/components/commitment/CommitmentCard.tsx`

- [ ] **Step 1: Add `onEdit?` to CommitmentCard**

Open `src/components/commitment/CommitmentCard.tsx`.

**1a.** Add `onEdit?: () => void` to `CommitmentCardProps`:

```ts
interface CommitmentCardProps {
  readonly commitment: Node;
  readonly allNodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly tensions: readonly TensionAlert[];
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
  readonly onAssumptionClick: (assumptionId: string) => void;
  readonly onEdit?: () => void;
}
```

**1b.** Destructure it in the function signature:

```ts
export function CommitmentCard({
  commitment,
  allNodes,
  edges,
  tensions,
  isSelected,
  onSelect,
  onAssumptionClick,
  onEdit,
}: CommitmentCardProps) {
```

**1c.** Add `group` to the outer `<button>` className:

Change:
```ts
'w-full text-left border-l-[3px] border-[#185FA5] bg-gray-50 dark:bg-gray-900 rounded-r-md mb-2 overflow-hidden',
```
To:
```ts
'w-full text-left border-l-[3px] border-[#185FA5] bg-gray-50 dark:bg-gray-900 rounded-r-md mb-2 overflow-hidden group',
```

**1d.** In the header div (the `flex items-start justify-between` row), add the pencil button between the title span and the author avatar span:

```tsx
{onEdit && (
  <button
    type="button"
    onClick={e => { e.stopPropagation(); onEdit(); }}
    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
    aria-label="Edit commitment"
  >
    ✏
  </button>
)}
```

The full header div after the change:

```tsx
<div className="flex items-start justify-between gap-1 mb-1">
  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug flex-1 min-w-0">
    {commitment.title}
  </span>
  {onEdit && (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onEdit(); }}
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      aria-label="Edit commitment"
    >
      ✏
    </button>
  )}
  {commitment.author_id && (
    <span className="shrink-0 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] text-gray-600 dark:text-gray-400 font-bold">
      {commitment.author_id.slice(0, 2).toUpperCase()}
    </span>
  )}
</div>
```

- [ ] **Step 2: Run full test suite to verify nothing broke**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: PASS (252+) FAIL (0)

- [ ] **Step 3: Commit**

```bash
git add src/components/commitment/CommitmentCard.tsx
git commit -m "feat(v06): CommitmentCard — add onEdit prop and hover pencil icon"
```

---

## Task 3: GoalSpaceSection — forward onEdit to CommitmentCards

**Files:**
- Modify: `src/components/commitment/GoalSpaceSection.tsx`

- [ ] **Step 1: Add `onEdit?` to GoalSpaceSectionProps**

Open `src/components/commitment/GoalSpaceSection.tsx`.

Add to the interface:
```ts
interface GoalSpaceSectionProps {
  readonly goalSpace: Node;
  readonly triggerOutcomes: readonly Node[];
  readonly commitmentsByOutcome: Readonly<Record<string, readonly Node[]>>;
  readonly unlinkedCommitments: readonly Node[];
  readonly allNodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly tensions: readonly TensionAlert[];
  readonly selectedCommitmentId: string | null;
  readonly onSelectCommitment: (id: string) => void;
  readonly onAssumptionClick: (assumptionId: string) => void;
  readonly onEdit?: (id: string) => void;  // add this
}
```

Destructure it in the function signature:
```ts
export function GoalSpaceSection({
  goalSpace,
  triggerOutcomes,
  commitmentsByOutcome,
  unlinkedCommitments,
  allNodes,
  edges,
  tensions,
  selectedCommitmentId,
  onSelectCommitment,
  onAssumptionClick,
  onEdit,
}: GoalSpaceSectionProps) {
```

- [ ] **Step 2: Forward onEdit to CommitmentCards under trigger outcomes**

In the `outcomeCommitments.map(c => ...)` block, add `onEdit` to each CommitmentCard:

Change:
```tsx
<CommitmentCard
  commitment={c}
  allNodes={allNodes}
  edges={edges}
  tensions={tensions}
  isSelected={selectedCommitmentId === c.id}
  onSelect={onSelectCommitment}
  onAssumptionClick={onAssumptionClick}
/>
```

To:
```tsx
<CommitmentCard
  commitment={c}
  allNodes={allNodes}
  edges={edges}
  tensions={tensions}
  isSelected={selectedCommitmentId === c.id}
  onSelect={onSelectCommitment}
  onAssumptionClick={onAssumptionClick}
  onEdit={onEdit ? () => onEdit(c.id) : undefined}
/>
```

- [ ] **Step 3: Forward onEdit to unlinked CommitmentCards**

In the `unlinkedCommitments.map(c => ...)` block, same change:

Change:
```tsx
<CommitmentCard
  commitment={c}
  allNodes={allNodes}
  edges={edges}
  tensions={tensions}
  isSelected={selectedCommitmentId === c.id}
  onSelect={onSelectCommitment}
  onAssumptionClick={onAssumptionClick}
/>
```

To:
```tsx
<CommitmentCard
  commitment={c}
  allNodes={allNodes}
  edges={edges}
  tensions={tensions}
  isSelected={selectedCommitmentId === c.id}
  onSelect={onSelectCommitment}
  onAssumptionClick={onAssumptionClick}
  onEdit={onEdit ? () => onEdit(c.id) : undefined}
/>
```

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: PASS (252+) FAIL (0)

- [ ] **Step 5: Commit**

```bash
git add src/components/commitment/GoalSpaceSection.tsx
git commit -m "feat(v06): GoalSpaceSection — forward onEdit to CommitmentCards"
```

---

## Task 4: CommitmentsClient — add form, edit wiring, rename prop + update page.tsx

**Files:**
- Modify: `src/app/commitments/CommitmentsClient.tsx`
- Modify: `src/app/commitments/__tests__/CommitmentsClient.test.tsx`
- Modify: `src/app/commitments/page.tsx`

- [ ] **Step 1: Update the test file — mocks + new tests**

Replace the contents of `src/app/commitments/__tests__/CommitmentsClient.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/commitment/GoalSpaceSection', () => ({
  GoalSpaceSection: ({ goalSpace }: { goalSpace: { title: string } }) =>
    React.createElement('div', { 'data-testid': 'goal-space-section' }, goalSpace.title),
}));

vi.mock('@/components/commitment/CommitmentCard', () => ({
  CommitmentCard: ({
    commitment,
    onEdit,
  }: {
    commitment: { title: string; id: string };
    onEdit?: () => void;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'commitment-card' },
      commitment.title,
      onEdit
        ? React.createElement('button', { onClick: onEdit, 'data-testid': 'edit-btn' }, 'Edit')
        : null,
    ),
}));

vi.mock('@/components/commitment/CommitmentCardEditor', () => ({
  CommitmentCardEditor: ({ commitment }: { commitment: { title: string } }) =>
    React.createElement('div', { 'data-testid': 'commitment-editor' }, commitment.title),
}));

vi.mock('@/components/commitment/TensionAlertItem', () => ({
  TensionAlertItem: ({ alert }: { alert: { description: string } }) =>
    React.createElement('div', { 'data-testid': 'tension-item' }, alert.description),
}));

import { CommitmentsClient } from '../CommitmentsClient';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';

const emptyProps = {
  goalSpaces: [] as Node[],
  triggerOutcomes: [] as Node[],
  initialCommitments: [] as Node[],
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
  beforeEach(() => { vi.restoreAllMocks(); });

  it('shows empty state when no commitments or goal spaces', () => {
    render(<CommitmentsClient {...emptyProps} />);
    expect(screen.getByText('No commitments yet.')).toBeInTheDocument();
  });

  it('renders a GoalSpaceSection for each goal space', () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        goalSpaces={[baseNode('gs1', 'Climate resilience', 'goal_space')]}
      />,
    );
    expect(screen.getByTestId('goal-space-section')).toBeInTheDocument();
  });

  it('renders unlinked commitments as CommitmentCards', () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        initialCommitments={[baseNode('c1', 'Fund Madrid pilot', 'commitment')]}
      />,
    );
    expect(screen.getByTestId('commitment-card')).toBeInTheDocument();
    expect(screen.getByText('Fund Madrid pilot')).toBeInTheDocument();
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
      resolved_by: null,
      resolved_action: null,
      resolved_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    render(<CommitmentsClient {...emptyProps} tensions={[tension]} />);
    expect(screen.getByTestId('tension-item')).toBeInTheDocument();
  });

  it('does not render tensions section when empty', () => {
    render(<CommitmentsClient {...emptyProps} />);
    expect(screen.queryByTestId('tension-item')).toBeNull();
  });

  it('renders the add commitment input', () => {
    render(<CommitmentsClient {...emptyProps} />);
    expect(screen.getByPlaceholderText('New commitment…')).toBeInTheDocument();
  });

  it('submitting the add form calls /api/capture and adds the commitment', async () => {
    const newNode = baseNode('c-new', 'My new commitment', 'commitment');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ node: newNode }),
    }));
    render(<CommitmentsClient {...emptyProps} />);
    fireEvent.change(screen.getByPlaceholderText('New commitment…'), {
      target: { value: 'My new commitment' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(screen.getByText('My new commitment')).toBeInTheDocument();
    });
  });

  it('shows error when add API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<CommitmentsClient {...emptyProps} />);
    fireEvent.change(screen.getByPlaceholderText('New commitment…'), {
      target: { value: 'Something' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(screen.getByText('Failed to add commitment')).toBeInTheDocument();
    });
  });

  it('clicking edit shows CommitmentCardEditor instead of CommitmentCard', async () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        initialCommitments={[baseNode('c1', 'Fund Madrid pilot', 'commitment')]}
      />,
    );
    fireEvent.click(screen.getByTestId('edit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('commitment-editor')).toBeInTheDocument();
      expect(screen.queryByTestId('commitment-card')).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
npx vitest run src/app/commitments/__tests__/CommitmentsClient.test.tsx --reporter=verbose
```

Expected: Some new tests fail (add form, edit flow), existing 5 may fail due to `initialCommitments` rename.

- [ ] **Step 3: Replace CommitmentsClient.tsx**

```tsx
// src/app/commitments/CommitmentsClient.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';
import { CommitmentCard } from '@/components/commitment/CommitmentCard';
import { CommitmentCardEditor, type CommitmentUpdates } from '@/components/commitment/CommitmentCardEditor';
import { TensionAlertItem } from '@/components/commitment/TensionAlertItem';
import { GoalSpaceSection } from '@/components/commitment/GoalSpaceSection';

interface CommitmentsClientProps {
  readonly goalSpaces: readonly Node[];
  readonly triggerOutcomes: readonly Node[];
  readonly initialCommitments: readonly Node[];
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
  initialCommitments,
  allNodes,
  edges,
  tensions,
  highlightId,
}: CommitmentsClientProps) {
  const [commitments, setCommitments] = useState<Node[]>(() => [...initialCommitments]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Build hierarchy
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
    Object.values(commitmentsByGoalSpace).flat().map(c => c.id),
  );
  const unlinkedCommitments = sortCommitments(
    commitments.filter(c => !linkedCommitmentIds.has(c.id) && !allGoalSpaceCommitmentIds.has(c.id)),
  );

  const activeTensions = tensions.filter(t => t.status === 'active');

  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(highlightId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId]);

  const handleAdd = useCallback(async () => {
    const trimmed = addTitle.trim();
    if (!trimmed) return;
    setAddError(null);
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed, node_type: 'commitment' }),
      });
      if (!res.ok) throw new Error('Failed to add');
      const { node } = await res.json() as { node: Node };
      setCommitments(prev => [node, ...prev]);
      setAddTitle('');
    } catch {
      setAddError('Failed to add commitment');
    }
  }, [addTitle]);

  const handleSave = useCallback(async (id: string, updates: CommitmentUpdates) => {
    const res = await fetch(`/api/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: updates.title,
        description: updates.description,
        content: updates.content,
      }),
    });
    if (!res.ok) throw new Error('Failed to save');
    const updated = await res.json() as Node;
    setCommitments(prev => prev.map(c => c.id === id ? updated : c));
    setEditingId(null);
  }, []);

  const isEmpty = goalSpaces.length === 0 && commitments.length === 0;

  return (
    <div>
      {/* Add commitment form */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={addTitle}
            onChange={e => setAddTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="New commitment…"
            className="flex-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#185FA5]"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!addTitle.trim()}
            className="text-sm px-3 py-1.5 bg-[#185FA5] text-white rounded-md disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {addError && <p className="text-[10px] text-red-400 mt-1">{addError}</p>}
      </div>

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
                onEdit={setEditingId}
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
                    {editingId === c.id ? (
                      <CommitmentCardEditor
                        commitment={c}
                        onSave={handleSave}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <CommitmentCard
                        commitment={c}
                        allNodes={allNodes}
                        edges={edges}
                        tensions={tensions}
                        isSelected={highlightId === c.id}
                        onSelect={() => {}}
                        onAssumptionClick={() => {}}
                        onEdit={() => setEditingId(c.id)}
                      />
                    )}
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

- [ ] **Step 4: Update page.tsx — rename commitments prop**

Open `src/app/commitments/page.tsx`. Change the prop name passed to `CommitmentsClient`:

Change:
```tsx
<CommitmentsClient
  commitments={commitmentsData as unknown as Node[]}
  goalSpaces={goalSpacesData as unknown as Node[]}
  triggerOutcomes={triggerOutcomesData as unknown as Node[]}
  allNodes={allNodesData as unknown as Node[]}
  edges={edgesData as unknown as Edge[]}
  tensions={tensionsData as unknown as TensionAlert[]}
  highlightId={highlightId}
/>
```

To:
```tsx
<CommitmentsClient
  initialCommitments={commitmentsData as unknown as Node[]}
  goalSpaces={goalSpacesData as unknown as Node[]}
  triggerOutcomes={triggerOutcomesData as unknown as Node[]}
  allNodes={allNodesData as unknown as Node[]}
  edges={edgesData as unknown as Edge[]}
  tensions={tensionsData as unknown as TensionAlert[]}
  highlightId={highlightId}
/>
```

- [ ] **Step 5: Run all tests**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: PASS (260+) FAIL (0)

- [ ] **Step 6: Commit**

```bash
git add src/app/commitments/CommitmentsClient.tsx src/app/commitments/__tests__/CommitmentsClient.test.tsx src/app/commitments/page.tsx
git commit -m "feat(v06): CommitmentsClient — add form, inline edit wiring, local state"
```

---

## Final check

```bash
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
git log --oneline -5
```

Confirm: all tests pass, no new TypeScript errors (pre-existing test-file TS errors are acceptable), 4 feature commits in log.
