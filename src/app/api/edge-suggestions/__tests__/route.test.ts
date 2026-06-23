import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
  from: mockFrom,
};
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue(mockSupabase) }));

const SUGGESTION_ROW = { id: 'sug-1', source_id: 's1', target_id: 't1', edge_type: 'supports' };

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe('PATCH /api/edge-suggestions/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for an invalid action', async () => {
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://test/api/edge-suggestions/sug-1', {
      method: 'PATCH', body: JSON.stringify({ action: 'nope' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: makeParams('sug-1') });
    expect(res.status).toBe(400);
  });

  it('dismiss marks the suggestion dismissed and creates no edge', async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const edgeInsert = vi.fn();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'edge_suggestions') return { update };
      if (table === 'edges') return { insert: edgeInsert };
      return {};
    });
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://test/api/edge-suggestions/sug-1', {
      method: 'PATCH', body: JSON.stringify({ action: 'dismiss' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: makeParams('sug-1') });
    expect(res.status).toBe(200);
    expect(edgeInsert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'dismissed' }));
  });

  it('accept inserts the edge and marks the suggestion accepted', async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const edgeInsert = vi.fn().mockResolvedValue({ error: null });
    const sugSelect = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: SUGGESTION_ROW }) })) })) }));
    mockFrom.mockImplementation((table: string) => {
      if (table === 'edge_suggestions') return { select: sugSelect, update };
      if (table === 'edges') return { insert: edgeInsert };
      return {};
    });
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://test/api/edge-suggestions/sug-1', {
      method: 'PATCH', body: JSON.stringify({ action: 'accept' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: makeParams('sug-1') });
    expect(res.status).toBe(200);
    expect(edgeInsert).toHaveBeenCalledWith(expect.objectContaining({
      source_id: 's1', target_id: 't1', edge_type: 'supports',
    }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }));
  });

  it('accept on a missing/already-resolved suggestion returns 409 and creates no edge', async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const edgeInsert = vi.fn();
    const sugSelect = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })) })) }));
    mockFrom.mockImplementation((table: string) => {
      if (table === 'edge_suggestions') return { select: sugSelect, update };
      if (table === 'edges') return { insert: edgeInsert };
      return {};
    });
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://test/api/edge-suggestions/sug-1', {
      method: 'PATCH', body: JSON.stringify({ action: 'accept' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: makeParams('sug-1') });
    expect(res.status).toBe(409);
    expect(edgeInsert).not.toHaveBeenCalled();
  });
});
