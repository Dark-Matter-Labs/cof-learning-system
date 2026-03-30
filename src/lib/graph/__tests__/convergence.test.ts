import { describe, it, expect } from 'vitest';
import { computeConvergenceScore, shouldTriggerSnapshot } from '@/lib/graph/convergence';
import type { Node, NodeStatus } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

// ─── Test Factories ───────────────────────────────────────────────────────────

let _nodeCounter = 0;
let _edgeCounter = 0;

function makeNode(overrides: Partial<Node>): Node {
  const id = overrides.id ?? `node-${++_nodeCounter}`;
  return {
    id,
    node_type: overrides.node_type ?? 'hunch',
    title: overrides.title ?? `Test Node ${id}`,
    description: null,
    content: null,
    hunch_type: null,
    confidence_level: null,
    confidence_basis: null,
    status: overrides.status ?? 'raw',
    llm_extraction: null,
    llm_review: null,
    human_review: null,
    author_id: null,
    parent_node_id: null,
    domain_tags: [],
    external_links: [],
    attachments: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeEdge(overrides: { source_id: string; target_id: string; edge_type: string; id?: string; weight?: number; description?: string | null; author_id?: string | null; created_at?: string }): Edge {
  return {
    id: overrides.id ?? `edge-${++_edgeCounter}`,
    source_id: overrides.source_id,
    target_id: overrides.target_id,
    edge_type: overrides.edge_type,
    weight: overrides.weight ?? 1.0,
    description: overrides.description ?? null,
    author_id: overrides.author_id ?? null,
    created_at: overrides.created_at ?? '2024-01-01T00:00:00Z',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeConvergenceScore', () => {
  it('returns score 0 and empty outcome_scores when goal space has no trigger_outcomes', () => {
    const goalSpace = makeNode({ id: 'gs-1', node_type: 'goal_space' });
    const unrelatedNode = makeNode({ id: 'other-1' });
    const unrelatedEdge = makeEdge({
      source_id: 'other-1',
      target_id: 'some-other',
      edge_type: 'targets_outcome',
    });

    const result = computeConvergenceScore('gs-1', [unrelatedEdge], [goalSpace, unrelatedNode]);

    expect(result.score).toBe(0);
    expect(result.factor_breakdown.outcome_scores).toEqual([]);
    expect(result.factor_breakdown.total_outcomes).toBe(0);
    expect(result.factor_breakdown.raw_score).toBe(0);
  });

  it('indicates_progress edge with promoted source scores +3.0', () => {
    const goalSpace = makeNode({ id: 'gs-2', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-2', node_type: 'trigger_outcome' });
    const signal = makeNode({ id: 'signal-2', node_type: 'signal', status: 'promoted' });

    const edges = [
      makeEdge({ source_id: 'outcome-2', target_id: 'gs-2', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'signal-2', target_id: 'outcome-2', edge_type: 'indicates_progress' }),
    ];

    const result = computeConvergenceScore('gs-2', edges, [goalSpace, outcome, signal]);

    const outcomeScore = result.factor_breakdown.outcome_scores[0];
    expect(outcomeScore).toBeDefined();
    const positiveFactor = outcomeScore.positive_factors.find(f => f.factor === 'indicates_progress:promoted');
    expect(positiveFactor).toBeDefined();
    expect(positiveFactor!.weight).toBe(3.0);
    expect(positiveFactor!.node_id).toBe('signal-2');
  });

  it('indicates_progress edge with human_reviewed source scores +2.0', () => {
    const goalSpace = makeNode({ id: 'gs-3', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-3', node_type: 'trigger_outcome' });
    const signal = makeNode({ id: 'signal-3', node_type: 'signal', status: 'human_reviewed' });

    const edges = [
      makeEdge({ source_id: 'outcome-3', target_id: 'gs-3', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'signal-3', target_id: 'outcome-3', edge_type: 'indicates_progress' }),
    ];

    const result = computeConvergenceScore('gs-3', edges, [goalSpace, outcome, signal]);

    const outcomeScore = result.factor_breakdown.outcome_scores[0];
    const positiveFactor = outcomeScore.positive_factors.find(f => f.factor === 'indicates_progress:human_reviewed');
    expect(positiveFactor).toBeDefined();
    expect(positiveFactor!.weight).toBe(2.0);
  });

  it('indicates_progress edge with raw source scores +0.5', () => {
    const goalSpace = makeNode({ id: 'gs-4', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-4', node_type: 'trigger_outcome' });
    const signal = makeNode({ id: 'signal-4', node_type: 'signal', status: 'raw' });

    const edges = [
      makeEdge({ source_id: 'outcome-4', target_id: 'gs-4', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'signal-4', target_id: 'outcome-4', edge_type: 'indicates_progress' }),
    ];

    const result = computeConvergenceScore('gs-4', edges, [goalSpace, outcome, signal]);

    const outcomeScore = result.factor_breakdown.outcome_scores[0];
    const positiveFactor = outcomeScore.positive_factors.find(f => f.factor === 'indicates_progress:other');
    expect(positiveFactor).toBeDefined();
    expect(positiveFactor!.weight).toBe(0.5);
  });

  it('assigned_to_outcome edge scores +2.0', () => {
    const goalSpace = makeNode({ id: 'gs-5', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-5', node_type: 'trigger_outcome' });
    const commitment = makeNode({ id: 'commitment-5', node_type: 'commitment', status: 'promoted' });

    const edges = [
      makeEdge({ source_id: 'outcome-5', target_id: 'gs-5', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'commitment-5', target_id: 'outcome-5', edge_type: 'assigned_to_outcome' }),
    ];

    const result = computeConvergenceScore('gs-5', edges, [goalSpace, outcome, commitment]);

    const outcomeScore = result.factor_breakdown.outcome_scores[0];
    const positiveFactor = outcomeScore.positive_factors.find(f => f.factor === 'assigned_to_outcome');
    expect(positiveFactor).toBeDefined();
    expect(positiveFactor!.weight).toBe(2.0);
  });

  it('targets_outcome from promoted hunch scores +1.0', () => {
    const goalSpace = makeNode({ id: 'gs-6', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-6', node_type: 'trigger_outcome' });
    const hunch = makeNode({ id: 'hunch-6', node_type: 'hunch', status: 'promoted' });

    const edges = [
      makeEdge({ source_id: 'outcome-6', target_id: 'gs-6', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'hunch-6', target_id: 'outcome-6', edge_type: 'targets_outcome' }),
    ];

    const result = computeConvergenceScore('gs-6', edges, [goalSpace, outcome, hunch]);

    const outcomeScore = result.factor_breakdown.outcome_scores[0];
    const positiveFactor = outcomeScore.positive_factors.find(f => f.factor === 'targets_outcome:hunch:promoted');
    expect(positiveFactor).toBeDefined();
    expect(positiveFactor!.weight).toBe(1.0);
  });

  it('targets_outcome from raw hunch scores +0.5', () => {
    const goalSpace = makeNode({ id: 'gs-7', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-7', node_type: 'trigger_outcome' });
    const hunch = makeNode({ id: 'hunch-7', node_type: 'hunch', status: 'raw' });

    const edges = [
      makeEdge({ source_id: 'outcome-7', target_id: 'gs-7', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'hunch-7', target_id: 'outcome-7', edge_type: 'targets_outcome' }),
    ];

    const result = computeConvergenceScore('gs-7', edges, [goalSpace, outcome, hunch]);

    const outcomeScore = result.factor_breakdown.outcome_scores[0];
    const positiveFactor = outcomeScore.positive_factors.find(f => f.factor === 'targets_outcome:hunch:other');
    expect(positiveFactor).toBeDefined();
    expect(positiveFactor!.weight).toBe(0.5);
  });

  it('targets_outcome from intervention scores +1.5', () => {
    const goalSpace = makeNode({ id: 'gs-8', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-8', node_type: 'trigger_outcome' });
    const intervention = makeNode({ id: 'intervention-8', node_type: 'intervention', status: 'promoted' });

    const edges = [
      makeEdge({ source_id: 'outcome-8', target_id: 'gs-8', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'intervention-8', target_id: 'outcome-8', edge_type: 'targets_outcome' }),
    ];

    const result = computeConvergenceScore('gs-8', edges, [goalSpace, outcome, intervention]);

    const outcomeScore = result.factor_breakdown.outcome_scores[0];
    const positiveFactor = outcomeScore.positive_factors.find(f => f.factor === 'targets_outcome:intervention');
    expect(positiveFactor).toBeDefined();
    expect(positiveFactor!.weight).toBe(1.5);
  });

  it('falsified source node on any incoming edge scores -2.0', () => {
    const goalSpace = makeNode({ id: 'gs-9', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-9', node_type: 'trigger_outcome' });
    const hunch = makeNode({ id: 'hunch-9', node_type: 'hunch', status: 'falsified' });

    const edges = [
      makeEdge({ source_id: 'outcome-9', target_id: 'gs-9', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'hunch-9', target_id: 'outcome-9', edge_type: 'targets_outcome' }),
    ];

    const result = computeConvergenceScore('gs-9', edges, [goalSpace, outcome, hunch]);

    const outcomeScore = result.factor_breakdown.outcome_scores[0];
    const negativeFactor = outcomeScore.negative_factors.find(f => f.factor === 'falsified_source');
    expect(negativeFactor).toBeDefined();
    expect(negativeFactor!.weight).toBe(-2.0);
    // Should NOT have positive factor for this node
    expect(outcomeScore.positive_factors.find(f => f.node_id === 'hunch-9')).toBeUndefined();
  });

  it('suspended source node on any incoming edge scores -1.0', () => {
    const goalSpace = makeNode({ id: 'gs-10', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-10', node_type: 'trigger_outcome' });
    const hunch = makeNode({ id: 'hunch-10', node_type: 'hunch', status: 'suspended' });

    const edges = [
      makeEdge({ source_id: 'outcome-10', target_id: 'gs-10', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'hunch-10', target_id: 'outcome-10', edge_type: 'targets_outcome' }),
    ];

    const result = computeConvergenceScore('gs-10', edges, [goalSpace, outcome, hunch]);

    const outcomeScore = result.factor_breakdown.outcome_scores[0];
    const negativeFactor = outcomeScore.negative_factors.find(f => f.factor === 'suspended_source');
    expect(negativeFactor).toBeDefined();
    expect(negativeFactor!.weight).toBe(-1.0);
    // Should NOT have positive factor for this node
    expect(outcomeScore.positive_factors.find(f => f.node_id === 'hunch-10')).toBeUndefined();
  });

  it('outcome with zero targets_outcome and zero assigned_to_outcome edges scores -1.0', () => {
    const goalSpace = makeNode({ id: 'gs-11', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-11', node_type: 'trigger_outcome' });

    const edges = [
      makeEdge({ source_id: 'outcome-11', target_id: 'gs-11', edge_type: 'advances_goal' }),
      // No targets_outcome or assigned_to_outcome edges
    ];

    const result = computeConvergenceScore('gs-11', edges, [goalSpace, outcome]);

    const outcomeScore = result.factor_breakdown.outcome_scores[0];
    const negativeFactor = outcomeScore.negative_factors.find(f => f.factor === 'no_attention');
    expect(negativeFactor).toBeDefined();
    expect(negativeFactor!.weight).toBe(-1.0);
  });

  it('score is averaged across multiple outcomes', () => {
    const goalSpace = makeNode({ id: 'gs-12', node_type: 'goal_space' });
    const outcome1 = makeNode({ id: 'outcome-12a', node_type: 'trigger_outcome', title: 'Outcome A' });
    const outcome2 = makeNode({ id: 'outcome-12b', node_type: 'trigger_outcome', title: 'Outcome B' });
    // Outcome1: one promoted indicates_progress signal (+3.0) AND one assigned_to_outcome commitment
    // to prevent the no_attention penalty (which only fires when there are zero targets/assigned edges).
    // indicates_progress is NOT a targets/assigned edge, so without the commitment, no_attention -1.0 would apply.
    // Final outcome1 score = 3.0 + 2.0 = 5.0
    const signal1 = makeNode({ id: 'signal-12a', node_type: 'signal', status: 'promoted' });
    const commitment1 = makeNode({ id: 'commitment-12a', node_type: 'commitment', status: 'promoted' });
    // Outcome2: one promoted hunch targets_outcome -> +1.0 (targets_outcome counts as attention, no penalty)
    const hunch2 = makeNode({ id: 'hunch-12b', node_type: 'hunch', status: 'promoted' });

    const edges = [
      makeEdge({ source_id: 'outcome-12a', target_id: 'gs-12', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'outcome-12b', target_id: 'gs-12', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'signal-12a', target_id: 'outcome-12a', edge_type: 'indicates_progress' }),
      makeEdge({ source_id: 'commitment-12a', target_id: 'outcome-12a', edge_type: 'assigned_to_outcome' }),
      makeEdge({ source_id: 'hunch-12b', target_id: 'outcome-12b', edge_type: 'targets_outcome' }),
    ];

    const result = computeConvergenceScore('gs-12', edges, [goalSpace, outcome1, outcome2, signal1, commitment1, hunch2]);

    // outcome1 score = 3.0 (indicates_progress:promoted) + 2.0 (assigned_to_outcome) = 5.0
    // outcome2 score = 1.0 (targets_outcome:hunch:promoted)
    // avg = (5.0 + 1.0) / 2 = 3.0
    expect(result.factor_breakdown.raw_score).toBe(3.0);
    expect(result.score).toBe(3.0);
    expect(result.factor_breakdown.total_outcomes).toBe(2);
  });

  it('score is clamped to +10 when raw exceeds', () => {
    const goalSpace = makeNode({ id: 'gs-13', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-13', node_type: 'trigger_outcome' });

    // Create many promoted indicates_progress signals to exceed +10
    const signals = Array.from({ length: 5 }, (_, i) =>
      makeNode({ id: `signal-13-${i}`, node_type: 'signal', status: 'promoted' })
    );

    const edges = [
      makeEdge({ source_id: 'outcome-13', target_id: 'gs-13', edge_type: 'advances_goal' }),
      ...signals.map(s =>
        makeEdge({ source_id: s.id, target_id: 'outcome-13', edge_type: 'indicates_progress' })
      ),
    ];

    const result = computeConvergenceScore('gs-13', edges, [goalSpace, outcome, ...signals]);

    // 5 signals * 3.0 = 15.0, minus -1.0 no_attention penalty (indicates_progress edges
    // do not count as targets_outcome or assigned_to_outcome, so no_attention applies)
    // raw = 14.0, still > 10, clamped to 10
    expect(result.factor_breakdown.raw_score).toBe(14.0);
    expect(result.score).toBe(10);
  });

  it('score is clamped to -10 when raw is below', () => {
    const goalSpace = makeNode({ id: 'gs-14', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-14', node_type: 'trigger_outcome' });

    // Create many falsified nodes to go below -10
    const falsifiedHunches = Array.from({ length: 7 }, (_, i) =>
      makeNode({ id: `hunch-14-${i}`, node_type: 'hunch', status: 'falsified' })
    );

    const edges = [
      makeEdge({ source_id: 'outcome-14', target_id: 'gs-14', edge_type: 'advances_goal' }),
      ...falsifiedHunches.map(h =>
        makeEdge({ source_id: h.id, target_id: 'outcome-14', edge_type: 'targets_outcome' })
      ),
    ];

    const result = computeConvergenceScore('gs-14', edges, [goalSpace, outcome, ...falsifiedHunches]);

    // 7 nodes * -2.0 = -14.0 raw, clamped to -10
    expect(result.factor_breakdown.raw_score).toBe(-14.0);
    expect(result.score).toBe(-10);
  });

  it('factor_breakdown includes outcome_id and outcome_title for each outcome', () => {
    const goalSpace = makeNode({ id: 'gs-15', node_type: 'goal_space' });
    const outcome = makeNode({ id: 'outcome-15', node_type: 'trigger_outcome', title: 'My Outcome' });
    const hunch = makeNode({ id: 'hunch-15', node_type: 'hunch', status: 'promoted' });

    const edges = [
      makeEdge({ source_id: 'outcome-15', target_id: 'gs-15', edge_type: 'advances_goal' }),
      makeEdge({ source_id: 'hunch-15', target_id: 'outcome-15', edge_type: 'targets_outcome' }),
    ];

    const result = computeConvergenceScore('gs-15', edges, [goalSpace, outcome, hunch]);

    expect(result.factor_breakdown.outcome_scores).toHaveLength(1);
    expect(result.factor_breakdown.outcome_scores[0].outcome_id).toBe('outcome-15');
    expect(result.factor_breakdown.outcome_scores[0].outcome_title).toBe('My Outcome');
  });
});

describe('shouldTriggerSnapshot', () => {
  it('returns false when delta is below threshold (delta=5, threshold=10)', () => {
    const result = shouldTriggerSnapshot({ currentCount: 15, lastSnapshotCount: 10, threshold: 10 });
    expect(result).toBe(false);
  });

  it('returns true when delta equals threshold (delta=10, threshold=10)', () => {
    const result = shouldTriggerSnapshot({ currentCount: 20, lastSnapshotCount: 10, threshold: 10 });
    expect(result).toBe(true);
  });

  it('returns true when delta exceeds threshold (delta=15, threshold=10)', () => {
    const result = shouldTriggerSnapshot({ currentCount: 25, lastSnapshotCount: 10, threshold: 10 });
    expect(result).toBe(true);
  });

  it('treats null lastSnapshotCount as 0 (no prior snapshot exists)', () => {
    const result = shouldTriggerSnapshot({ currentCount: 12, lastSnapshotCount: null, threshold: 10 });
    expect(result).toBe(true);
  });

  it('treats null lastSnapshotCount as 0 — below threshold', () => {
    const result = shouldTriggerSnapshot({ currentCount: 5, lastSnapshotCount: null, threshold: 10 });
    expect(result).toBe(false);
  });

  it('returns false when delta is 0 (no new nodes)', () => {
    const result = shouldTriggerSnapshot({ currentCount: 10, lastSnapshotCount: 10, threshold: 10 });
    expect(result).toBe(false);
  });

  it('uses default threshold of 10 when not specified', () => {
    const result = shouldTriggerSnapshot({ currentCount: 20, lastSnapshotCount: 5 });
    expect(result).toBe(true);
  });
});
