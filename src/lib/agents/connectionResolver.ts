import type { SupabaseClient } from '@supabase/supabase-js';

export interface SuggestedConnection {
  readonly target_title: string;
  readonly edge_type: string;
  readonly rationale: string;
}

export interface ResolveResult {
  readonly created: number;
  readonly unresolved: SuggestedConnection[];
}

const VALID_EDGE_TYPES = new Set([
  'supports', 'contradicts', 'requires', 'evolved_from', 'tested_by',
  'produced', 'connected_to', 'works_at', 'authored_by', 'challenges',
  'mentioned_in', 'advances_goal', 'targets_outcome', 'indicates_progress',
  'assigned_to_outcome',
]);

export async function resolveConnections(
  sourceNodeId: string,
  suggestions: ReadonlyArray<SuggestedConnection>,
  supabase: SupabaseClient,
  userId: string,
): Promise<ResolveResult> {
  const unresolved: SuggestedConnection[] = [];
  if (!suggestions.length) return { created: 0, unresolved };

  let created = 0;

  for (const suggestion of suggestions) {
    if (!suggestion.target_title?.trim()) continue;
    if (!VALID_EDGE_TYPES.has(suggestion.edge_type)) continue;

    const { data: match } = await supabase
      .from('nodes')
      .select('id')
      .ilike('title', suggestion.target_title.trim())
      .neq('id', sourceNodeId)
      .in('status', ['promoted', 'human_reviewed', 'llm_reviewed'])
      .limit(1)
      .maybeSingle();

    if (!match) {
      unresolved.push(suggestion);
      continue;
    }

    const { data: existing } = await supabase
      .from('edges')
      .select('id')
      .eq('source_id', sourceNodeId)
      .eq('target_id', match.id)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from('edges').insert({
      source_id: sourceNodeId,
      target_id: match.id,
      edge_type: suggestion.edge_type,
      weight: 1,
      author_id: userId,
    });

    if (error) {
      process.stderr.write(`[connectionResolver] Edge insert failed (${sourceNodeId} -> ${match.id}, type: ${suggestion.edge_type}): ${error.message}\n`);
    } else {
      created++;
    }
  }

  return { created, unresolved };
}
