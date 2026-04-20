import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/app/commitments/CommitmentsClient', () => ({
  CommitmentsClient: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'commitments-client' },
      `commitments:${(props.initialCommitments as unknown[]).length}`
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
