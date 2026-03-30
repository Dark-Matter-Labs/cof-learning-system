import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConvergenceSparkline } from '../convergence/ConvergenceSparkline';
import type { SparklinePoint } from '@/lib/types/convergence';

describe('ConvergenceSparkline', () => {
  it('renders SVG with width=200 height=40', () => {
    const { container } = render(<ConvergenceSparkline snapshots={[]} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('200');
    expect(svg?.getAttribute('height')).toBe('40');
  });

  it('renders dashed line placeholder when snapshots is empty', () => {
    const { container } = render(<ConvergenceSparkline snapshots={[]} />);
    const line = container.querySelector('line');
    expect(line).toBeTruthy();
    expect(line?.getAttribute('stroke-dasharray')).toBe('4 2');
  });

  it('renders circle for single snapshot', () => {
    const snapshots: SparklinePoint[] = [{ score: 3, computed_at: '2026-03-15T00:00:00Z' }];
    const { container } = render(<ConvergenceSparkline snapshots={snapshots} />);
    const circle = container.querySelector('circle');
    expect(circle).toBeTruthy();
    expect(container.querySelector('path')).toBeFalsy();
  });

  it('renders path element for 2+ snapshots', () => {
    const snapshots: SparklinePoint[] = [
      { score: 2, computed_at: '2026-03-01T00:00:00Z' },
      { score: 5, computed_at: '2026-03-15T00:00:00Z' },
    ];
    const { container } = render(<ConvergenceSparkline snapshots={snapshots} />);
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    expect(path?.getAttribute('d')).toBeTruthy();
  });

  it('uses teal fill (#14b8a6) when last score > 0', () => {
    const snapshots: SparklinePoint[] = [
      { score: -1, computed_at: '2026-03-01T00:00:00Z' },
      { score: 3, computed_at: '2026-03-15T00:00:00Z' },
    ];
    const { container } = render(<ConvergenceSparkline snapshots={snapshots} />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('#14b8a6');
  });

  it('uses coral fill (#f97316) when last score <= 0', () => {
    const snapshots: SparklinePoint[] = [
      { score: 2, computed_at: '2026-03-01T00:00:00Z' },
      { score: -1, computed_at: '2026-03-15T00:00:00Z' },
    ];
    const { container } = render(<ConvergenceSparkline snapshots={snapshots} />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('#f97316');
  });

  it('uses coral fill when last score is exactly 0', () => {
    const snapshots: SparklinePoint[] = [
      { score: 2, computed_at: '2026-03-01T00:00:00Z' },
      { score: 0, computed_at: '2026-03-15T00:00:00Z' },
    ];
    const { container } = render(<ConvergenceSparkline snapshots={snapshots} />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('#f97316');
  });
});
