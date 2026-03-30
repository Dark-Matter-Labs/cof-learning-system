import { createClient } from '@/lib/supabase/server';
import { computeConvergenceScore } from '@/lib/graph/convergence';
import { NextResponse } from 'next/server';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { goal_space_id, all } = body as { goal_space_id?: string; all?: boolean };

    if (!goal_space_id && all !== true) {
      return NextResponse.json(
        { error: 'Provide goal_space_id or { all: true }' },
        { status: 400 }
      );
    }

    // Fetch all graph data in parallel
    const [{ data: nodesData }, { data: edgesData }] = await Promise.all([
      supabase.from('nodes').select('*').neq('status', 'archived'),
      supabase.from('edges').select('*'),
    ]);
    const nodes = (nodesData ?? []) as Node[];
    const edges = (edgesData ?? []) as Edge[];

    // Determine which goal space IDs to compute
    let goalSpaceIds: string[];
    if (all === true) {
      goalSpaceIds = nodes
        .filter(n => n.node_type === 'goal_space' && n.status !== 'archived')
        .map(n => n.id);
    } else {
      goalSpaceIds = [goal_space_id!];
    }

    if (goalSpaceIds.length === 0) {
      return NextResponse.json({ data: { snapshots: [] } });
    }

    // Count promoted + human_reviewed nodes for node_count_at_snapshot
    const qualifiedNodeCount = nodes.filter(
      n => n.status === 'promoted' || n.status === 'human_reviewed'
    ).length;

    // Compute and insert a snapshot for each goal space
    const snapshots: Array<{ id: string; goal_space_id: string; score: number }> = [];

    for (const gsId of goalSpaceIds) {
      const result = computeConvergenceScore(gsId, edges, nodes);
      const { data: snapshot, error: insertError } = await supabase
        .from('convergence_snapshots')
        .insert({
          goal_space_id: gsId,
          score: result.score,
          factor_breakdown: result.factor_breakdown,
          node_count_at_snapshot: qualifiedNodeCount,
        })
        .select('id, goal_space_id, score')
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      snapshots.push(snapshot);
    }

    // Log activity for each snapshot (fire-and-forget, non-blocking)
    await Promise.all(
      snapshots.map(s =>
        supabase.from('activity_log').insert({
          actor_id: user.id,
          action: 'convergence_snapshot',
          target_node_id: s.goal_space_id,
          details: { score: s.score, trigger: 'on_demand' },
        })
      )
    );

    return NextResponse.json({ data: { snapshots } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
