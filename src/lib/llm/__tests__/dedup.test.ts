import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findAndRecordDuplicate, DUP_SIMILARITY_THRESHOLD } from '../dedup';

type Match = { id: string; similarity: number };

function makeSupabase(matches: Match[], rpcError: { message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const supabase = {
    rpc: vi.fn().mockResolvedValue({ data: matches, error: rpcError }),
    from: vi.fn(() => ({ upsert })),
    _upsert: upsert,
  };
  return supabase;
}

// 'learning' is in the matchable set; 'person' is not.
const LEARNING = { id: 'self', node_type: 'learning' };

describe('findAndRecordDuplicate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('records the top non-self match when above threshold', async () => {
    const supabase = makeSupabase([
      { id: 'self', similarity: 1 },
      { id: 'other', similarity: 0.92 },
    ]);
    await findAndRecordDuplicate(supabase as never, LEARNING, [0.1, 0.2]);
    expect(supabase._upsert).toHaveBeenCalledWith(
      expect.objectContaining({ node_id: 'self', similar_node_id: 'other', status: 'open' }),
      expect.objectContaining({ onConflict: 'node_id,similar_node_id' }),
    );
  });

  it('scopes the match to the same node_type via allowed_types', async () => {
    const supabase = makeSupabase([{ id: 'self', similarity: 1 }, { id: 'other', similarity: 0.92 }]);
    await findAndRecordDuplicate(supabase as never, LEARNING, [0.1]);
    expect(supabase.rpc).toHaveBeenCalledWith('match_nodes', expect.objectContaining({
      allowed_types: ['learning'],
    }));
  });

  it('skips entirely (no rpc) when the source node_type is not matchable', async () => {
    const supabase = makeSupabase([{ id: 'self', similarity: 1 }, { id: 'other', similarity: 0.99 }]);
    await findAndRecordDuplicate(supabase as never, { id: 'self', node_type: 'person' }, [0.1]);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('records nothing when the best non-self match is below threshold', async () => {
    const supabase = makeSupabase([{ id: 'self', similarity: 1 }, { id: 'other', similarity: 0.5 }]);
    await findAndRecordDuplicate(supabase as never, LEARNING, [0.1]);
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('records nothing when only the node itself comes back', async () => {
    const supabase = makeSupabase([{ id: 'self', similarity: 1 }]);
    await findAndRecordDuplicate(supabase as never, LEARNING, [0.1]);
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('is non-fatal on an rpc error', async () => {
    const supabase = makeSupabase([], { message: 'boom' });
    await expect(findAndRecordDuplicate(supabase as never, LEARNING, [0.1])).resolves.toBeUndefined();
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('uses a threshold strictly below 1 (real near-dupes, not just identical)', () => {
    expect(DUP_SIMILARITY_THRESHOLD).toBeGreaterThan(0.5);
    expect(DUP_SIMILARITY_THRESHOLD).toBeLessThan(1);
  });
});
