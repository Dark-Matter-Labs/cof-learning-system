import type { SupabaseClient } from '@supabase/supabase-js';
import { embedText, contentHashForNode, EMBEDDING_MODEL } from './embeddings';

export interface EmbeddableNode {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
}

/**
 * Embeds a node's title + description and upserts it into `node_embeddings`.
 * Skips the (paid) embed call when the stored `content_hash` is unchanged.
 * Fully non-fatal — a missing key, embed failure, or DB error never throws, so
 * callers can fire this without guarding the promote/edit path it hooks into.
 */
export async function upsertNodeEmbedding(supabase: SupabaseClient, node: EmbeddableNode): Promise<void> {
  try {
    const text = `${node.title}\n${node.description ?? ''}`.trim();
    if (!text) return;

    const hash = contentHashForNode(node.title, node.description);
    const { data: existing } = await supabase
      .from('node_embeddings')
      .select('content_hash')
      .eq('node_id', node.id)
      .maybeSingle();
    if (existing?.content_hash === hash) return;

    const embedding = await embedText(text, 'document');
    if (!embedding) return;

    await supabase.from('node_embeddings').upsert({
      node_id: node.id,
      embedding,
      model: EMBEDDING_MODEL,
      content_hash: hash,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[embedNode] upsert failed for', node.id, err);
  }
}
