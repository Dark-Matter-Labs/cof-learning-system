import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';

export const GET = withAuth(async ({ supabase }) => {
  const nodeTypeGroups = [
    'goal_space',
    'site',
    'option',
    'person',
    'hunch',
    'assumption_background',
    'assumption_foreground',
    'learning',
    'signal',
  ];

  const counts: Record<string, number> = {};
  for (const nodeType of nodeTypeGroups) {
    const { count } = await supabase
      .from('nodes')
      .select('*', { count: 'exact', head: true })
      .eq('node_type', nodeType)
      .neq('status', 'archived');
    counts[nodeType] = count ?? 0;
  }

  const { count: edgeCount } = await supabase
    .from('edges')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({ data: { nodes: counts, edges: edgeCount ?? 0 } }, { status: 200 });
});
