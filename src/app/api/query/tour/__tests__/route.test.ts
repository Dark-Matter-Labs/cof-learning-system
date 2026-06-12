// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockNodesSelect, mockCallLLM, mockAdminUpsert } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockNodesSelect: vi.fn(),
  mockCallLLM: vi.fn(),
  mockAdminUpsert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: () => ({ select: mockNodesSelect }),
    })
  ),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ upsert: mockAdminUpsert }),
  })),
}));

vi.mock('@/lib/llm', () => ({
  callLLM: mockCallLLM,
}));

const mockLlmResponse = {
  chapters: [
    { title: 'Our goals', narrative: 'We have one goal space.', nodeIds: ['gs1'] },
    { title: 'Key assumptions', narrative: 'No assumptions yet.', nodeIds: [] },
    { title: "What we're testing", narrative: 'No active tests.', nodeIds: [] },
    { title: "What we've learned", narrative: 'Nothing learned yet.', nodeIds: [] },
    { title: 'Where attention is needed', narrative: 'Nothing pending.', nodeIds: [] },
  ],
};

import { POST } from '../route';

function makeRequest() {
  return new Request('http://localhost/api/query/tour', { method: 'POST' });
}

describe('POST /api/query/tour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockNodesSelect.mockReturnValue({
      neq: vi.fn().mockResolvedValue({
        data: [{ id: 'gs1', node_type: 'goal_space', title: 'Madrid Goal', description: null, status: 'raw' }],
      }),
    });
    mockCallLLM.mockResolvedValue({ content: JSON.stringify(mockLlmResponse), model: 'test-model' });
    mockAdminUpsert.mockResolvedValue({ error: null });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 5 chapters from the LLM response', async () => {
    const res = await POST(makeRequest());
    const body = await res.json() as { tour: { chapters: unknown[] } };
    expect(res.status).toBe(200);
    expect(body.tour.chapters).toHaveLength(5);
  });

  it('returns chapter titles from LLM', async () => {
    const res = await POST(makeRequest());
    const body = await res.json() as { tour: { chapters: Array<{ title: string }> } };
    expect(body.tour.chapters[0].title).toBe('Our goals');
    expect(body.tour.chapters[4].title).toBe('Where attention is needed');
  });

  it('returns 5 fallback chapters when no nodes exist', async () => {
    mockNodesSelect.mockReturnValue({
      neq: vi.fn().mockResolvedValue({ data: [] }),
    });
    const res = await POST(makeRequest());
    const body = await res.json() as { tour: { chapters: unknown[] } };
    expect(res.status).toBe(200);
    expect(body.tour.chapters).toHaveLength(5);
  });

  it('handles LLM response wrapped in markdown code fences', async () => {
    const wrapped = `\`\`\`json\n${JSON.stringify(mockLlmResponse)}\n\`\`\``;
    mockCallLLM.mockResolvedValueOnce({ content: wrapped, model: 'test-model' });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { tour: { chapters: unknown[] } };
    expect(body.tour.chapters).toHaveLength(5);
  });

  it('returns 500 when LLM call fails', async () => {
    mockCallLLM.mockRejectedValueOnce(new Error('Network error'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  it('returns 500 when database query fails', async () => {
    mockNodesSelect.mockReturnValue({
      neq: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  it('returns 500 when the LLM returns an unparseable response', async () => {
    mockCallLLM.mockResolvedValueOnce({ content: 'not json at all', model: 'test-model' });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
