import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
  from: mockFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

describe('GET /api/portfolios', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no user') });
    const { GET } = await import('../route');
    const res = await GET(new Request('http://t', { method: 'GET' }));
    expect(res.status).toBe(401);
  });

  it('returns portfolio list', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'p1', title: 'Test', current_step: 3 }],
        error: null,
      }),
    });
    const { GET } = await import('../route');
    const res = await GET(new Request('http://t', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/portfolios', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for missing title', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
