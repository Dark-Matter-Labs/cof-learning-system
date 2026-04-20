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
