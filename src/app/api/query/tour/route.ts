import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const { data: nodesData, error: dbError } = await supabase
    .from('nodes')
    .select('id, node_type, title, description, status')
    .neq('status', 'archived');

  if (dbError) {
    return Response.json({ error: 'Failed to load graph data' }, { status: 500 });
  }

  const nodes = (nodesData ?? []) as QuerySerializedNode[];

  if (nodes.length === 0) {
    return Response.json(EMPTY_TOUR);
  }

  const serialized = serializeNodesForQuery(nodes);
  const prompt = buildTourPrompt(serialized);

  const anthropic = new Anthropic({ apiKey });

  let message: Awaited<ReturnType<typeof anthropic.messages.create>>;
  try {
    message = await anthropic.messages.create({
      model: process.env.QUERY_LLM_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch {
    return Response.json({ error: 'Failed to generate tour' }, { status: 500 });
  }

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock) {
    return Response.json({ error: 'Failed to generate tour' }, { status: 500 });
  }

  try {
    const extracted = extractJsonObject(textBlock.text);
    const tour = JSON.parse(extracted) as TourResponse;
    if (!isValidTourResponse(tour)) {
      return Response.json({ error: 'Failed to parse tour response' }, { status: 500 });
    }
    return Response.json(tour);
  } catch {
    return Response.json({ error: 'Failed to parse tour response' }, { status: 500 });
  }
}
