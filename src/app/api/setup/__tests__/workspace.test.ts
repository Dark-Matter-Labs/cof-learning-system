import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { POST } from '../workspace/route';

describe('POST /api/setup/workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSingle.mockResolvedValue({ data: { id: 'ctx-1', name: 'Test Workspace' }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('creates a context and returns its id', async () => {
    const req = new Request('http://localhost/api/setup/workspace', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Workspace', description: 'A test workspace' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe('ctx-1');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Workspace' }));
  });

  it('returns 400 when name is missing', async () => {
    const req = new Request('http://localhost/api/setup/workspace', {
      method: 'POST',
      body: JSON.stringify({ description: 'No name' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const req = new Request('http://localhost/api/setup/workspace', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
