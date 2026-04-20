import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { ReflectionSection } from '../ReflectionSection';

describe('ReflectionSection', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Run reflection button', () => {
    render(<ReflectionSection sites={[]} options={[]} goalSpaces={[]} />);
    expect(screen.getByRole('button', { name: /run reflection/i })).toBeTruthy();
  });

  it('renders filter dropdown when options exist', () => {
    render(
      <ReflectionSection
        sites={[{ id: 's1', label: 'Madrid', type: 'site' }]}
        options={[]}
        goalSpaces={[]}
      />
    );
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByText('Madrid')).toBeTruthy();
  });

  it('shows no-filters message when all lists are empty', () => {
    render(<ReflectionSection sites={[]} options={[]} goalSpaces={[]} />);
    expect(screen.getByText(/No filters available/)).toBeTruthy();
  });

  it('disables Run button while loading', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
    render(<ReflectionSection sites={[]} options={[]} goalSpaces={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /run reflection/i }));
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  it('renders synthesis text on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ synthesis: 'Madrid has 3 active hunches.' }),
    } as Response);

    render(
      <ReflectionSection
        sites={[{ id: 's1', label: 'Madrid', type: 'site' }]}
        options={[]}
        goalSpaces={[]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /run reflection/i }));
    await waitFor(() => {
      expect(screen.getByText('Madrid has 3 active hunches.')).toBeTruthy();
    });
  });

  it('shows error message on fetch failure', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'LLM call failed' }),
    } as Response);

    render(<ReflectionSection sites={[]} options={[]} goalSpaces={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /run reflection/i }));
    await waitFor(() => {
      expect(screen.getByText(/Reflection failed/)).toBeTruthy();
    });
  });

  it('sends site filter payload after selecting a site', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ synthesis: 'Site synthesis.' }),
    } as Response);

    render(
      <ReflectionSection
        sites={[{ id: 's1', label: 'Madrid', type: 'site' }]}
        options={[]}
        goalSpaces={[]}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'site::s1' } });
    fireEvent.click(screen.getByRole('button', { name: /run reflection/i }));
    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        '/api/reflect/analyse',
        expect.objectContaining({
          body: JSON.stringify({ type: 'site', value: 's1', label: 'Madrid' }),
        }),
      );
    });
  });
});
