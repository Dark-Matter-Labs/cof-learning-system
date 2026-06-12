import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { callLLM } from '@/lib/llm';

export const maxDuration = 300;
import { serializeNodesForQuery, buildTourPrompt } from '@/lib/agents/query';
import type { TourResponse, TourChapter, QuerySerializedNode } from '@/lib/agents/query';
import { parseLlmJsonLoose } from '@/lib/llm/parse';

const EMPTY_TOUR: TourResponse = {
  chapters: [
    { title: 'Our goals', narrative: 'No goal spaces have been captured yet. Start by adding content in the Capture page.', nodeIds: [] },
    { title: 'Key assumptions', narrative: 'Nothing here yet.', nodeIds: [] },
    { title: "What we're testing", narrative: 'Nothing here yet.', nodeIds: [] },
    { title: "What we've learned", narrative: 'Nothing here yet.', nodeIds: [] },
    { title: 'Where attention is needed', narrative: 'Nothing here yet.', nodeIds: [] },
  ],
};

/**
 * Coerces a parsed LLM response into a valid TourResponse, tolerating omitted
 * or wrongly-typed fields (e.g. missing nodeIds, extra keys, null values).
 * Returns null if the shape is unrecognisably wrong.
 */
function normalizeTour(v: unknown): TourResponse | null {
  if (!v || typeof v !== 'object') return null;
  const raw = v as Record<string, unknown>;
  if (!Array.isArray(raw.chapters) || raw.chapters.length === 0) return null;

  const chapters: TourChapter[] = [];
  for (const ch of raw.chapters as unknown[]) {
    if (!ch || typeof ch !== 'object') return null;
    const c = ch as Record<string, unknown>;
    const title = typeof c.title === 'string' ? c.title : '';
    const narrative = typeof c.narrative === 'string' ? c.narrative : '';
    const nodeIds: string[] = Array.isArray(c.nodeIds)
      ? (c.nodeIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];
    if (!title) return null;
    chapters.push({ title, narrative, nodeIds });
  }

  return chapters.length > 0 ? { chapters } : null;
}

export async function GET(_request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('guided_tour, guided_tour_generated_at')
    .eq('id', user.id)
    .single();

  if (!profile?.guided_tour) {
    return Response.json({ tour: null, generatedAt: null });
  }

  return Response.json({ tour: profile.guided_tour, generatedAt: profile.guided_tour_generated_at });
}

export async function POST(_request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: nodesData, error: dbError } = await supabase
    .from('nodes')
    .select('id, node_type, title, description, status')
    .neq('status', 'archived');

  if (dbError) {
    console.error('[tour] DB error fetching nodes:', dbError);
    return Response.json({ error: 'Failed to load graph data' }, { status: 500 });
  }

  const nodes = (nodesData ?? []) as QuerySerializedNode[];

  if (nodes.length === 0) {
    return Response.json({ tour: EMPTY_TOUR, generatedAt: null });
  }

  const serialized = serializeNodesForQuery(nodes);
  const prompt = buildTourPrompt(serialized);

  let llmText: string;
  try {
    const response = await callLLM('query', {
      systemPrompt: 'You are a knowledge graph assistant. Return only valid JSON with no commentary.',
      userMessage: prompt,
      maxTokens: 4096,
    });
    llmText = response.content;
  } catch (err) {
    console.error('[tour] LLM call failed:', err);
    return Response.json({ error: 'Failed to generate tour' }, { status: 500 });
  }

  try {
    const parsed = parseLlmJsonLoose(llmText);
    const tour = normalizeTour(parsed);
    if (!tour) {
      console.error('[tour] Invalid tour structure after normalize. Raw (200):', llmText.slice(0, 200));
      return Response.json({ error: 'Failed to parse tour response' }, { status: 500 });
    }

    const generatedAt = new Date().toISOString();
    const adminClient = createAdminClient();
    const { error: saveError } = await adminClient.from('profiles').upsert({
      id: user.id,
      guided_tour: tour,
      guided_tour_generated_at: generatedAt,
    });
    if (saveError) console.error('[tour] Failed to cache tour:', saveError);

    return Response.json({ tour, generatedAt });
  } catch (err) {
    console.error('[tour] JSON parse failed:', err, '| raw (200):', llmText.slice(0, 200));
    return Response.json({ error: 'Failed to parse tour response' }, { status: 500 });
  }
}
