import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

import { ReviewItem } from '../ReviewItem';
import type { Node } from '@/lib/types/nodes';

const baseNode: Node = {
  id: 'n1',
  node_type: 'hunch',
  title: 'Uncertain Hunch',
  description: 'A test description',
  status: 'flagged_for_review',
  llm_extraction: { maturity: 'watch_closely' } as unknown as Node['llm_extraction'],
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
};

describe('ReviewItem', () => {
  it('renders the node title and the three actions', () => {
    render(<ReviewItem node={baseNode} kind="flagged" onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Uncertain Hunch')).toBeTruthy();
    expect(screen.getByText('Accept as-is')).toBeTruthy();
    expect(screen.getByText('Edit & promote')).toBeTruthy();
    expect(screen.getByText('Archive')).toBeTruthy();
  });

  it('shows the maturity reason for a flagged node', () => {
    render(<ReviewItem node={baseNode} kind="flagged" onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Needs more evidence')).toBeTruthy();
  });

  it('shows "Awaiting sign-off" for an awaiting node', () => {
    const node: Node = { ...baseNode, status: 'llm_reviewed', llm_extraction: null };
    render(<ReviewItem node={node} kind="awaiting" onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Awaiting sign-off')).toBeTruthy();
  });

  it('shows "Low extraction confidence" for a flagged child with no maturity', () => {
    const child: Node = { ...baseNode, llm_extraction: null, parent_node_id: 'doc-1' };
    render(<ReviewItem node={child} kind="flagged" onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Low extraction confidence')).toBeTruthy();
  });

  it('renders a "from <source>" tag for an extracted child', () => {
    const child: Node = { ...baseNode, parent_node_id: 'doc-1' };
    render(<ReviewItem node={child} kind="flagged" sourceTitle="Madrid board notes" onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText(/from Madrid board notes/)).toBeTruthy();
  });

  it('Edit & promote links to /capture/[id]/review', () => {
    render(<ReviewItem node={baseNode} kind="flagged" onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Edit & promote').closest('a')?.getAttribute('href')).toBe('/capture/n1/review');
  });

  it('calls onAccept / onArchive with the node id', () => {
    const onAccept = vi.fn();
    const onArchive = vi.fn();
    render(<ReviewItem node={baseNode} kind="flagged" onAccept={onAccept} onArchive={onArchive} />);
    fireEvent.click(screen.getByText('Accept as-is'));
    fireEvent.click(screen.getByText('Archive'));
    expect(onAccept).toHaveBeenCalledWith('n1');
    expect(onArchive).toHaveBeenCalledWith('n1');
  });
});
