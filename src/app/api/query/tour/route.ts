import { createClient } from '@/lib/supabase/server';
import { callLLM } from '@/lib/llm';
import { serializeNodesForQuery, buildTourPrompt } from '@/lib/agents/query';
import type { TourResponse, QuerySerializedNode } from '@/lib/agents/query';
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

function isValidTourResponse(v: unknown): v is TourResponse {
  if (!v || typeof v !== 'object') return false;
  const { chapters } = v as Record<string, unknown>;
  if (!Array.isArray(chapters) || chapters.length === 0) return false;
  return (chapters as unknown[]).every(
    ch =>
      ch !== null &&
      typeof ch === 'object' &&
      typeof (ch as Record<string, unknown>).title === 'string' &&
      typeof (ch as Record<string, unknown>).narrative === 'string' &&
      Array.isArray((ch as Record<string, unknown>).nodeIds)
  );
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
      maxTokens: 2048,
    });
    llmText = response.content;
  } catch (err) {
    console.error('[tour] LLM call failed:', err);
    return Response.json({ error: 'Failed to generate tour' }, { status: 500 });
  }

  try {
    const extracted = extractJsonObject(llmText);
    const tour = JSON.parse(extracted) as TourResponse;
    if (!isValidTourResponse(tour)) {
      console.error('[tour] Invalid tour structure:', extracted.slice(0, 200));
      return Response.json({ error: 'Failed to parse tour response' }, { status: 500 });
    }
    return Response.json(tour);
  } catch (err) {
    console.error('[tour] JSON parse failed:', err, 'raw:', llmText.slice(0, 200));
    return Response.json({ error: 'Failed to parse tour response' }, { status: 500 });
  }
}
