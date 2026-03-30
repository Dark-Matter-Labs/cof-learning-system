import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Shared mock state ───────────────────────────────────────────────
let mockAwaitingData: unknown[] = [];
let mockStaleData: unknown[] = [];
let mockLowConfData: unknown[] = [];
let mockTestsData: unknown[] = [];
let mockTensionsData: unknown[] = [];
let mockCommitmentsData: unknown[] = [];
let mockStalledData: unknown[] = [];
let mockAllHunchesData: unknown[] = [];
let mockTargetEdgesData: unknown[] = [];

// ── Supabase mock ──────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

vi.mock('@/components/shared/EmptyState', () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) =>
    React.createElement('div', { 'data-testid': 'empty-state' },
      React.createElement('h2', null, title),
      React.createElement('p', null, description),
    ),
}));

vi.mock('@/components/shared/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) =>
    React.createElement('span', { 'data-testid': 'status-badge' }, status),
}));

/**
 * Build a flexible Supabase client mock.
 * Each call to .from() returns the next dataset in the sequence.
 * All chained methods return the same object so any chain works.
 * The object is also Promise-like so it can be awaited directly.
 */
function buildMockClient() {
  const datasets: { data: unknown[]; error: null }[] = [
    { data: mockAwaitingData, error: null },    // 0: awaiting
    { data: mockStaleData, error: null },        // 1: stale
    { data: mockLowConfData, error: null },      // 2: lowConf
    { data: mockTestsData, error: null },        // 3: tests
    { data: mockTensionsData, error: null },     // 4: tensions
    { data: mockCommitmentsData, error: null },  // 5: commitments
    { data: mockStalledData, error: null },      // 6: stalled
    { data: mockAllHunchesData, error: null },   // 7: allHunches
    { data: mockTargetEdgesData, error: null },  // 8: targetEdges
  ];

  let callIndex = 0;

  return {
    from: vi.fn().mockImplementation(() => {
      const resolveWith = datasets[callIndex] ?? { data: [], error: null };
      callIndex++;

      // Build a chainable, awaitable object
      const chain: Record<string, unknown> = {};

      const selfReturn = () => chain;
      chain.select = selfReturn;
      chain.eq = selfReturn;
      chain.neq = selfReturn;
      chain.in = selfReturn;
      chain.not = selfReturn;
      chain.lte = selfReturn;
      chain.lt = selfReturn;
      chain.order = vi.fn().mockResolvedValue(resolveWith);

      // Make it directly awaitable (for queries that end without .order())
      chain.then = (onFulfilled: (v: typeof resolveWith) => unknown) =>
        Promise.resolve(resolveWith).then(onFulfilled);

      return chain;
    }),
  };
}

// ── Import the page under test ──────────────────────────────────────
import { createClient } from '@/lib/supabase/server';

async function renderPage() {
  const mod = await import('../page');
  const Page = mod.default;
  const element = await Page();
  const { container } = render(element as React.ReactElement);
  return container;
}

describe('ReviewPage — undirected hunches section', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAwaitingData = [];
    mockStaleData = [];
    mockLowConfData = [];
    mockTestsData = [];
    mockTensionsData = [];
    mockCommitmentsData = [];
    mockStalledData = [];
    mockAllHunchesData = [];
    mockTargetEdgesData = [];
  });

  it('Test 1: renders "Undirected hunches" section when hunches have no targets_outcome edge', async () => {
    mockAllHunchesData = [{ id: 'h1', title: 'Hunch One', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' }];
    mockTargetEdgesData = [];
    // Also add to awaiting so isEmpty check passes
    mockAwaitingData = [{ id: 'h1', title: 'Hunch One', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' }];

    vi.mocked(createClient).mockResolvedValue(buildMockClient() as never);

    const container = await renderPage();
    expect(container.textContent).toContain('Undirected hunches');
    expect(container.textContent).toContain('1');
  });

  it('Test 2: each undirected hunch links to /capture/{id}/review with "consider linking" text', async () => {
    mockAllHunchesData = [{ id: 'h2', title: 'Explore AI governance', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' }];
    mockTargetEdgesData = [];
    mockAwaitingData = [{ id: 'h2', title: 'Explore AI governance', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' }];

    vi.mocked(createClient).mockResolvedValue(buildMockClient() as never);

    const container = await renderPage();
    const link = container.querySelector('a[href="/capture/h2/review"]');
    expect(link).not.toBeNull();
    expect(container.textContent).toContain('consider linking');
  });

  it('Test 3: hunches WITH targets_outcome edge are NOT shown in undirected section', async () => {
    mockAllHunchesData = [
      { id: 'h3', title: 'Linked Hunch', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'h4', title: 'Unlinked Hunch', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];
    mockTargetEdgesData = [{ source_id: 'h3' }]; // h3 has a link
    mockAwaitingData = [
      { id: 'h3', title: 'Linked Hunch', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    vi.mocked(createClient).mockResolvedValue(buildMockClient() as never);

    const container = await renderPage();
    const undirectedSection = container.querySelector('[data-testid="undirected-hunches"]');
    expect(undirectedSection).not.toBeNull();
    expect(undirectedSection!.textContent).not.toContain('Linked Hunch');
    expect(undirectedSection!.textContent).toContain('Unlinked Hunch');
  });

  it('Test 4: active hunches without archived/falsified/suspended status are shown', async () => {
    mockAllHunchesData = [
      { id: 'h5', title: 'Active Hunch', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];
    mockTargetEdgesData = [];
    mockAwaitingData = [
      { id: 'h5', title: 'Active Hunch', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    vi.mocked(createClient).mockResolvedValue(buildMockClient() as never);

    const container = await renderPage();
    expect(container.textContent).toContain('Active Hunch');
  });

  it('Test 5: undirected hunches section does not render when all hunches have targets_outcome edges', async () => {
    mockAllHunchesData = [{ id: 'h6', title: 'Fully Linked', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' }];
    mockTargetEdgesData = [{ source_id: 'h6' }];
    mockAwaitingData = [{ id: 'h6', title: 'Fully Linked', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' }];

    vi.mocked(createClient).mockResolvedValue(buildMockClient() as never);

    const container = await renderPage();
    expect(container.textContent).not.toContain('Undirected hunches');
    expect(container.textContent).not.toContain('consider linking');
  });

  it('Test 6: isEmpty check includes undirectedHunches — page renders when only undirected hunches exist', async () => {
    mockAllHunchesData = [{ id: 'h7', title: 'Lonely Hunch', status: 'llm_reviewed', node_type: 'hunch', created_at: '2026-01-01', updated_at: '2026-01-01' }];
    mockTargetEdgesData = [];
    // All other arrays empty — no awaiting, tensions, or lowConf
    mockAwaitingData = [];
    mockTensionsData = [];
    mockLowConfData = [];

    vi.mocked(createClient).mockResolvedValue(buildMockClient() as never);

    const container = await renderPage();
    // Should NOT show empty state — should show the undirected hunches section
    const emptyState = container.querySelector('[data-testid="empty-state"]');
    expect(emptyState).toBeNull();
    expect(container.textContent).toContain('Undirected hunches');
  });
});
