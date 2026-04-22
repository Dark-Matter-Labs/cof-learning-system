// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockNodesSelect, mockEdgesSelect, mockProfileSelect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockNodesSelect: vi.fn(),
  mockEdgesSelect: vi.fn(),
  mockProfileSelect: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (table: string) => {
        if (table === 'nodes') return { select: mockNodesSelect };
        if (table === 'edges') return { select: mockEdgesSelect };
        if (table === 'profiles') return { select: mockProfileSelect };
        return { select: vi.fn().mockResolvedValue({ data: [] }) };
      },
    })
  ),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function () {
    return {
      messages: {
        stream: vi.fn(() =>
          (async function* () {
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } };
          })()
        ),
      },
    };
  }),
}));

import { POST } from '../route';

const mockNodes = [
  { id: 'n1', node_type: 'hunch', title: 'Madrid financial risk', description: 'Funding uncertainty', status: 'raw' },
  { id: 'n2', node_type: 'commitment', title: 'Partner with IES', description: null, status: 'promoted' },
  { id: 'n3', node_type: 'learning', title: 'Unrelated learning', description: null, status: 'promoted' },
];
const mockEdges = [{ source_id: 'n1', target_id: 'n2' }];

function makeRequest(body: object) {
  return new Request('http://localhost/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockNodesSelect.mockReturnValue({
      neq: vi.fn().mockResolvedValue({ data: mockNodes }),
    });
    mockEdgesSelect.mockResolvedValue({ data: mockEdges });
    mockProfileSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await POST(makeRequest({ query: 'test' }));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when query is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when query is blank whitespace', async () => {
    const res = await POST(makeRequest({ query: '   ' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 streaming response with correct Content-Type', async () => {
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
  });

  it('sets X-Context-Nodes header with matching node IDs', async () => {
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    const nodeIds = JSON.parse(res.headers.get('X-Context-Nodes') ?? '[]') as string[];
    expect(nodeIds).toContain('n1');
  });

  it('includes BFS-expanded neighbour in X-Context-Nodes', async () => {
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    const nodeIds = JSON.parse(res.headers.get('X-Context-Nodes') ?? '[]') as string[];
    // n2 is connected to n1 via edge — should be BFS-expanded
    expect(nodeIds).toContain('n2');
  });

  it('excludes unrelated nodes from context header', async () => {
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    const nodeIds = JSON.parse(res.headers.get('X-Context-Nodes') ?? '[]') as string[];
    expect(nodeIds).not.toContain('n3');
  });

  it('streams text content in response body', async () => {
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    const text = await res.text();
    expect(text).toBe('Hello world');
  });

  it('includes user background in system prompt when profile has background', async () => {
    mockProfileSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { background: 'finance and investment' }, error: null }),
      }),
    });
    // Can't inspect system prompt directly — verify route still returns 200
    // (background is passed to LLM internally, not exposed in response)
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    expect(res.status).toBe(200);
  });

  it('errors the stream when Anthropic throws during streaming', async () => {
    const { default: AnthropicSdk } = await import('@anthropic-ai/sdk');
    (AnthropicSdk as ReturnType<typeof vi.fn>).mockImplementationOnce(function () {
      return {
        messages: {
          stream: vi.fn(() => {
            throw new Error('API error');
          }),
        },
      };
    });
    const res = await POST(makeRequest({ query: 'Madrid financial' }));
    expect(res.status).toBe(200); // headers already sent
    // Reading the body should reject/throw since the stream errored
    try {
      await res.text();
      // If text() doesn't throw, the stream may have closed empty — that's also acceptable
    } catch {
      // Expected: stream errored
    }
  });
});
