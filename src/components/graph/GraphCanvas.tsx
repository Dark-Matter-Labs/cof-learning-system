'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { HighlightState } from '@/lib/types/highlight';
import {
  toGraphNode, toGraphLink, FORCE_CONFIG,
  CARD_WIDTH, CARD_HEIGHT,
  type GraphNode, type GraphLink,
} from '@/lib/graph/layout';

interface GraphCanvasProps {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly activeTypes: readonly string[];
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

const HIGHLIGHT_EDGE_COLOR = '#F59E0B'; // amber for tension chains

/** Derive the set of highlighted node IDs and edge IDs from highlight state. */
function getHighlightedIds(highlight: HighlightState): {
  nodeIds: ReadonlySet<string> | null;
  edgeIds: ReadonlySet<string> | null;
  isTension: boolean;
} {
  switch (highlight.type) {
    case 'commitment':
      return { nodeIds: highlight.connectedNodeIds, edgeIds: null, isTension: false };
    case 'tension':
      return { nodeIds: highlight.chainNodeIds, edgeIds: highlight.chainEdgeIds, isTension: true };
    case 'assumption':
      return { nodeIds: highlight.treeNodeIds, edgeIds: null, isTension: false };
    case 'none':
    default:
      return { nodeIds: null, edgeIds: null, isTension: false };
  }
}

export function GraphCanvas({ nodes, edges, activeTypes, onSelectNode, onCanvasClick, highlight }: GraphCanvasProps) {
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
    const screenX = event.clientX;
    const screenY = event.clientY;
    const g = svgRef.current?.querySelector('g');
    const transform = g ? d3.zoomTransform(g as unknown as Element) : d3.zoomIdentity;
    const [canvasX, canvasY] = transform.invert([event.clientX - rect.left, event.clientY - rect.top]);
    onCanvasClick(screenX, screenY, canvasX, canvasY);
  }, [onCanvasClick]);

  // Re-run D3 only when node/edge data changes (not on highlight changes)
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .on('zoom', event => { g.attr('transform', event.transform); });
    svg.call(zoom);

    // Defs: arrowheads per edge type
    const defs = svg.append('defs');
    const allEdgeTypes = [...Object.keys(EDGE_COLORS), 'highlight'];
    allEdgeTypes.forEach(type => {
      const color = type === 'highlight' ? HIGHLIGHT_EDGE_COLOR : (EDGE_COLORS[type] ?? '#444');
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', CARD_WIDTH / 2 + 8)
        .attr('refY', 0)
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', color);
    });

    // Links
    const link = g.append('g').attr('class', 'links')
      .selectAll<SVGPathElement, GraphLink>('path')
      .data(graphLinks)
      .join('path')
      .attr('class', d => `edge-${d.id}`)
      .attr('fill', 'none')
      .attr('stroke', d => EDGE_COLORS[d.edge_type] ?? '#444')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', d => `url(#arrow-${d.edge_type})`);

    // Drag behavior
    const dragBehavior = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Node cards
    const cardG = g.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(graphNodes)
      .join('g')
      .attr('class', d => `node-card node-${d.id}`)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelectNode(d.data);
      })
      .call(dragBehavior);

    // Card background
    cardG.append('rect')
      .attr('width', CARD_WIDTH)
      .attr('height', CARD_HEIGHT)
      .attr('rx', 8)
      .attr('fill', '#111827')
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1);

    // Left accent bar
    cardG.append('rect')
      .attr('width', 3)
      .attr('height', CARD_HEIGHT)
      .attr('rx', 2)
      .attr('fill', d => d.color);

    // Type label
    cardG.append('text')
      .text(d => d.node_type.replace(/_/g, ' '))
      .attr('x', 12)
      .attr('y', 20)
      .attr('font-size', 9)
      .attr('fill', d => d.color)
      .attr('font-weight', '600')
      .attr('text-transform', 'uppercase')
      .attr('letter-spacing', '0.05em');

    // Title
    cardG.append('text')
      .text(d => truncate(d.title, 28))
      .attr('x', 12)
      .attr('y', 38)
      .attr('font-size', 11)
      .attr('fill', '#e5e7eb')
      .attr('font-weight', '500');

    // Confidence dots
    cardG.each(function(d) {
      const level = d.data.confidence_level ?? 0;
      for (let i = 0; i < 5; i++) {
        d3.select(this).append('circle')
          .attr('cx', 12 + i * 10)
          .attr('cy', 60)
          .attr('r', 3)
          .attr('fill', i < level ? d.color : '#374151');
      }
    });

    // Dual-model indicators (bottom row)
    cardG.each(function(d) {
      const nodeType = d.data.node_type;
      const el = d3.select(this);

      if (nodeType === 'assumption_background' || nodeType === 'assumption_foreground') {
        // Count commitments that depend on this assumption via serves_commitment
        const dependentCount = edges.filter(
          e => e.source_id === d.id && e.edge_type === 'serves_commitment'
        ).length;
        if (dependentCount > 0) {
          el.append('text')
            .text(`⬡ ${dependentCount} commitment${dependentCount > 1 ? 's' : ''}`)
            .attr('x', 12)
            .attr('y', CARD_HEIGHT - 6)
            .attr('font-size', 8)
            .attr('fill', '#185FA5');
        }
      } else if (nodeType === 'intervention') {
        // Show commitment and assumption links
        const commEdge = edges.find(e => e.source_id === d.id && e.edge_type === 'serves_commitment');
        const testEdge = edges.find(e => e.source_id === d.id && e.edge_type === 'tests_assumption');
        const commNode = commEdge ? filteredNodes.find(n => n.id === commEdge.target_id) : null;
        const testNode = testEdge ? filteredNodes.find(n => n.id === testEdge.target_id) : null;
        if (commNode) {
          el.append('text')
            .text(`→ ${truncate(commNode.title, 18)}`)
            .attr('x', 12)
            .attr('y', CARD_HEIGHT - 14)
            .attr('font-size', 8)
            .attr('fill', '#185FA5');
        }
        if (testNode) {
          el.append('text')
            .text(`⊹ ${truncate(testNode.title, 18)}`)
            .attr('x', 12)
            .attr('y', CARD_HEIGHT - 4)
            .attr('font-size', 8)
            .attr('fill', '#534AB7');
        }
      } else if (nodeType === 'signal') {
        const challengeEdge = edges.find(e => e.source_id === d.id && e.edge_type === 'challenges_assumption');
        const challengedNode = challengeEdge ? filteredNodes.find(n => n.id === challengeEdge.target_id) : null;
        if (challengedNode) {
          el.append('text')
            .text(`⚠ ${truncate(challengedNode.title, 18)}`)
            .attr('x', 12)
            .attr('y', CARD_HEIGHT - 6)
            .attr('font-size', 8)
            .attr('fill', '#F59E0B');
        }
      } else if (d.data.domain_tags.length > 0) {
        el.append('text')
          .text(`#${d.data.domain_tags[0]}`)
          .attr('x', CARD_WIDTH - 8)
          .attr('y', CARD_HEIGHT - 10)
          .attr('font-size', 9)
          .attr('fill', '#4b5563')
          .attr('text-anchor', 'end');
      }
    });

    // Simulation
    const simulation = d3.forceSimulation(graphNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphLinks)
        .id(d => d.id)
        .distance(FORCE_CONFIG.linkDistance))
      .force('charge', d3.forceManyBody().strength(FORCE_CONFIG.charge))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(FORCE_CONFIG.centerStrength))
      .force('collide', d3.forceCollide<GraphNode>().radius(FORCE_CONFIG.collideRadius))
      .on('tick', () => {
        cardG.attr('transform', d =>
          `translate(${(d.x ?? 0) - CARD_WIDTH / 2}, ${(d.y ?? 0) - CARD_HEIGHT / 2})`
        );
        link.attr('d', d => {
          const sx = (d.source as GraphNode).x ?? 0;
          const sy = (d.source as GraphNode).y ?? 0;
          const tx = (d.target as GraphNode).x ?? 0;
          const ty = (d.target as GraphNode).y ?? 0;
          const mx = (sx + tx) / 2;
          const my = (sy + ty) / 2 - 30;
          return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
        });
      });

    simulationRef.current = simulation;
    return () => { simulation.stop(); };
  }, [filteredNodes.length, filteredEdges.length, activeTypes]);

  // Apply highlight styles separately (no need to re-run simulation)
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const { nodeIds, edgeIds, isTension } = getHighlightedIds(highlight ?? { type: 'none' });

    if (!nodeIds) {
      // No highlight — restore everything
      svg.selectAll<SVGGElement, GraphNode>('.node-card').attr('opacity', 1);
      svg.selectAll<SVGPathElement, GraphLink>('.links path')
        .attr('stroke', d => EDGE_COLORS[d.edge_type] ?? '#444')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1.5)
        .attr('marker-end', d => `url(#arrow-${d.edge_type})`);
      return;
    }

    // Fade non-highlighted nodes
    svg.selectAll<SVGGElement, GraphNode>('.node-card')
      .attr('opacity', d => (nodeIds.has(d.id) ? 1 : 0.2));

    // Style edges
    svg.selectAll<SVGPathElement, GraphLink>('.links path')
      .each(function(d) {
        const inChain = edgeIds ? edgeIds.has(d.id) : (nodeIds.has(d.data.source_id) && nodeIds.has(d.data.target_id));
        const el = d3.select(this);
        if (inChain && isTension) {
          el.attr('stroke', HIGHLIGHT_EDGE_COLOR)
            .attr('stroke-opacity', 0.9)
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrow-highlight)');
        } else if (inChain) {
          el.attr('stroke', EDGE_COLORS[d.edge_type] ?? '#444')
            .attr('stroke-opacity', 0.9)
            .attr('stroke-width', 2)
            .attr('marker-end', `url(#arrow-${d.edge_type})`);
        } else {
          el.attr('stroke', EDGE_COLORS[d.edge_type] ?? '#444')
            .attr('stroke-opacity', 0.15)
            .attr('stroke-width', 1)
            .attr('marker-end', `url(#arrow-${d.edge_type})`);
        }
      });
  }, [highlight]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ background: '#030712' }}
      onClick={handleCanvasClick}
    />
  );
}
