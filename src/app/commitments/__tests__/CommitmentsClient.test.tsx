import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/commitment/GoalSpaceSection', () => ({
  GoalSpaceSection: ({ goalSpace }: { goalSpace: { title: string } }) =>
    React.createElement('div', { 'data-testid': 'goal-space-section' }, goalSpace.title),
}));

vi.mock('@/components/commitment/CommitmentCard', () => ({
  CommitmentCard: ({
    commitment,
    onEdit,
  }: {
    commitment: { title: string; id: string };
    onEdit?: () => void;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'commitment-card' },
      commitment.title,
      onEdit
        ? React.createElement('button', { onClick: onEdit, 'data-testid': 'edit-btn' }, 'Edit')
        : null,
    ),
}));

vi.mock('@/components/commitment/CommitmentCardEditor', () => ({
  CommitmentCardEditor: ({
    commitment,
    onSave,
    onCancel,
  }: {
    commitment: { title: string; id: string };
    onSave: (id: string, updates: object) => Promise<void>;
    onCancel: () => void;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'commitment-editor' },
      commitment.title,
      React.createElement(
        'button',
        {
          'data-testid': 'save-btn',
          onClick: () => onSave(commitment.id, { title: commitment.title, description: null, content: { status: 'active', resource_allocation: null } }),
        },
        'Save',
      ),
      React.createElement(
        'button',
        { 'data-testid': 'cancel-btn', onClick: onCancel },
        'Cancel',
      ),
    ),
}));

vi.mock('@/components/commitment/TensionAlertItem', () => ({
  TensionAlertItem: ({ alert }: { alert: { description: string } }) =>
    React.createElement('div', { 'data-testid': 'tension-item' }, alert.description),
}));

import { CommitmentsClient } from '../CommitmentsClient';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';

const emptyProps = {
  goalSpaces: [] as Node[],
  triggerOutcomes: [] as Node[],
  initialCommitments: [] as Node[],
  allNodes: [] as Node[],
  edges: [] as Edge[],
  tensions: [] as TensionAlert[],
};

const baseNode = (id: string, title: string, node_type: string): Node => ({
  id,
  title,
  node_type,
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
  lifecycle_stage: null,
  stage_transitioned_at: null,
  stage_transition_reason: null,
});

describe('CommitmentsClient', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('shows empty state when no commitments or goal spaces', () => {
    render(<CommitmentsClient {...emptyProps} />);
    expect(screen.getByText('No commitments yet.')).toBeInTheDocument();
  });

  it('renders a GoalSpaceSection for each goal space', () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        goalSpaces={[baseNode('gs1', 'Climate resilience', 'goal_space')]}
      />,
    );
    expect(screen.getByTestId('goal-space-section')).toBeInTheDocument();
  });

  it('renders unlinked commitments as CommitmentCards', () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        initialCommitments={[baseNode('c1', 'Fund Madrid pilot', 'commitment')]}
      />,
    );
    expect(screen.getByTestId('commitment-card')).toBeInTheDocument();
    expect(screen.getByText('Fund Madrid pilot')).toBeInTheDocument();
  });

  it('renders tension alerts section when active tensions exist', () => {
    const tension: TensionAlert = {
      id: 't1',
      type: 'assumption_challenged',
      severity: 'high',
      description: 'Madrid assumption challenged',
      status: 'active',
      source_node_id: null,
      affected_assumption_id: null,
      affected_commitment_ids: [],
      resolved_by: null,
      resolved_action: null,
      resolved_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    render(<CommitmentsClient {...emptyProps} tensions={[tension]} />);
    expect(screen.getByTestId('tension-item')).toBeInTheDocument();
  });

  it('does not render tensions section when empty', () => {
    render(<CommitmentsClient {...emptyProps} />);
    expect(screen.queryByTestId('tension-item')).toBeNull();
  });

  it('renders the add commitment input', () => {
    render(<CommitmentsClient {...emptyProps} />);
    expect(screen.getByPlaceholderText('New commitment…')).toBeInTheDocument();
  });

  it('submitting the add form calls /api/capture and adds the commitment', async () => {
    const newNode = baseNode('c-new', 'My new commitment', 'commitment');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: newNode }),
    }));
    render(<CommitmentsClient {...emptyProps} />);
    fireEvent.change(screen.getByPlaceholderText('New commitment…'), {
      target: { value: 'My new commitment' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(screen.getByText('My new commitment')).toBeInTheDocument();
    });
  });

  it('shows error when add API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<CommitmentsClient {...emptyProps} />);
    fireEvent.change(screen.getByPlaceholderText('New commitment…'), {
      target: { value: 'Something' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(screen.getByText('Failed to add commitment')).toBeInTheDocument();
    });
  });

  it('clicking edit shows CommitmentCardEditor instead of CommitmentCard', async () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        initialCommitments={[baseNode('c1', 'Fund Madrid pilot', 'commitment')]}
      />,
    );
    fireEvent.click(screen.getByTestId('edit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('commitment-editor')).toBeInTheDocument();
      expect(screen.queryByTestId('commitment-card')).toBeNull();
    });
  });

  it('successful save updates card and closes editor', async () => {
    const updatedNode = baseNode('c1', 'Updated title', 'commitment');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: updatedNode }),
    }));
    render(
      <CommitmentsClient
        {...emptyProps}
        initialCommitments={[baseNode('c1', 'Fund Madrid pilot', 'commitment')]}
      />,
    );
    fireEvent.click(screen.getByTestId('edit-btn'));
    await waitFor(() => expect(screen.getByTestId('commitment-editor')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('commitment-editor')).toBeNull();
      expect(screen.getByTestId('commitment-card')).toBeInTheDocument();
    });
  });

  it('cancel edit closes editor without changing card', () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        initialCommitments={[baseNode('c1', 'Fund Madrid pilot', 'commitment')]}
      />,
    );
    fireEvent.click(screen.getByTestId('edit-btn'));
    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(screen.getByTestId('commitment-card')).toBeInTheDocument();
    expect(screen.queryByTestId('commitment-editor')).toBeNull();
  });
});
