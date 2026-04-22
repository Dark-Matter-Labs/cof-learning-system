import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeCard } from '../NodeCard';

const mockNode = {
  id: 'n1',
  node_type: 'hunch',
  title: 'My test hunch',
  description: 'A description of the hunch',
  status: 'raw' as const,
};

describe('NodeCard', () => {
  it('renders node title', () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByText('My test hunch')).toBeDefined();
  });

  it('renders node type with underscores replaced by spaces', () => {
    render(<NodeCard node={{ ...mockNode, node_type: 'assumption_background' }} />);
    expect(screen.getByText('assumption background')).toBeDefined();
  });

  it('renders description when present', () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByText('A description of the hunch')).toBeDefined();
  });

  it('omits description element when description is null', () => {
    render(<NodeCard node={{ ...mockNode, description: null }} />);
    expect(screen.queryByText('A description of the hunch')).toBeNull();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<NodeCard node={mockNode} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders as button element', () => {
    render(<NodeCard node={mockNode} />);
    expect(screen.getByRole('button')).toBeDefined();
  });
});
