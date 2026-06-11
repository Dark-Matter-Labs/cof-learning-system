import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardSidebar } from '../DashboardSidebar';

const mockStats = {
  awaitingReview: 3,
  promotedThisWeek: 5,
  activeTests: 2,
};

it('renders stats when open', () => {
  render(<DashboardSidebar stats={mockStats} isOpen={true} onToggle={() => {}} />);
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
});

it('hides stats when closed', () => {
  render(<DashboardSidebar stats={mockStats} isOpen={false} onToggle={() => {}} />);
  expect(screen.queryByText('Awaiting Review')).not.toBeInTheDocument();
});

it('calls onToggle when toggle button clicked', () => {
  const onToggle = vi.fn();
  render(<DashboardSidebar stats={mockStats} isOpen={true} onToggle={onToggle} />);
  fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }));
  expect(onToggle).toHaveBeenCalled();
});
