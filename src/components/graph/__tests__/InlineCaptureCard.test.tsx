import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineCaptureCard } from '../InlineCaptureCard';
import { vi } from 'vitest';

global.fetch = vi.fn();

it('renders at given position', () => {
  render(
    <InlineCaptureCard
      position={{ x: 100, y: 200 }}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />
  );
  expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
});

it('calls onClose when Escape pressed', () => {
  const onClose = vi.fn();
  render(
    <InlineCaptureCard
      position={{ x: 100, y: 200 }}
      onClose={onClose}
      onCreated={vi.fn()}
    />
  );
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

it('disables Create button when title is empty', () => {
  render(
    <InlineCaptureCard
      position={{ x: 100, y: 200 }}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />
  );
  expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
});

it('submits on Create click with valid title', async () => {
  const mockNode = { id: 'new-id', title: 'Test' };
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: mockNode }),
  });
  const onCreated = vi.fn();
  render(
    <InlineCaptureCard
      position={{ x: 100, y: 200 }}
      onClose={vi.fn()}
      onCreated={onCreated}
    />
  );
  fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Test hunch' } });
  fireEvent.click(screen.getByRole('button', { name: /create/i }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-id'));
});
