import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient } from '../QueryClient';

vi.mock('../AskMode', () => ({
  AskMode: () => <div data-testid="ask-mode">AskMode</div>,
}));

vi.mock('../GuidedTour', () => ({
  GuidedTour: () => <div data-testid="guided-tour">GuidedTour</div>,
}));

describe('QueryClient', () => {
  it('renders page title', () => {
    render(<QueryClient nodes={[]} />);
    expect(screen.getByText('Query')).toBeDefined();
  });

  it('renders Ask and Guided Tour tabs', () => {
    render(<QueryClient nodes={[]} />);
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Guided Tour' })).toBeDefined();
  });

  it('shows AskMode by default', () => {
    render(<QueryClient nodes={[]} />);
    expect(screen.getByTestId('ask-mode')).toBeDefined();
  });

  it('switches to GuidedTour on tab click', () => {
    render(<QueryClient nodes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guided Tour' }));
    expect(screen.getByTestId('guided-tour')).toBeDefined();
    expect(screen.queryByTestId('ask-mode')).toBeNull();
  });

  it('switches back to Ask mode when Ask tab is clicked', () => {
    render(<QueryClient nodes={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guided Tour' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByTestId('ask-mode')).toBeDefined();
    expect(screen.queryByTestId('guided-tour')).toBeNull();
  });
});
