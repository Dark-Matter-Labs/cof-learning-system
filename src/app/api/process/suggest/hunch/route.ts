import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { suggestHunch } from '@/lib/agents/process';
import type { Node } from '@/lib/types/nodes';
import type { GoalContext } from '@/lib/agents/extraction';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sourceNodeId } = body;
  if (!sourceNodeId || typeof sourceNodeId !== 'string') {
    return NextResponse.json({ error: 'sourceNodeId is required' }, { status: 400 });
  }

  const { data: sourceNode, error: sourceError } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', sourceNodeId)
    .single();

  if (sourceError || !sourceNode) {
    return NextResponse.json({ error: 'Source node not found' }, { status: 404 });
  }

  const typedSource = sourceNode as Node;

  // Fetch goal context
  const [goalSpacesResult, triggerOutcomesResult, personNodesResult] = await Promise.all([
    supabase.from('nodes').select('id, title').eq('node_type', 'goal_space').eq('status', 'promoted'),
    supabase.from('nodes').select('id, title').eq('node_type', 'trigger_outcome').eq('status', 'promoted'),
    supabase.from('nodes').select('id, title').eq('node_type', 'entity').eq('status', 'promoted'),
  ]);

  const goalContext: GoalContext = {
    goalSpaces: (goalSpacesResult.data ?? []) as { id: string; title: string }[],
    triggerOutcomes: (triggerOutcomesResult.data ?? []) as { id: string; title: string }[],
    personNodes: (personNodesResult.data ?? []) as { id: string; title: string }[],
  };

  try {
    const suggestion = await suggestHunch(typedSource, goalContext);
    return NextResponse.json({ data: suggestion });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'LLM call failed' },
      { status: 500 }
    );
  }
}
