import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
}
