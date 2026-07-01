import type { SupabaseClient } from '@supabase/supabase-js';
import { getSemanticMatchableTypes } from '@/lib/config/captureTypes';

/**
 * Cosine-similarity bar for treating two nodes as possible duplicates. Voyage
 * embeddings put genuine near-duplicates well above this; tune as needed.
 */
export const DUP_SIMILARITY_THRESHOLD = 0.88;

interface MatchRow {
  readonly id: string;
  readonly similarity: number;
}

export interface DedupNode {
  readonly id: string;
  readonly node_type: string;
}

/**
 * Given a freshly-embedded node, finds its nearest *same-type* vetted node via
 * the match_nodes RPC and, if similar enough, records an open
 * `duplicate_candidates` row. Only runs for knowledge/claim node types
 * (getSemanticMatchableTypes) — entity/structural nodes (person, site, …) embed
 * near-identically and would produce false positives. Non-fatal — never throws.
 */
export async function findAndRecordDuplicate(
  supabase: SupabaseClient,
  node: DedupNode,
  embedding: number[],
): Promise<void> {
  try {
    if (!getSemanticMatchableTypes().includes(node.node_type)) return;

    const { data, error } = await supabase.rpc('match_nodes', {
      query_embedding: embedding,
      match_count: 5,
      allowed_types: [node.node_type],
    });
    if (error) {
      console.error('[dedup] match_nodes failed:', error.message);
      return;
    }

    const top = ((data ?? []) as MatchRow[])
      .filter(m => m.id !== node.id)
      .sort((a, b) => b.similarity - a.similarity)[0];

    if (!top || top.similarity < DUP_SIMILARITY_THRESHOLD) return;

    await supabase.from('duplicate_candidates').upsert(
      {
        node_id: node.id,
        similar_node_id: top.id,
        similarity: top.similarity,
        status: 'open',
      },
      { onConflict: 'node_id,similar_node_id' },
    );
  } catch (err) {
    console.error('[dedup] detection failed for', node.id, err);
  }
}
