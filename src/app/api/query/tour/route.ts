import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { serializeNodesForQuery, buildTourPrompt } from '@/lib/agents/query';
import type { TourResponse, QuerySerializedNode } from '@/lib/agents/query';

const EMPTY_TOUR: TourResponse = {
  chapters: [
    { title: 'Our goals', narrative: 'No goal spaces have been captured yet. Start by adding content in the Capture page.', nodeIds: [] },
    { title: 'Key assumptions', narrative: 'Nothing here yet.', nodeIds: [] },
    { title: "What we're testing", narrative: 'Nothing here yet.', nodeIds: [] },
    { title: "What we've learned", narrative: 'Nothing here yet.', nodeIds: [] },
    { title: 'Where attention is needed', narrative: 'Nothing here yet.', nodeIds: [] },
  ],
};

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

  const { data: nodesData } = await supabase
    .from('nodes')
    .select('id, node_type, title, description, status')
    .neq('status', 'archived');

  const nodes = (nodesData ?? []) as QuerySerializedNode[];

  if (nodes.length === 0) {
    return Response.json(EMPTY_TOUR);
  }

  const serialized = serializeNodesForQuery(nodes);
  const prompt = buildTourPrompt(serialized);

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: process.env.QUERY_LLM_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return Response.json({ error: 'Failed to generate tour' }, { status: 500 });
  }

  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const tour = JSON.parse(jsonMatch[0]) as TourResponse;
    return Response.json(tour);
  } catch {
    return Response.json({ error: 'Failed to parse tour response' }, { status: 500 });
  }
}
