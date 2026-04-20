import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// D3 does real DOM work in SVG that JSDOM handles poorly.
// We verify: the component accepts onSelectCommitment and renders without throwing.
vi.mock('d3', () => {
  const noop = () => mockChain;
  const mockChain: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'selectAll', 'append', 'attr', 'call', 'on', 'each', 'data', 'join',
    'filter', 'text', 'zoom', 'zoomIdentity', 'force', 'forceSimulation', 'forceLink',
    'forceManyBody', 'forceCenter', 'forceCollide', 'drag', 'hierarchy', 'tree',
    'scaleLinear', 'scaleTime', 'axisBottom', 'axisTop', 'zoomTransform',
    // zoom chain
    'scaleExtent',
    // force simulation chain
    'alphaTarget', 'restart', 'strength', 'distance', 'radius', 'id', 'stop',
    // selection chain
    'remove', 'style', 'size',
    // axis chain
    'ticks', 'tickFormat', 'domain', 'range',
    // misc
    'invert',
  ];
  chainMethods.forEach(m => { mockChain[m] = noop; });
  mockChain.invert = () => [0, 0];
  return mockChain;
});

import { GraphCanvas } from '../GraphCanvas';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

const makeNode = (id: string, node_type: string): Node => ({
  id,
  node_type,
  title: `Node ${id}`,
  description: null,
  status: 'promoted',
  llm_extraction: null,
  hunch_type: null,
  confidence_level: null,
  confidence_basis: null,
  content: null,
  llm_review: null,
  human_review: null,
  author_id: null,
  parent_node_id: null,
  insight_date: null,
  domain_tags: [],
  external_links: [],
  attachments: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

describe('GraphCanvas', () => {
  it('renders without throwing when commitment nodes are present', () => {
    const nodes: Node[] = [makeNode('c1', 'commitment'), makeNode('h1', 'hunch')];
    const onSelectNode = vi.fn();
    const onSelectCommitment = vi.fn();

    expect(() =>
      render(
        <GraphCanvas
          nodes={nodes}
          edges={[] as Edge[]}
          activeTypes={['commitment', 'hunch']}
          view="force"
          onSelectNode={onSelectNode}
          onSelectCommitment={onSelectCommitment}
        />
      )
    ).not.toThrow();
  });

  it('renders without onSelectCommitment prop (backward compatible)', () => {
    expect(() =>
      render(
        <GraphCanvas
          nodes={[makeNode('h1', 'hunch')]}
          edges={[] as Edge[]}
          activeTypes={['hunch']}
          view="force"
          onSelectNode={vi.fn()}
        />
      )
    ).not.toThrow();
  });
});
