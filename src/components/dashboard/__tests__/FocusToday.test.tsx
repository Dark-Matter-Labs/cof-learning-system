import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusToday } from '../FocusToday';
import type { FocusItem } from '@/lib/dashboard/queries';

const items: FocusItem[] = [
  { id: 'tension-1', type: 'tension', title: 'Cassie meeting follow-up', subtitle: 'awaiting your decision', href: '/review' },
  { id: 'commit-1', type: 'stale_commitment', title: 'Dartmoor commitment', subtitle: 'no activity in 12 days', href: '/commitments' },
];

describe('FocusToday', () => {
  beforeEach(() => localStorage.clear());

  it('renders all items', () => {
    render(<FocusToday items={items} />);
    expect(screen.getByText('Cassie meeting follow-up')).toBeInTheDocument();
    expect(screen.getByText('Dartmoor commitment')).toBeInTheDocument();
  });

  it('shows empty state when items is empty', () => {
    render(<FocusToday items={[]} />);
    expect(screen.getByText(/all clear/i)).toBeInTheDocument();
  });

  it('hides an item after dismissal', () => {
    render(<FocusToday items={items} />);
    fireEvent.click(screen.getAllByLabelText(/dismiss/i)[0]);
    expect(screen.queryByText('Cassie meeting follow-up')).not.toBeInTheDocument();
    expect(screen.getByText('Dartmoor commitment')).toBeInTheDocument();
  });

  it('persists dismissal to localStorage', () => {
    render(<FocusToday items={items} />);
    fireEvent.click(screen.getAllByLabelText(/dismiss/i)[0]);
    const today = new Date().toISOString().slice(0, 10);
    const stored = JSON.parse(localStorage.getItem(`focus_dismissed_${today}`) ?? '[]') as string[];
    expect(stored).toContain('tension-1');
  });
});
