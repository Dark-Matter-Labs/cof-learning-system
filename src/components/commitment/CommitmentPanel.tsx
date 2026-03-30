'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert, TensionResolutionAction } from '@/lib/types/tension';
import { CommitmentCard } from './CommitmentCard';
import { TensionAlertItem } from './TensionAlertItem';
import { GoalSpaceSection } from './GoalSpaceSection';

interface CommitmentPanelProps {
  readonly goalSpaces: readonly Node[];
  readonly triggerOutcomes: readonly Node[];
  readonly commitments: readonly Node[];
  readonly allNodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly tensions: readonly TensionAlert[];
  readonly selectedCommitmentId: string | null;
  readonly onSelectCommitment: (id: string) => void;
  readonly onSelectTension: (alert: TensionAlert) => void;
  readonly onAssumptionClick: (assumptionId: string) => void;
  readonly onAddCommitment: () => void;
  readonly onAcknowledgeTension: (id: string) => void;
  readonly onResolveTension: (id: string, action: TensionResolutionAction, belief: string) => void;
}

function getStatus(node: Node): string {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    if (typeof c.status === 'string') return c.status;
  }
  return 'active';
}

function sortCommitments(nodes: readonly Node[]): readonly Node[] {
  const order = { active: 0, proposed: 1 };
  return [...nodes].sort((a, b) => {
    const statusA = getStatus(a);
    const statusB = getStatus(b);
    const orderA = order[statusA as keyof typeof order] ?? 2;
    const orderB = order[statusB as keyof typeof order] ?? 2;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function CommitmentPanel({
  goalSpaces,
  triggerOutcomes,
  commitments,
  allNodes,
  edges,
  tensions,
  selectedCommitmentId,
  onSelectCommitment,
  onSelectTension,
  onAssumptionClick,
  onAddCommitment,
  onAcknowledgeTension,
  onResolveTension,
}: CommitmentPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const activeTensions = tensions.filter(t => t.status === 'active');

  // Build hierarchy from edges
  // advances_goal: trigger_outcome (source) -> goal_space (target)
  // assigned_to_outcome: commitment (source) -> trigger_outcome (target)
  // belongs_to_goalspace: commitment (source) -> goal_space (target)

  const outcomesByGoalSpace: Record<string, Node[]> = {};
  const commitmentsByOutcome: Record<string, Node[]> = {};
  const commitmentsByGoalSpace: Record<string, Node[]> = {};
  const linkedCommitmentIds = new Set<string>();

  for (const edge of edges) {
    if (edge.edge_type === 'advances_goal') {
      const outcome = triggerOutcomes.find(n => n.id === edge.source_id);
      if (outcome) {
        const list = outcomesByGoalSpace[edge.target_id] ?? [];
        outcomesByGoalSpace[edge.target_id] = [...list, outcome];
      }
    }
    if (edge.edge_type === 'assigned_to_outcome') {
      const commitment = commitments.find(n => n.id === edge.source_id);
      if (commitment) {
        const list = commitmentsByOutcome[edge.target_id] ?? [];
        commitmentsByOutcome[edge.target_id] = [...list, commitment];
        linkedCommitmentIds.add(commitment.id);
      }
    }
    if (edge.edge_type === 'belongs_to_goalspace') {
      const commitment = commitments.find(n => n.id === edge.source_id);
      if (commitment) {
        const list = commitmentsByGoalSpace[edge.target_id] ?? [];
        commitmentsByGoalSpace[edge.target_id] = [...list, commitment];
      }
    }
  }

  // Commitments linked to a goal space but NOT to any trigger outcome
  const goalSpaceOnlyCommitments: Record<string, readonly Node[]> = {};
  for (const gs of goalSpaces) {
    const gsCommitments = commitmentsByGoalSpace[gs.id] ?? [];
    goalSpaceOnlyCommitments[gs.id] = gsCommitments.filter(c => !linkedCommitmentIds.has(c.id));
  }

  // Fully unlinked commitments (no goal space, no trigger outcome)
  const allGoalSpaceCommitmentIds = new Set(
    Object.values(commitmentsByGoalSpace).flat().map(c => c.id)
  );
  const unlinkedCommitments = sortCommitments(
    commitments.filter(c => !linkedCommitmentIds.has(c.id) && !allGoalSpaceCommitmentIds.has(c.id))
  );

  if (collapsed) {
    return (
      <div className="absolute left-0 top-[49px] bottom-0 w-6 flex flex-col items-center pt-3 bg-gray-950 border-r border-gray-800/50 z-10">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="text-gray-600 hover:text-gray-400"
          title="Expand commitment panel"
        >
          ‹
        </button>
        {activeTensions.length > 0 && (
          <div className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500" title={`${activeTensions.length} active tensions`} />
        )}
      </div>
    );
  }

  return (
    <div className="absolute left-0 top-[49px] bottom-0 w-[260px] bg-gray-950 border-r border-gray-800/50 z-10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50 shrink-0">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Commitments</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-gray-600 hover:text-gray-400 text-sm"
          title="Collapse"
        >
          ‹
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Goal space hierarchy */}
        {goalSpaces.length > 0 && (
          <div className="pt-2">
            {goalSpaces.map(gs => (
              <GoalSpaceSection
                key={gs.id}
                goalSpace={gs}
                triggerOutcomes={outcomesByGoalSpace[gs.id] ?? []}
                commitmentsByOutcome={commitmentsByOutcome}
                unlinkedCommitments={goalSpaceOnlyCommitments[gs.id] ?? []}
                allNodes={allNodes}
                edges={edges}
                tensions={tensions}
                selectedCommitmentId={selectedCommitmentId}
                onSelectCommitment={onSelectCommitment}
                onAssumptionClick={onAssumptionClick}
              />
            ))}
          </div>
        )}

        {/* Unlinked commitments (no goal space, no trigger outcome) */}
        {unlinkedCommitments.length > 0 && (
          <div className="pt-2">
            {goalSpaces.length > 0 && (
              <div className="px-3 pb-1">
                <span className="text-[9px] text-gray-600 uppercase tracking-wide">Unlinked</span>
              </div>
            )}
            <div className="px-3">
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
          </div>
        )}

        {/* Empty state */}
        {goalSpaces.length === 0 && commitments.length === 0 && (
          <div className="px-3 pt-3">
            <p className="text-[10px] text-gray-600 italic">No commitments yet</p>
          </div>
        )}

        {/* Add commitment button */}
        <div className="px-3 pb-3 pt-2">
          <button
            type="button"
            onClick={onAddCommitment}
            className="w-full text-[10px] text-gray-600 hover:text-gray-400 border border-dashed border-gray-800 hover:border-gray-700 rounded py-1.5 transition-colors"
          >
            + Add commitment
          </button>
        </div>

        {/* Tension alerts */}
        {activeTensions.length > 0 && (
          <div className="border-t border-gray-800/50 px-3 pt-3">
            <div className="text-[9px] text-gray-600 uppercase tracking-wide mb-2">
              Tensions ({activeTensions.length})
            </div>
            {activeTensions.map(alert => (
              <TensionAlertItem
                key={alert.id}
                alert={alert}
                onSelect={onSelectTension}
                onAcknowledge={onAcknowledgeTension}
                onResolve={onResolveTension}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
