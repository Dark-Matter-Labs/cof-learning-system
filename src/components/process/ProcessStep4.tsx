'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

export interface NotifyResult {
  readonly notifiedCount: number;
  readonly edgeIds: string[];
}

interface PersonSelection {
  readonly nodeId: string;
  readonly selected: boolean;
  readonly note: string;
}

interface ProcessStep4Props {
  readonly sourceNode: Node;
  readonly allNodes: readonly Node[];
  readonly allEdges: readonly Edge[];
  readonly onComplete: (result: NotifyResult) => void;
}

export function ProcessStep4({
  sourceNode,
  allNodes,
  allEdges,
  onComplete,
}: ProcessStep4Props) {
  const entityNodes = allNodes.filter(n => n.node_type === 'entity');

  // Pre-select entities already connected
  const connectedEntityIds = new Set(
    allEdges
      .filter(e => e.source_id === sourceNode.id || e.target_id === sourceNode.id)
      .flatMap(e => [e.source_id, e.target_id])
      .filter(id => id !== sourceNode.id && entityNodes.some(n => n.id === id))
  );

  const [selections, setSelections] = useState<Map<string, PersonSelection>>(
    new Map(
      entityNodes.map(n => [n.id, {
        nodeId: n.id,
        selected: connectedEntityIds.has(n.id),
        note: '',
      }])
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSelection(nodeId: string) {
    setSelections(prev => {
      const current = prev.get(nodeId);
      if (!current) return prev;
      return new Map(prev).set(nodeId, { ...current, selected: !current.selected });
    });
  }

  function setNote(nodeId: string, note: string) {
    setSelections(prev => {
      const current = prev.get(nodeId);
      if (!current) return prev;
      return new Map(prev).set(nodeId, { ...current, note });
    });
  }

  async function handleComplete() {
    setSaving(true);
    setError(null);

    const selected = Array.from(selections.values()).filter(s => s.selected);
    const edgeIds: string[] = [];

    try {
      const promises = selected.map(s =>
        fetch('/api/graph/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_id: sourceNode.id,
            target_id: s.nodeId,
            edge_type: 'connected_to',
            description: s.note || null,
          }),
        }).then(async r => {
          const res = await r.json() as { data?: Edge; error?: string };
          // Ignore duplicate edge errors — entity may already be connected
          if (res.data) edgeIds.push(res.data.id);
        })
      );

      await Promise.all(promises);
      onComplete({ notifiedCount: selected.length, edgeIds });
    } catch {
      setError('Failed to save — please try again');
    } finally {
      setSaving(false);
    }
  }

  if (entityNodes.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No entity nodes found. Add people and organisations to the graph to notify them of findings.
        </p>
        <button
          type="button"
          onClick={() => onComplete({ notifiedCount: 0, edgeIds: [] })}
          className="w-full py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Select people and organisations who should know about this {sourceNode.node_type}.
      </p>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <div className="space-y-2">
        {entityNodes.map(entity => {
          const sel = selections.get(entity.id);
          return (
            <div key={entity.id} className="border border-gray-200 dark:border-gray-800 rounded-md p-2.5 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sel?.selected ?? false}
                  onChange={() => toggleSelection(entity.id)}
                  className="rounded border-gray-300 dark:border-gray-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-800 dark:text-gray-200">{entity.title}</span>
              </label>

              {sel?.selected && (
                <input
                  type="text"
                  value={sel.note}
                  onChange={e => setNote(entity.id, e.target.value)}
                  placeholder="Optional note for this person"
                  className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void handleComplete()}
        disabled={saving}
        className="w-full py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving…' : 'Complete'}
      </button>
    </div>
  );
}
