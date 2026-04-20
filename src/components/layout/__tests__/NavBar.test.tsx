import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' } }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

import { NavBar } from '../NavBar';

describe('NavBar', () => {
  it('renders Graph link', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.getByText('Graph')).toBeTruthy();
  });

  it('renders Commitments link', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.getByText('Commitments')).toBeTruthy();
  });

  it('renders Review link', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.getByText('Review')).toBeTruthy();
  });
});
