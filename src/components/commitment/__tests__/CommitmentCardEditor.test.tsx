import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CommitmentCardEditor } from '../CommitmentCardEditor';
import type { Node } from '@/lib/types/nodes';

const baseCommitment: Node = {
  id: 'c1',
  title: 'Fund Madrid',
  description: 'Description here',
  node_type: 'commitment',
  status: 'promoted',
  content: { status: 'active', resource_allocation: 30 },
  llm_extraction: null,
  hunch_type: null,
  confidence_level: null,
  confidence_basis: null,
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

describe('CommitmentCardEditor', () => {
  it('renders with existing values pre-filled', () => {
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect((screen.getByPlaceholderText('Title') as HTMLInputElement).value).toBe('Fund Madrid');
    expect((screen.getByPlaceholderText('Description (optional)') as HTMLTextAreaElement).value).toBe('Description here');
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('active');
    expect((screen.getByPlaceholderText('0') as HTMLInputElement).value).toBe('30');
  });

  it('calls onSave with correct shape', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('c1', {
        title: 'Fund Madrid',
        description: 'Description here',
        content: { status: 'active', resource_allocation: 30 },
      });
    });
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables Save and shows Saving… while in flight', async () => {
    const onSave = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      const btn = screen.getByText('Saving…');
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('shows error message when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network'));
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeTruthy();
      expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('auto-focuses the title input on mount', () => {
    render(<CommitmentCardEditor commitment={baseCommitment} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Title'));
  });
});
