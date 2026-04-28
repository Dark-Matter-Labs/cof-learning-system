// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockCandidatesSelect = vi.hoisted(() => vi.fn());
const mockNodesSelect = vi.hoisted(() => vi.fn());
const mockCandidatesUpdate = vi.hoisted(() => vi.fn());
const mockNodesInsert = vi.hoisted(() => vi.fn());
const mockEdgesInsert = vi.hoisted(() => vi.fn());
const mockNodesUpdate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (table: string) => {
        if (table === 'distillation_candidates') return {
          select: mockCandidatesSelect,
          update: mockCandidatesUpdate,
        };
        if (table === 'nodes') return {
          select: mockNodesSelect,
          insert: mockNodesInsert,
          update: mockNodesUpdate,
        };
        if (table === 'edges') return { insert: mockEdgesInsert };
        return {};
      },
    })
  ),
}));

import { GET, PATCH } from '../candidates/route';

const PENDING_CANDIDATE = {
  id: 'cand-1',
  node_ids: ['n1', 'n2'],
  merged_title: 'Distilled node',
  merged_summary: 'Combined insight',
  merged_node_type: 'hunch',
  rationale: 'Near duplicates',
  created_at: '2026-04-28T10:00:00Z',
};

describe('GET /api/distill/candidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockCandidatesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [PENDING_CANDIDATE], error: null }),
        }),
      }),
    });
    mockNodesSelect.mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            { id: 'n1', title: 'Node 1', node_type: 'hunch', description: 'Desc 1' },
            { id: 'n2', title: 'Node 2', node_type: 'hunch', description: 'Desc 2' },
          ],
        }),
      }),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns enriched candidates with node details', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: string; nodes: Array<{ id: string }> }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('cand-1');
    expect(body.data[0].nodes).toHaveLength(2);
  });

  it('returns empty array when no pending candidates', async () => {
    mockCandidatesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(0);
  });
});

describe('PATCH /api/distill/candidates — reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockCandidatesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...PENDING_CANDIDATE, created_by: 'user-1' },
            error: null,
          }),
        }),
      }),
    });
    mockCandidatesUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('returns 400 for invalid body', async () => {
    const req = new Request('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'not-a-uuid', action: 'accept' }) });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('updates status to rejected', async () => {
    const req = new Request('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', action: 'reject' }) });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { action: string } };
    expect(body.data.action).toBe('rejected');
    expect(mockCandidatesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected' })
    );
  });
});

describe('PATCH /api/distill/candidates — accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockCandidatesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...PENDING_CANDIDATE, created_by: 'user-1' },
            error: null,
          }),
        }),
      }),
    });
    mockNodesInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'new-node-id' }, error: null }),
      }),
    });
    mockEdgesInsert.mockResolvedValue({ error: null });
    mockNodesUpdate.mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    mockCandidatesUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('creates merged node, evolved_from edges, archives originals, returns new node id', async () => {
    const req = new Request('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', action: 'accept' }) });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { action: string; node_id: string } };
    expect(body.data.action).toBe('accepted');
    expect(body.data.node_id).toBe('new-node-id');

    const edgeArg = mockEdgesInsert.mock.calls[0][0] as Array<{ source_id: string; edge_type: string }>;
    expect(edgeArg).toHaveLength(2);
    expect(edgeArg[0].edge_type).toBe('evolved_from');

    expect(mockNodesUpdate).toHaveBeenCalled();
  });
});
