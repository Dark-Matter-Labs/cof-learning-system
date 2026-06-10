// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLM = vi.hoisted(() => vi.fn());
vi.mock('@/lib/llm', () => ({ callLLM: mockCallLLM }));

import { runDistillation } from '../distillation';

const NODES = [
  { id: 'a1', title: 'Formation capital requires patient debt', node_type: 'hunch', description: 'Long-term capital structures need patience.' },
  { id: 'a2', title: 'Patient debt is key to formation capital', node_type: 'hunch', description: 'Formation capital cannot work with short-term debt.' },
  { id: 'b1', title: 'Natural assets need new ownership models', node_type: 'learning', description: 'Commons structures work better.' },
];

function makeSupabase(nodes: typeof NODES) {
  const candidatesInsert = vi.fn().mockResolvedValue({ error: null });
  const supabase = {
    from: (table: string) => {
      if (table === 'nodes') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: nodes }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'distillation_candidates') return { insert: candidatesInsert };
      return { insert: vi.fn() };
    },
    _candidatesInsert: candidatesInsert,
  };
  return supabase;
}

describe('runDistillation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns { created: 0 } when no nodes exist', async () => {
    const supabase = makeSupabase([]);
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it('returns { created: 0 } when LLM finds no groups', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM.mockResolvedValue({ content: '{"groups":[]}' });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(0);
    expect(mockCallLLM).toHaveBeenCalledTimes(1);
  });

  it('creates 1 candidate when LLM finds 1 group and synthesis succeeds', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM
      .mockResolvedValueOnce({ content: JSON.stringify({ groups: [{ node_ids: ['a1', 'a2'], rationale: 'Same idea about patient debt' }] }) })
      .mockResolvedValueOnce({ content: JSON.stringify({ title: 'Formation capital requires patient debt', summary: 'Patient, long-term debt structures underpin formation capital.', node_type: 'hunch', rationale: 'Merged two near-identical hunches' }) });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(supabase._candidatesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        node_ids: ['a1', 'a2'],
        merged_title: 'Formation capital requires patient debt',
        merged_node_type: 'hunch',
        created_by: 'user-1',
      })
    );
  });

  it('parses cluster and synthesis responses wrapped in ```json code fences', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM
      .mockResolvedValueOnce({ content: '```json\n{"groups":[{"node_ids":["a1","a2"],"rationale":"same idea"}]}\n```' })
      .mockResolvedValueOnce({ content: '```json\n{"title":"Patient debt underpins formation capital","summary":"Merged.","node_type":"hunch","rationale":"deduped"}\n```' });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('skips groups where LLM returns invalid node IDs not in the node list', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM.mockResolvedValueOnce({ content: JSON.stringify({ groups: [{ node_ids: ['ghost-1', 'ghost-2'], rationale: 'unknown' }] }) });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(0);
    expect(supabase._candidatesInsert).not.toHaveBeenCalled();
  });

  it('returns error when cluster LLM response is not valid JSON', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM.mockResolvedValue({ content: 'not json at all' });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error when node fetch fails', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          in: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: null, error: { message: 'DB connection failed' } }),
              }),
            }),
          }),
        }),
      }),
      _candidatesInsert: vi.fn(),
    };
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(0);
    expect(result.errors[0]).toContain('Failed to fetch nodes');
  });

  it('records error and continues when synthesis fails for one group', async () => {
    const supabase = makeSupabase(NODES);
    mockCallLLM
      .mockResolvedValueOnce({ content: JSON.stringify({ groups: [
        { node_ids: ['a1', 'a2'], rationale: 'duplicate' },
        { node_ids: ['b1', 'a1'], rationale: 'also duplicate' },
      ] }) })
      .mockResolvedValueOnce({ content: 'bad json' })
      .mockResolvedValueOnce({ content: JSON.stringify({ title: 'Natural assets', summary: 'Summary.', node_type: 'learning', rationale: 'Merged' }) });
    const result = await runDistillation(supabase as never, 'user-1');
    expect(result.created).toBe(1);
    expect(result.errors.length).toBe(1);
  });
});
