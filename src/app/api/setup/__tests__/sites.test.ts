import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser }, from: mockFrom })),
}));

import { POST } from '../sites/route';

describe('POST /api/setup/sites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSelect.mockResolvedValue({ data: [{ id: 'n-1' }], error: null });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('creates site nodes', async () => {
    const req = new Request('http://localhost/api/setup/sites', {
      method: 'POST',
      body: JSON.stringify({ sites: [{ name: 'Madrid', description: 'Urban heat' }], options: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ node_type: 'site', title: 'Madrid' })])
    );
  });

  it('accepts empty sites and options (skip case)', async () => {
    const req = new Request('http://localhost/api/setup/sites', {
      method: 'POST',
      body: JSON.stringify({ sites: [], options: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('auth') });
    const req = new Request('http://localhost/api/setup/sites', {
      method: 'POST',
      body: JSON.stringify({ sites: [], options: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
