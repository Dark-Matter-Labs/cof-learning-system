import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmbedText = vi.fn();
vi.mock('../embeddings', async (orig) => ({
  ...(await orig<typeof import('../embeddings')>()),
  embedText: (...args: unknown[]) => mockEmbedText(...args),
}));

import { upsertNodeEmbedding } from '../embedNode';
import { contentHashForNode } from '../embeddings';

function makeSupabase(existingHash: string | null) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: existingHash ? { content_hash: existingHash } : null });
  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      upsert,
    })),
    _upsert: upsert,
  };
  return supabase;
}

describe('upsertNodeEmbedding', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('skips embedding + upsert when the content hash is unchanged', async () => {
    const node = { id: 'n1', title: 'T', description: 'd' };
    const supabase = makeSupabase(contentHashForNode(node.title, node.description));
    await upsertNodeEmbedding(supabase as never, node);
    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('embeds and upserts when content changed', async () => {
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
    const node = { id: 'n1', title: 'T', description: 'new' };
    const supabase = makeSupabase('stale-hash');
    await upsertNodeEmbedding(supabase as never, node);
    expect(mockEmbedText).toHaveBeenCalledOnce();
    expect(supabase._upsert).toHaveBeenCalledWith(expect.objectContaining({
      node_id: 'n1',
      embedding: [0.1, 0.2, 0.3],
      model: 'voyage-3.5',
    }));
  });

  it('does not upsert when the embedding is unavailable (null)', async () => {
    mockEmbedText.mockResolvedValue(null);
    const supabase = makeSupabase(null);
    await upsertNodeEmbedding(supabase as never, { id: 'n1', title: 'T', description: 'd' });
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('no-ops on empty content without embedding', async () => {
    const supabase = makeSupabase(null);
    await upsertNodeEmbedding(supabase as never, { id: 'n1', title: '', description: null });
    expect(mockEmbedText).not.toHaveBeenCalled();
  });

  it('never throws when the DB call rejects', async () => {
    mockEmbedText.mockResolvedValue([1, 2]);
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockRejectedValue(new Error('db down')) })) })),
        upsert: vi.fn(),
      })),
    };
    await expect(upsertNodeEmbedding(supabase as never, { id: 'n1', title: 'T', description: 'd' })).resolves.toBeUndefined();
  });
});
