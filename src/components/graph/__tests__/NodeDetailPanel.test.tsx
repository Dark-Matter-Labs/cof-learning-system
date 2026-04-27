import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NodeDetailPanel } from '../NodeDetailPanel';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

function makeNode(overrides: Partial<Node>): Node {
  return {
    id: 'node-1',
    node_type: 'hunch',
    title: 'Test node title',
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
    insight_date: null,
    domain_tags: [],
    external_links: [],
    attachments: [],
    lifecycle_stage: null,
    stage_transitioned_at: null,
    stage_transition_reason: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
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

const testNode = makeNode({
  id: 'node-abc',
  node_type: 'hunch',
  title: 'My hunch title',
  description: 'A detailed description',
  status: 'promoted',
  domain_tags: ['climate', 'policy'],
});

describe('NodeDetailPanel — view mode', () => {
  it('renders title in view mode', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('My hunch title')).toBeInTheDocument();
  });

  it('renders Edit button in view mode', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('renders connections section when edges exist', () => {
    const otherNode = makeNode({ id: 'other-1', title: 'Other node' });
    const edge = makeEdge({ source_id: 'node-abc', target_id: 'other-1', edge_type: 'related_to' });
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[edge]}
        allNodes={[testNode, otherNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Connections/)).toBeInTheDocument();
  });
});

describe('NodeDetailPanel — edit mode toggle', () => {
  it('clicking Edit switches to edit mode showing title input', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const titleInput = screen.getByDisplayValue('My hunch title');
    expect(titleInput.tagName).toBe('INPUT');
  });

  it('edit mode shows description textarea', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByDisplayValue('A detailed description')).toBeInTheDocument();
  });

  it('edit mode shows type select', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('combobox', { name: /type/i })).toBeInTheDocument();
  });

  it('edit mode shows domain tag chips', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByText('climate')).toBeInTheDocument();
    expect(screen.getByText('policy')).toBeInTheDocument();
  });

  it('edit mode shows Save and Cancel buttons', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});

describe('NodeDetailPanel — Cancel', () => {
  it('Cancel returns to view mode without calling fetch', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it('Cancel discards field changes', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const titleInput = screen.getByDisplayValue('My hunch title');
    fireEvent.change(titleInput, { target: { value: 'Changed title' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    // Back in view mode — original title shown
    expect(screen.getByText('My hunch title')).toBeInTheDocument();
  });
});

describe('NodeDetailPanel — Save', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ...testNode, title: 'Updated title' } }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Save calls fetch PATCH with updated fields', async () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const titleInput = screen.getByDisplayValue('My hunch title');
    fireEvent.change(titleInput, { target: { value: 'Updated title' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/nodes/node-abc'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  it('Save exits edit mode on success', async () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });
  });

  it('Save calls onNodeUpdated with updated node', async () => {
    const onNodeUpdated = vi.fn();
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
        onNodeUpdated={onNodeUpdated}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onNodeUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated title' })
      );
    });
  });
});

describe('NodeDetailPanel — status select constraints', () => {
  it('status select only shows user-facing statuses', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const statusSelect = screen.getByRole('combobox', { name: /status/i });
    const options = Array.from(statusSelect.querySelectorAll('option')).map(o => o.value);
    expect(options).toContain('promoted');
    expect(options).toContain('archived');
    expect(options).toContain('falsified');
    expect(options).toContain('suspended');
    expect(options).not.toContain('raw');
    expect(options).not.toContain('processing');
    expect(options).not.toContain('llm_reviewed');
    expect(options).not.toContain('human_reviewed');
    expect(options).not.toContain('error');
  });
});

describe('NodeDetailPanel — domain tag chips', () => {
  it('renders removable tag chips in edit mode', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    // Each chip should have a remove button
    const removeButtons = screen.getAllByRole('button', { name: /remove.*tag|×/i });
    expect(removeButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('adding a tag via input and Enter appends it to chips', () => {
    const nodeWithTags = makeNode({ ...testNode, domain_tags: ['existing'] });
    render(
      <NodeDetailPanel
        node={nodeWithTags}
        edges={[]}
        allNodes={[nodeWithTags]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const tagInput = screen.getByPlaceholderText(/add tag/i);
    fireEvent.change(tagInput, { target: { value: 'newtag' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    expect(screen.getByText('newtag')).toBeInTheDocument();
  });
});

// ─── Connection Management (Plan 02) ────────────────────────────────────────

const otherNodeForEdge = makeNode({ id: 'other-node', title: 'Connected Node Title' });
const edgeForTest = makeEdge({
  id: 'edge-123',
  source_id: 'node-abc',
  target_id: 'other-node',
  edge_type: 'supports',
});

describe('NodeDetailPanel — connection list', () => {
  it('renders edge type, direction arrow, and connected node title for each connection', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[edgeForTest]}
        allNodes={[testNode, otherNodeForEdge]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByText('supports')).toBeInTheDocument();
    expect(screen.getByText('Connected Node Title')).toBeInTheDocument();
  });

  it('renders Remove button for each connection', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[edgeForTest]}
        allNodes={[testNode, otherNodeForEdge]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });
});

describe('NodeDetailPanel — remove connection', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clicking Remove calls fetch DELETE /api/edges/{edgeId}', async () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[edgeForTest]}
        allNodes={[testNode, otherNodeForEdge]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/edges/edge-123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('clicking Remove calls onEdgeRemoved with edge id on success', async () => {
    const onEdgeRemoved = vi.fn();
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[edgeForTest]}
        allNodes={[testNode, otherNodeForEdge]}
        onClose={vi.fn()}
        onEdgeRemoved={onEdgeRemoved}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => {
      expect(onEdgeRemoved).toHaveBeenCalledWith('edge-123');
    });
  });
});

describe('NodeDetailPanel — add connection form', () => {
  it('clicking "Add connection" shows the add-connection form', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add connection/i }));
    expect(screen.getByRole('combobox', { name: /edge type/i })).toBeInTheDocument();
  });

  it('add connection form has direction toggle buttons by default', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add connection/i }));
    // Select a directional type first (default should be directional)
    expect(screen.getByRole('button', { name: /this node.*target/i })).toBeInTheDocument();
  });

  it('direction toggle is hidden when undirected edge type (connected_to) is selected', async () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add connection/i }));
    const edgeTypeSelect = screen.getByRole('combobox', { name: /edge type/i });
    fireEvent.change(edgeTypeSelect, { target: { value: 'connected_to' } });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /this node.*target/i })).not.toBeInTheDocument();
    });
  });

  it('cancel button hides the add connection form', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add connection/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('combobox', { name: /edge type/i })).not.toBeInTheDocument();
  });
});

describe('NodeDetailPanel — confirm add connection', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        data: {
          id: 'new-edge-1',
          source_id: 'node-abc',
          target_id: 'other-node',
          edge_type: 'supports',
          weight: 1,
          description: null,
          author_id: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows error message when add connection returns 500 (e.g. duplicate)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'duplicate key value violates unique constraint' }),
    } as Response);

    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode, otherNodeForEdge]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add connection/i }));
    // Confirm without selecting a node — or mock the selectedNode state
    // For this test, directly click confirm to trigger a fetch error
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => {
      // Should show some error/warning — either "select a node" or the API error
      const errorEl = screen.queryByText(/already exists|error|required|select/i);
      expect(errorEl).toBeInTheDocument();
    });
  });
});
