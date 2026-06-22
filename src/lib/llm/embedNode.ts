import type { SupabaseClient } from '@supabase/supabase-js';
import { embedText, contentHashForNode, EMBEDDING_MODEL } from './embeddings';
import { findAndRecordDuplicate } from './dedup';

export interface EmbeddableNode {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
}

/**
 * Embeds a node's title + description and upserts it into `node_embeddings`.
 * Skips the (paid) embed call when the stored `content_hash` is unchanged.
 * Returns the embedding it stored, or `null` when skipped/unavailable (so
 * callers can chain dedup detection without a re-read). Fully non-fatal — a
 * missing key, embed failure, or DB error never throws.
 */
export async function upsertNodeEmbedding(
  supabase: SupabaseClient,
  node: EmbeddableNode,
): Promise<number[] | null> {
  try {
    const text = `${node.title}\n${node.description ?? ''}`.trim();
    if (!text) return null;

    const hash = contentHashForNode(node.title, node.description);
    const { data: existing } = await supabase
      .from('node_embeddings')
      .select('content_hash')
      .eq('node_id', node.id)
      .maybeSingle();
    if (existing?.content_hash === hash) return null;

    const embedding = await embedText(text, 'document');
    if (!embedding) return null;

    await supabase.from('node_embeddings').upsert({
      node_id: node.id,
      embedding,
      model: EMBEDDING_MODEL,
      content_hash: hash,
      updated_at: new Date().toISOString(),
    });
    return embedding;
  } catch (err) {
    console.error('[embedNode] upsert failed for', node.id, err);
    return null;
  }
}

/**
 * Embeds + indexes a node, then checks it against the vector index for a
 * near-duplicate (recording a `duplicate_candidates` row if found). Only runs
 * dedup when a fresh embedding was produced (i.e. content changed). Non-fatal.
 */
export async function indexNode(supabase: SupabaseClient, node: EmbeddableNode): Promise<void> {
  const embedding = await upsertNodeEmbedding(supabase, node);
  if (embedding) {
    await findAndRecordDuplicate(supabase, node.id, embedding);
  }
}
