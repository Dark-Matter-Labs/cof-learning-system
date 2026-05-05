'use client';

import { useState, useEffect } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';
import type { ConvergenceData } from '@/lib/types/convergence';
import { CommitmentCard } from './CommitmentCard';
import { CommitmentCardEditor, type CommitmentUpdates } from './CommitmentCardEditor';
import { TrajectoryBadge, scoreToStatus } from './TrajectoryBadge';
import { AllocationSummary } from './AllocationSummary';
import { ConvergenceSparkline } from '@/components/graph/convergence/ConvergenceSparkline';

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
  readonly onEdit?: (id: string) => void;
  readonly editingId?: string | null;
  readonly onSave?: (id: string, updates: CommitmentUpdates) => Promise<void>;
  readonly onCancelEdit?: () => void;
  readonly onAddOutcome?: (title: string) => Promise<void>;
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
  onEdit,
  editingId,
  onSave,
  onCancelEdit,
  onAddOutcome,
}: GoalSpaceSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [convergenceData, setConvergenceData] = useState<ConvergenceData | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetch(`/api/convergence/snapshots?goal_space_id=${goalSpace.id}`)
      .then(res => res.json())
      .then(json => {
        if (json.data) setConvergenceData(json.data);
      })
      .catch(() => {
        // Silent fail — badge stays 'pending' when data unavailable
      });
  }, [goalSpace.id]);

  const trajectoryStatus = convergenceData?.latest
    ? scoreToStatus(convergenceData.latest.score)
    : 'pending';
  const trajectoryScore = convergenceData?.latest?.score;
  const trajectoryBreakdown = convergenceData?.latest?.factor_breakdown;

  // All commitments in this goal space (for AllocationSummary)
  const allSectionCommitments: readonly Node[] = [
    ...Object.values(commitmentsByOutcome).flat(),
    ...unlinkedCommitments,
  ];

  const handleAddOutcomeSubmit = async () => {
    const trimmed = addTitle.trim();
    if (!trimmed || !onAddOutcome) return;
    setIsAdding(true);
    setAddError(null);
    try {
      await onAddOutcome(trimmed);
      setAddTitle('');
      setShowAddForm(false);
    } catch {
      setAddError('Failed to add outcome');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="border-b border-gray-200/80 dark:border-gray-800/50">
      {/* Goal space header */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100/80 dark:hover:bg-gray-900/50 transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-gray-500">{expanded ? '\u25BC' : '\u25B6'}</span>
          <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate">{goalSpace.title}</span>
        </div>
        <TrajectoryBadge
          status={trajectoryStatus}
          score={trajectoryScore}
          factorBreakdown={trajectoryBreakdown}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="pb-2">
          {convergenceData && convergenceData.history.length > 0 && (
            <div className="px-3 py-1">
              <ConvergenceSparkline snapshots={convergenceData.history} />
            </div>
          )}

          {triggerOutcomes.length === 0 && unlinkedCommitments.length === 0 && (
            <p className="px-3 pl-6 text-[9px] text-gray-500 dark:text-gray-600 italic">No outcomes or commitments</p>
          )}

          {triggerOutcomes.map((outcome, idx) => {
            const isLast = idx === triggerOutcomes.length - 1 && unlinkedCommitments.length === 0;
            const outcomeCommitments = commitmentsByOutcome[outcome.id] ?? [];
            const prefix = isLast ? '\u2514' : '\u251C';

            return (
              <div key={outcome.id} className="pl-3">
                {/* Trigger outcome row */}
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <span className="text-[10px] text-gray-500 dark:text-gray-600 font-mono">{prefix}</span>
                  <span className="text-[10px] text-gray-500">{'\u25CB'}</span>
                  <span className="text-[10px] text-gray-600 dark:text-gray-400 truncate">{outcome.title}</span>
                </div>

                {/* Commitments under this outcome */}
                {outcomeCommitments.length > 0 ? (
                  <div className="pl-6">
                    {outcomeCommitments.map(c => (
                      <div key={c.id} id={c.id}>
                        {editingId === c.id && onSave && onCancelEdit ? (
                          <CommitmentCardEditor
                            commitment={c}
                            onSave={onSave}
                            onCancel={onCancelEdit}
                          />
                        ) : (
                          <CommitmentCard
                            commitment={c}
                            allNodes={allNodes}
                            edges={edges}
                            tensions={tensions}
                            isSelected={selectedCommitmentId === c.id}
                            onSelect={onSelectCommitment}
                            onAssumptionClick={onAssumptionClick}
                            onEdit={onEdit ? () => onEdit(c.id) : undefined}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="pl-8 text-[9px] text-gray-500 dark:text-gray-700 italic">no commitments</p>
                )}
              </div>
            );
          })}

          {/* Commitments linked to goal space but not to any trigger outcome */}
          {unlinkedCommitments.length > 0 && (
            <div className="pl-6">
              {unlinkedCommitments.map(c => (
                <div key={c.id} id={c.id}>
                  {editingId === c.id && onSave && onCancelEdit ? (
                    <CommitmentCardEditor
                      commitment={c}
                      onSave={onSave}
                      onCancel={onCancelEdit}
                    />
                  ) : (
                    <CommitmentCard
                      commitment={c}
                      allNodes={allNodes}
                      edges={edges}
                      tensions={tensions}
                      isSelected={selectedCommitmentId === c.id}
                      onSelect={onSelectCommitment}
                      onAssumptionClick={onAssumptionClick}
                      onEdit={onEdit ? () => onEdit(c.id) : undefined}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Inline add outcome */}
          {onAddOutcome && (
            <div className="pl-6 py-1">
              {showAddForm ? (
                <div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={addTitle}
                      onChange={e => setAddTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { void handleAddOutcomeSubmit(); }
                        if (e.key === 'Escape') { setShowAddForm(false); setAddTitle(''); setAddError(null); }
                      }}
                      placeholder="Outcome title…"
                      autoFocus
                      className="flex-1 text-[10px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-xco-teal"
                    />
                    <button
                      type="button"
                      onClick={() => { void handleAddOutcomeSubmit(); }}
                      disabled={!addTitle.trim() || isAdding}
                      className="text-[10px] text-xco-ocean disabled:opacity-40"
                    >
                      {isAdding ? '…' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setAddTitle(''); setAddError(null); }}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  {addError && <p className="text-[9px] text-red-400 mt-0.5">{addError}</p>}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="text-[9px] text-gray-400 hover:text-xco-ocean flex items-center gap-0.5"
                >
                  <span>+</span>
                  <span>outcome</span>
                </button>
              )}
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
