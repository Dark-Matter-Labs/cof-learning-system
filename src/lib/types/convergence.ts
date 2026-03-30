import type { FactorBreakdown } from '@/lib/graph/convergence';

export interface ConvergenceSnapshot {
  readonly score: number;
  readonly factor_breakdown: FactorBreakdown;
  readonly computed_at: string;
}

export interface SparklinePoint {
  readonly score: number;
  readonly computed_at: string;
}

export interface ConvergenceData {
  readonly latest: ConvergenceSnapshot | null;
  readonly history: readonly SparklinePoint[];
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function shouldTriggerReflection(
  nodeCountNow: number,
  lastReflectionNodeCount: number,
  lastReflectionAt: Date | null,
  threshold: number = 10,
): boolean {
  const delta = nodeCountNow - lastReflectionNodeCount;
  if (delta < threshold) return false;
  if (lastReflectionAt === null) return true;
  return (Date.now() - lastReflectionAt.getTime()) > TWENTY_FOUR_HOURS_MS;
}
