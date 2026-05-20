import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;
import {
  buildReflectionPrompt,
  parseReflectionResponse,
  REFLECTION_SYSTEM_PROMPT,
  type ReflectionContext,
} from '@/lib/agents/reflection';

export async function POST(_request: Request): Promise<Response> {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit check: has reflection run in last 24 hours?
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('reflection_sessions')
    .select('id', { count: 'exact', head: true })
    .gt('created_at', cutoff);
  if ((count ?? 0) > 0) {
    return Response.json(
      { error: 'Reflection already run in the last 24 hours' },
      { status: 429 }
    );
  }

  // Context assembly — all queries in parallel before stream creation
  const [
    { data: nodesData },
    { data: tensionsData },
    { data: snapshotsData },
  ] = await Promise.all([
    supabase
      .from('nodes')
      .select('id, title, node_type, status, description, author_id')
      .neq('status', 'archived'),
    supabase
      .from('tension_alerts')
      .select('type, severity, description')
      .eq('status', 'active'),
    supabase
      .from('convergence_snapshots')
      .select('goal_space_id, score, computed_at')
      .order('computed_at', { ascending: false })
      .limit(50),
  ]);

  const nodes = nodesData ?? [];
  const activeTensions = (tensionsData ?? []) as Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  const convergenceSnapshots = (snapshotsData ?? []) as Array<{
    goal_space_id: string;
    score: number;
    computed_at: string;
  }>;

  // Derive context from query results
  const goalSpaces = nodes
    .filter(n => n.node_type === 'goal_space')
    .map(n => ({ id: n.id, title: n.title }));

  const triggerOutcomes = nodes
    .filter(n => n.node_type === 'trigger_outcome')
    .map(n => ({ id: n.id, title: n.title, goal_space_id: '' }));

  // activityByAuthor derived from nodes grouped by author_id
  const activityByAuthor = Object.entries(
    nodes.reduce((acc: Record<string, number>, n) => {
      if (n.author_id) {
        acc[n.author_id] = (acc[n.author_id] || 0) + 1;
      }
      return acc;
    }, {})
  ).map(([author_id, node_count]) => ({ author_id, node_count }));

  const ctx: ReflectionContext = {
    goalSpaces,
    triggerOutcomes,
    nodes,
    convergenceSnapshots,
    activeTensions,
    activityByAuthor,
  };

  const prompt = buildReflectionPrompt(ctx);
  const nodeCount = nodes.length;

  // Create streaming response
  const encoder = new TextEncoder();
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      const messageStream = anthropic.messages.stream({
        model: process.env.REFLECTION_LLM_MODEL ?? 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: REFLECTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      let fullContent = '';
      for await (const chunk of messageStream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          fullContent += chunk.delta.text;
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }

      // Persist after stream completes — parse/persist failure must not break stream
      try {
        const parsed = parseReflectionResponse(fullContent);
        await supabase.from('reflection_sessions').insert({
          machine_reflection: parsed,
          node_count_at_reflection: nodeCount,
          triggered_by: 'on_demand',
          run_by: user.id,
        });
      } catch {
        // Intentionally silent — stream already delivered to client
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  });
}
