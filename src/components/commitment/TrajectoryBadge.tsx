'use client';

import { useState } from 'react';
import type { FactorBreakdown } from '@/lib/graph/convergence';

export type TrajectoryStatus = 'pending' | 'converging' | 'neutral' | 'drifting';

export interface TrajectoryBadgeProps {
  readonly status: TrajectoryStatus;
  readonly score?: number;
  readonly factorBreakdown?: FactorBreakdown;
}

const STATUS_CONFIG: Record<TrajectoryStatus, { label: string; icon: string; bgClass: string; textClass: string }> = {
  pending:    { label: '---',        icon: '\u2299', bgClass: 'bg-gray-100 dark:bg-gray-800',    textClass: 'text-gray-500' },
  converging: { label: 'Converging', icon: '\u2197', bgClass: 'bg-xco-teal/10 dark:bg-xco-navy/50', textClass: 'text-xco-ocean dark:text-xco-teal' },
  neutral:    { label: 'Neutral',    icon: '\u2192', bgClass: 'bg-gray-100 dark:bg-gray-800',    textClass: 'text-gray-600 dark:text-gray-400' },
  drifting:   { label: 'Drifting',   icon: '\u2198', bgClass: 'bg-red-50 dark:bg-red-900/30',    textClass: 'text-red-600 dark:text-red-400'   },
};

export function scoreToStatus(score: number): TrajectoryStatus {
  if (score > 1.0) return 'converging';
  if (score < -1.0) return 'drifting';
  return 'neutral';
}

export function TrajectoryBadge({ status, score, factorBreakdown }: TrajectoryBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[status];

  const scoreText = status === 'pending'
    ? '\u2014'
    : score !== undefined
      ? `${score >= 0 ? '+' : ''}${score}`
      : '\u2014';

  const handleClick = () => {
    if (factorBreakdown !== undefined) {
      setExpanded(prev => !prev);
    }
  };

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${config.bgClass} ${config.textClass} ${factorBreakdown !== undefined ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
        <span>{scoreText}</span>
      </button>

      {expanded && factorBreakdown !== undefined && (
        <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-left">
          {factorBreakdown.outcome_scores.map(outcome => (
            <div key={outcome.outcome_id} className="mb-2">
              <div className="text-[10px] text-gray-700 dark:text-gray-300 mb-0.5">{outcome.outcome_title}</div>
              {outcome.positive_factors.map((factor, idx) => (
                <div key={`pos-${idx}`} className="flex gap-1 text-[9px]">
                  <span className="text-xco-teal">+{factor.weight.toFixed(1)}</span>
                  <span className="text-gray-600 dark:text-gray-400">{factor.node_title}</span>
                </div>
              ))}
              {outcome.negative_factors.map((factor, idx) => (
                <div key={`neg-${idx}`} className="flex gap-1 text-[9px]">
                  <span className="text-red-400">{factor.weight.toFixed(1)}</span>
                  <span className="text-gray-600 dark:text-gray-400">{factor.node_title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
