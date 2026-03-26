import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

export const CARD_WIDTH = 200;
export const CARD_HEIGHT = 80;
export const CARD_COLLIDE_RADIUS = 120;

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
  charge: -400,
  linkDistance: 180,
  collideRadius: CARD_COLLIDE_RADIUS,
  centerStrength: 0.05,
} as const;
