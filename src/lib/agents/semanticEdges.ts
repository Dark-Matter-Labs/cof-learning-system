import type { SupabaseClient } from '@supabase/supabase-js';
import { embedText } from '@/lib/llm/embeddings';
import type { SuggestedConnection } from './connectionResolver';

/** Auto-create an edge at/above this cosine similarity. */
export const EDGE_AUTO_THRESHOLD = 0.80;
/** Between this and the auto threshold → surface for review; below → drop. */
export const EDGE_REVIEW_THRESHOLD = 0.65;

interface MatchRow {
  readonly id: string;
  readonly similarity: number;
}

/**
 * For each connection suggestion the exact-title resolver could not place,
 * embed the target title and find its nearest vetted node via match_nodes.
 * Tier the top hit: auto-create an edge (>= AUTO), record an open
 * edge_suggestions row (REVIEW..AUTO), or drop (< REVIEW). Intended to run
 * async via after(); non-fatal — never throws, no-ops when embeddings are
 * unavailable.
 */
export async function resolveSemantically(
  sourceId: string,
  suggestions: ReadonlyArray<SuggestedConnection>,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  for (const suggestion of suggestions) {
    try {
      const title = suggestion.target_title?.trim();
      if (!title) continue;

      const embedding = await embedText(title, 'query');
      if (!embedding) continue;

      const { data, error } = await supabase.rpc('match_nodes', {
        query_embedding: embedding,
        match_count: 5,
      });
      if (error) {
        console.error('[semanticEdges] match_nodes failed:', error.message);
        continue;
      }

      const top = ((data ?? []) as MatchRow[])
        .filter(m => m.id !== sourceId)
        .sort((a, b) => b.similarity - a.similarity)[0];
      if (!top || top.similarity < EDGE_REVIEW_THRESHOLD) continue;

      const { data: existing } = await supabase
        .from('edges')
        .select('id')
        .eq('source_id', sourceId)
        .eq('target_id', top.id)
        .eq('edge_type', suggestion.edge_type)
        .maybeSingle();
      if (existing) continue;

      const tier = top.similarity >= EDGE_AUTO_THRESHOLD ? 'auto' : 'review';
      console.error(
        `[semanticEdges] "${title}" -> ${top.id} sim=${top.similarity.toFixed(3)} tier=${tier}`,
      );

      if (tier === 'auto') {
        await supabase.from('edges').insert({
          source_id: sourceId,
          target_id: top.id,
          edge_type: suggestion.edge_type,
          weight: top.similarity,
          author_id: userId,
        });
      } else {
        await supabase.from('edge_suggestions').upsert(
          {
            source_id: sourceId,
            target_id: top.id,
            edge_type: suggestion.edge_type,
            rationale: suggestion.rationale ?? null,
            similarity: top.similarity,
            status: 'open',
          },
          { onConflict: 'source_id,target_id,edge_type' },
        );
      }
    } catch (err) {
      console.error('[semanticEdges] failed for', suggestion.target_title, err);
    }
  }
}
