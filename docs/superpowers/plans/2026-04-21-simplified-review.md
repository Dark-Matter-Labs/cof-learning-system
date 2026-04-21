# Simplified Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the field-by-field `ReviewCard` with a lightweight `SimpleReviewClient` that shows an LLM summary, accepts an optional free-text note, and offers two buttons — Promote or Archive.

**Architecture:** `SimpleReviewClient` is a new client component owning note state and error display. `page.tsx` is rewritten to use it, auto-accepting all LLM connections on promote. `ReviewCard` and its five sub-components are deleted. `HumanReview` gains an optional `note` field (no DB migration needed — column is already JSONB).

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase client, Vitest + React Testing Library, Tailwind CSS

**Working directory:** `/Users/gurden/Documents/code/cof-learning-system/.worktrees/cof-v06-pipeline`

---

## File map

| File | Action |
|---|---|
| `src/lib/types/nodes.ts` | **Modify** — add `note?: string` to `HumanReview` |
| `src/components/review/SimpleReviewClient.tsx` | **Create** — lightweight review UI |
| `src/components/review/__tests__/SimpleReviewClient.test.tsx` | **Create** |
| `src/app/capture/[id]/review/page.tsx` | **Modify** — swap ReviewCard for SimpleReviewClient, simplify handlePromote, remove handleSaveDraft |
| `src/components/review/ReviewCard.tsx` | **Delete** |
| `src/components/review/ConfidenceSlider.tsx` | **Delete** |
| `src/components/review/ConnectionSuggestion.tsx` | **Delete** |
| `src/components/review/DomainTagEditor.tsx` | **Delete** |
| `src/components/review/ExtractionField.tsx` | **Delete** |
| `src/components/review/GoalRelevanceField.tsx` | **Delete** |
| `src/components/review/__tests__/ReviewCard.test.tsx` | **Delete** |
| `src/components/review/__tests__/GoalRelevanceField.test.tsx` | **Delete** |

---

## Task 1: Add `note` to `HumanReview` type

**Files:**
- Modify: `src/lib/types/nodes.ts`

- [ ] **Step 1: Add `note?: string` to the HumanReview interface**

Open `src/lib/types/nodes.ts`. Find the `HumanReview` interface (currently around line 70) and add `readonly note?: string` after `reviewer_id`:

```ts
export interface HumanReview {
  readonly reviewed_at: string;
  readonly reviewer_id: string;
  readonly note?: string;
  readonly fields: Readonly<Record<string, {
    readonly action: 'accepted' | 'rejected' | 'edited';
    readonly original: unknown;
    readonly final: unknown;
  }>>;
  readonly connections_accepted: ReadonlyArray<{
    readonly target_node_id: string;
    readonly target_title: string;
    readonly edge_type: string;
  }>;
  readonly connections_rejected: readonly string[];
  readonly connections_added: ReadonlyArray<{
    readonly target_node_id: string;
    readonly edge_type: string;
  }>;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/gurden/Documents/code/cof-learning-system/.worktrees/cof-v06-pipeline
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/nodes.ts
git commit -m "feat(review): add note field to HumanReview type"
```

---

## Task 2: Create SimpleReviewClient component

