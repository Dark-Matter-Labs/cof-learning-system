import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FactorDetail {
  readonly factor: string;
  readonly node_id: string;
  readonly node_title: string;
  readonly weight: number;
}

export interface OutcomeScore {
  readonly outcome_id: string;
  readonly outcome_title: string;
  readonly score: number;
  readonly positive_factors: readonly FactorDetail[];
  readonly negative_factors: readonly FactorDetail[];
}

export interface FactorBreakdown {
  readonly outcome_scores: readonly OutcomeScore[];
  readonly total_outcomes: number;
  readonly raw_score: number;
}

export interface ConvergenceResult {
  readonly score: number;
  readonly factor_breakdown: FactorBreakdown;
}

// ─── Weight Constants ─────────────────────────────────────────────────────────

const WEIGHTS = {
  indicates_progress_promoted: 3.0,
  indicates_progress_human_reviewed: 2.0,
  indicates_progress_other: 0.5,
  assigned_to_outcome: 2.0,
  targets_outcome_hunch_promoted: 1.0,
  targets_outcome_hunch_other: 0.5,
  targets_outcome_intervention: 1.5,
  falsified_source: -2.0,
  suspended_source: -1.0,
  no_attention: -1.0,
} as const;

// ─── Internal: Score a single trigger_outcome ─────────────────────────────────

function scoreOutcome(
  outcomeId: string,
  outcomeTitle: string,
  edges: readonly Edge[],
  nodeMap: ReadonlyMap<string, Node>
): OutcomeScore {
  const incomingEdges = edges.filter(e => e.target_id === outcomeId);

  const positiveFactors: FactorDetail[] = [];
  const negativeFactors: FactorDetail[] = [];

  // Track whether this outcome has targets_outcome or assigned_to_outcome edges
  // (to detect no_attention)
  let attentionEdgeCount = 0;

  // Track processed node IDs to avoid double-counting a node
  const processedNodeIds = new Set<string>();

  for (const edge of incomingEdges) {
    const sourceNode = nodeMap.get(edge.source_id);
    if (!sourceNode) continue;

    const nodeId = sourceNode.id;
    const nodeTitle = sourceNode.title;

    if (edge.edge_type === 'targets_outcome' || edge.edge_type === 'assigned_to_outcome') {
      attentionEdgeCount++;
    }

    // Skip double-counted nodes
    if (processedNodeIds.has(nodeId)) continue;
    processedNodeIds.add(nodeId);

    // Falsified overrides — contributes only negative weight, no positive
    if (sourceNode.status === 'falsified') {
      negativeFactors.push({
        factor: 'falsified_source',
        node_id: nodeId,
        node_title: nodeTitle,
        weight: WEIGHTS.falsified_source,
      });
      continue;
    }

    // Suspended overrides — contributes only negative weight, no positive
    if (sourceNode.status === 'suspended') {
      negativeFactors.push({
        factor: 'suspended_source',
        node_id: nodeId,
        node_title: nodeTitle,
        weight: WEIGHTS.suspended_source,
      });
      continue;
    }

    // Positive weight rules
    if (edge.edge_type === 'indicates_progress') {
      if (sourceNode.status === 'promoted') {
        positiveFactors.push({
          factor: 'indicates_progress:promoted',
          node_id: nodeId,
          node_title: nodeTitle,
          weight: WEIGHTS.indicates_progress_promoted,
        });
      } else if (sourceNode.status === 'human_reviewed') {
        positiveFactors.push({
          factor: 'indicates_progress:human_reviewed',
          node_id: nodeId,
          node_title: nodeTitle,
          weight: WEIGHTS.indicates_progress_human_reviewed,
        });
      } else {
        positiveFactors.push({
          factor: 'indicates_progress:other',
          node_id: nodeId,
          node_title: nodeTitle,
          weight: WEIGHTS.indicates_progress_other,
        });
      }
    } else if (edge.edge_type === 'assigned_to_outcome') {
      positiveFactors.push({
        factor: 'assigned_to_outcome',
        node_id: nodeId,
        node_title: nodeTitle,
        weight: WEIGHTS.assigned_to_outcome,
      });
    } else if (edge.edge_type === 'targets_outcome') {
      if (sourceNode.node_type === 'intervention') {
        positiveFactors.push({
          factor: 'targets_outcome:intervention',
          node_id: nodeId,
          node_title: nodeTitle,
          weight: WEIGHTS.targets_outcome_intervention,
        });
      } else if (sourceNode.node_type === 'hunch') {
        if (sourceNode.status === 'promoted') {
          positiveFactors.push({
            factor: 'targets_outcome:hunch:promoted',
            node_id: nodeId,
            node_title: nodeTitle,
            weight: WEIGHTS.targets_outcome_hunch_promoted,
          });
        } else {
          positiveFactors.push({
            factor: 'targets_outcome:hunch:other',
            node_id: nodeId,
            node_title: nodeTitle,
            weight: WEIGHTS.targets_outcome_hunch_other,
          });
        }
      }
    }
  }

  // Penalty: outcome has no active attention (no targets_outcome or assigned_to_outcome edges)
  if (attentionEdgeCount === 0) {
    negativeFactors.push({
      factor: 'no_attention',
      node_id: outcomeId,
      node_title: outcomeTitle,
      weight: WEIGHTS.no_attention,
    });
  }

  const score =
    positiveFactors.reduce((sum, f) => sum + f.weight, 0) +
    negativeFactors.reduce((sum, f) => sum + f.weight, 0);

  return {
    outcome_id: outcomeId,
    outcome_title: outcomeTitle,
    score,
    positive_factors: positiveFactors,
    negative_factors: negativeFactors,
  };
}

// ─── Threshold Trigger ────────────────────────────────────────────────────────

export interface TriggerSnapshotInput {
  readonly currentCount: number;
  readonly lastSnapshotCount: number | null;
  readonly threshold?: number;
}

export function shouldTriggerSnapshot(input: TriggerSnapshotInput): boolean {
  const threshold = input.threshold ?? 10;
  const lastCount = input.lastSnapshotCount ?? 0;
  const delta = input.currentCount - lastCount;
  return delta >= threshold;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeConvergenceScore(
  goalSpaceId: string,
  edges: readonly Edge[],
  allNodes: readonly Node[]
): ConvergenceResult {
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  // Step 1: find all trigger_outcome IDs linked to this goal_space via advances_goal
  // Direction: trigger_outcome (source) -> advances_goal -> goal_space (target)
  const outcomeIds = edges
    .filter(e => e.edge_type === 'advances_goal' && e.target_id === goalSpaceId)
    .map(e => e.source_id);

  if (outcomeIds.length === 0) {
    return {
      score: 0,
      factor_breakdown: {
        outcome_scores: [],
        total_outcomes: 0,
        raw_score: 0,
      },
    };
  }

  // Step 2: score each outcome
  const outcomeScores = outcomeIds.map(outcomeId => {
    const outcomeNode = nodeMap.get(outcomeId);
    const outcomeTitle = outcomeNode?.title ?? outcomeId;
    return scoreOutcome(outcomeId, outcomeTitle, edges, nodeMap);
  });

  // Step 3: average across outcomes
  const raw_score =
    outcomeScores.reduce((sum, os) => sum + os.score, 0) / outcomeIds.length;

  // Step 4: clamp to [-10, 10]
  const score = Math.max(-10, Math.min(10, raw_score));

  return {
    score,
    factor_breakdown: {
      outcome_scores: outcomeScores,
      total_outcomes: outcomeIds.length,
      raw_score,
    },
  };
}
