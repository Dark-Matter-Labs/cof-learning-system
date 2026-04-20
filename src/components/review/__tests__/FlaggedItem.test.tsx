import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

import { FlaggedItem } from '../FlaggedItem';
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
};

describe('FlaggedItem', () => {
  it('renders the node title', () => {
    render(<FlaggedItem node={baseNode} onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Uncertain Hunch')).toBeTruthy();
  });

  it('renders flag reason label for watch_closely', () => {
    render(<FlaggedItem node={baseNode} onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Needs more evidence')).toBeTruthy();
  });

  it('renders flag reason for needs_development', () => {
    const node: Node = { ...baseNode, llm_extraction: { maturity: 'needs_development' } as unknown as Node['llm_extraction'] };
    render(<FlaggedItem node={node} onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Needs development')).toBeTruthy();
  });

  it('renders all three action buttons/links', () => {
    render(<FlaggedItem node={baseNode} onAccept={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Accept as-is')).toBeTruthy();
    expect(screen.getByText('Edit & promote')).toBeTruthy();
    expect(screen.getByText('Archive')).toBeTruthy();
  });

  it('Edit & promote links to /capture/[id]/review', () => {
    render(<FlaggedItem node={baseNode} onAccept={vi.fn()} onArchive={vi.fn()} />);
    const link = screen.getByText('Edit & promote').closest('a');
    expect(link?.getAttribute('href')).toBe('/capture/n1/review');
  });

  it('calls onAccept with node id when Accept is clicked', () => {
    const onAccept = vi.fn();
    render(<FlaggedItem node={baseNode} onAccept={onAccept} onArchive={vi.fn()} />);
    fireEvent.click(screen.getByText('Accept as-is'));
    expect(onAccept).toHaveBeenCalledWith('n1');
  });

  it('calls onArchive with node id when Archive is clicked', () => {
    const onArchive = vi.fn();
    render(<FlaggedItem node={baseNode} onAccept={vi.fn()} onArchive={onArchive} />);
    fireEvent.click(screen.getByText('Archive'));
    expect(onArchive).toHaveBeenCalledWith('n1');
  });
});
