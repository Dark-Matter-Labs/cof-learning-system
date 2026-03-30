import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrajectoryBadge, scoreToStatus } from '../TrajectoryBadge';
import type { FactorBreakdown } from '@/lib/graph/convergence';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockBreakdown: FactorBreakdown = {
  outcome_scores: [{
    outcome_id: 'oc-1',
    outcome_title: 'Increase retention',
    score: 2.5,
    positive_factors: [{
      factor: 'indicates_progress:promoted',
      node_id: 'n-1',
      node_title: 'Retention improved 5%',
      weight: 3.0,
    }],
    negative_factors: [{
      factor: 'no_attention',
      node_id: 'oc-1',
      node_title: 'Increase retention',
      weight: -1.0,
    }],
  }],
  total_outcomes: 1,
  raw_score: 2.5,
};

// ─── scoreToStatus unit tests ─────────────────────────────────────────────────

describe('scoreToStatus', () => {
  it('returns converging for score > 1.0', () => {
    expect(scoreToStatus(5.0)).toBe('converging');
  });

  it('returns neutral for score between -1.0 and 1.0 (0.5)', () => {
    expect(scoreToStatus(0.5)).toBe('neutral');
  });

  it('returns drifting for score < -1.0', () => {
    expect(scoreToStatus(-3.0)).toBe('drifting');
  });

  it('returns neutral for score exactly 1.0 (boundary — not strictly > 1.0)', () => {
    expect(scoreToStatus(1.0)).toBe('neutral');
  });

  it('returns neutral for score exactly -1.0 (boundary — not strictly < -1.0)', () => {
    expect(scoreToStatus(-1.0)).toBe('neutral');
  });
});

// ─── Badge rendering tests ────────────────────────────────────────────────────

describe('TrajectoryBadge rendering', () => {
  it('renders "Converging" label when status is converging', () => {
    render(<TrajectoryBadge status="converging" score={5.0} />);
    expect(screen.getByText(/Converging/i)).toBeInTheDocument();
  });

  it('renders "Drifting" label when status is drifting', () => {
    render(<TrajectoryBadge status="drifting" score={-3.0} />);
    expect(screen.getByText(/Drifting/i)).toBeInTheDocument();
  });

  it('renders score with + prefix for positive score', () => {
    render(<TrajectoryBadge status="converging" score={3.5} />);
    expect(screen.getByRole('button').textContent).toContain('+3.5');
  });

  it('renders score with - prefix for negative score', () => {
    render(<TrajectoryBadge status="drifting" score={-2.1} />);
    expect(screen.getByRole('button').textContent).toContain('-2.1');
  });

  it('badge outer element is a button', () => {
    render(<TrajectoryBadge status="neutral" score={0.5} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

// ─── Click-expand tests ───────────────────────────────────────────────────────

describe('TrajectoryBadge click-expand breakdown', () => {
  it('breakdown panel is not visible before click', () => {
    render(
      <TrajectoryBadge
        status="converging"
        score={2.5}
        factorBreakdown={mockBreakdown}
      />
    );
    expect(screen.queryByText('Retention improved 5%')).toBeNull();
  });

  it('clicking badge shows breakdown panel with factor node_title', () => {
    render(
      <TrajectoryBadge
        status="converging"
        score={2.5}
        factorBreakdown={mockBreakdown}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Retention improved 5%')).toBeInTheDocument();
  });

  it('positive factor weight has text-teal-400 class', () => {
    render(
      <TrajectoryBadge
        status="converging"
        score={2.5}
        factorBreakdown={mockBreakdown}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    // Find the element that shows positive weight "+3.0"
    const positiveEl = screen.getByText((content, el) =>
      el?.textContent?.includes('+3.0') && el?.classList.contains('text-teal-400') || false
    );
    expect(positiveEl).toBeInTheDocument();
  });

  it('negative factor weight has text-red-400 class', () => {
    render(
      <TrajectoryBadge
        status="converging"
        score={2.5}
        factorBreakdown={mockBreakdown}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    // Find the element that shows negative weight "-1.0"
    const negativeEl = screen.getByText((content, el) =>
      el?.textContent?.includes('-1.0') && el?.classList.contains('text-red-400') || false
    );
    expect(negativeEl).toBeInTheDocument();
  });

  it('clicking badge again hides the breakdown panel', () => {
    render(
      <TrajectoryBadge
        status="converging"
        score={2.5}
        factorBreakdown={mockBreakdown}
      />
    );
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByText('Retention improved 5%')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('Retention improved 5%')).toBeNull();
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('TrajectoryBadge edge cases', () => {
  it('when status is pending and factorBreakdown is undefined, clicking does not show breakdown', () => {
    render(<TrajectoryBadge status="pending" />);
    fireEvent.click(screen.getByRole('button'));
    // No breakdown panel should render
    expect(screen.queryByText('Increase retention')).toBeNull();
  });
});
