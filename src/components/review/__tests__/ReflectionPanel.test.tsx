import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReflectionPanel } from '@/app/review/ReflectionPanel';
import type { ReflectionReport } from '@/lib/agents/reflection';

// ── Helper: create a minimal ReflectionReport ────────────────────────────────

function makeReport(overrides: Partial<ReflectionReport> = {}): ReflectionReport {
  return {
    patterns: ['Pattern A', 'Pattern B'],
    contradictions: [
      { description: 'Node X contradicts Node Y', node_ids: ['node-x', 'node-y'] },
    ],
    coverage_gaps: ['Coverage gap in domain Z'],
    trajectory: 'The system is converging overall but drifting in goal space 2.',
    recommendations: [
      { text: 'Stop adding hunches without follow-up', action_type: 'stop', target_node_id: 'abc-123' },
      { text: 'Strengthen the biosecurity thread', action_type: 'strengthen', target_node_id: 'def-456' },
      { text: 'Reframe the AI risk framing', action_type: 'reframe', target_node_id: null },
      { text: 'General observation with no action', action_type: null, target_node_id: null },
    ],
    ...overrides,
  };
}

// ── Button state tests ────────────────────────────────────────────────────────

describe('ReflectionPanel — button states', () => {
  it('renders Run Reflection button enabled in idle state', () => {
    render(<ReflectionPanel reflectionDue={false} />);
    const button = screen.getByRole('button', { name: /run reflection/i });
    expect(button).not.toBeDisabled();
  });

  it('renders Run Reflection button text in idle state', () => {
    render(<ReflectionPanel reflectionDue={false} />);
    expect(screen.getByText(/run reflection/i)).toBeInTheDocument();
  });
});

// ── Badge rendering tests ─────────────────────────────────────────────────────

describe('ReflectionPanel — badge rendering', () => {
  it('shows teal badge when reflectionDue is true', () => {
    render(<ReflectionPanel reflectionDue={true} />);
    expect(screen.getByText(/run reflection\?/i)).toBeInTheDocument();
  });

  it('does not show badge when reflectionDue is false', () => {
    render(<ReflectionPanel reflectionDue={false} />);
    expect(screen.queryByText(/run reflection\?/i)).not.toBeInTheDocument();
  });
});

// ── Section heading tests ─────────────────────────────────────────────────────

describe('ReflectionPanel — report sections with initialReport prop', () => {
  it('renders all 5 report section headings when initialReport is provided', () => {
    render(<ReflectionPanel reflectionDue={false} initialReport={makeReport()} />);
    expect(screen.getByText('Patterns')).toBeInTheDocument();
    expect(screen.getByText('Contradictions')).toBeInTheDocument();
    expect(screen.getByText('Coverage Gaps')).toBeInTheDocument();
    expect(screen.getByText('Trajectory')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
  });

  it('renders pattern text from report', () => {
    render(<ReflectionPanel reflectionDue={false} initialReport={makeReport()} />);
    expect(screen.getByText('Pattern A')).toBeInTheDocument();
  });

  it('renders trajectory text from report', () => {
    render(<ReflectionPanel reflectionDue={false} initialReport={makeReport()} />);
    expect(screen.getByText(/converging overall/i)).toBeInTheDocument();
  });
});

// ── Action button tests ───────────────────────────────────────────────────────

describe('ReflectionPanel — action buttons', () => {
  it('recommendation with action_type=stop renders href containing /capture/abc-123/review', () => {
    render(<ReflectionPanel reflectionDue={false} initialReport={makeReport()} />);
    const stopLinks = screen.getAllByRole('link', { name: /stop/i });
    expect(stopLinks.length).toBeGreaterThan(0);
    expect(stopLinks[0]).toHaveAttribute('href', expect.stringContaining('/capture/abc-123/review'));
  });

  it('recommendation with action_type=strengthen renders href containing /capture/def-456/review', () => {
    render(<ReflectionPanel reflectionDue={false} initialReport={makeReport()} />);
    const strengthenLinks = screen.getAllByRole('link', { name: /strengthen/i });
    expect(strengthenLinks.length).toBeGreaterThan(0);
    expect(strengthenLinks[0]).toHaveAttribute('href', expect.stringContaining('/capture/def-456/review'));
  });

  it('recommendation with action_type=reframe and null target_node_id renders plain text label, not a link', () => {
    render(<ReflectionPanel reflectionDue={false} initialReport={makeReport()} />);
    // The reframe recommendation has null target_node_id, so it should render as plain text
    expect(screen.getByText('Reframe')).toBeInTheDocument();
    const reframeLinks = screen.queryAllByRole('link', { name: /^reframe$/i });
    expect(reframeLinks).toHaveLength(0);
  });

  it('recommendation with null action_type renders no action link', () => {
    const report = makeReport({
      recommendations: [
        { text: 'General observation with no action', action_type: null, target_node_id: null },
      ],
    });
    render(<ReflectionPanel reflectionDue={false} initialReport={report} />);
    // The text should be visible
    expect(screen.getByText('General observation with no action')).toBeInTheDocument();
    // No links should be rendered for null action_type
    const links = screen.queryAllByRole('link');
    expect(links).toHaveLength(0);
  });
});
