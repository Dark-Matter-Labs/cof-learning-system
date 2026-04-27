export type LifecycleStage = 'divergence' | 'attractor' | 'convergence' | 'execution' | 'archived';

export interface HunchStats {
  readonly currentStage: LifecycleStage;
  readonly connectedAssumptions: number;
  readonly connectedTests: number;
  readonly reinforcedEdges: number;
  readonly linkedCommitments: number;
  readonly activeCommitments: number;
  readonly testsWithSignals: number;
}

export interface StageDecision {
  readonly advance: boolean;
  readonly newStage?: LifecycleStage;
  readonly reason?: string;
}

export function evaluateStagePromotion(stats: HunchStats): StageDecision {
  const { currentStage, connectedAssumptions, connectedTests, reinforcedEdges, linkedCommitments, activeCommitments, testsWithSignals } = stats;

  if (currentStage === 'divergence') {
    if (connectedAssumptions >= 2) {
      return { advance: true, newStage: 'attractor', reason: `${connectedAssumptions} assumptions connected` };
    }
    if (connectedTests >= 1) {
      return { advance: true, newStage: 'attractor', reason: `${connectedTests} test(s) linked` };
    }
  }

  if (currentStage === 'attractor') {
    if (reinforcedEdges >= 2 && linkedCommitments >= 1) {
      return { advance: true, newStage: 'convergence', reason: `${reinforcedEdges} reinforced edges, ${linkedCommitments} commitment(s)` };
    }
  }

  if (currentStage === 'convergence') {
    if (activeCommitments >= 1 && testsWithSignals >= 1) {
      return { advance: true, newStage: 'execution', reason: `Active commitment + ${testsWithSignals} test(s) with signals` };
    }
  }

  return { advance: false };
}

export async function checkHunchPromotion(nodeId: string): Promise<StageDecision> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: node } = await supabase
      .from('nodes')
      .select('lifecycle_stage, node_type')
      .eq('id', nodeId)
      .single();

    if (!node || node.node_type !== 'hunch') return { advance: false };

    const { data: edgesFromHunch } = await supabase.from('edges').select('target_id').eq('source_id', nodeId);

    let connectedAssumptions = 0;
    let connectedTests = 0;
    let linkedCommitments = 0;
    let activeCommitments = 0;

    if (edgesFromHunch?.length) {
      const tids = edgesFromHunch.map(e => e.target_id as string);
      const { count: aCount } = await supabase.from('nodes').select('id', { count: 'exact', head: true })
        .in('id', tids).in('node_type', ['assumption_background', 'assumption_foreground']);
      connectedAssumptions = aCount ?? 0;

      const { count: tCount } = await supabase.from('nodes').select('id', { count: 'exact', head: true })
        .in('id', tids).eq('node_type', 'test');
      connectedTests = tCount ?? 0;

      const { data: commitmentRows } = await supabase.from('nodes').select('id, status')
        .in('id', tids).eq('node_type', 'commitment');
      linkedCommitments = commitmentRows?.length ?? 0;
      activeCommitments = commitmentRows?.filter(c => c.status === 'promoted').length ?? 0;
    }

    const { count: reinforcedEdges } = await supabase.from('edges').select('id', { count: 'exact', head: true })
      .eq('source_id', nodeId).eq('path_status', 'reinforced');

    const VALID_STAGES: readonly LifecycleStage[] = ['divergence', 'attractor', 'convergence', 'execution', 'archived'];
    const rawStage = node.lifecycle_stage as string;
    const currentStage: LifecycleStage = VALID_STAGES.includes(rawStage as LifecycleStage) ? (rawStage as LifecycleStage) : 'divergence';

    const stats: HunchStats = {
      currentStage,
      connectedAssumptions,
      connectedTests,
      reinforcedEdges: reinforcedEdges ?? 0,
      linkedCommitments,
      activeCommitments,
      testsWithSignals: 0,
    };

    return evaluateStagePromotion(stats);
  } catch {
    return { advance: false };
  }
}
