import { createClient } from '@/lib/supabase/server';
import { computeConvergenceScore, shouldTriggerSnapshot } from '@/lib/graph/convergence';
import { NextResponse } from 'next/server';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

async function checkAndTriggerSnapshots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<void> {
  try {
    // 1. Count current promoted + human_reviewed nodes
    const { count: currentCount } = await supabase
      .from('nodes')
      .select('*', { count: 'exact', head: true })
      .in('status', ['promoted', 'human_reviewed']);

    if (currentCount === null) return;

    // 2. Get most recent snapshot (any goal space) to find last node_count_at_snapshot
    const { data: lastSnapshot } = await supabase
      .from('convergence_snapshots')
      .select('node_count_at_snapshot')
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    // 3. Use pure function for threshold decision
    if (!shouldTriggerSnapshot({
      currentCount,
      lastSnapshotCount: lastSnapshot?.node_count_at_snapshot ?? null,
    })) return;

    // 4. Fetch all data needed for scoring
    const [{ data: nodesData }, { data: edgesData }] = await Promise.all([
      supabase.from('nodes').select('*').neq('status', 'archived'),
      supabase.from('edges').select('*'),
    ]);
    const nodes = (nodesData ?? []) as Node[];
    const edges = (edgesData ?? []) as Edge[];

    // 5. Find all non-archived goal spaces
    const goalSpaces = nodes.filter(
      n => n.node_type === 'goal_space' && n.status !== 'archived'
    );

    if (goalSpaces.length === 0) return;

    // 6. Compute and insert snapshot for each goal space
    for (const gs of goalSpaces) {
      const result = computeConvergenceScore(gs.id, edges, nodes);
      await supabase.from('convergence_snapshots').insert({
        goal_space_id: gs.id,
        score: result.score,
        factor_breakdown: result.factor_breakdown,
        node_count_at_snapshot: currentCount,
      });
    }

    // 7. Log activity
    await Promise.all(
      goalSpaces.map(gs =>
        supabase.from('activity_log').insert({
          actor_id: userId,
          action: 'convergence_snapshot',
          target_node_id: gs.id,
          details: { trigger: 'threshold', delta: currentCount - (lastSnapshot?.node_count_at_snapshot ?? 0) },
        })
      )
    );
  } catch {
    // Fire-and-forget: convergence snapshot failure must NOT break node creation
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from('nodes')
    .select('*')
    .in('status', ['promoted', 'human_reviewed']);

  const nodeType = searchParams.get('node_type');
  if (nodeType) query = query.eq('node_type', nodeType);

  const authorId = searchParams.get('author_id');
  if (authorId) query = query.eq('author_id', authorId);

  const domain = searchParams.get('domain');
  if (domain) query = query.contains('domain_tags', [domain]);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from('nodes')
    .insert({ ...body, author_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: trigger convergence snapshot if threshold met
  void checkAndTriggerSnapshots(supabase, user.id);

  return NextResponse.json({ data }, { status: 201 });
}
