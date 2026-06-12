import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/capture',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' } }),
}));

vi.mock('@/lib/supabase/client', () => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };
  return {
    createClient: () => ({
      auth: { signOut: vi.fn() },
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    }),
  };
});

import { NavBar } from '../NavBar';

describe('NavBar', () => {
  it('renders the primary nav links', () => {
    render(<NavBar reviewCount={0} />);
    for (const label of ['Capture', 'Review', 'Graph', 'Ask', 'Reflect', 'Commitments']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('hides secondary links until the More menu is opened', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.queryByText('Portfolios')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Portfolios')).toBeTruthy();
    expect(screen.getByText('Intelligence')).toBeTruthy();
  });

  it('shows the review-count badge only when count > 0', () => {
    const { unmount } = render(<NavBar reviewCount={3} />);
    expect(screen.getByText(/3 to review/)).toBeTruthy();
    unmount();
    render(<NavBar reviewCount={0} />);
    expect(screen.queryByText(/to review/)).toBeNull();
  });

  it('opens a mobile drawer (with Sign out) from the hamburger', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.queryByText('Sign out')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByText('Sign out')).toBeTruthy();
  });
});
