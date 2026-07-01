import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

import { SuggestedConnectionItem, type ReviewEdgeSuggestion } from '../SuggestedConnectionItem';

const suggestion: ReviewEdgeSuggestion = {
  id: 'sug-1',
  similarity: 0.74,
  edgeType: 'supports',
  rationale: 'It builds on the earlier finding',
  source: { id: 's1', title: 'New debt-relief hunch' },
  target: { id: 't1', title: 'Patient debt program' },
};

describe('SuggestedConnectionItem', () => {
  it('renders both node titles, edge type, rationale, and percent', () => {
    render(<SuggestedConnectionItem suggestion={suggestion} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('New debt-relief hunch')).toBeTruthy();
    expect(screen.getByText('Patient debt program')).toBeTruthy();
    expect(screen.getByText(/supports/)).toBeTruthy();
    expect(screen.getByText('It builds on the earlier finding')).toBeTruthy();
    expect(screen.getByText('74% match')).toBeTruthy();
  });

  it('links the target node to its capture page', () => {
    render(<SuggestedConnectionItem suggestion={suggestion} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Patient debt program').closest('a')?.getAttribute('href')).toBe('/capture/t1');
  });

  it('fires onAccept with the suggestion', () => {
    const onAccept = vi.fn();
    render(<SuggestedConnectionItem suggestion={suggestion} onAccept={onAccept} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText('Add connection'));
    expect(onAccept).toHaveBeenCalledWith(suggestion);
  });

  it('fires onDismiss with the suggestion id', () => {
    const onDismiss = vi.fn();
    render(<SuggestedConnectionItem suggestion={suggestion} onAccept={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledWith('sug-1');
  });
});
