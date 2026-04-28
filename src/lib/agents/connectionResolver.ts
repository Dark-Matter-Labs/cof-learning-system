import type { SupabaseClient } from '@supabase/supabase-js';

export interface SuggestedConnection {
  readonly target_title: string;
  readonly edge_type: string;
  readonly rationale: string;
}

export async function resolveConnections(
  sourceNodeId: string,
  suggestions: ReadonlyArray<SuggestedConnection>,
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  if (!suggestions.length) return 0;

  let created = 0;

  for (const suggestion of suggestions) {
    if (!suggestion.target_title?.trim()) continue;

    const { data: match } = await supabase
      .from('nodes')
      .select('id')
      .ilike('title', suggestion.target_title.trim())
      .neq('id', sourceNodeId)
      .in('status', ['promoted', 'human_reviewed', 'llm_reviewed'])
      .limit(1)
      .maybeSingle();

    if (!match) continue;

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

    if (!error) created++;
  }

  return created;
}
