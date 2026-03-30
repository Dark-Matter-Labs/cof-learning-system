import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { FactorBreakdown } from '@/lib/graph/convergence';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const goalSpaceId = searchParams.get('goal_space_id');

    if (!goalSpaceId) {
      return NextResponse.json({ error: 'goal_space_id required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query 1: Latest snapshot (for badge + breakdown)
    const { data: latestRow } = await supabase
      .from('convergence_snapshots')
      .select('score, factor_breakdown, computed_at')
      .eq('goal_space_id', goalSpaceId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const latest = latestRow
      ? {
          score: latestRow.score as number,
          factor_breakdown: latestRow.factor_breakdown as FactorBreakdown,
          computed_at: latestRow.computed_at as string,
        }
      : null;

    // Query 2: Configurable history window (for sparkline — lean, no factor_breakdown)
    const daysParam = searchParams.get('days');
    const days = Math.min(90, Math.max(1, parseInt(daysParam ?? '30', 10)));
    const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: historyRows } = await supabase
      .from('convergence_snapshots')
      .select('score, computed_at')
      .eq('goal_space_id', goalSpaceId)
      .gte('computed_at', windowStart)
      .order('computed_at', { ascending: true });

    const history = (historyRows ?? []).map(row => ({
      score: row.score as number,
      computed_at: row.computed_at as string,
    }));

    return NextResponse.json({ data: { latest, history } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
