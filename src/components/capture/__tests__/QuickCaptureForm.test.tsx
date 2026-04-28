import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QuickCaptureForm } from '../QuickCaptureForm';

// Mock PersonAutocomplete to avoid fetch calls in tests
vi.mock('../PersonAutocomplete', () => ({
  PersonAutocomplete: ({ onChange }: { onChange: (p: []) => void }) => (
    <div data-testid="person-autocomplete">
      <button type="button" onClick={() => onChange([])}>mock-autocomplete</button>
    </div>
  ),
}));

describe('QuickCaptureForm', () => {
  it('disables submit when title is empty', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    const submitButton = screen.getByRole('button', { name: /capture/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit when title is provided', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test thought' } });
    const submitButton = screen.getByRole('button', { name: /^capture$/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('calls onSubmit with form data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuickCaptureForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test thought' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A test description' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^capture$/i }));
    });

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Test thought',
      description: 'A test description',
    }));
  });

  it('does not include node_type in submitted form data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuickCaptureForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test thought' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^capture$/i }));
    });

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted).not.toHaveProperty('node_type');
  });

  it('does not include confidence_level in submitted form data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuickCaptureForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test thought' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^capture$/i }));
    });

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted).not.toHaveProperty('confidence_level');
  });

  it('does not render type selector dropdown', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText(/capture type/i)).not.toBeInTheDocument();
  });

  it('does not render hunch type selector', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText(/hunch type/i)).not.toBeInTheDocument();
  });

  it('shows date field', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/when did this happen/i)).toBeInTheDocument();
  });

  it('shows people field', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    expect(screen.getByTestId('person-autocomplete')).toBeInTheDocument();
  });

  it('shows external link collapsible', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    expect(screen.getByText(/add external link/i)).toBeInTheDocument();
  });

  it('uses larger textarea rows in call mode', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} entryMode="call" />);
    const textarea = screen.getByLabelText(/description/i);
    expect(textarea).toHaveAttribute('rows', '10');
  });

  it('uses smaller textarea rows in thought mode', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} entryMode="thought" />);
    const textarea = screen.getByLabelText(/description/i);
    expect(textarea).toHaveAttribute('rows', '5');
  });

  it('uses call placeholder in call mode', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} entryMode="call" />);
    const textarea = screen.getByLabelText(/description/i);
    expect(textarea).toHaveAttribute('placeholder', 'Paste the transcript or meeting notes here...');
  });

  it('resets form after submit', async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuickCaptureForm onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Test thought' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^capture$/i }));
    });

    // Form resets after the 1000ms captured → idle transition
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(titleInput).toHaveValue('');
    vi.useRealTimers();
  });
});
