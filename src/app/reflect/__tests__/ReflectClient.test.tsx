import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReflectClient } from '../ReflectClient';
import { REFLECTION_QUESTIONS } from '../questions';

// Mock ConvergenceSparkline to avoid d3 in test env
vi.mock('@/components/graph/convergence/ConvergenceSparkline', () => ({
  ConvergenceSparkline: ({ snapshots }: { snapshots: unknown[] }) => (
    <div data-testid="sparkline">sparkline ({snapshots.length} points)</div>
  ),
}));

// Mock fetch for sparkline data
global.fetch = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) } as Response)
);

const defaultProps = {
  goalSpaces: [
    { id: 'gs-1', title: 'Goal Space 1' },
    { id: 'gs-2', title: 'Goal Space 2' },
  ],
  lastSession: null,
  userId: 'user-123',
};

describe('ReflectClient', () => {
  it('renders sparkline window selector with 30d / 60d / 90d buttons', () => {
    render(<ReflectClient {...defaultProps} />);
    expect(screen.getByRole('button', { name: /30d/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /60d/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /90d/i })).toBeDefined();
  });

  it('renders guided questions from REFLECTION_QUESTIONS', () => {
    render(<ReflectClient {...defaultProps} />);
    for (const q of REFLECTION_QUESTIONS) {
      expect(screen.getByText(q.text)).toBeDefined();
    }
  });

  it('renders decisions log with an "Add Decision" button', () => {
    render(<ReflectClient {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add/i })).toBeDefined();
  });

  it('renders a "Save Reflection" button', () => {
    render(<ReflectClient {...defaultProps} />);
    expect(screen.getByRole('button', { name: /save reflection/i })).toBeDefined();
  });
});
