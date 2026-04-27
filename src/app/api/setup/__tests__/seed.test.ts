import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockSingle = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser }, from: mockFrom })),
}));

vi.mock('@/lib/agents/setup', () => ({
  processSeedChat: vi.fn().mockResolvedValue({
    reply: 'I captured your hunch.',
    extracted: [{ title: 'Capital formation is broken', node_type: 'hunch' }],
  }),
}));

import { POST } from '../seed/route';

describe('POST /api/setup/seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSingle.mockResolvedValue({ data: { id: 'n-1' }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('chat mode: creates nodes, returns reply and extracted', async () => {
    const req = new Request('http://localhost/api/setup/seed', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'chat',
        message: 'I think the capital system is fundamentally broken',
        history: [],
        goals: [{ title: 'Establish capital model' }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe('I captured your hunch.');
    expect(body.extracted).toHaveLength(1);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('write mode: creates a raw node, returns node_id', async () => {
    const req = new Request('http://localhost/api/setup/seed', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'write',
        content: 'Key assumption: warming will drive new institutional demand.',
        goals: [],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.node_id).toBeDefined();
  });

  it('returns 400 for unknown mode', async () => {
    const req = new Request('http://localhost/api/setup/seed', {
      method: 'POST',
      body: JSON.stringify({ mode: 'unknown', content: 'foo', goals: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('auth') });
    const req = new Request('http://localhost/api/setup/seed', {
      method: 'POST',
      body: JSON.stringify({ mode: 'write', content: 'test', goals: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
