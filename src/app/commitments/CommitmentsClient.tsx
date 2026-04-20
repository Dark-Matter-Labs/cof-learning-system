'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';
import { CommitmentCard } from '@/components/commitment/CommitmentCard';
import { CommitmentCardEditor, type CommitmentUpdates } from '@/components/commitment/CommitmentCardEditor';
import { TensionAlertItem } from '@/components/commitment/TensionAlertItem';
import { GoalSpaceSection } from '@/components/commitment/GoalSpaceSection';

interface CommitmentsClientProps {
  readonly goalSpaces: readonly Node[];
  readonly triggerOutcomes: readonly Node[];
  readonly initialCommitments: readonly Node[];
  readonly allNodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly tensions: readonly TensionAlert[];
  readonly highlightId?: string;
}

function getStatus(node: Node): string {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    if (typeof c.status === 'string') return c.status;
  }
  return 'active';
}

function sortCommitments(nodes: readonly Node[]): readonly Node[] {
  const order: Record<string, number> = { active: 0, proposed: 1 };
  return [...nodes].sort((a, b) => {
    const oa = order[getStatus(a)] ?? 2;
    const ob = order[getStatus(b)] ?? 2;
    if (oa !== ob) return oa - ob;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function CommitmentsClient({
  goalSpaces,
  triggerOutcomes,
  initialCommitments,
  allNodes,
  edges,
  tensions,
  highlightId,
}: CommitmentsClientProps) {
  const [commitments, setCommitments] = useState<Node[]>(() => [...initialCommitments]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Build hierarchy
  const outcomesByGoalSpace: Record<string, Node[]> = {};
  const commitmentsByOutcome: Record<string, Node[]> = {};
  const commitmentsByGoalSpace: Record<string, Node[]> = {};
  const linkedCommitmentIds = new Set<string>();

  for (const edge of edges) {
    if (edge.edge_type === 'advances_goal') {
      const outcome = triggerOutcomes.find(n => n.id === edge.source_id);
      if (outcome) {
        outcomesByGoalSpace[edge.target_id] = [...(outcomesByGoalSpace[edge.target_id] ?? []), outcome];
      }
    }
    if (edge.edge_type === 'assigned_to_outcome') {
      const commitment = commitments.find(n => n.id === edge.source_id);
      if (commitment) {
        commitmentsByOutcome[edge.target_id] = [...(commitmentsByOutcome[edge.target_id] ?? []), commitment];
        linkedCommitmentIds.add(commitment.id);
      }
    }
    if (edge.edge_type === 'belongs_to_goalspace') {
      const commitment = commitments.find(n => n.id === edge.source_id);
      if (commitment) {
        commitmentsByGoalSpace[edge.target_id] = [...(commitmentsByGoalSpace[edge.target_id] ?? []), commitment];
      }
    }
  }

  const goalSpaceOnlyCommitments: Record<string, readonly Node[]> = {};
  for (const gs of goalSpaces) {
    const gsCommitments = commitmentsByGoalSpace[gs.id] ?? [];
    goalSpaceOnlyCommitments[gs.id] = gsCommitments.filter(c => !linkedCommitmentIds.has(c.id));
  }

  const allGoalSpaceCommitmentIds = new Set(
    Object.values(commitmentsByGoalSpace).flat().map(c => c.id),
  );
  const unlinkedCommitments = sortCommitments(
    commitments.filter(c => !linkedCommitmentIds.has(c.id) && !allGoalSpaceCommitmentIds.has(c.id)),
  );

  const activeTensions = tensions.filter(t => t.status === 'active');

  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(highlightId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId]);

  const handleAdd = useCallback(async () => {
    const trimmed = addTitle.trim();
    if (!trimmed) return;
    setAddError(null);
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed, node_type: 'commitment' }),
      });
      if (!res.ok) throw new Error('Failed to add');
      const { data: node } = await res.json() as { data: Node };
      setCommitments(prev => [node, ...prev]);
      setAddTitle('');
    } catch {
      setAddError('Failed to add commitment');
    }
  }, [addTitle]);

  const handleSave = useCallback(async (id: string, updates: CommitmentUpdates) => {
    const res = await fetch(`/api/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: updates.title,
        description: updates.description,
        content: updates.content,
      }),
    });
    if (!res.ok) throw new Error('Failed to save');
    const { data: updated } = await res.json() as { data: Node };
    setCommitments(prev => prev.map(c => c.id === id ? updated : c));
    setEditingId(null);
  }, []);

  const isEmpty = goalSpaces.length === 0 && commitments.length === 0;

  return (
    <div>
      {/* Add commitment form */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={addTitle}
            onChange={e => setAddTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="New commitment…"
            className="flex-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#185FA5]"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!addTitle.trim()}
            className="text-sm px-3 py-1.5 bg-[#185FA5] text-white rounded-md disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {addError && <p className="text-[10px] text-red-400 mt-1">{addError}</p>}
      </div>

      {isEmpty ? (
        <p className="text-sm text-gray-500 dark:text-gray-600">No commitments yet.</p>
      ) : (
        <>
          {goalSpaces.map(gs => (
            <div key={gs.id} id={`gs-${gs.id}`}>
              <GoalSpaceSection
                goalSpace={gs}
                triggerOutcomes={outcomesByGoalSpace[gs.id] ?? []}
                commitmentsByOutcome={commitmentsByOutcome}
                unlinkedCommitments={goalSpaceOnlyCommitments[gs.id] ?? []}
                allNodes={allNodes}
                edges={edges}
                tensions={tensions}
                selectedCommitmentId={highlightId ?? null}
                onSelectCommitment={() => {}}
                onAssumptionClick={() => {}}
                onEdit={setEditingId}
                editingId={editingId}
                onSave={handleSave}
                onCancelEdit={() => setEditingId(null)}
              />
            </div>
          ))}

          {unlinkedCommitments.length > 0 && (
            <section className="mt-6">
              {goalSpaces.length > 0 && (
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Unlinked commitments
                </h2>
              )}
              <div className="space-y-2">
                {unlinkedCommitments.map(c => (
                  <div
                    key={c.id}
                    id={c.id}
                    className={highlightId === c.id ? 'ring-2 ring-[#185FA5] rounded-md' : ''}
                  >
                    {editingId === c.id ? (
                      <CommitmentCardEditor
                        commitment={c}
                        onSave={handleSave}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <CommitmentCard
                        commitment={c}
                        allNodes={allNodes}
                        edges={edges}
                        tensions={tensions}
                        isSelected={highlightId === c.id}
                        onSelect={() => {}}
                        onAssumptionClick={() => {}}
                        onEdit={() => setEditingId(c.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {activeTensions.length > 0 && (
        <section className="mt-8 border-t border-gray-200 dark:border-gray-800 pt-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Tension alerts ({activeTensions.length})
          </h2>
          <div className="space-y-2">
            {activeTensions.map(alert => (
              <TensionAlertItem
                key={alert.id}
                alert={alert}
                onSelect={() => {}}
                onAcknowledge={() => {}}
                onResolve={() => {}}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
