'use client';

import { useEffect, useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import { getStructuralTypes } from '@/lib/config/captureTypes';

const OUTCOME_NODE_TYPES = ['hunch', 'intervention', 'signal'];

const STRUCTURAL_TYPE_LABELS: Record<string, string> = {
  hunch: 'Auto-detect',
};

interface InlineCaptureCardProps {
  /** Screen coordinates (viewport) where the card should appear */
  readonly position: { x: number; y: number };
  readonly linkedNodeId?: string;
  readonly defaultNodeType?: string;
  readonly onClose: () => void;
  readonly onCreated: (nodeId: string) => void;
  readonly goalSpaces: readonly Node[];
  readonly triggerOutcomes: readonly Node[];
}

export function InlineCaptureCard({
  position,
  defaultNodeType = 'hunch',
  onClose,
  onCreated,
  goalSpaces,
  triggerOutcomes,
}: InlineCaptureCardProps) {
  const [title, setTitle] = useState('');
  const [nodeType, setNodeType] = useState(defaultNodeType);
  const [goalSpaceId, setGoalSpaceId] = useState('');
  const [triggerOutcomeId, setTriggerOutcomeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          node_type: nodeType,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const { data } = await res.json();

      // If a goal space was selected and this is a trigger_outcome, create the advances_goal edge
      if (goalSpaceId && nodeType === 'trigger_outcome') {
        try {
          await fetch('/api/graph/edges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source_id: data.id,
              target_id: goalSpaceId,
              edge_type: 'advances_goal',
            }),
          });
        } catch {
          // Edge creation failure does not block node creation
        }
      }

      // If a trigger outcome was selected and node type supports outcome linking
      if (triggerOutcomeId && OUTCOME_NODE_TYPES.includes(nodeType)) {
        try {
          await fetch('/api/graph/edges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source_id: data.id,
              target_id: triggerOutcomeId,
              edge_type: nodeType === 'signal' ? 'indicates_progress' : 'targets_outcome',
            }),
          });
        } catch {
          // Edge creation failure does not block node creation
        }
      }

      setTitle('');
      setGoalSpaceId('');
      setTriggerOutcomeId('');
      onCreated(data.id);
    } catch {
      // keep card open on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardW = 280;
  const cardH = 180;
  const left = Math.min(position.x, window.innerWidth - cardW - 16);
  const top = Math.min(position.y, window.innerHeight - cardH - 16);

  const showOutcomeSection = OUTCOME_NODE_TYPES.includes(nodeType);

  const structuralTypes = getStructuralTypes();

  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 flex flex-col gap-3"
      style={{ left, top, width: cardW }}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-xs text-gray-500 uppercase tracking-wider">New node</div>

      <input
        autoFocus
        type="text"
        placeholder="Title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 w-full"
      />

      <select
        value={nodeType}
        onChange={e => setNodeType(e.target.value)}
        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 focus:outline-none w-full"
      >
        {structuralTypes.map(t => (
          <option key={t.id} value={t.nodeType}>
            {STRUCTURAL_TYPE_LABELS[t.id] ?? t.label}
          </option>
        ))}
      </select>

      {nodeType === 'trigger_outcome' && (
        <div className="bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/50 rounded-lg p-2 mt-2">
          <label className="block text-[10px] text-[#085041] uppercase tracking-wide font-semibold mb-1">
            Which goal space does this advance? <span className="text-gray-500 dark:text-gray-600 normal-case font-normal">(optional)</span>
          </label>
          {goalSpaces.length === 0 ? (
            <p className="text-[9px] text-gray-600 italic">No goal spaces yet — create one first.</p>
          ) : (
            <select
              value={goalSpaceId}
              onChange={e => setGoalSpaceId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600"
            >
              <option value="">— None —</option>
              {goalSpaces.map(gs => (
                <option key={gs.id} value={gs.id}>{gs.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {showOutcomeSection && (
        <div className="bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/50 rounded-lg p-2">
          <label className="block text-[10px] text-[#085041] uppercase tracking-wide font-semibold mb-1">
            Which outcome does this target? <span className="text-gray-500 dark:text-gray-600 normal-case font-normal">(optional)</span>
          </label>
          {triggerOutcomes.length === 0 ? (
            <p className="text-[9px] text-gray-600 italic">No trigger outcomes yet — create one first.</p>
          ) : (
            <select
              value={triggerOutcomeId}
              onChange={e => setTriggerOutcomeId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600"
            >
              <option value="">— None —</option>
              {triggerOutcomes.map(to => (
                <option key={to.id} value={to.id}>{to.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={!title.trim() || isSubmitting}
          className="flex-1 py-1.5 bg-node-hunch text-white text-xs rounded-md disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {isSubmitting ? 'Creating…' : 'Create'}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
