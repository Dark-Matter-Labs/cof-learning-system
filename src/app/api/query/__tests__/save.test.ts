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
    expect(insertArg.confidence_level).toBe(3);
    expect(insertArg.description).toBe(VALID_BODY.content);
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

  it('returns 500 when node insert fails', async () => {
    mockNodesInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('db error') }),
      }),
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });

  it('logs created_learning action for learning node_type', async () => {
    await POST(makeRequest(VALID_BODY)); // VALID_BODY.node_type is 'learning'
    const logArg = mockActivityInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(logArg.action).toBe('created_learning');
  });

  it('logs created_hunch action for hunch node_type', async () => {
    await POST(makeRequest({ ...VALID_BODY, node_type: 'hunch' }));
    const logArg = mockActivityInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(logArg.action).toBe('created_hunch');
  });
});
