import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReflectClient } from '../ReflectClient';

// Markdown pulls in react-markdown (ESM); render children as plain text in tests.
vi.mock('@/components/ui/Markdown', () => ({
  Markdown: ({ children }: { children: string }) => <div>{children}</div>,
}));

const props = {
  sites: [{ id: 's-1', label: 'Madrid', type: 'site' as const }],
  options: [{ id: 'o-1', label: 'Patient debt', type: 'option' as const }],
  goalSpaces: [{ id: 'g-1', label: 'Formation capital', type: 'goal_space' as const }],
};

describe('ReflectClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the scope picker and a Run reflection button', () => {
    render(<ReflectClient {...props} />);
    expect(screen.getByRole('button', { name: /run reflection/i })).toBeDefined();
    expect(screen.getByRole('combobox', { name: /reflection scope/i })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Whole system' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Madrid' })).toBeDefined();
  });

  it('runs a whole-system reflection and renders the synthesis', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ synthesis: 'System-wide synthesis here.' }),
    } as Response);
    global.fetch = fetchMock;

    render(<ReflectClient {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /run reflection/i }));

    await waitFor(() => expect(screen.getByText('System-wide synthesis here.')).toBeDefined());
    expect(fetchMock).toHaveBeenCalledWith('/api/reflect/analyse', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ type: 'system', label: 'Whole system' });
  });

  it('sends the selected scope (goal space) in the request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ synthesis: 'Formation capital synthesis.' }),
    } as Response);
    global.fetch = fetchMock;

    render(<ReflectClient {...props} />);
    fireEvent.change(screen.getByRole('combobox', { name: /reflection scope/i }), {
      target: { value: 'goal_space::g-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run reflection/i }));

    await waitFor(() => expect(screen.getByText('Formation capital synthesis.')).toBeDefined());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ type: 'goal_space', value: 'g-1', label: 'Formation capital' });
  });

  it('shows an error message when the request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);
    render(<ReflectClient {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /run reflection/i }));
    await waitFor(() => expect(screen.getByText(/reflection failed/i)).toBeDefined());
  });

  it('disables the scope picker when there are no filter options', () => {
    render(<ReflectClient sites={[]} options={[]} goalSpaces={[]} />);
    const select = screen.getByRole('combobox', { name: /reflection scope/i }) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});
