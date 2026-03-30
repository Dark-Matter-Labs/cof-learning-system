import { scaleLinear, area } from 'd3';
import type { SparklinePoint } from '@/lib/types/convergence';

const WIDTH = 200;
const HEIGHT = 40;
const TEAL = '#14b8a6';
const CORAL = '#f97316';

interface ConvergenceSparklineProps {
  readonly snapshots: readonly SparklinePoint[];
}

export function ConvergenceSparkline({ snapshots }: ConvergenceSparklineProps) {
  // Empty state: dashed baseline
  if (snapshots.length === 0) {
    return (
      <svg width={WIDTH} height={HEIGHT}>
        <line
          x1={0} y1={HEIGHT / 2}
          x2={WIDTH} y2={HEIGHT / 2}
          stroke="#374151"
          strokeDasharray="4 2"
        />
      </svg>
    );
  }

  // Single point: dot
  if (snapshots.length === 1) {
    const yScale = scaleLinear().domain([-10, 10]).range([HEIGHT, 0]);
    const fillColor = snapshots[0].score > 0 ? TEAL : CORAL;
    return (
      <svg width={WIDTH} height={HEIGHT}>
        <circle
          cx={WIDTH / 2}
          cy={yScale(snapshots[0].score)}
          r={3}
          fill={fillColor}
        />
      </svg>
    );
  }

  // Multiple points: area chart
  const xScale = scaleLinear()
    .domain([0, snapshots.length - 1])
    .range([0, WIDTH]);

  const yScale = scaleLinear()
    .domain([-10, 10])
    .range([HEIGHT, 0]);

  const areaGen = area<SparklinePoint>()
    .x((_, i) => xScale(i))
    .y0(yScale(0))
    .y1(d => yScale(d.score));

  const lastScore = snapshots[snapshots.length - 1].score;
  const fillColor = lastScore > 0 ? TEAL : CORAL;
  const pathD = areaGen(snapshots as SparklinePoint[]) ?? '';

  return (
    <svg width={WIDTH} height={HEIGHT}>
      <path d={pathD} fill={fillColor} fillOpacity={0.4} />
    </svg>
  );
}
