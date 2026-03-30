import { createClient } from '@/lib/supabase/server';
import { runExtraction, type GoalContext } from '@/lib/agents/extraction';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { node_id } = await request.json();

  if (!node_id) {
    return NextResponse.json({ error: 'node_id is required' }, { status: 400 });
  }

  // Set status to processing
  await supabase
    .from('nodes')
    .update({ status: 'processing' })
    .eq('id', node_id);

  try {
    // Fetch the node and goal context in parallel
    const [
      { data: node, error: fetchError },
      { data: goalSpacesData },
      { data: triggerOutcomesData },
    ] = await Promise.all([
      supabase
        .from('nodes')
        .select('title, description')
        .eq('id', node_id)
        .single(),
      supabase
        .from('nodes')
        .select('id, title')
        .eq('node_type', 'goal_space')
        .neq('status', 'archived'),
      supabase
        .from('nodes')
        .select('id, title')
        .eq('node_type', 'trigger_outcome')
        .neq('status', 'archived'),
    ]);

    if (fetchError || !node) {
      throw new Error(`Node not found: ${node_id}`);
    }

    const goalContext: GoalContext = {
      goalSpaces: goalSpacesData ?? [],
      triggerOutcomes: triggerOutcomesData ?? [],
    };

    // Run extraction with goal context
    const extraction = await runExtraction(node.title, node.description ?? '', goalContext);

    // Update node with extraction results
    await supabase
      .from('nodes')
      .update({
        llm_extraction: extraction,
        status: 'llm_reviewed',
      })
      .eq('id', node_id);

    // Log activity
    await supabase.from('activity_log').insert({
      actor_id: user.id,
      action: 'reviewed',
      target_node_id: node_id,
      details: { type: 'llm_extraction', model: 'extraction' },
    });

    return NextResponse.json({ data: { node_id, status: 'llm_reviewed' } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Set error status
    await supabase
      .from('nodes')
      .update({
        status: 'error',
        llm_extraction: { error: errorMessage, failed_at: new Date().toISOString() },
      })
      .eq('id', node_id);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
