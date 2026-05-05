import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
  from: mockFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

vi.mock('@/lib/llm', () => ({
  callLLM: vi.fn().mockResolvedValue({ content: 'Generated newsletter text.', model: 'claude-sonnet-4-6' }),
}));

vi.mock('@/lib/newsletter/select', () => ({
  selectMissionPathwaysNodes: vi.fn().mockResolvedValue({
    stageCounts: { hypothesis: 1 },
    recentlyMoved: [],
    activeCommitments: [],
    completedCommitments: [],
    testsWithActivity: [],
    stuckHunches: [],
  }),
  selectCloseContactsNodes: vi.fn().mockResolvedValue({
    learnings: [],
    testsWithActivity: [],
    coherentHunches: [],
  }),
}));

describe('GET /api/newsletters', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no user') });
    const { GET } = await import('../route');
    const req = new Request('http://test/api/newsletters?type=mission_pathways');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid type', async () => {
    const { GET } = await import('../route');
    const req = new Request('http://test/api/newsletters?type=invalid');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns newsletter list for valid type', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'n1', content: 'test', created_at: '2026-01-01' }], error: null }),
    });
    const { GET } = await import('../route');
    const req = new Request('http://test/api/newsletters?type=mission_pathways');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/newsletters', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no user') });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/newsletters', {
      method: 'POST',
      body: JSON.stringify({ type: 'mission_pathways' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid type', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://test/api/newsletters', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid_type' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('generates and saves a mission pathways newsletter', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'n1', content: 'Generated newsletter text.', created_at: '2026-05-05T00:00:00Z' },
        error: null,
      }),
    });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/newsletters', {
      method: 'POST',
      body: JSON.stringify({ type: 'mission_pathways' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { content: string } };
    expect(body.data.content).toBe('Generated newsletter text.');
  });

  it('generates a close contacts newsletter', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'n2', content: 'Field update text.', created_at: '2026-05-05T00:00:00Z' },
        error: null,
      }),
    });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/newsletters', {
      method: 'POST',
      body: JSON.stringify({ type: 'close_contacts' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
