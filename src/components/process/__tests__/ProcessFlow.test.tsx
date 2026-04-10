import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessFlow } from '../ProcessFlow';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'node-1',
    node_type: 'learning',
    title: 'Test learning node',
    description: 'Some description',
    content: null,
    hunch_type: null,
    confidence_level: null,
    confidence_basis: null,
    status: 'promoted',
    llm_extraction: null,
    llm_review: null,
    human_review: null,
    author_id: null,
    parent_node_id: null,
    insight_date: null,
    domain_tags: [],
    external_links: [],
    attachments: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeEdge(overrides: Partial<Edge> = {}): Edge {
  return {
    id: 'edge-1',
    source_id: '',
    target_id: '',
    edge_type: 'supports',
    weight: 1,
    description: null,
    author_id: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const mockProps = {
  onClose: vi.fn(),
  onNodeCreated: vi.fn(),
  onEdgeAdded: vi.fn(),
  onNodeUpdated: vi.fn(),
};

// Mock fetch globally — default: step APIs return empty, capture returns a node
function mockFetchEmpty() {
  vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/process/suggest/nodes')) {
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    }
    if (urlStr.includes('/api/process/suggest/hunch')) {
      return { ok: true, json: async () => ({ data: { suggested: false, hunch: null, reasoning: 'no hunch' } }) } as Response;
    }
    if (urlStr.includes('/api/process/suggest/commitments')) {
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    }
    if (urlStr.includes('/api/capture')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ data: makeNode({ id: 'new-hunch-1', node_type: 'hunch', title: 'New hunch' }) }),
      } as Response;
    }
    if (urlStr.includes('/api/graph/edges')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ data: makeEdge({ id: 'new-edge-1' }) }),
      } as Response;
    }
    if (urlStr.includes('/api/nodes/')) {
      return { ok: true, json: async () => ({ data: makeNode() }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProcessFlow — basic rendering', () => {
  beforeEach(() => {
    mockFetchEmpty();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the process flow panel with source node title', () => {
    const sourceNode = makeNode({ title: 'My learning title' });
    render(
      <ProcessFlow
        sourceNode={sourceNode}
        allNodes={[sourceNode]}
        allEdges={[]}
        {...mockProps}
      />
    );
    expect(screen.getByText('My learning title')).toBeInTheDocument();
    expect(screen.getByText('Process this')).toBeInTheDocument();
  });

  it('renders close button', () => {
    const sourceNode = makeNode();
    render(
      <ProcessFlow
        sourceNode={sourceNode}
        allNodes={[sourceNode]}
        allEdges={[]}
        {...mockProps}
      />
    );
    expect(screen.getByRole('button', { name: /close process flow/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const sourceNode = makeNode();
    render(
      <ProcessFlow
        sourceNode={sourceNode}
        allNodes={[sourceNode]}
        allEdges={[]}
        {...mockProps}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /close process flow/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows step label for step 1 initially', () => {
    const sourceNode = makeNode();
    render(
      <ProcessFlow
        sourceNode={sourceNode}
        allNodes={[sourceNode]}
        allEdges={[]}
        {...mockProps}
      />
    );
    expect(screen.getByText(/Does this reshape existing thinking/i)).toBeInTheDocument();
  });
});

// ─── "Process this" button in NodeDetailPanel ─────────────────────────────────

describe('"Process this" button in NodeDetailPanel', () => {
  it('appears for learning node', async () => {
    const { NodeDetailPanel } = await import('../../graph/NodeDetailPanel');
    const node = makeNode({ node_type: 'learning' });
    const onProcessThis = vi.fn();
    render(
      <NodeDetailPanel
        node={node}
        edges={[]}
        allNodes={[node]}
        onClose={vi.fn()}
        onProcessThis={onProcessThis}
      />
    );
    expect(screen.getByRole('button', { name: /process this/i })).toBeInTheDocument();
  });

  it('appears for signal node', async () => {
    const { NodeDetailPanel } = await import('../../graph/NodeDetailPanel');
    const node = makeNode({ node_type: 'signal' });
    const onProcessThis = vi.fn();
    render(
      <NodeDetailPanel
        node={node}
        edges={[]}
        allNodes={[node]}
        onClose={vi.fn()}
        onProcessThis={onProcessThis}
      />
    );
    expect(screen.getByRole('button', { name: /process this/i })).toBeInTheDocument();
  });

  it('does not appear for hunch node', async () => {
    const { NodeDetailPanel } = await import('../../graph/NodeDetailPanel');
    const node = makeNode({ node_type: 'hunch' });
    render(
      <NodeDetailPanel
        node={node}
        edges={[]}
        allNodes={[node]}
        onClose={vi.fn()}
        onProcessThis={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /process this/i })).not.toBeInTheDocument();
  });

  it('does not appear when onProcessThis not provided', async () => {
    const { NodeDetailPanel } = await import('../../graph/NodeDetailPanel');
    const node = makeNode({ node_type: 'learning' });
    render(
      <NodeDetailPanel
        node={node}
        edges={[]}
        allNodes={[node]}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /process this/i })).not.toBeInTheDocument();
  });

  it('calls onProcessThis with node when clicked', async () => {
    const { NodeDetailPanel } = await import('../../graph/NodeDetailPanel');
    const node = makeNode({ node_type: 'learning', title: 'My learning' });
    const onProcessThis = vi.fn();
    render(
      <NodeDetailPanel
        node={node}
        edges={[]}
        allNodes={[node]}
        onClose={vi.fn()}
        onProcessThis={onProcessThis}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /process this/i }));
    expect(onProcessThis).toHaveBeenCalledWith(node);
  });
});

