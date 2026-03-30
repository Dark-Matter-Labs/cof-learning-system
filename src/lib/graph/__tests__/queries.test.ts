import { describe, it, expect } from 'vitest';
import {
  computeOutcomeStatus,
  getOutcomeCommitmentCount,
  getOutcomeHunchCount,
} from '@/lib/graph/queries';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

function makeNode(overrides: Partial<Node>): Node {
  return {
    id: 'node-1',
    node_type: 'hunch',
    title: 'Test',
    description: null,
    content: null,
    hunch_type: null,
    confidence_level: null,
    confidence_basis: null,
    status: 'raw',
    llm_extraction: null,
    llm_review: null,
    human_review: null,
    author_id: null,
    parent_node_id: null,
    domain_tags: [],
    external_links: [],
    attachments: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

function makeEdge(overrides: Partial<Edge>): Edge {
  return {
    id: 'edge-1',
    source_id: '',
    target_id: '',
    edge_type: '',
    weight: 1,
    description: null,
    author_id: null,
    created_at: '',
    ...overrides,
  };
}

describe('computeOutcomeStatus', () => {
  it('returns blocked when any incoming edge source node has status falsified', () => {
    const outcomeId = 'outcome-1';
    const falsifiedNode = makeNode({ id: 'signal-1', node_type: 'signal', status: 'falsified' });
    const edge = makeEdge({ id: 'e1', source_id: 'signal-1', target_id: outcomeId, edge_type: 'indicates_progress' });
    expect(computeOutcomeStatus(outcomeId, [edge], [falsifiedNode])).toBe('blocked');
  });

  it('returns blocked when any incoming edge source node has status suspended', () => {
    const outcomeId = 'outcome-1';
    const suspendedNode = makeNode({ id: 'signal-2', node_type: 'signal', status: 'suspended' });
    const edge = makeEdge({ id: 'e2', source_id: 'signal-2', target_id: outcomeId, edge_type: 'indicates_progress' });
    expect(computeOutcomeStatus(outcomeId, [edge], [suspendedNode])).toBe('blocked');
  });

  it('returns met when an indicates_progress edge source has status promoted', () => {
    const outcomeId = 'outcome-1';
    const promotedSignal = makeNode({ id: 'signal-3', node_type: 'signal', status: 'promoted' });
    const edge = makeEdge({ id: 'e3', source_id: 'signal-3', target_id: outcomeId, edge_type: 'indicates_progress' });
    expect(computeOutcomeStatus(outcomeId, [edge], [promotedSignal])).toBe('met');
  });

  it('returns in_progress when assigned_to_outcome edges exist but no met/blocked', () => {
    const outcomeId = 'outcome-1';
    const commitmentNode = makeNode({ id: 'commit-1', node_type: 'commitment', status: 'raw' });
    const edge = makeEdge({ id: 'e4', source_id: 'commit-1', target_id: outcomeId, edge_type: 'assigned_to_outcome' });
    expect(computeOutcomeStatus(outcomeId, [edge], [commitmentNode])).toBe('in_progress');
  });

  it('returns in_progress when targets_outcome edges exist but no met/blocked', () => {
    const outcomeId = 'outcome-1';
    const hunchNode = makeNode({ id: 'hunch-1', node_type: 'hunch', status: 'raw' });
    const edge = makeEdge({ id: 'e5', source_id: 'hunch-1', target_id: outcomeId, edge_type: 'targets_outcome' });
    expect(computeOutcomeStatus(outcomeId, [edge], [hunchNode])).toBe('in_progress');
  });

  it('returns not_started when no qualifying edges exist', () => {
    const outcomeId = 'outcome-1';
    const unrelatedNode = makeNode({ id: 'node-x', node_type: 'hunch', status: 'raw' });
    const unrelatedEdge = makeEdge({ id: 'e6', source_id: 'node-x', target_id: 'other-outcome', edge_type: 'assigned_to_outcome' });
    expect(computeOutcomeStatus(outcomeId, [unrelatedEdge], [unrelatedNode])).toBe('not_started');
  });

  it('returns not_started when there are no edges at all', () => {
    expect(computeOutcomeStatus('outcome-1', [], [])).toBe('not_started');
  });

  it('blocked takes priority over met: falsified node AND indicates_progress promoted signal -> returns blocked', () => {
    const outcomeId = 'outcome-1';
    const falsifiedNode = makeNode({ id: 'signal-bad', node_type: 'signal', status: 'falsified' });
    const promotedNode = makeNode({ id: 'signal-good', node_type: 'signal', status: 'promoted' });
    const blockedEdge = makeEdge({ id: 'e7', source_id: 'signal-bad', target_id: outcomeId, edge_type: 'indicates_progress' });
    const metEdge = makeEdge({ id: 'e8', source_id: 'signal-good', target_id: outcomeId, edge_type: 'indicates_progress' });
    expect(computeOutcomeStatus(outcomeId, [blockedEdge, metEdge], [falsifiedNode, promotedNode])).toBe('blocked');
  });
});

describe('getOutcomeCommitmentCount', () => {
  it('returns count of assigned_to_outcome edges where target_id matches', () => {
    const outcomeId = 'outcome-1';
    const edges: Edge[] = [
      makeEdge({ id: 'e1', source_id: 'c1', target_id: outcomeId, edge_type: 'assigned_to_outcome' }),
      makeEdge({ id: 'e2', source_id: 'c2', target_id: outcomeId, edge_type: 'assigned_to_outcome' }),
      makeEdge({ id: 'e3', source_id: 'c3', target_id: 'other-outcome', edge_type: 'assigned_to_outcome' }),
    ];
    expect(getOutcomeCommitmentCount(outcomeId, edges)).toBe(2);
  });

  it('returns 0 when no matching edges exist', () => {
    const outcomeId = 'outcome-1';
    const edges: Edge[] = [
      makeEdge({ id: 'e1', source_id: 'c1', target_id: 'other-outcome', edge_type: 'assigned_to_outcome' }),
    ];
    expect(getOutcomeCommitmentCount(outcomeId, edges)).toBe(0);
  });

  it('returns 0 when edge list is empty', () => {
    expect(getOutcomeCommitmentCount('outcome-1', [])).toBe(0);
  });
});

describe('getOutcomeHunchCount', () => {
  it('returns count of targets_outcome edges where source is node_type hunch only', () => {
    const outcomeId = 'outcome-1';
    const hunch1 = makeNode({ id: 'h1', node_type: 'hunch', status: 'raw' });
    const hunch2 = makeNode({ id: 'h2', node_type: 'hunch', status: 'raw' });
    const intervention = makeNode({ id: 'i1', node_type: 'intervention', status: 'raw' });
    const edges: Edge[] = [
      makeEdge({ id: 'e1', source_id: 'h1', target_id: outcomeId, edge_type: 'targets_outcome' }),
      makeEdge({ id: 'e2', source_id: 'h2', target_id: outcomeId, edge_type: 'targets_outcome' }),
      makeEdge({ id: 'e3', source_id: 'i1', target_id: outcomeId, edge_type: 'targets_outcome' }),
    ];
    expect(getOutcomeHunchCount(outcomeId, edges, [hunch1, hunch2, intervention])).toBe(2);
  });

  it('returns 0 for targets_outcome edges where source is node_type intervention (not a hunch)', () => {
    const outcomeId = 'outcome-1';
    const intervention = makeNode({ id: 'i1', node_type: 'intervention', status: 'raw' });
    const edge = makeEdge({ id: 'e1', source_id: 'i1', target_id: outcomeId, edge_type: 'targets_outcome' });
    expect(getOutcomeHunchCount(outcomeId, [edge], [intervention])).toBe(0);
  });

  it('returns 0 when no targets_outcome edges for this outcome', () => {
    const outcomeId = 'outcome-1';
    const hunch = makeNode({ id: 'h1', node_type: 'hunch', status: 'raw' });
    const edge = makeEdge({ id: 'e1', source_id: 'h1', target_id: 'other-outcome', edge_type: 'targets_outcome' });
    expect(getOutcomeHunchCount(outcomeId, [edge], [hunch])).toBe(0);
  });
});
