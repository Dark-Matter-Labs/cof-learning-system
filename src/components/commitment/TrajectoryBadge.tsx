'use client';

import { useState } from 'react';

type TrajectoryStatus = 'pending' | 'converging' | 'neutral' | 'drifting';

interface TrajectoryBadgeProps {
  readonly status: TrajectoryStatus;
  readonly score?: number;
}

const STATUS_CONFIG: Record<TrajectoryStatus, { label: string; icon: string; bgClass: string; textClass: string }> = {
  pending:    { label: '---',         icon: '\u2299', bgClass: 'bg-gray-800',    textClass: 'text-gray-500' },
  converging: { label: 'Converging', icon: '\u2197',  bgClass: 'bg-teal-900/50', textClass: 'text-teal-400' },
  neutral:    { label: 'Neutral',    icon: '\u2192',  bgClass: 'bg-gray-800',    textClass: 'text-gray-400' },
  drifting:   { label: 'Drifting',   icon: '\u2198',  bgClass: 'bg-red-900/30',  textClass: 'text-red-400'  },
};

export function TrajectoryBadge({ status, score }: TrajectoryBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = STATUS_CONFIG[status];

  const scoreText = status === 'pending'
    ? '\u2014'
    : score !== undefined
      ? `${score >= 0 ? '+' : ''}${score}`
      : '\u2014';

  return (
    <span
      className={`relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${config.bgClass} ${config.textClass} cursor-default`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span>{config.icon}</span>
      <span>{scoreText}</span>
      {showTooltip && status === 'pending' && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-[9px] text-gray-400 whitespace-nowrap z-50">
          Trajectory computed in Phase 4
        </span>
      )}
    </span>
  );
}
