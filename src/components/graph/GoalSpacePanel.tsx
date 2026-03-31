'use client';

import { useState, useEffect } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { ConvergenceData } from '@/lib/types/convergence';
import { NodeTypeBadge } from '@/components/shared/NodeTypeBadge';
import { TrajectoryBadge, scoreToStatus } from '@/components/commitment/TrajectoryBadge';
import { ConvergenceSparkline } from '@/components/graph/convergence/ConvergenceSparkline';
import {
  computeOutcomeStatus,
  getOutcomeCommitmentCount,
  getOutcomeHunchCount,
  type OutcomeStatus,
} from '@/lib/graph/queries';

interface GoalSpacePanelProps {
  readonly node: Node;
  readonly edges: readonly Edge[];
  readonly allNodes: readonly Node[];
  readonly onClose: () => void;
}

const STATUS_DISPLAY: Record<OutcomeStatus, { symbol: string; colorClass: string }> = {
  not_started: { symbol: '\u25CB', colorClass: 'text-gray-600' },
  in_progress: { symbol: '\u25D0', colorClass: 'text-yellow-500' },
  met:         { symbol: '\u25C9', colorClass: 'text-teal-400' },
  blocked:     { symbol: '\u2715', colorClass: 'text-red-500' },
};

export function GoalSpacePanel({ node, edges, allNodes, onClose }: GoalSpacePanelProps) {
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  const outcomes: readonly Node[] = edges
    .filter(e => e.edge_type === 'advances_goal' && e.target_id === node.id)
    .map(e => nodeMap.get(e.source_id))
    .filter((n): n is Node => n !== undefined);

  const [convergenceData, setConvergenceData] = useState<ConvergenceData | null>(null);

  useEffect(() => {
    fetch(`/api/convergence/snapshots?goal_space_id=${node.id}`)
      .then(res => res.json())
      .then(json => {
        if (json.data) setConvergenceData(json.data);
      })
      .catch(() => {
        // Silent fail — badge stays 'pending'
      });
  }, [node.id]);

  const trajectoryStatus = convergenceData?.latest
    ? scoreToStatus(convergenceData.latest.score)
    : 'pending';

  return (
    <div className="absolute right-0 top-[49px] bottom-0 w-72 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <NodeTypeBadge nodeType={node.node_type} />
          <TrajectoryBadge
            status={trajectoryStatus}
            score={convergenceData?.latest?.score}
            factorBreakdown={convergenceData?.latest?.factor_breakdown}
          />
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 text-lg"
          aria-label="Close goal space panel"
        >
          ×
        </button>
      </div>

      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-200 mb-2">{node.title}</h3>

      {/* Convergence sparkline */}
      <div className="mb-3">
        <ConvergenceSparkline snapshots={convergenceData?.history ?? []} />
      </div>

      <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-2">
        Trigger Outcomes ({outcomes.length})
      </div>

      {outcomes.length === 0 ? (
        <p className="text-[10px] text-gray-500 dark:text-gray-700 italic">No trigger outcomes linked</p>
      ) : (
        outcomes.map(outcome => {
          const status = computeOutcomeStatus(outcome.id, edges, allNodes);
          const { symbol, colorClass } = STATUS_DISPLAY[status];
          const commitmentCount = getOutcomeCommitmentCount(outcome.id, edges);
          const hunchCount = getOutcomeHunchCount(outcome.id, edges, allNodes);
          const commitmentLabel = commitmentCount === 1 ? '1 commitment' : `${commitmentCount} commitments`;
          const hunchLabel = hunchCount === 1 ? '1 hunch' : `${hunchCount} hunches`;

          return (
            <div key={outcome.id} className="mb-3 border border-gray-200 dark:border-gray-800 rounded p-2">
              <div className="flex items-start gap-2">
                <span className={`text-sm mt-0.5 ${colorClass}`}>{symbol}</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">{outcome.title}</span>
              </div>
              <div className="flex gap-3 mt-1.5 pl-5">
                <span className="text-[10px] text-gray-500 dark:text-gray-600">{commitmentLabel}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-600">{hunchLabel}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
