import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GoalSpacePanel } from '../GoalSpacePanel';
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

const goalSpaceNode = makeNode({ id: 'gs-1', node_type: 'goal_space', title: 'Formation capital model' });
const triggerOutcome1 = makeNode({ id: 'to-1', node_type: 'trigger_outcome', title: 'Outcome Alpha' });
const triggerOutcome2 = makeNode({ id: 'to-2', node_type: 'trigger_outcome', title: 'Outcome Beta' });

const advancesGoalEdge1 = makeEdge({ id: 'e-1', source_id: 'to-1', target_id: 'gs-1', edge_type: 'advances_goal' });
const advancesGoalEdge2 = makeEdge({ id: 'e-2', source_id: 'to-2', target_id: 'gs-1', edge_type: 'advances_goal' });

describe('GoalSpacePanel', () => {
  it('renders NodeTypeBadge with node_type and panel title', () => {
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[]}
        allNodes={[goalSpaceNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('goal space')).toBeInTheDocument();
    expect(screen.getByText('Formation capital model')).toBeInTheDocument();
  });

  it('shows correct trigger outcome count in section header', () => {
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[advancesGoalEdge1, advancesGoalEdge2]}
        allNodes={[goalSpaceNode, triggerOutcome1, triggerOutcome2]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Trigger Outcomes (2)')).toBeInTheDocument();
  });

  it('shows empty state when no advances_goal edges target this node', () => {
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[]}
        allNodes={[goalSpaceNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('No trigger outcomes linked')).toBeInTheDocument();
    expect(screen.getByText('Trigger Outcomes (0)')).toBeInTheDocument();
  });

  it('renders outcome titles when advances_goal edges exist', () => {
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[advancesGoalEdge1, advancesGoalEdge2]}
        allNodes={[goalSpaceNode, triggerOutcome1, triggerOutcome2]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Outcome Alpha')).toBeInTheDocument();
    expect(screen.getByText('Outcome Beta')).toBeInTheDocument();
  });

  it('renders not_started status symbol ○ for outcome with no edges', () => {
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[advancesGoalEdge1]}
        allNodes={[goalSpaceNode, triggerOutcome1]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('\u25CB')).toBeInTheDocument();
  });

  it('renders in_progress status symbol ◐ for outcome with assigned_to_outcome edge', () => {
    const assignedEdge = makeEdge({ id: 'e-assigned', source_id: 'c-1', target_id: 'to-1', edge_type: 'assigned_to_outcome' });
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[advancesGoalEdge1, assignedEdge]}
        allNodes={[goalSpaceNode, triggerOutcome1]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('\u25D0')).toBeInTheDocument();
  });

  it('renders met status symbol ◉ for outcome with indicates_progress edge from promoted node', () => {
    const promotedNode = makeNode({ id: 'signal-1', node_type: 'signal', status: 'promoted' });
    const progressEdge = makeEdge({ id: 'e-progress', source_id: 'signal-1', target_id: 'to-1', edge_type: 'indicates_progress' });
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[advancesGoalEdge1, progressEdge]}
        allNodes={[goalSpaceNode, triggerOutcome1, promotedNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('\u25C9')).toBeInTheDocument();
  });

  it('renders blocked status symbol ✕ for outcome with falsified source node', () => {
    const falsifiedNode = makeNode({ id: 'assumption-1', node_type: 'assumption_foreground', status: 'falsified' });
    const progressEdge = makeEdge({ id: 'e-falsified', source_id: 'assumption-1', target_id: 'to-1', edge_type: 'indicates_progress' });
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[advancesGoalEdge1, progressEdge]}
        allNodes={[goalSpaceNode, triggerOutcome1, falsifiedNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('\u2715')).toBeInTheDocument();
  });

  it('renders commitment count correctly', () => {
    const commitmentNode = makeNode({ id: 'c-1', node_type: 'commitment' });
    const assignedEdge = makeEdge({ id: 'e-assigned', source_id: 'c-1', target_id: 'to-1', edge_type: 'assigned_to_outcome' });
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[advancesGoalEdge1, assignedEdge]}
        allNodes={[goalSpaceNode, triggerOutcome1, commitmentNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('1 commitment')).toBeInTheDocument();
  });

  it('renders hunch count correctly', () => {
    const hunchNode = makeNode({ id: 'h-1', node_type: 'hunch' });
    const hunchEdge = makeEdge({ id: 'e-hunch', source_id: 'h-1', target_id: 'to-1', edge_type: 'targets_outcome' });
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[advancesGoalEdge1, hunchEdge]}
        allNodes={[goalSpaceNode, triggerOutcome1, hunchNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('1 hunch')).toBeInTheDocument();
  });

  it('pluralizes commitments correctly', () => {
    const commitmentNode1 = makeNode({ id: 'c-1', node_type: 'commitment' });
    const commitmentNode2 = makeNode({ id: 'c-2', node_type: 'commitment' });
    const assignedEdge1 = makeEdge({ id: 'e-a1', source_id: 'c-1', target_id: 'to-1', edge_type: 'assigned_to_outcome' });
    const assignedEdge2 = makeEdge({ id: 'e-a2', source_id: 'c-2', target_id: 'to-1', edge_type: 'assigned_to_outcome' });
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[advancesGoalEdge1, assignedEdge1, assignedEdge2]}
        allNodes={[goalSpaceNode, triggerOutcome1, commitmentNode1, commitmentNode2]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('2 commitments')).toBeInTheDocument();
  });

  it('pluralizes hunches correctly', () => {
    const hunchNode1 = makeNode({ id: 'h-1', node_type: 'hunch' });
    const hunchNode2 = makeNode({ id: 'h-2', node_type: 'hunch' });
    const hunchEdge1 = makeEdge({ id: 'e-h1', source_id: 'h-1', target_id: 'to-1', edge_type: 'targets_outcome' });
    const hunchEdge2 = makeEdge({ id: 'e-h2', source_id: 'h-2', target_id: 'to-1', edge_type: 'targets_outcome' });
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[advancesGoalEdge1, hunchEdge1, hunchEdge2]}
        allNodes={[goalSpaceNode, triggerOutcome1, hunchNode1, hunchNode2]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('2 hunches')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <GoalSpacePanel
        node={goalSpaceNode}
        edges={[]}
        allNodes={[goalSpaceNode]}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close goal space panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
