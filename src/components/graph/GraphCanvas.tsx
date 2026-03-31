'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { HighlightState } from '@/lib/types/highlight';
import type { GraphView } from './GraphTopBar';
import {
  toGraphNode, toGraphLink, FORCE_CONFIG,
  CARD_WIDTH, CARD_HEIGHT,
  type GraphNode, type GraphLink,
} from '@/lib/graph/layout';

interface GraphCanvasProps {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly activeTypes: readonly string[];
  readonly view: GraphView;
  readonly onSelectNode: (node: Node | null) => void;
  readonly onCanvasClick?: (screenX: number, screenY: number, canvasX: number, canvasY: number) => void;
  readonly highlight?: HighlightState;
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

const EDGE_COLORS: Record<string, string> = {
  supports:               '#1D9E75',
  contradicts:            '#D85A30',
  evolved_from:           '#7F77DD',
  tested_by:              '#D4537E',
  challenges:             '#BA7517',
  requires:               '#378ADD',
  authored_by:            '#888780',
  works_at:               '#888780',
  serves_commitment:      '#185FA5',
  tests_assumption:       '#534AB7',
  challenges_assumption:  '#A32D2D',
  informs_reallocation:   '#D4537E',
  belongs_to_goalspace:   '#0F6E56',
  consumes_resource:      '#534AB7',
};

const HIGHLIGHT_EDGE_COLOR = '#F59E0B';

// ─── Layout algorithms ────────────────────────────────────────────────────────

/** Tree: BFS from most-connected root, d3.tree for positions. */
function computeTreeLayout(
  gNodes: GraphNode[],
  gLinks: GraphLink[],
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (gNodes.length === 0) return positions;

  const nodeIds = new Set(gNodes.map(n => n.id));
  const outEdges = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  gNodes.forEach(n => { outEdges.set(n.id, []); inDegree.set(n.id, 0); });
  gLinks.forEach(l => {
    const src = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source as string;
    const tgt = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target as string;
    if (nodeIds.has(src) && nodeIds.has(tgt)) {
      outEdges.get(src)?.push(tgt);
      inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1);
    }
  });

  // Root = node with no incoming edges (most outgoing as tiebreak), else most-outgoing overall
  const noIncoming = gNodes.filter(n => (inDegree.get(n.id) ?? 0) === 0);
  const pool = noIncoming.length > 0 ? noIncoming : gNodes;
  const root = pool.reduce((a, b) =>
    (outEdges.get(a.id)?.length ?? 0) >= (outEdges.get(b.id)?.length ?? 0) ? a : b
  );

  interface TNode { id: string; children: TNode[] }
  const visited = new Set<string>();
  function buildTree(id: string): TNode {
    visited.add(id);
    const children: TNode[] = [];
    for (const cid of (outEdges.get(id) ?? [])) {
      if (!visited.has(cid) && nodeIds.has(cid)) children.push(buildTree(cid));
    }
    return { id, children };
  }
  const treeRoot = buildTree(root.id);
  // Orphaned nodes (disconnected components) attach to root
  gNodes.forEach(n => { if (!visited.has(n.id)) treeRoot.children.push(buildTree(n.id)); });

  const hier = d3.hierarchy(treeRoot);
  const treeLayout = d3.tree<TNode>().nodeSize([CARD_WIDTH + 24, CARD_HEIGHT + 80]);
  treeLayout(hier);

  let minX = Infinity, maxX = -Infinity;
  hier.each(n => { minX = Math.min(minX, n.x ?? 0); maxX = Math.max(maxX, n.x ?? 0); });
  const offsetX = width / 2 - (minX + maxX) / 2;
  const offsetY = 60;

  hier.each(n => {
    positions.set(n.data.id, {
      x: (n.x ?? 0) + offsetX,
      y: n.depth * (CARD_HEIGHT + 80) + offsetY,
    });
  });
  return positions;
}

