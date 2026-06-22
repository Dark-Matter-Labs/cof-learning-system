import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

import { DuplicateItem, type ReviewDuplicate } from '../DuplicateItem';

const dup: ReviewDuplicate = {
  id: 'cand-1',
  similarity: 0.88,
  node: { id: 'n1', title: 'New patient debt hunch' },
  similarTo: { id: 'n2', title: 'Existing patient debt hunch' },
};

describe('DuplicateItem', () => {
  it('renders both node titles and the similarity percentage', () => {
    render(<DuplicateItem dup={dup} onDismiss={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('New patient debt hunch')).toBeTruthy();
    expect(screen.getByText('Existing patient debt hunch')).toBeTruthy();
    expect(screen.getByText('88% similar')).toBeTruthy();
  });

  it('links the existing node to its capture page', () => {
    render(<DuplicateItem dup={dup} onDismiss={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByText('Existing patient debt hunch').closest('a')?.getAttribute('href')).toBe('/capture/n2');
  });

  it('fires onDismiss with the candidate id', () => {
    const onDismiss = vi.fn();
    render(<DuplicateItem dup={dup} onDismiss={onDismiss} onArchive={vi.fn()} />);
    fireEvent.click(screen.getByText('Not a duplicate'));
    expect(onDismiss).toHaveBeenCalledWith('cand-1');
  });

  it('fires onArchive with the duplicate', () => {
    const onArchive = vi.fn();
    render(<DuplicateItem dup={dup} onDismiss={vi.fn()} onArchive={onArchive} />);
    fireEvent.click(screen.getByText('Archive as duplicate'));
    expect(onArchive).toHaveBeenCalledWith(dup);
  });
});
