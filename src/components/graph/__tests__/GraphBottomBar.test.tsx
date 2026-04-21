import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GraphBottomBar } from '../GraphBottomBar';
import type { GraphView } from '../GraphTopBar';
import type { GraphNode } from '@/lib/graph/layout';

const makeNode = (id: string, title: string) => ({
  id, title, node_type: 'hunch', color: '#fff', radius: 14, data: {} as unknown as GraphNode['data'],
});

describe('GraphBottomBar', () => {
  it('renders Fit view button', () => {
    render(
      <GraphBottomBar
        onFitView={vi.fn()} view="force" onChangeView={vi.fn()}
        nodes={[]} onFocusNode={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /fit view/i })).toBeInTheDocument();
  });

  it('calls onFitView when Fit view is clicked', () => {
    const onFitView = vi.fn();
    render(
      <GraphBottomBar
        onFitView={onFitView} view="force" onChangeView={vi.fn()}
        nodes={[]} onFocusNode={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /fit view/i }));
    expect(onFitView).toHaveBeenCalledOnce();
  });

  it('renders search input', () => {
    render(
      <GraphBottomBar
        onFitView={vi.fn()} view="force" onChangeView={vi.fn()}
        nodes={[]} onFocusNode={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText(/find node/i)).toBeInTheDocument();
  });

  it('calls onFocusNode with matching node id on search', () => {
    const onFocusNode = vi.fn();
    const nodes = [makeNode('abc', 'Pricing hunch'), makeNode('def', 'CAC model')];
    render(
      <GraphBottomBar
        onFitView={vi.fn()} view="force" onChangeView={vi.fn()}
        nodes={nodes} onFocusNode={onFocusNode}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/find node/i), { target: { value: 'pricing' } });
    expect(onFocusNode).toHaveBeenCalledWith('abc');
  });

  it('does not call onFocusNode when search has no match', () => {
    const onFocusNode = vi.fn();
    render(
      <GraphBottomBar
        onFitView={vi.fn()} view="force" onChangeView={vi.fn()}
        nodes={[makeNode('a', 'Alpha')]} onFocusNode={onFocusNode}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/find node/i), { target: { value: 'zzz' } });
    expect(onFocusNode).not.toHaveBeenCalled();
  });

  it('does not call onFocusNode when search input is cleared', () => {
    const onFocusNode = vi.fn();
    const nodes = [makeNode('abc', 'Pricing hunch')];
    render(
      <GraphBottomBar
        onFitView={vi.fn()} view="force" onChangeView={vi.fn()}
        nodes={nodes} onFocusNode={onFocusNode}
      />
    );
    const input = screen.getByPlaceholderText(/find node/i);
    fireEvent.change(input, { target: { value: 'pricing' } });
    expect(onFocusNode).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: '' } });
    // clearing the input must not trigger a second call
    expect(onFocusNode).toHaveBeenCalledOnce();
  });

  it('calls onChangeView when a layout button is clicked', () => {
    const onChangeView = vi.fn();
    render(
      <GraphBottomBar
        onFitView={vi.fn()} view="force" onChangeView={onChangeView}
        nodes={[]} onFocusNode={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(onChangeView).toHaveBeenCalledWith('timeline');
  });

  it('highlights the active view button', () => {
    render(
      <GraphBottomBar
        onFitView={vi.fn()} view="timeline" onChangeView={vi.fn()}
        nodes={[]} onFocusNode={vi.fn()}
      />
    );
    const timelineBtn = screen.getByRole('button', { name: 'Timeline' });
    expect(timelineBtn).toHaveAttribute('aria-pressed', 'true');
    // Also check that a non-active button does NOT have aria-pressed=true
    const forceBtn = screen.getByRole('button', { name: 'Force' });
    expect(forceBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