/** Timeline: x = created_at date, y = node type row. */
function computeTimelineLayout(
  gNodes: GraphNode[],
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (gNodes.length === 0) return positions;

  const TYPE_ROW: Record<string, number> = {
    goal_space: 0, commitment: 1, intervention: 2,
    assumption_foreground: 3, assumption_background: 4,
    test: 5, signal: 6, hunch: 7, learning: 8, option: 9,
  };
  const ROW_HEIGHT = CARD_HEIGHT + 48;
  const PAD_LEFT = 60, PAD_RIGHT = 60, PAD_TOP = 40;

  const sorted = [...gNodes].sort(
    (a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime()
  );
  const minT = new Date(sorted[0].data.created_at).getTime();
  const maxT = new Date(sorted[sorted.length - 1].data.created_at).getTime();
  const tRange = maxT - minT || 1;
  const xRange = width - PAD_LEFT - PAD_RIGHT - CARD_WIDTH;

  // Group by type-row so rows are contiguous
  const byRow = new Map<number, GraphNode[]>();
  sorted.forEach(n => {
    const row = TYPE_ROW[n.node_type] ?? 10;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row)!.push(n);
  });
  const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]);

  // Center rows vertically
  const totalH = rows.length * ROW_HEIGHT;
  const startY = Math.max(PAD_TOP, (height - totalH) / 2);

  rows.forEach(([, rowNodes], ri) => {
    rowNodes.forEach(n => {
      const t = new Date(n.data.created_at).getTime();
      positions.set(n.id, {
        x: PAD_LEFT + ((t - minT) / tRange) * xRange,
        y: startY + ri * ROW_HEIGHT,
      });
    });
  });
  return positions;
}

/** Workflow: Kahn topological sort → left-to-right layers. */
function computeWorkflowLayout(
  gNodes: GraphNode[],
  gLinks: GraphLink[],
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (gNodes.length === 0) return positions;

  const nodeIds = new Set(gNodes.map(n => n.id));
  const outEdges = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  gNodes.forEach(n => { outEdges.set(n.id, []); inDeg.set(n.id, 0); });
  gLinks.forEach(l => {
    const src = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source as string;
    const tgt = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target as string;
    if (nodeIds.has(src) && nodeIds.has(tgt)) {
      outEdges.get(src)?.push(tgt);
      inDeg.set(tgt, (inDeg.get(tgt) ?? 0) + 1);
    }
  });

  const layer = new Map<string, number>();
  const queue: string[] = [];
  gNodes.forEach(n => {
    if ((inDeg.get(n.id) ?? 0) === 0) { queue.push(n.id); layer.set(n.id, 0); }
  });
  // Nodes with cycles get layer 0
  gNodes.forEach(n => { if (!layer.has(n.id)) layer.set(n.id, 0); });

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const cl = layer.get(cur) ?? 0;
    for (const nxt of (outEdges.get(cur) ?? [])) {
      layer.set(nxt, Math.max(layer.get(nxt) ?? 0, cl + 1));
      inDeg.set(nxt, (inDeg.get(nxt) ?? 1) - 1);
      if ((inDeg.get(nxt) ?? 0) <= 0) queue.push(nxt);
    }
  }

  const byLayer = new Map<number, string[]>();
  gNodes.forEach(n => {
    const l = layer.get(n.id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(n.id);
  });

  const H_GAP = 60, V_GAP = 24;
  const maxLayer = Math.max(...byLayer.keys(), 0);
  const totalW = (maxLayer + 1) * (CARD_WIDTH + H_GAP) - H_GAP;
  const startX = Math.max(H_GAP, (width - totalW) / 2);

  [...byLayer.entries()].sort((a, b) => a[0] - b[0]).forEach(([layerNum, ids]) => {
    const totalH = ids.length * (CARD_HEIGHT + V_GAP) - V_GAP;
    const startY = Math.max(V_GAP, (height - totalH) / 2);
    ids.forEach((id, i) => {
      positions.set(id, {
        x: startX + layerNum * (CARD_WIDTH + H_GAP),
        y: startY + i * (CARD_HEIGHT + V_GAP),
      });
    });
  });
  return positions;
}

// ─── Shared rendering helpers ─────────────────────────────────────────────────

function edgePath(sx: number, sy: number, tx: number, ty: number): string {
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2 - 30;
  return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
}

