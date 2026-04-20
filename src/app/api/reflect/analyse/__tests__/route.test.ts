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
  const user = 'user' in overrides ? overrides.user : { id: 'user-1' };
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
