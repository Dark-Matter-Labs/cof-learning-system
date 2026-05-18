import { createClient } from '@/lib/supabase/server';
import { callLLM } from '@/lib/llm';
import { serializeNodesForQuery, buildTourPrompt } from '@/lib/agents/query';
import type { TourResponse, TourChapter, QuerySerializedNode } from '@/lib/agents/query';
import { extractJsonObject } from '@/lib/utils/json';

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
    return Response.json(EMPTY_TOUR);
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
    const extracted = extractJsonObject(llmText);
    const parsed = JSON.parse(extracted) as unknown;
    const tour = normalizeTour(parsed);
    if (!tour) {
      console.error('[tour] Invalid tour structure after normalize. Raw (200):', llmText.slice(0, 200));
      return Response.json({ error: 'Failed to parse tour response' }, { status: 500 });
    }
    return Response.json(tour);
  } catch (err) {
    console.error('[tour] JSON parse failed:', err, '| raw (200):', llmText.slice(0, 200));
    return Response.json({ error: 'Failed to parse tour response' }, { status: 500 });
  }
}