function getHighlightedIds(highlight: HighlightState): {
  nodeIds: ReadonlySet<string> | null;
  edgeIds: ReadonlySet<string> | null;
  isTension: boolean;
} {
  switch (highlight.type) {
    case 'commitment': return { nodeIds: highlight.connectedNodeIds, edgeIds: null, isTension: false };
    case 'tension':    return { nodeIds: highlight.chainNodeIds, edgeIds: highlight.chainEdgeIds, isTension: true };
    case 'assumption': return { nodeIds: highlight.treeNodeIds, edgeIds: null, isTension: false };
    default:           return { nodeIds: null, edgeIds: null, isTension: false };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphCanvas({ nodes, edges, activeTypes, view, onSelectNode, onCanvasClick, highlight }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const filteredNodes = nodes.filter(n => activeTypes.includes(n.node_type));
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(e => filteredNodeIds.has(e.source_id) && filteredNodeIds.has(e.target_id));

  const graphNodes = filteredNodes.map(toGraphNode);
  const graphLinks = filteredEdges.map(toGraphLink);

  const handleCanvasClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if ((event.target as SVGElement).closest('.node-card')) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !onCanvasClick) return;
    const g = svgRef.current?.querySelector('g');
    const transform = g ? d3.zoomTransform(g as unknown as Element) : d3.zoomIdentity;
    const [canvasX, canvasY] = transform.invert([event.clientX - rect.left, event.clientY - rect.top]);
    onCanvasClick(event.clientX, event.clientY, canvasX, canvasY);
  }, [onCanvasClick]);

  useEffect(() => {
    if (!svgRef.current) return;
    simulationRef.current?.stop();

    const isDark = document.documentElement.classList.contains('dark');
    const NODE_CARD_BG = isDark ? '#1f2937' : '#ffffff';
    const NODE_CARD_BORDER = isDark ? '#374151' : '#e5e7eb';
    const NODE_TITLE_FILL = isDark ? '#e5e7eb' : '#111827';
    const NODE_DOTS_EMPTY = isDark ? '#374151' : '#d1d5db';
    const AXIS_STROKE = isDark ? '#374151' : '#d1d5db';
    const AXIS_TEXT_FILL = isDark ? '#6b7280' : '#9ca3af';

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    svg.selectAll('*').remove();

    const g = svg.append('g');
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on('zoom', ev => g.attr('transform', ev.transform))
    );

    // Arrowhead markers
    const defs = svg.append('defs');
    [...Object.keys(EDGE_COLORS), 'highlight'].forEach(type => {
      const color = type === 'highlight' ? HIGHLIGHT_EDGE_COLOR : (EDGE_COLORS[type] ?? '#444');
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -4 8 8').attr('refX', CARD_WIDTH / 2 + 8).attr('refY', 0)
        .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', color);
    });

    // Timeline: add date axis labels
    if (view === 'timeline' && graphNodes.length > 0) {
      const sorted = [...graphNodes].sort(
        (a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime()
      );
      const minT = new Date(sorted[0].data.created_at);
      const maxT = new Date(sorted[sorted.length - 1].data.created_at);
      const xScale = d3.scaleTime().domain([minT, maxT]).range([60, width - 60 - CARD_WIDTH]);
      const axis = d3.axisTop(xScale).ticks(6).tickFormat(d => {
        const date = d as Date;
        return `${date.toLocaleString('default', { month: 'short' })} '${String(date.getFullYear()).slice(2)}`;
      });
      g.append('g')
        .attr('transform', `translate(0, 30)`)
        .call(axis)
        .call(ax => ax.select('.domain').attr('stroke', AXIS_STROKE))
        .call(ax => ax.selectAll('text').attr('fill', AXIS_TEXT_FILL).attr('font-size', 9))
        .call(ax => ax.selectAll('line').attr('stroke', AXIS_STROKE));
    }

    // Links group (rendered before nodes)
    const link = g.append('g').attr('class', 'links')
      .selectAll<SVGPathElement, GraphLink>('path')
      .data(graphLinks).join('path')
      .attr('class', d => `edge-${d.id}`)
      .attr('fill', 'none')
      .attr('stroke', d => EDGE_COLORS[d.edge_type] ?? '#444')
      .attr('stroke-width', 1.5).attr('stroke-opacity', 0.6)
      .attr('marker-end', d => `url(#arrow-${d.edge_type})`);

    // Drag — only meaningful for force layout
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (ev, d) => { if (!ev.active) simulationRef.current?.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag',  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on('end',   (ev, d) => { if (!ev.active) simulationRef.current?.alphaTarget(0); d.fx = null; d.fy = null; });

    // Node cards
    const cardG = g.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(graphNodes).join('g')
      .attr('class', d => `node-card node-${d.id}`)
      .attr('cursor', 'pointer')
      .on('click', (ev, d) => { ev.stopPropagation(); onSelectNode(d.data); })
      .call(view === 'force' ? drag : d3.drag<SVGGElement, GraphNode>());

    cardG.append('rect').attr('width', CARD_WIDTH).attr('height', CARD_HEIGHT)
      .attr('rx', 8).attr('fill', NODE_CARD_BG).attr('stroke', NODE_CARD_BORDER).attr('stroke-width', 1);
    cardG.append('rect').attr('width', 3).attr('height', CARD_HEIGHT).attr('rx', 2).attr('fill', d => d.color);
    cardG.append('text').text(d => d.node_type.replace(/_/g, ' '))
      .attr('x', 12).attr('y', 20).attr('font-size', 9).attr('fill', d => d.color)
      .attr('font-weight', '600').attr('letter-spacing', '0.05em');
    cardG.append('text').text(d => truncate(d.title, 28))
      .attr('x', 12).attr('y', 38).attr('font-size', 11).attr('fill', NODE_TITLE_FILL).attr('font-weight', '500');
    cardG.each(function(d) {
      const level = d.data.confidence_level ?? 0;
      for (let i = 0; i < 5; i++) {
        d3.select(this).append('circle').attr('cx', 12 + i * 10).attr('cy', 60).attr('r', 3)
          .attr('fill', i < level ? d.color : NODE_DOTS_EMPTY);
      }
    });

    // Dual-model indicators
    cardG.each(function(d) {
      const el = d3.select(this);
      const nt = d.data.node_type;
      if (nt === 'assumption_background' || nt === 'assumption_foreground') {
        const n = edges.filter(e => e.source_id === d.id && e.edge_type === 'serves_commitment').length;
        if (n > 0) el.append('text').text(`⬡ ${n} commitment${n > 1 ? 's' : ''}`)
          .attr('x', 12).attr('y', CARD_HEIGHT - 6).attr('font-size', 8).attr('fill', '#185FA5');
      } else if (nt === 'intervention') {
        const ce = edges.find(e => e.source_id === d.id && e.edge_type === 'serves_commitment');
        const te = edges.find(e => e.source_id === d.id && e.edge_type === 'tests_assumption');
        const cn = ce ? filteredNodes.find(n => n.id === ce.target_id) : null;
        const tn = te ? filteredNodes.find(n => n.id === te.target_id) : null;
        if (cn) el.append('text').text(`→ ${truncate(cn.title, 18)}`).attr('x', 12).attr('y', CARD_HEIGHT - 14).attr('font-size', 8).attr('fill', '#185FA5');
        if (tn) el.append('text').text(`⊹ ${truncate(tn.title, 18)}`).attr('x', 12).attr('y', CARD_HEIGHT - 4).attr('font-size', 8).attr('fill', '#534AB7');
      } else if (nt === 'signal') {
        const ce = edges.find(e => e.source_id === d.id && e.edge_type === 'challenges_assumption');
        const cn = ce ? filteredNodes.find(n => n.id === ce.target_id) : null;
        if (cn) el.append('text').text(`⚠ ${truncate(cn.title, 18)}`).attr('x', 12).attr('y', CARD_HEIGHT - 6).attr('font-size', 8).attr('fill', '#F59E0B');
      } else if (d.data.domain_tags.length > 0) {
        el.append('text').text(`#${d.data.domain_tags[0]}`).attr('x', CARD_WIDTH - 8).attr('y', CARD_HEIGHT - 10)
          .attr('font-size', 9).attr('fill', '#4b5563').attr('text-anchor', 'end');
      }
    });

    // ── Position nodes ──────────────────────────────────────────────────────

    function applyStaticPositions(posMap: Map<string, { x: number; y: number }>) {
      cardG.attr('transform', d => {
        const p = posMap.get(d.id) ?? { x: 0, y: 0 };
        // Store for edge rendering
        d.x = p.x; d.y = p.y;
        return `translate(${p.x - CARD_WIDTH / 2}, ${p.y - CARD_HEIGHT / 2})`;
      });
      link.attr('d', d => {
        const sx = (d.source as GraphNode).x ?? 0;
        const sy = (d.source as GraphNode).y ?? 0;
        const tx = (d.target as GraphNode).x ?? 0;
        const ty = (d.target as GraphNode).y ?? 0;
        return edgePath(sx, sy, tx, ty);
      });
    }

    if (view === 'force') {
      const simulation = d3.forceSimulation(graphNodes)
        .force('link', d3.forceLink<GraphNode, GraphLink>(graphLinks).id(d => d.id).distance(FORCE_CONFIG.linkDistance))
        .force('charge', d3.forceManyBody().strength(FORCE_CONFIG.charge))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(FORCE_CONFIG.centerStrength))
        .force('collide', d3.forceCollide<GraphNode>().radius(FORCE_CONFIG.collideRadius))
        .on('tick', () => {
          cardG.attr('transform', d => `translate(${(d.x ?? 0) - CARD_WIDTH / 2}, ${(d.y ?? 0) - CARD_HEIGHT / 2})`);
          link.attr('d', d => {
            const sx = (d.source as GraphNode).x ?? 0; const sy = (d.source as GraphNode).y ?? 0;
            const tx = (d.target as GraphNode).x ?? 0; const ty = (d.target as GraphNode).y ?? 0;
            return edgePath(sx, sy, tx, ty);
          });
        });
      simulationRef.current = simulation;
      return () => { simulation.stop(); };
    }

    if (view === 'tree') {
      applyStaticPositions(computeTreeLayout(graphNodes, graphLinks, width, height));
    } else if (view === 'timeline') {
      applyStaticPositions(computeTimelineLayout(graphNodes, width, height));
    } else if (view === 'workflow') {
      applyStaticPositions(computeWorkflowLayout(graphNodes, graphLinks, width, height));
    }

    return () => {};
  }, [filteredNodes.length, filteredEdges.length, activeTypes, view]);

  // Highlight effect (independent of layout)
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const { nodeIds, edgeIds, isTension } = getHighlightedIds(highlight ?? { type: 'none' });

    if (!nodeIds) {
      svg.selectAll<SVGGElement, GraphNode>('.node-card').attr('opacity', 1);
      svg.selectAll<SVGPathElement, GraphLink>('.links path')
        .attr('stroke', d => EDGE_COLORS[d.edge_type] ?? '#444').attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1.5).attr('marker-end', d => `url(#arrow-${d.edge_type})`);
      return;
    }

    svg.selectAll<SVGGElement, GraphNode>('.node-card').attr('opacity', d => nodeIds.has(d.id) ? 1 : 0.2);
    svg.selectAll<SVGPathElement, GraphLink>('.links path').each(function(d) {
      const inChain = edgeIds ? edgeIds.has(d.id) : (nodeIds.has(d.data.source_id) && nodeIds.has(d.data.target_id));
      const el = d3.select(this);
      if (inChain && isTension) {
        el.attr('stroke', HIGHLIGHT_EDGE_COLOR).attr('stroke-opacity', 0.9).attr('stroke-width', 2).attr('marker-end', 'url(#arrow-highlight)');
      } else if (inChain) {
        el.attr('stroke', EDGE_COLORS[d.edge_type] ?? '#444').attr('stroke-opacity', 0.9).attr('stroke-width', 2).attr('marker-end', `url(#arrow-${d.edge_type})`);
      } else {
        el.attr('stroke', EDGE_COLORS[d.edge_type] ?? '#444').attr('stroke-opacity', 0.15).attr('stroke-width', 1).attr('marker-end', `url(#arrow-${d.edge_type})`);
      }
    });
  }, [highlight]);

  return (
    <svg ref={svgRef} className="w-full h-full bg-gray-50 dark:bg-[#030712]" onClick={handleCanvasClick} />
  );
}
