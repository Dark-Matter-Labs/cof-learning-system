'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert, TensionResolutionAction } from '@/lib/types/tension';
import { CommitmentCard } from './CommitmentCard';
import { TensionAlertItem } from './TensionAlertItem';

interface CommitmentPanelProps {
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

function AllocationSummary({ commitments }: { commitments: readonly Node[] }) {
  const allocations = commitments
    .filter(c => {
      const status = getStatus(c);
      return status === 'active' || status === 'proposed';
    })
    .map(c => ({
      title: c.title,
      allocation: getAllocation(c),
    }))
    .filter(c => c.allocation !== null) as { title: string; allocation: number }[];

  if (allocations.length === 0) return null;

  const total = allocations.reduce((sum, c) => sum + c.allocation, 0);

  return (
    <div className="px-3 pb-3">
      <div className="text-[9px] text-gray-600 uppercase tracking-wide mb-2">Allocation</div>
      <div className="space-y-1.5">
        {allocations.map(({ title, allocation }) => (
          <div key={title}>
            <div className="flex justify-between mb-0.5">
              <span className="text-[9px] text-gray-500 truncate flex-1 min-w-0">{title}</span>
              <span className="text-[9px] text-gray-600 ml-1">{allocation}%</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#185FA5]/70 rounded-full"
                style={{ width: `${allocation}%` }}
              />
            </div>
          </div>
        ))}
        <div className="flex justify-between pt-1 border-t border-gray-800 mt-1">
          <span className="text-[9px] text-gray-600">Total committed</span>
          <span className={`text-[9px] font-medium ${total > 100 ? 'text-red-400' : 'text-gray-400'}`}>
            {total}%
          </span>
        </div>
      </div>
    </div>
  );
}

function getStatus(node: Node): string {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    if (typeof c.status === 'string') return c.status;
  }
  return 'active';
}

function getAllocation(node: Node): number | null {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    if (typeof c.resource_allocation === 'number') return c.resource_allocation;
  }
  return null;
}

function sortCommitments(commitments: readonly Node[]): readonly Node[] {
  const order = { active: 0, proposed: 1 };
  return [...commitments].sort((a, b) => {
    const statusA = getStatus(a);
    const statusB = getStatus(b);
    const orderA = order[statusA as keyof typeof order] ?? 2;
    const orderB = order[statusB as keyof typeof order] ?? 2;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function CommitmentPanel({
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
  const [allocationOpen, setAllocationOpen] = useState(false);

  const activeTensions = tensions.filter(t => t.status === 'active');
  const sorted = sortCommitments(commitments);

  if (collapsed) {
    return (
      <div className="absolute right-0 top-[49px] bottom-0 w-6 flex flex-col items-center pt-3 bg-gray-950 border-l border-gray-800/50 z-20">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="text-gray-600 hover:text-gray-400 rotate-180"
          title="Expand commitment panel"
        >
          ›
        </button>
        {activeTensions.length > 0 && (
          <div className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500" title={`${activeTensions.length} active tensions`} />
        )}
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-[49px] bottom-0 w-[260px] bg-gray-950 border-l border-gray-800/50 z-20 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50 shrink-0">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Commitments</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-gray-600 hover:text-gray-400 text-sm"
          title="Collapse"
        >
          ›
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active commitments */}
        <div className="px-3 pt-3">
          {sorted.length === 0 ? (
            <p className="text-[10px] text-gray-600 italic">No commitments yet</p>
          ) : (
            sorted.map(c => (
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
            ))
          )}
        </div>

        <div className="px-3 pb-3">
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

        {/* Allocation summary */}
        {commitments.length > 0 && (
          <div className="border-t border-gray-800/50 mt-1">
            <button
              type="button"
              onClick={() => setAllocationOpen(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-gray-600 hover:text-gray-400"
            >
              <span className="uppercase tracking-wide">Allocation</span>
              <span>{allocationOpen ? '▲' : '▼'}</span>
            </button>
            {allocationOpen && <AllocationSummary commitments={commitments} />}
          </div>
        )}
      </div>
    </div>
  );
}
