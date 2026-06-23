import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConnections } from '../connectionResolver';
import type { SuggestedConnection } from '../connectionResolver';

function makeSupabase(
  matchResult: { id: string } | null,
  existingEdge: { id: string } | null = null,
) {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockEdgeSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: existingEdge }),
      }),
    }),
  });
  const mockNodeSelect = vi.fn().mockReturnValue({
    ilike: vi.fn().mockReturnValue({
      neq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: matchResult }),
          }),
        }),
      }),
    }),
  });

  return {
    from: (table: string) => {
      if (table === 'nodes') return { select: mockNodeSelect };
      if (table === 'edges') return { select: mockEdgeSelect, insert: mockInsert };
      return { select: vi.fn(), insert: vi.fn() };
    },
    _mockInsert: mockInsert,
  };
}

const SUGGESTIONS: SuggestedConnection[] = [
  { target_title: 'Formation capital strategy', edge_type: 'supports', rationale: 'Directly supports' },
  { target_title: 'Nonexistent node', edge_type: 'contradicts', rationale: 'Should not match' },
];

describe('resolveConnections', () => {
  it('returns created 0 and no unresolved when suggestions is empty', async () => {
    const supabase = makeSupabase(null);
    const { created, unresolved } = await resolveConnections('src-id', [], supabase as never, 'user-1');
    expect(created).toBe(0);
    expect(unresolved).toEqual([]);
  });

  it('creates an edge when a matching node is found', async () => {
    const supabase = makeSupabase({ id: 'matched-id' });
    const { created } = await resolveConnections('src-id', [SUGGESTIONS[0]], supabase as never, 'user-1');
    expect(created).toBe(1);
    expect(supabase._mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: 'src-id', target_id: 'matched-id', edge_type: 'supports' }),
    );
  });

  it('returns unmatched valid suggestions in unresolved instead of creating', async () => {
    const supabase = makeSupabase(null);
    const { created, unresolved } = await resolveConnections('src-id', [SUGGESTIONS[1]], supabase as never, 'user-1');
    expect(created).toBe(0);
    expect(unresolved).toEqual([SUGGESTIONS[1]]);
    expect(supabase._mockInsert).not.toHaveBeenCalled();
  });

  it('skips when edge already exists', async () => {
    const supabase = makeSupabase({ id: 'matched-id' }, { id: 'existing-edge' });
    const { created } = await resolveConnections('src-id', [SUGGESTIONS[0]], supabase as never, 'user-1');
    expect(created).toBe(0);
    expect(supabase._mockInsert).not.toHaveBeenCalled();
  });

  it('processes multiple suggestions independently', async () => {
    const supabase = makeSupabase({ id: 'matched-id' });
    const { created } = await resolveConnections('src-id', SUGGESTIONS, supabase as never, 'user-1');
    expect(created).toBeGreaterThan(0);
  });

  it('skips suggestions with empty target_title', async () => {
    const supabase = makeSupabase({ id: 'matched-id' });
    const empty: SuggestedConnection = { target_title: '  ', edge_type: 'supports', rationale: '' };
    const { created, unresolved } = await resolveConnections('src-id', [empty], supabase as never, 'user-1');
    expect(created).toBe(0);
    expect(unresolved).toEqual([]);
  });
});