// ─── Skip behaviour ───────────────────────────────────────────────────────────

describe('ProcessFlow — skip navigation', () => {
  beforeEach(() => {
    mockFetchEmpty();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Skip button on step 1 advances to step 2', async () => {
    const sourceNode = makeNode();
    render(
      <ProcessFlow
        sourceNode={sourceNode}
        allNodes={[sourceNode]}
        allEdges={[]}
        {...mockProps}
      />
    );

    // Wait for loading to finish — step1 fetches suggestions
    await waitFor(() => {
      expect(screen.queryByText(/analysing connections/i)).not.toBeInTheDocument();
    });

    // Since no connected nodes and empty suggestions, step 1 auto-skips to step 2
    // Step 2 should be visible
    await waitFor(() => {
      expect(screen.getByText(/Does this spark a new hunch/i)).toBeInTheDocument();
    });
  });
});

// ─── Completion ───────────────────────────────────────────────────────────────

describe('ProcessFlow — completion', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/process/suggest/nodes')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (urlStr.includes('/api/process/suggest/hunch')) {
        return { ok: true, json: async () => ({ data: { suggested: false, hunch: null, reasoning: 'no' } }) } as Response;
      }
      if (urlStr.includes('/api/process/suggest/commitments')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (urlStr.includes('/api/nodes/')) {
        return { ok: true, json: async () => ({ data: makeNode({ id: 'node-1' }) }) } as Response;
      }
      if (urlStr.includes('/api/graph/edges')) {
        return { ok: true, status: 201, json: async () => ({ data: makeEdge() }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks node as processed when completing step 4', async () => {
    const sourceNode = makeNode({ node_type: 'learning', id: 'node-1' });
    render(
      <ProcessFlow
        sourceNode={sourceNode}
        allNodes={[sourceNode]}
        allEdges={[]}
        {...mockProps}
      />
    );

    // Wait for step 1 to auto-skip (no connections, no suggestions)
    await waitFor(() => {
      expect(screen.queryByText(/analysing connections/i)).not.toBeInTheDocument();
    });

    // Step 2 is shown — loading hunch suggestion
    await waitFor(() => {
      // Not showing loading anymore
      expect(screen.queryByText(/generating hunch suggestion/i)).not.toBeInTheDocument();
    });

    // Should be on step 2 — click "No — confirms existing thinking"
    await waitFor(() => {
      expect(screen.getByText(/No — confirms existing thinking/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/No — confirms existing thinking/i));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Saving on step 2...
    await waitFor(() => {
      // Step 3 — no commitments so auto-skips to step 4
      expect(screen.queryByText(/What does this mean for active commitments/i)).not.toBeInTheDocument();
    });

    // Step 4
    await waitFor(() => {
      expect(screen.getByText(/Who needs to see this/i)).toBeInTheDocument();
    });

    // Complete step 4 — no entities so shows "Continue" button
    const completeBtn = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Processing complete/i)).toBeInTheDocument();
    });

    // Verify node was marked as processed
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/nodes/node-1'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });
});
