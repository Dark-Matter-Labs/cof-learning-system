import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickCaptureForm } from '../QuickCaptureForm';

describe('QuickCaptureForm', () => {
  it('disables submit when title is empty', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    const submitButton = screen.getByRole('button', { name: /submit for processing/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit when title is provided', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test hunch' } });
    const submitButton = screen.getByRole('button', { name: /submit for processing/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('calls onSubmit with form data', () => {
    const onSubmit = vi.fn();
    render(<QuickCaptureForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test hunch' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A test description' } });
    fireEvent.click(screen.getByRole('button', { name: /submit for processing/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Test hunch',
      description: 'A test description',
    }));
  });
});
