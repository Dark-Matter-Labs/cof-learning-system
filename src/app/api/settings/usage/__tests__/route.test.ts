import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockGte = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
    },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/llm/usage', () => ({
  estimateCostMicroCents: vi.fn((model: string, input: number, output: number) => {
    return input + output;
  }),
}));

describe('GET /api/settings/usage', () => {
  beforeEach(() => {
    mockGte.mockResolvedValue({
      data: [
        { agent: 'extraction', model: 'claude-haiku-4-5-20251001', input_tokens: 500, output_tokens: 200, cached: false },
        { agent: 'extraction', model: 'claude-haiku-4-5-20251001', input_tokens: 0, output_tokens: 0, cached: true },
      ],
      error: null,
    });

    mockSelect.mockReturnValue({
      gte: mockGte,
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
    });
  });

  it('returns 200 with usage data', async () => {
    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { totalCalls: number; cachedCalls: number } };
    expect(body.data.totalCalls).toBe(2);
    expect(body.data.cachedCalls).toBe(1);
  });
});
