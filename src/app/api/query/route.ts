import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { buildQuerySystemPrompt, serializeNodesForQuery } from '@/lib/agents/query';
import type { QuerySerializedNode } from '@/lib/agents/query';

const QueryBodySchema = z.object({
  query: z.string().trim().min(1, 'Query is required').max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(32000),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

interface EdgeRow {
  source_id: string;
  target_id: string;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof QueryBodySchema>;
  try {
    const raw = await request.json();
    const parsed = QueryBodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { query, history } = body;

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, background')
    .eq('id', user.id)
    .single();

  const userBackground = profile?.background ?? undefined;
  const userName = profile?.name ?? undefined;

  const [{ data: nodesData }, { data: edgesData }] = await Promise.all([
    supabase.from('nodes').select('id, node_type, title, description, status').neq('status', 'archived'),
    supabase.from('edges').select('source_id, target_id'),
  ]);

  const allNodes = (nodesData ?? []) as QuerySerializedNode[];
  const allEdges = (edgesData ?? []) as EdgeRow[];

  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const matchingIds = new Set<string>(
    allNodes
      .filter(n => {
        const text = `${n.title} ${n.description ?? ''}`.toLowerCase();
        return searchTerms.length === 0 || searchTerms.some(term => text.includes(term));
      })
      .map(n => n.id)
  );

  const expandedIds = new Set<string>(matchingIds);
  for (const edge of allEdges) {
    if (matchingIds.has(edge.source_id)) expandedIds.add(edge.target_id);
    if (matchingIds.has(edge.target_id)) expandedIds.add(edge.source_id);
  }

  const contextNodes = allNodes.filter(n => expandedIds.has(n.id));
  const contextNodeIds = contextNodes.map(n => n.id);
  const serialized = serializeNodesForQuery(contextNodes);

  const systemPrompt = buildQuerySystemPrompt(userBackground, userName);
  const contextMessage = serialized
    ? `Knowledge graph context:\n${serialized}\n\nAnswer the following question:`
    : 'Answer the following question (the knowledge graph is currently empty):';

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history,
    { role: 'user', content: `${contextMessage}\n\n${query}` },
  ];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const anthropic = new Anthropic({ apiKey });
  const sessionId = crypto.randomUUID();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: process.env.QUERY_LLM_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        let accumulatedResponse = '';
        for await (const chunk of messageStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            accumulatedResponse += chunk.delta.text;
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        await supabase.from('query_sessions').insert({
          id: sessionId,
          author_id: user.id,
          query_text: query,
          response: accumulatedResponse,
          node_refs: contextNodeIds,
        });

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Context-Nodes': JSON.stringify(contextNodeIds),
      'X-Query-Session-Id': sessionId,
    },
  });
}