**Files:**
- Create: `src/components/review/__tests__/SimpleReviewClient.test.tsx`
- Create: `src/components/review/SimpleReviewClient.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/review/__tests__/SimpleReviewClient.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SimpleReviewClient } from '../SimpleReviewClient';
import type { Node } from '@/lib/types/nodes';

const baseNode: Node = {
  id: 'n1',
  title: 'Assume Madrid will fund',
  description: null,
  node_type: 'assumption_background',
  status: 'flagged_for_review',
  content: null,
  hunch_type: null,
  confidence_level: 3,
  confidence_basis: 'intuition',
  llm_extraction: {
    title: 'Assume Madrid will fund',
    summary: 'Madrid is likely to provide seed funding',
    structured_claim: {
      if: 'We pitch to Madrid',
      then: 'They will fund us',
      because: 'Prior conversations were positive',
    },
    assumption_type: 'background',
    entities: [],
    domain_tags: ['finance', 'madrid'],
    suggested_connections: [],
    confidence_assessment: { level: 3, basis: 'intuition' },
    open_questions: [],
    commitment_relevance: null,
    maturity: 'watch_closely',
  },
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

describe('SimpleReviewClient', () => {
  it('renders type label and maturity badge', () => {
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={vi.fn()} isSubmitting={false} />);
    expect(screen.getByText('Background Assumption')).toBeInTheDocument();
    expect(screen.getByText('Watch closely')).toBeInTheDocument();
  });

  it('renders summary and structured claim', () => {
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={vi.fn()} isSubmitting={false} />);
    expect(screen.getByText('Madrid is likely to provide seed funding')).toBeInTheDocument();
    expect(screen.getByText(/We pitch to Madrid/)).toBeInTheDocument();
    expect(screen.getByText(/They will fund us/)).toBeInTheDocument();
    expect(screen.getByText(/Prior conversations were positive/)).toBeInTheDocument();
  });

  it('renders confidence and domain tags', () => {
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={vi.fn()} isSubmitting={false} />);
    expect(screen.getByText(/3\/5/)).toBeInTheDocument();
    expect(screen.getByText('finance')).toBeInTheDocument();
    expect(screen.getByText('madrid')).toBeInTheDocument();
  });

  it('calls onPromote with note text', async () => {
    const onPromote = vi.fn().mockResolvedValue(undefined);
    render(<SimpleReviewClient node={baseNode} onPromote={onPromote} onArchive={vi.fn()} isSubmitting={false} />);
    fireEvent.change(screen.getByPlaceholderText('Add a note to supplement this entry (optional)'), {
      target: { value: 'This is a human note' },
    });
    fireEvent.click(screen.getByText('Promote'));
    await waitFor(() => {
      expect(onPromote).toHaveBeenCalledWith('This is a human note');
    });
  });

  it('calls onPromote with empty string when no note entered', async () => {
    const onPromote = vi.fn().mockResolvedValue(undefined);
    render(<SimpleReviewClient node={baseNode} onPromote={onPromote} onArchive={vi.fn()} isSubmitting={false} />);
    fireEvent.click(screen.getByText('Promote'));
    await waitFor(() => {
      expect(onPromote).toHaveBeenCalledWith('');
    });
  });

  it('calls onArchive when Archive is clicked', async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={onArchive} isSubmitting={false} />);
    fireEvent.click(screen.getByText('Archive'));
    await waitFor(() => {
      expect(onArchive).toHaveBeenCalled();
    });
  });

  it('disables buttons and shows Saving… when isSubmitting is true', () => {
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={vi.fn()} isSubmitting={true} />);
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    expect((screen.getByText('Saving…') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('Archive') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows error when onPromote rejects', async () => {
    const onPromote = vi.fn().mockRejectedValue(new Error('network'));
    render(<SimpleReviewClient node={baseNode} onPromote={onPromote} onArchive={vi.fn()} isSubmitting={false} />);
    fireEvent.click(screen.getByText('Promote'));
    await waitFor(() => {
      expect(screen.getByText('Failed — try again')).toBeInTheDocument();
    });
  });

  it('shows error when onArchive rejects', async () => {
    const onArchive = vi.fn().mockRejectedValue(new Error('network'));
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={onArchive} isSubmitting={false} />);
    fireEvent.click(screen.getByText('Archive'));
    await waitFor(() => {
      expect(screen.getByText('Failed — try again')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/review/__tests__/SimpleReviewClient.test.tsx --reporter=verbose
```

Expected: FAIL — `Cannot find module '../SimpleReviewClient'`

- [ ] **Step 3: Create SimpleReviewClient.tsx**

Create `src/components/review/SimpleReviewClient.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';

const NODE_TYPE_LABELS: Record<string, string> = {
  hunch: 'Hunch',
  assumption_background: 'Background Assumption',
  assumption_foreground: 'Active Assumption',
  test: 'Test',
  signal: 'Signal',
  learning: 'Learning',
  option: 'Option',
};

const MATURITY_LABELS: Record<string, string> = {
  watch_closely: 'Watch closely',
  needs_development: 'Needs development',
  cluster_dependent: 'Cluster dependent',
};

function getTypeLabel(nodeType: string): string {
  return NODE_TYPE_LABELS[nodeType]
    ?? nodeType.charAt(0).toUpperCase() + nodeType.slice(1).replace(/_/g, ' ');
}

interface SimpleReviewClientProps {
  readonly node: Node;
  readonly onPromote: (note: string) => Promise<void>;
  readonly onArchive: () => Promise<void>;
  readonly isSubmitting: boolean;
}

export function SimpleReviewClient({ node, onPromote, onArchive, isSubmitting }: SimpleReviewClientProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const extraction = node.llm_extraction;
  const maturityLabel = extraction?.maturity ? MATURITY_LABELS[extraction.maturity] : null;

  async function handlePromote() {
    setError(null);
    try {
      await onPromote(note);
    } catch {
      setError('Failed — try again');
    }
  }

  async function handleArchive() {
    setError(null);
    try {
      await onArchive();
    } catch {
      setError('Failed — try again');
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {getTypeLabel(node.node_type)}
        </span>
        {maturityLabel && (
          <span className="text-[10px] text-gray-500 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {maturityLabel}
          </span>
        )}
      </div>

      {extraction && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3">
          {extraction.summary && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{extraction.summary}</p>
          )}
          {extraction.structured_claim && (
            <div className="space-y-1 text-xs text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-gray-800 pt-3">
              <p><span className="font-medium text-gray-700 dark:text-gray-400">If</span> {extraction.structured_claim.if}</p>
              <p><span className="font-medium text-gray-700 dark:text-gray-400">Then</span> {extraction.structured_claim.then}</p>
              <p><span className="font-medium text-gray-700 dark:text-gray-400">Because</span> {extraction.structured_claim.because}</p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 pt-3">
            <span className="text-[10px] text-gray-500">
              {extraction.confidence_assessment.level}/5 · {extraction.confidence_assessment.basis.replace(/_/g, ' ')}
            </span>
            {extraction.domain_tags.length > 0 && (
              <div className="flex gap-1 flex-wrap justify-end">
                {extraction.domain_tags.map(tag => (
                  <span key={tag} className="text-[10px] bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a note to supplement this entry (optional)"
        rows={3}
        className="w-full text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#185FA5] resize-none"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePromote}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-[#185FA5] text-white rounded-md disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Promote'}
        </button>
        <button
          type="button"
          onClick={handleArchive}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-md disabled:opacity-50"
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
npx vitest run src/components/review/__tests__/SimpleReviewClient.test.tsx --reporter=verbose
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/review/SimpleReviewClient.tsx src/components/review/__tests__/SimpleReviewClient.test.tsx
git commit -m "feat(review): SimpleReviewClient — lightweight LLM summary + promote/archive"
```

