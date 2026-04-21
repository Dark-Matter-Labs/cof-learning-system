import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

export const CARD_WIDTH = 200;
export const CARD_HEIGHT = 80;
export const CARD_COLLIDE_RADIUS = 120;
export const COMMIT_SIZE = 80;

export interface GraphNode extends SimulationNodeDatum {
  readonly id: string;
  readonly node_type: string;
  readonly title: string;
  readonly color: string;
  readonly radius: number;
  readonly data: Node;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  readonly id: string;
  readonly edge_type: string;
  readonly data: Edge;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  hunch: '#7F77DD',
  assumption_background: '#1D9E75',
  assumption_foreground: '#D85A30',
  test: '#D4537E',
  learning: '#378ADD',
  option: '#BA7517',
  person: '#888780',
  organisation: '#888780',
  entity: '#888780',
  site: '#639922',
  commitment: '#185FA5',
  intervention: '#534AB7',
  signal: '#A32D2D',
  goal_space: '#0F6E56',
};

const NODE_TYPE_RADII: Record<string, number> = {
  hunch: 20,
  assumption_background: 16,
  assumption_foreground: 16,
  test: 14,
  learning: 14,
  option: 18,
  person: 12,
  organisation: 12,
  site: 12,
};

export function toGraphNode(node: Node): GraphNode {
  return {
    id: node.id,
    node_type: node.node_type,
    title: node.title,
    color: NODE_TYPE_COLORS[node.node_type] ?? '#888',
    radius: NODE_TYPE_RADII[node.node_type] ?? 14,
    data: node,
  };
}

export function toGraphLink(edge: Edge): GraphLink {
  return {
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    edge_type: edge.edge_type,
    data: edge,
  };
}

export const FORCE_CONFIG = {
  charge: -800,
  linkDistance: 180,
  collideRadius: CARD_COLLIDE_RADIUS + 20,
  centerStrength: 0.03,
} as const;

/** Cluster force strength — low enough to keep the organic feel while grouping nodes. */
export const CLUSTER_FORCE_STRENGTH = 0.08;

// ─── Cluster force ────────────────────────────────────────────────────────────

const TYPE_OFFSETS: Record<string, { dx: number; dy: number }> = {
  hunch:                 { dx: -55, dy: -35 },
  assumption_background: { dx:  55, dy: -35 },
  assumption_foreground: { dx:  55, dy: -35 },
  test:                  { dx:  55, dy:  35 },
  learning:              { dx: -55, dy:  35 },
  signal:                { dx:   0, dy: -55 },
  goal_space:            { dx:   0, dy:   0 },
  commitment:            { dx:   0, dy:   0 },
};

/**
 * Computes a centroid position (in canvas coords) for each goal space found in
 * nodeGoalMap. Centroids are spread evenly in a ring centred on the canvas.
 */
export function computeGoalCentroids(
  nodeGoalMap: ReadonlyMap<string, string>,
  canvasWidth: number,
  canvasHeight: number,
): Map<string, { x: number; y: number }> {
  const gsIds = [...new Set(nodeGoalMap.values())];
  const result = new Map<string, { x: number; y: number }>();
  if (gsIds.length === 0) return result;

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const r = Math.min(canvasWidth, canvasHeight) * 0.28;

  gsIds.forEach((gsId, i) => {
    const angle = (i / gsIds.length) * 2 * Math.PI - Math.PI / 2;
    result.set(gsId, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  });
  return result;
}

/**
 * Returns a D3-compatible force that gently pulls each node toward its
 * (goalSpace + nodeType) target position. Strength 0.08 keeps it organic.
 */
export function buildClusterForce(
  nodeGoalMap: ReadonlyMap<string, string>,
  goalCentroids: ReadonlyMap<string, { x: number; y: number }>,
): ((alpha: number) => void) & { initialize?: (nodes: GraphNode[]) => void } {
  let _nodes: GraphNode[] = [];

  function force(alpha: number) {
    for (const n of _nodes) {
      const gsId = nodeGoalMap.get(n.id);
      if (!gsId) continue;
      const c = goalCentroids.get(gsId);
      if (!c) continue;
      const off = TYPE_OFFSETS[n.node_type] ?? { dx: 0, dy: 0 };
      const mut = n as GraphNode & { vx: number; vy: number; x: number; y: number };
      mut.vx += (c.x + off.dx - (mut.x ?? 0)) * alpha * CLUSTER_FORCE_STRENGTH;
      mut.vy += (c.y + off.dy - (mut.y ?? 0)) * alpha * CLUSTER_FORCE_STRENGTH;
    }
  }

  force.initialize = (nodes: GraphNode[]) => { _nodes = nodes; };
  return force;
}
