import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineCaptureCard } from '../InlineCaptureCard';
import { vi } from 'vitest';

global.fetch = vi.fn();

const DEFAULT_PROPS = {
  position: { x: 100, y: 200 },
  onClose: vi.fn(),
  onCreated: vi.fn(),
  goalSpaces: [],
} as const;

it('renders at given position', () => {
  render(<InlineCaptureCard {...DEFAULT_PROPS} />);
  expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
});

it('calls onClose when Escape pressed', () => {
  const onClose = vi.fn();
  render(<InlineCaptureCard {...DEFAULT_PROPS} onClose={onClose} />);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

it('disables Create button when title is empty', () => {
  render(<InlineCaptureCard {...DEFAULT_PROPS} />);
  expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
});

it('submits on Create click with valid title', async () => {
  const mockNode = { id: 'new-id', title: 'Test' };
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: mockNode }),
  });
  const onCreated = vi.fn();
  render(<InlineCaptureCard {...DEFAULT_PROPS} onCreated={onCreated} />);
  fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Test hunch' } });
  fireEvent.click(screen.getByRole('button', { name: /create/i }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-id'));
});

it('shows goal space dropdown when trigger_outcome type selected', () => {
  const goalSpaces = [
    { id: 'gs-1', title: 'Formation capital', node_type: 'goal_space' } as Parameters<typeof InlineCaptureCard>[0]['goalSpaces'][number],
  ];
  render(<InlineCaptureCard {...DEFAULT_PROPS} goalSpaces={goalSpaces} defaultNodeType="trigger_outcome" />);
  expect(screen.getByText(/which goal space/i)).toBeInTheDocument();
  expect(screen.getByText('Formation capital')).toBeInTheDocument();
});

it('does not show goal space dropdown for non-trigger_outcome types', () => {
  render(<InlineCaptureCard {...DEFAULT_PROPS} defaultNodeType="hunch" />);
  expect(screen.queryByText(/which goal space/i)).not.toBeInTheDocument();
});
