import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cosine-similarity bar for treating two nodes as possible duplicates. Voyage
 * embeddings put genuine near-duplicates well above this; tune as needed.
 */
export const DUP_SIMILARITY_THRESHOLD = 0.88;

interface MatchRow {
  readonly id: string;
  readonly similarity: number;
}

/**
 * Given a freshly-embedded node, finds its nearest *other* vetted node via the
 * match_nodes RPC and, if similar enough, records an open `duplicate_candidates`
 * row (node_id = the new/likely-duplicate, similar_node_id = the existing
 * original). Surfaced in the Review inbox. Non-fatal — never throws.
 */
export async function findAndRecordDuplicate(
  supabase: SupabaseClient,
  nodeId: string,
  embedding: number[],
): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('match_nodes', {
      query_embedding: embedding,
      match_count: 5,
    });
    if (error) {
      console.error('[dedup] match_nodes failed:', error.message);
      return;
    }

    const top = ((data ?? []) as MatchRow[])
      .filter(m => m.id !== nodeId)
      .sort((a, b) => b.similarity - a.similarity)[0];

    if (!top || top.similarity < DUP_SIMILARITY_THRESHOLD) return;

    await supabase.from('duplicate_candidates').upsert(
      {
        node_id: nodeId,
        similar_node_id: top.id,
        similarity: top.similarity,
        status: 'open',
      },
      { onConflict: 'node_id,similar_node_id' },
    );
  } catch (err) {
    console.error('[dedup] detection failed for', nodeId, err);
  }
}
