// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockRunDistillation = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ auth: { getUser: mockGetUser } })),
}));

vi.mock('@/lib/agents/distillation', () => ({ runDistillation: mockRunDistillation }));

import { POST } from '../run/route';

describe('POST /api/distill/run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockRunDistillation.mockResolvedValue({ created: 2, errors: [] });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('calls runDistillation with user id and returns result', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(mockRunDistillation).toHaveBeenCalledWith(expect.anything(), 'user-1');
    const body = await res.json() as { data: { created: number; errors: string[] } };
    expect(body.data.created).toBe(2);
    expect(body.data.errors).toHaveLength(0);
  });

  it('returns result even when distillation finds 0 candidates', async () => {
    mockRunDistillation.mockResolvedValue({ created: 0, errors: [] });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { created: number } };
    expect(body.data.created).toBe(0);
  });

  it('returns 500 when runDistillation throws', async () => {
    mockRunDistillation.mockRejectedValue(new Error('LLM timeout'));
    const res = await POST();
    expect(res.status).toBe(500);
  });
});
