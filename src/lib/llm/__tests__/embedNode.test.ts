import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmbedText = vi.fn();
vi.mock('../embeddings', async (orig) => ({
  ...(await orig<typeof import('../embeddings')>()),
  embedText: (...args: unknown[]) => mockEmbedText(...args),
}));

const mockFindDup = vi.fn();
vi.mock('../dedup', () => ({
  findAndRecordDuplicate: (...args: unknown[]) => mockFindDup(...args),
  DUP_SIMILARITY_THRESHOLD: 0.88,
}));

import { upsertNodeEmbedding, indexNode } from '../embedNode';
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
    const node = { id: 'n1', title: 'T', description: 'd', node_type: 'learning' };
    const supabase = makeSupabase(contentHashForNode(node.title, node.description));
    await upsertNodeEmbedding(supabase as never, node);
    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('embeds and upserts when content changed, returning the embedding', async () => {
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
    const node = { id: 'n1', title: 'T', description: 'new', node_type: 'learning' };
    const supabase = makeSupabase('stale-hash');
    const result = await upsertNodeEmbedding(supabase as never, node);
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockEmbedText).toHaveBeenCalledOnce();
    expect(supabase._upsert).toHaveBeenCalledWith(expect.objectContaining({
      node_id: 'n1',
      embedding: [0.1, 0.2, 0.3],
      model: 'voyage-3.5',
    }));
  });

  it('returns null when the content hash is unchanged', async () => {
    const node = { id: 'n1', title: 'T', description: 'd', node_type: 'learning' };
    const supabase = makeSupabase(contentHashForNode(node.title, node.description));
    expect(await upsertNodeEmbedding(supabase as never, node)).toBeNull();
  });

  it('does not upsert when the embedding is unavailable (null)', async () => {
    mockEmbedText.mockResolvedValue(null);
    const supabase = makeSupabase(null);
    await upsertNodeEmbedding(supabase as never, { id: 'n1', title: 'T', description: 'd', node_type: 'learning' });
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it('no-ops on empty content without embedding', async () => {
    const supabase = makeSupabase(null);
    await upsertNodeEmbedding(supabase as never, { id: 'n1', title: '', description: null, node_type: 'learning' });
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
    await expect(upsertNodeEmbedding(supabase as never, { id: 'n1', title: 'T', description: 'd', node_type: 'learning' })).resolves.toBeNull();
  });
});

describe('indexNode', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('runs dedup detection when a fresh embedding was produced', async () => {
    mockEmbedText.mockResolvedValue([0.5, 0.6]);
    const supabase = makeSupabase('stale-hash');
    await indexNode(supabase as never, { id: 'n1', title: 'T', description: 'new', node_type: 'learning' });
    expect(mockFindDup).toHaveBeenCalledWith(supabase, { id: 'n1', node_type: 'learning' }, [0.5, 0.6]);
  });

  it('skips dedup detection when the embedding was skipped (unchanged content)', async () => {
    const node = { id: 'n1', title: 'T', description: 'd', node_type: 'learning' };
    const supabase = makeSupabase(contentHashForNode(node.title, node.description));
    await indexNode(supabase as never, node);
    expect(mockFindDup).not.toHaveBeenCalled();
  });
});