---

## Task 3: Rewrite review page.tsx

**Files:**
- Modify: `src/app/capture/[id]/review/page.tsx`

The current page is a client component with a complex `handlePromote(review: HumanReview)` that reads from `ReviewCard`'s built review object. Replace the whole file with the simplified version below.

- [ ] **Step 1: Replace the entire contents of page.tsx**

Write `src/app/capture/[id]/review/page.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { SimpleReviewClient } from '@/components/review/SimpleReviewClient';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { Node, HumanReview } from '@/lib/types/nodes';

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'in', 'to', 'and', 'for', 'is', 'as', 'on', 'by', 'at', 'or', 'not']);

function getKeywords(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function findBestMatch(targetTitle: string, candidates: { id: string; title: string }[]): { id: string; title: string } | null {
  const exact = candidates.find(n => n.title === targetTitle);
  if (exact) return exact;
  const sub = candidates.find(n => n.title.toLowerCase().includes(targetTitle.toLowerCase()))
    ?? candidates.find(n => targetTitle.toLowerCase().includes(n.title.toLowerCase()));
  if (sub) return sub;
  const searchWords = getKeywords(targetTitle);
  if (searchWords.length === 0) return null;
  let bestScore = 0;
  let bestMatch: { id: string; title: string } | null = null;
  for (const candidate of candidates) {
    const candidateWords = getKeywords(candidate.title);
    const overlap = searchWords.filter(w => candidateWords.some(cw => cw.includes(w) || w.includes(cw))).length;
    if (overlap > 0 && overlap > bestScore) {
      bestScore = overlap;
      bestMatch = candidate;
    }
  }
  return bestMatch;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [node, setNode] = useState<Node | null>(null);
  const [childNodes, setChildNodes] = useState<Node[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchNode = async () => {
      const supabase = createClient();
      const [{ data: nodeData }, { data: childNodesData }] = await Promise.all([
        supabase.from('nodes').select('*').eq('id', params.id).single(),
        supabase
          .from('nodes')
          .select('*')
          .eq('parent_node_id', params.id as string)
          .order('created_at', { ascending: true }),
      ]);
      if (nodeData) setNode(nodeData as unknown as Node);
      if (childNodesData) setChildNodes(childNodesData as unknown as Node[]);
    };
    fetchNode();
  }, [params.id]);

  const handlePromote = async (note: string) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const nodeId = params.id as string;

      const humanReview: HumanReview = {
        reviewed_at: new Date().toISOString(),
        reviewer_id: node?.author_id ?? '',
        note: note.trim() || undefined,
        fields: {},
        connections_accepted: [],
        connections_rejected: [],
        connections_added: [],
      };

      await supabase
        .from('nodes')
        .update({ human_review: humanReview, status: 'promoted' })
        .eq('id', nodeId);

      // Auto-accept all LLM-suggested connections
      const suggested = node?.llm_extraction?.suggested_connections ?? [];
      if (suggested.length > 0) {
        const { data: allNodes } = await supabase
          .from('nodes')
          .select('id, title')
          .in('status', ['promoted', 'human_reviewed'])
          .neq('id', nodeId);
        if (allNodes && allNodes.length > 0) {
          const edges = suggested
            .map(conn => {
              const target = findBestMatch(conn.target_title, allNodes);
              if (!target) return null;
              return { source_id: nodeId, target_id: target.id, edge_type: conn.edge_type, weight: 1 };
            })
            .filter((e): e is NonNullable<typeof e> => e !== null);
          if (edges.length > 0) await supabase.from('edges').insert(edges);
        }
      }

      // Auto-accept all goal relevance suggestions
      const goalRelevance = node?.llm_extraction?.goal_relevance ?? [];
      if (goalRelevance.length > 0) {
        const goalEdges = goalRelevance.map(gr => ({
          source_id: nodeId,
          target_id: gr.outcome_id,
          edge_type: 'targets_outcome',
          weight: 1,
        }));
        await supabase.from('edges').insert(goalEdges);
      }

      await supabase.from('activity_log').insert({
        action: 'promoted',
        target_node_id: nodeId,
        details: { from_status: node?.status },
      });

      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      await supabase.from('nodes').update({ status: 'archived' }).eq('id', params.id);
      await supabase.from('activity_log').insert({
        action: 'archived',
        target_node_id: params.id as string,
      });
      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!node) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-48" />
          <div className="h-32 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (!node.llm_extraction || node.status === 'raw' || node.status === 'processing') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">This entry is still being processed.</p>
        <p className="text-sm text-gray-600 mt-1">Check back in a moment.</p>
        <Link href="/capture" className="text-sm text-[#185FA5] mt-3 inline-block">
          Back to capture
        </Link>
      </div>
    );
  }

  if (node.status === 'promoted' || node.status === 'archived') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">This entry has already been {node.status}.</p>
        <Link href="/capture" className="text-sm text-[#185FA5] mt-2 inline-block">
          Back to capture
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-200">{node.title}</h1>
        {node.description && (
          <p className="mt-1 text-sm text-gray-500">{node.description}</p>
        )}
      </div>
      {node.node_type === 'meeting_notes' && childNodes.length > 0 ? (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Meeting Summary</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {((node.llm_extraction as unknown as Record<string, unknown> | null)?.meeting_summary as string | undefined) ?? 'No summary available'}
            </p>
            <div className="mt-2 text-[10px] text-gray-400">
              {childNodes.length} node{childNodes.length !== 1 ? 's' : ''} extracted
            </div>
          </div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Extracted Nodes — Review Each
          </h3>
          <div className="space-y-2">
            {childNodes.map(child => (
              <Link
                key={child.id}
                href={`/capture/${child.id}/review`}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-800 dark:text-gray-200 truncate">{child.title}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-600 mt-0.5">
                    {child.node_type} · {(child.content as Record<string, unknown> | null)?.category as string ?? 'extracted'}
                  </div>
                </div>
                <StatusBadge status={child.status} />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <SimpleReviewClient
          node={node}
          onPromote={handlePromote}
          onArchive={handleArchive}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: The `ReviewCard.test.tsx` tests will still pass (ReviewCard not yet deleted). New tests continue passing. Overall: PASS, FAIL 0.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/capture/[id]/review/page.tsx
git commit -m "feat(review): replace ReviewCard with SimpleReviewClient, auto-accept connections on promote"
```

