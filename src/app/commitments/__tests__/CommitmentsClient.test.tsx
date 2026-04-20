import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/commitment/GoalSpaceSection', () => ({
  GoalSpaceSection: ({ goalSpace }: { goalSpace: { title: string } }) =>
    React.createElement('div', { 'data-testid': 'goal-space-section' }, goalSpace.title),
}));

vi.mock('@/components/commitment/CommitmentCard', () => ({
  CommitmentCard: ({ commitment }: { commitment: { title: string; id: string } }) =>
    React.createElement('div', { 'data-testid': 'commitment-card' }, commitment.title),
}));

vi.mock('@/components/commitment/TensionAlertItem', () => ({
  TensionAlertItem: ({ alert }: { alert: { id: string; description: string } }) =>
    React.createElement('div', { 'data-testid': 'tension-item' }, alert.description),
}));

import { CommitmentsClient } from '../CommitmentsClient';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';

const emptyProps = {
  goalSpaces: [] as Node[],
  triggerOutcomes: [] as Node[],
  commitments: [] as Node[],
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
});

describe('CommitmentsClient', () => {
  it('shows empty state when no commitments or goal spaces', () => {
    render(<CommitmentsClient {...emptyProps} />);
    expect(screen.getByText('No commitments yet.')).toBeTruthy();
  });

  it('renders a GoalSpaceSection for each goal space', () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        goalSpaces={[baseNode('gs1', 'Climate resilience', 'goal_space')]}
      />
    );
    expect(screen.getByTestId('goal-space-section')).toBeTruthy();
    expect(screen.getByText('Climate resilience')).toBeTruthy();
  });

  it('renders unlinked commitments (no edge to any goal space)', () => {
    render(
      <CommitmentsClient
        {...emptyProps}
        commitments={[baseNode('c1', 'Fund Madrid pilot', 'commitment')]}
      />
    );
    expect(screen.getByTestId('commitment-card')).toBeTruthy();
    expect(screen.getByText('Fund Madrid pilot')).toBeTruthy();
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
      resolved_action: null,
      resolved_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    render(<CommitmentsClient {...emptyProps} tensions={[tension]} />);
    expect(screen.getByTestId('tension-item')).toBeTruthy();
  });

  it('does not render tensions section when empty', () => {
    render(<CommitmentsClient {...emptyProps} />);
    expect(screen.queryByTestId('tension-item')).toBeNull();
  });
});
