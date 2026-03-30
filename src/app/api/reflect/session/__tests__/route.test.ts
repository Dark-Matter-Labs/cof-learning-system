import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';

// Mock Supabase server client
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      insert: mockInsert,
    }),
  }),
}));

describe('POST /api/reflect/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } });

    const req = new Request('http://localhost/api/reflect/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ human_responses: {}, decisions: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 and inserts a row when session valid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    const payload = {
      machine_reflection: {},
      human_responses: { q_trajectory: 'test answer' },
      decisions: [{ text: 'a decision', node_id: null }],
      convergence_snapshot: {},
      participants: ['user-1'],
      node_count_at_reflection: 5,
      triggered_by: 'on_demand',
    };

    const req = new Request('http://localhost/api/reflect/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledOnce();
  });
});