---

## Task 4: Delete ReviewCard and its sub-components

**Files:**
- Delete: `src/components/review/ReviewCard.tsx`
- Delete: `src/components/review/ConfidenceSlider.tsx`
- Delete: `src/components/review/ConnectionSuggestion.tsx`
- Delete: `src/components/review/DomainTagEditor.tsx`
- Delete: `src/components/review/ExtractionField.tsx`
- Delete: `src/components/review/GoalRelevanceField.tsx`
- Delete: `src/components/review/__tests__/ReviewCard.test.tsx`
- Delete: `src/components/review/__tests__/GoalRelevanceField.test.tsx`

Note: `FlaggedItem.tsx`, `ReflectionSection.tsx`, and their tests are **kept** — they are used by the System Health page, not ReviewCard.

- [ ] **Step 1: Delete all ReviewCard files**

```bash
cd /Users/gurden/Documents/code/cof-learning-system/.worktrees/cof-v06-pipeline
git rm src/components/review/ReviewCard.tsx \
       src/components/review/ConfidenceSlider.tsx \
       src/components/review/ConnectionSuggestion.tsx \
       src/components/review/DomainTagEditor.tsx \
       src/components/review/ExtractionField.tsx \
       src/components/review/GoalRelevanceField.tsx \
       src/components/review/__tests__/ReviewCard.test.tsx \
       src/components/review/__tests__/GoalRelevanceField.test.tsx
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: PASS, FAIL 0. The deleted test files are gone; all remaining tests pass.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(review): delete ReviewCard and sub-components — replaced by SimpleReviewClient"
```

---

## Final check

```bash
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
git log --oneline -5
```

Confirm: all tests pass, no TypeScript errors, 4 feature commits in log.
