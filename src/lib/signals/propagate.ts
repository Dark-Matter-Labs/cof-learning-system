import { createClient } from '@/lib/supabase/server';
import type { TensionAlert } from '@/lib/types/tension';

interface NodeRow {
  id: string;
  title: string;
  node_type: string;
  confidence_level: number | null;
}

interface EdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: string;
}

function determineSeverity(
  signalNode: NodeRow,
  _assumptionId: string,
  _commitmentId: string
): TensionAlert['severity'] {
  // High if the signal has strong evidence; medium otherwise
  return signalNode.node_type === 'signal' ? 'high' : 'medium';
}

/**
 * Propagate a signal node through the graph:
 * - challenges_assumption edges → create tension alerts for affected commitments
 * - supports edges → increment confidence on the target assumption
 */
export async function propagateSignal(signalId: string): Promise<void> {
  const supabase = await createClient();

  // Fetch the signal node
  const { data: signal, error: signalError } = await supabase
    .from('nodes')
    .select('id, title, node_type, confidence_level')
    .eq('id', signalId)
    .single();

  if (signalError || !signal) return;

  // Fetch all outgoing edges from this signal
  const { data: outEdges, error: edgesError } = await supabase
    .from('edges')
    .select('id, source_id, target_id, edge_type')
    .eq('source_id', signalId);

  if (edgesError || !outEdges) return;

  for (const edge of outEdges as EdgeRow[]) {
    if (edge.edge_type === 'challenges_assumption') {
      await handleChallengesAssumption(supabase, signal as NodeRow, edge.target_id);
    }

    if (edge.edge_type === 'supports') {
      await handleSupports(supabase, edge.target_id, signalId);
    }
  }
}

async function handleChallengesAssumption(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  signal: NodeRow,
  assumptionId: string
): Promise<void> {
  // Find assumption title
  const { data: assumption } = await supabase
    .from('nodes')
    .select('id, title')
    .eq('id', assumptionId)
    .single();

  if (!assumption) return;

  // Find all commitments that depend on this assumption via serves_commitment edges
  // Edge direction: node → serves_commitment → commitment (source is the serving node, target is the commitment)
  const { data: commitmentEdges } = await supabase
    .from('edges')
    .select('id, source_id, target_id, edge_type')
    .eq('source_id', assumptionId)
    .eq('edge_type', 'serves_commitment');

  const commitmentIds: string[] = (commitmentEdges ?? []).map((e: EdgeRow) => e.target_id);

  // Also check: commitment nodes with edges pointing to this assumption (backward direction)
  const { data: reverseEdges } = await supabase
    .from('edges')
    .select('id, source_id, target_id, edge_type')
    .eq('target_id', assumptionId)
    .eq('edge_type', 'serves_commitment');

  const reverseCommitmentIds: string[] = (reverseEdges ?? []).map((e: EdgeRow) => e.source_id);

  const allCommitmentIds = [...new Set([...commitmentIds, ...reverseCommitmentIds])];

  if (allCommitmentIds.length === 0) {
    // Still create an alert — assumption is challenged even without linked commitments
    await supabase.from('tension_alerts').insert({
      type: 'assumption_challenged',
      severity: 'low',
      description: `Signal "${signal.title}" challenges assumption "${assumption.title}"`,
      affected_assumption_id: assumptionId,
      affected_commitment_ids: [],
      source_node_id: signal.id,
    });
    return;
  }

  await supabase.from('tension_alerts').insert({
    type: 'assumption_challenged',
    severity: determineSeverity(signal, assumptionId, allCommitmentIds[0]),
    description: `Signal "${signal.title}" challenges assumption "${assumption.title}" — affects ${allCommitmentIds.length} commitment${allCommitmentIds.length > 1 ? 's' : ''}`,
    affected_assumption_id: assumptionId,
    affected_commitment_ids: allCommitmentIds,
    source_node_id: signal.id,
  });
}

async function handleSupports(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  assumptionId: string,
  signalId: string
): Promise<void> {
  // Increment confidence level (cap at 5)
  const { data: assumption } = await supabase
    .from('nodes')
    .select('id, confidence_level')
    .eq('id', assumptionId)
    .single();

  if (!assumption) return;

  const current = assumption.confidence_level ?? 3;
  const updated = Math.min(5, current + 1);

  if (updated !== current) {
    await supabase
      .from('nodes')
      .update({ confidence_level: updated, updated_at: new Date().toISOString() })
      .eq('id', assumptionId);

    // Log the update
    await supabase.from('activity_log').insert({
      action: 'confidence_increased',
      target_node_id: assumptionId,
      details: {
        from: current,
        to: updated,
        reason: `Supported by signal ${signalId}`,
      },
    });
  }
}
