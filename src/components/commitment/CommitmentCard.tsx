'use client';

import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';

interface CommitmentCardProps {
  readonly commitment: Node;
  readonly allNodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly tensions: readonly TensionAlert[];
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
  readonly onAssumptionClick: (assumptionId: string) => void;
  readonly onEdit?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  active:   'text-emerald-600 dark:text-emerald-400',
  proposed: 'text-amber-600 dark:text-amber-400',
  achieved: 'text-gray-500',
  abandoned:'text-gray-500 dark:text-gray-600',
};

function getCommitmentStatus(node: Node): string {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    if (typeof c.status === 'string') return c.status;
  }
  return 'active';
}

function getResourceAllocation(node: Node): number | null {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    if (typeof c.resource_allocation === 'number') return c.resource_allocation;
  }
  return null;
}

export function CommitmentCard({
  commitment,
  allNodes,
  edges,
  tensions,
  isSelected,
  onSelect,
  onAssumptionClick,
  onEdit,
}: CommitmentCardProps) {
  const status = getCommitmentStatus(commitment);
  const allocation = getResourceAllocation(commitment);

  // Find linked assumptions (nodes this commitment serves — backward: assumption → serves_commitment → commitment)
  const linkedAssumptionIds = edges
    .filter(e => e.target_id === commitment.id && e.edge_type === 'serves_commitment')
    .map(e => e.source_id);

  const linkedAssumptions = linkedAssumptionIds
    .map(id => allNodes.find(n => n.id === id))
    .filter((n): n is Node => n !== undefined);

  // Count tensions affecting this commitment's assumptions
  const activeTensions = tensions.filter(
    t => t.status === 'active' && t.affected_commitment_ids.includes(commitment.id)
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(commitment.id)}
      className={[
        'w-full text-left border-l-[3px] border-[#185FA5] bg-gray-50 dark:bg-gray-900 rounded-r-md mb-2 overflow-hidden group',
        'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
        isSelected ? 'ring-1 ring-[#185FA5]/60' : '',
      ].join(' ')}
    >
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug flex-1 min-w-0">
            {commitment.title}
          </span>
          {onEdit && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onEdit(); }}
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Edit commitment"
            >
              ✏
            </button>
          )}
          {commitment.author_id && (
            <span className="shrink-0 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] text-gray-600 dark:text-gray-400 font-bold">
              {commitment.author_id.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {commitment.description && (
          <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-1.5">
            {commitment.description}
          </p>
        )}

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium ${STATUS_COLORS[status] ?? 'text-gray-500'}`}>
            ● {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          {allocation !== null && (
            <span className="text-[10px] text-gray-500 dark:text-gray-600">{allocation}%</span>
          )}
        </div>
      </div>

      {/* Linked assumptions */}
      {linkedAssumptions.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 px-2.5 py-2">
          <div className="text-[9px] text-gray-500 dark:text-gray-600 uppercase tracking-wide mb-1">Depends on</div>
          <div className="flex flex-wrap gap-1">
            {linkedAssumptions.map(assumption => (
              <button
                key={assumption.id}
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onAssumptionClick(assumption.id);
                }}
                className="text-[10px] bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded truncate max-w-[100px]"
                title={assumption.title}
              >
                {assumption.title.length > 14 ? assumption.title.slice(0, 13) + '…' : assumption.title}
              </button>
            ))}
          </div>

          {activeTensions.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1">
              <span className="text-amber-500 text-[10px]">⚠</span>
              <span className="text-[10px] text-amber-500">{activeTensions.length} tension{activeTensions.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
