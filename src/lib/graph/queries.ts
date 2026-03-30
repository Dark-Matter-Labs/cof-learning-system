import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

export type OutcomeStatus = 'not_started' | 'in_progress' | 'met' | 'blocked';

export function getNodeConnections(nodeId: string, edges: readonly Edge[]): readonly Edge[] {
  return edges.filter(e => e.source_id === nodeId || e.target_id === nodeId);
}

export function getConnectedNodeIds(nodeId: string, edges: readonly Edge[]): readonly string[] {
  const connections = getNodeConnections(nodeId, edges);
  const ids = new Set<string>();
  for (const edge of connections) {
    if (edge.source_id !== nodeId) ids.add(edge.source_id);
    if (edge.target_id !== nodeId) ids.add(edge.target_id);
  }
  return Array.from(ids);
}

export function getChain(
  startNodeId: string,
  nodes: readonly Node[],
  edges: readonly Edge[]
): readonly Node[] {
  const visited = new Set<string>();
  const chain: Node[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) chain.push(node);

    const outgoing = edges.filter(e => e.source_id === nodeId);
    for (const edge of outgoing) {
      traverse(edge.target_id);
    }
  }

  traverse(startNodeId);
  return chain;
}

export function computeOutcomeStatus(
  outcomeId: string,
  edges: readonly Edge[],
  allNodes: readonly Node[]
): OutcomeStatus {
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));
  const incomingEdges = edges.filter(e => e.target_id === outcomeId);

  // blocked takes highest priority
  for (const edge of incomingEdges) {
    const sourceNode = nodeMap.get(edge.source_id);
    if (sourceNode && (sourceNode.status === 'falsified' || sourceNode.status === 'suspended')) {
      return 'blocked';
    }
  }

  // met: indicates_progress edge with promoted source
  for (const edge of incomingEdges) {
    if (edge.edge_type === 'indicates_progress') {
      const sourceNode = nodeMap.get(edge.source_id);
      if (sourceNode && sourceNode.status === 'promoted') {
        return 'met';
      }
    }
  }

  // in_progress: any assigned_to_outcome or targets_outcome edge
  const hasProgressEdge = incomingEdges.some(
    e => e.edge_type === 'assigned_to_outcome' || e.edge_type === 'targets_outcome'
  );
  if (hasProgressEdge) {
    return 'in_progress';
  }

  return 'not_started';
}

export function getOutcomeCommitmentCount(
  outcomeId: string,
  edges: readonly Edge[]
): number {
  return edges.filter(
    e => e.edge_type === 'assigned_to_outcome' && e.target_id === outcomeId
  ).length;
}

export function getOutcomeHunchCount(
  outcomeId: string,
  edges: readonly Edge[],
  allNodes: readonly Node[]
): number {
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));
  return edges.filter(e => {
    if (e.edge_type !== 'targets_outcome' || e.target_id !== outcomeId) return false;
    const sourceNode = nodeMap.get(e.source_id);
    return sourceNode?.node_type === 'hunch';
  }).length;
}
