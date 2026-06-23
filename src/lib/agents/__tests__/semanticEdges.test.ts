import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmbedText = vi.fn();
vi.mock('@/lib/llm/embeddings', () => ({
  embedText: (...args: unknown[]) => mockEmbedText(...args),
}));

import {
  resolveSemantically,
  EDGE_AUTO_THRESHOLD,
  EDGE_REVIEW_THRESHOLD,
} from '../semanticEdges';
import type { SuggestedConnection } from '../connectionResolver';

type Match = { id: string; similarity: number };

function makeSupabase(matches: Match[], opts: { existingEdge?: boolean; rpcError?: { message: string } } = {}) {
  const edgeInsert = vi.fn().mockResolvedValue({ error: null });
  const suggestionUpsert = vi.fn().mockResolvedValue({ error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.existingEdge ? { id: 'e1' } : null });
  const supabase = {
    rpc: vi.fn().mockResolvedValue({ data: matches, error: opts.rpcError ?? null }),
    from: vi.fn((table: string) => {
      if (table === 'edges') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) })),
          insert: edgeInsert,
        };
      }
      return { upsert: suggestionUpsert };
    }),
    _edgeInsert: edgeInsert,
    _suggestionUpsert: suggestionUpsert,
  };
  return supabase;
}

const SUGGESTION: SuggestedConnection = {
  target_title: 'Formation capital strategy',
  edge_type: 'supports',
  rationale: 'Directly supports',
};

describe('resolveSemantically', () => {
  beforeEach(() => { vi.clearAllMocks(); mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]); });

  it('auto-creates an edge when the top match is at/above the auto threshold', async () => {
    const supabase = makeSupabase([{ id: 'target', similarity: 0.9 }]);
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase._edgeInsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: 'src', target_id: 'target', edge_type: 'supports', weight: 0.9 }),
    );
    expect(supabase._suggestionUpsert).not.toHaveBeenCalled();
  });

  it('records a review suggestion when the top match is in the review band', async () => {
    const supabase = makeSupabase([{ id: 'target', similarity: 0.72 }]);
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase._suggestionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: 'src', target_id: 'target', edge_type: 'supports', status: 'open' }),
      expect.objectContaining({ onConflict: 'source_id,target_id,edge_type' }),
    );
    expect(supabase._edgeInsert).not.toHaveBeenCalled();
  });

  it('drops the suggestion when the top match is below the review threshold', async () => {
    const supabase = makeSupabase([{ id: 'target', similarity: 0.4 }]);
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase._edgeInsert).not.toHaveBeenCalled();
    expect(supabase._suggestionUpsert).not.toHaveBeenCalled();
  });

  it('ignores the source node itself in the matches', async () => {
    const supabase = makeSupabase([{ id: 'src', similarity: 0.99 }]);
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase._edgeInsert).not.toHaveBeenCalled();
    expect(supabase._suggestionUpsert).not.toHaveBeenCalled();
  });

  it('skips when an edge for the pair+type already exists', async () => {
    const supabase = makeSupabase([{ id: 'target', similarity: 0.9 }], { existingEdge: true });
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase._edgeInsert).not.toHaveBeenCalled();
  });

  it('no-ops (no rpc) when embeddings are unavailable', async () => {
    mockEmbedText.mockResolvedValue(null);
    const supabase = makeSupabase([{ id: 'target', similarity: 0.9 }]);
    await resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('is non-fatal on an rpc error', async () => {
    const supabase = makeSupabase([], { rpcError: { message: 'boom' } });
    await expect(resolveSemantically('src', [SUGGESTION], supabase as never, 'user-1')).resolves.toBeUndefined();
    expect(supabase._edgeInsert).not.toHaveBeenCalled();
  });

  it('orders thresholds sanely', () => {
    expect(EDGE_REVIEW_THRESHOLD).toBeGreaterThan(0);
    expect(EDGE_REVIEW_THRESHOLD).toBeLessThan(EDGE_AUTO_THRESHOLD);
    expect(EDGE_AUTO_THRESHOLD).toBeLessThan(1);
  });
});
