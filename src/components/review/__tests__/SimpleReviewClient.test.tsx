import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SimpleReviewClient } from '../SimpleReviewClient';
import type { Node } from '@/lib/types/nodes';

const baseNode: Node = {
  id: 'n1',
  title: 'Assume Madrid will fund',
  description: null,
  node_type: 'assumption_background',
  status: 'flagged_for_review',
  content: null,
  hunch_type: null,
  confidence_level: 3,
  confidence_basis: 'intuition',
  llm_extraction: {
    title: 'Assume Madrid will fund',
    summary: 'Madrid is likely to provide seed funding',
    structured_claim: {
      if: 'We pitch to Madrid',
      then: 'They will fund us',
      because: 'Prior conversations were positive',
    },
    assumption_type: 'background',
    entities: [],
    domain_tags: ['finance', 'madrid'],
    suggested_connections: [],
    confidence_assessment: { level: 3, basis: 'intuition' },
    open_questions: [],
    commitment_relevance: null,
    maturity: 'watch_closely',
  },
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

describe('SimpleReviewClient', () => {
  it('renders type label and maturity badge', () => {
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={vi.fn()} isSubmitting={false} />);
    expect(screen.getByText('Background Assumption')).toBeInTheDocument();
    expect(screen.getByText('Watch closely')).toBeInTheDocument();
  });

  it('renders summary and structured claim', () => {
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={vi.fn()} isSubmitting={false} />);
    expect(screen.getByText('Madrid is likely to provide seed funding')).toBeInTheDocument();
    expect(screen.getByText(/We pitch to Madrid/)).toBeInTheDocument();
    expect(screen.getByText(/They will fund us/)).toBeInTheDocument();
    expect(screen.getByText(/Prior conversations were positive/)).toBeInTheDocument();
  });

  it('renders confidence and domain tags', () => {
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={vi.fn()} isSubmitting={false} />);
    expect(screen.getByText(/3\/5/)).toBeInTheDocument();
    expect(screen.getByText('finance')).toBeInTheDocument();
    expect(screen.getByText('madrid')).toBeInTheDocument();
  });

  it('calls onPromote with note text', async () => {
    const onPromote = vi.fn().mockResolvedValue(undefined);
    render(<SimpleReviewClient node={baseNode} onPromote={onPromote} onArchive={vi.fn()} isSubmitting={false} />);
    fireEvent.change(screen.getByPlaceholderText('Add a note to supplement this entry (optional)'), {
      target: { value: 'This is a human note' },
    });
    fireEvent.click(screen.getByText('Promote'));
    await waitFor(() => {
      expect(onPromote).toHaveBeenCalledWith('This is a human note');
    });
  });

  it('calls onPromote with empty string when no note entered', async () => {
    const onPromote = vi.fn().mockResolvedValue(undefined);
    render(<SimpleReviewClient node={baseNode} onPromote={onPromote} onArchive={vi.fn()} isSubmitting={false} />);
    fireEvent.click(screen.getByText('Promote'));
    await waitFor(() => {
      expect(onPromote).toHaveBeenCalledWith('');
    });
  });

  it('calls onArchive when Archive is clicked', async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={onArchive} isSubmitting={false} />);
    fireEvent.click(screen.getByText('Archive'));
    await waitFor(() => {
      expect(onArchive).toHaveBeenCalled();
    });
  });

  it('disables buttons and shows Saving… when isSubmitting is true', () => {
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={vi.fn()} isSubmitting={true} />);
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    expect((screen.getByText('Saving…') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('Archive') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows error when onPromote rejects', async () => {
    const onPromote = vi.fn().mockRejectedValue(new Error('network'));
    render(<SimpleReviewClient node={baseNode} onPromote={onPromote} onArchive={vi.fn()} isSubmitting={false} />);
    fireEvent.click(screen.getByText('Promote'));
    await waitFor(() => {
      expect(screen.getByText('Failed — try again')).toBeInTheDocument();
    });
  });

  it('shows error when onArchive rejects', async () => {
    const onArchive = vi.fn().mockRejectedValue(new Error('network'));
    render(<SimpleReviewClient node={baseNode} onPromote={vi.fn()} onArchive={onArchive} isSubmitting={false} />);
    fireEvent.click(screen.getByText('Archive'));
    await waitFor(() => {
      expect(screen.getByText('Failed — try again')).toBeInTheDocument();
    });
  });
});
