import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser }, from: mockFrom })),
}));

import { POST } from '../team/route';

describe('POST /api/setup/team', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSelect.mockResolvedValue({ data: [{ id: 'p-1' }], error: null });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('creates person nodes for each member', async () => {
    const req = new Request('http://localhost/api/setup/team', {
      method: 'POST',
      body: JSON.stringify({ members: [{ name: 'Indy Johar', role: 'Founder' }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ node_type: 'person', title: 'Indy Johar' })])
    );
  });

  it('returns 400 for empty members array', async () => {
    const req = new Request('http://localhost/api/setup/team', {
      method: 'POST',
      body: JSON.stringify({ members: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('auth') });
    const req = new Request('http://localhost/api/setup/team', {
      method: 'POST',
      body: JSON.stringify({ members: [{ name: 'Test' }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
