'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';
import { CommitmentCard } from './CommitmentCard';
import { TrajectoryBadge } from './TrajectoryBadge';
import { AllocationSummary } from './AllocationSummary';

interface GoalSpaceSectionProps {
  readonly goalSpace: Node;
  readonly triggerOutcomes: readonly Node[];
  readonly commitmentsByOutcome: Readonly<Record<string, readonly Node[]>>;
  readonly unlinkedCommitments: readonly Node[];
  readonly allNodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly tensions: readonly TensionAlert[];
  readonly selectedCommitmentId: string | null;
  readonly onSelectCommitment: (id: string) => void;
  readonly onAssumptionClick: (assumptionId: string) => void;
}

export function GoalSpaceSection({
  goalSpace,
  triggerOutcomes,
  commitmentsByOutcome,
  unlinkedCommitments,
  allNodes,
  edges,
  tensions,
  selectedCommitmentId,
  onSelectCommitment,
  onAssumptionClick,
}: GoalSpaceSectionProps) {
  const [expanded, setExpanded] = useState(true);

  // All commitments in this goal space (for AllocationSummary)
  const allSectionCommitments: readonly Node[] = [
    ...Object.values(commitmentsByOutcome).flat(),
    ...unlinkedCommitments,
  ];

  return (
    <div className="border-b border-gray-800/50">
      {/* Goal space header */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-900/50 transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-gray-500">{expanded ? '\u25BC' : '\u25B6'}</span>
          <span className="text-[10px] font-semibold text-gray-300 truncate">{goalSpace.title}</span>
        </div>
        <TrajectoryBadge status="pending" />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="pb-2">
          {triggerOutcomes.length === 0 && unlinkedCommitments.length === 0 && (
            <p className="px-3 pl-6 text-[9px] text-gray-600 italic">No outcomes or commitments</p>
          )}

          {triggerOutcomes.map((outcome, idx) => {
            const isLast = idx === triggerOutcomes.length - 1 && unlinkedCommitments.length === 0;
            const outcomeCommitments = commitmentsByOutcome[outcome.id] ?? [];
            const prefix = isLast ? '\u2514' : '\u251C';

            return (
              <div key={outcome.id} className="pl-3">
                {/* Trigger outcome row */}
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <span className="text-[10px] text-gray-600 font-mono">{prefix}</span>
                  <span className="text-[10px] text-gray-500">{'\u25CB'}</span>
                  <span className="text-[10px] text-gray-400 truncate">{outcome.title}</span>
                </div>

                {/* Commitments under this outcome */}
                {outcomeCommitments.length > 0 ? (
                  <div className="pl-6">
                    {outcomeCommitments.map(c => (
                      <CommitmentCard
                        key={c.id}
                        commitment={c}
                        allNodes={allNodes}
                        edges={edges}
                        tensions={tensions}
                        isSelected={selectedCommitmentId === c.id}
                        onSelect={onSelectCommitment}
                        onAssumptionClick={onAssumptionClick}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="pl-8 text-[9px] text-gray-700 italic">no commitments</p>
                )}
              </div>
            );
          })}

          {/* Commitments linked to goal space but not to any trigger outcome */}
          {unlinkedCommitments.length > 0 && (
            <div className="pl-6">
              {unlinkedCommitments.map(c => (
                <CommitmentCard
                  key={c.id}
                  commitment={c}
                  allNodes={allNodes}
                  edges={edges}
                  tensions={tensions}
                  isSelected={selectedCommitmentId === c.id}
                  onSelect={onSelectCommitment}
                  onAssumptionClick={onAssumptionClick}
                />
              ))}
            </div>
          )}

          {/* AllocationSummary per goal space section (D-09) */}
          {allSectionCommitments.length > 0 && (
            <div className="px-3 pt-1">
              <AllocationSummary commitments={allSectionCommitments} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
