'use client';

import { useState, useEffect } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { SuggestedNodeImpact } from '@/lib/agents/process';

interface NodeAssessment {
  readonly nodeId: string;
  readonly assessment: 'valid' | 'needs_revision' | 'falsified';
  readonly note: string;
}

interface ProcessStep1Props {
  readonly sourceNode: Node;
  readonly allNodes: readonly Node[];
  readonly allEdges: readonly Edge[];
  readonly onComplete: (assessments: NodeAssessment[]) => void;
  readonly onSkip: () => void;
  readonly onEmpty: () => void;
}

export function ProcessStep1({
  sourceNode,
  allNodes,
  allEdges,
  onComplete,
  onSkip,
  onEmpty,
}: ProcessStep1Props) {
  const [loading, setLoading] = useState(true);
  const [suggestedNodes, setSuggestedNodes] = useState<SuggestedNodeImpact[]>([]);
  const [assessments, setAssessments] = useState<Map<string, NodeAssessment>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nodes directly connected to the source
  const connectedNodeIds = new Set<string>();
  for (const edge of allEdges) {
    if (edge.source_id === sourceNode.id) connectedNodeIds.add(edge.target_id);
    if (edge.target_id === sourceNode.id) connectedNodeIds.add(edge.source_id);
  }
  const connectedNodes = allNodes.filter(n => connectedNodeIds.has(n.id));
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const response = await fetch('/api/process/suggest/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceNodeId: sourceNode.id }),
        });
        const result = await response.json() as { data?: SuggestedNodeImpact[]; error?: string };
        if (result.data) {
          // Filter out already-connected nodes to avoid duplicates
          const filtered = result.data.filter(s => !connectedNodeIds.has(s.nodeId));
          setSuggestedNodes(filtered);
        }
      } catch {
        // Suggestions are non-critical — silently fail
      } finally {
        setLoading(false);
      }
    }

    void fetchSuggestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceNode.id]);

  // After loading, check if there's anything to show
  useEffect(() => {
    if (!loading && connectedNodes.length === 0 && suggestedNodes.length === 0) {
      onEmpty();
    }
  }, [loading, connectedNodes.length, suggestedNodes.length, onEmpty]);

  function setAssessment(nodeId: string, assessment: NodeAssessment['assessment']) {
    setAssessments(prev => new Map(prev).set(nodeId, {
      nodeId,
      assessment,
      note: prev.get(nodeId)?.note ?? '',
    }));
  }

  function setNote(nodeId: string, note: string) {
    setAssessments(prev => {
      const current = prev.get(nodeId);
      if (!current) return prev;
      return new Map(prev).set(nodeId, { ...current, note });
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const promises: Promise<void>[] = [];

      for (const [nodeId, assessment] of assessments) {
        if (assessment.assessment === 'falsified') {
          promises.push(
            fetch(`/api/nodes/${nodeId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'falsified' }),
            }).then(() => undefined)
          );
        } else if (assessment.assessment === 'needs_revision' && assessment.note.trim()) {
          const edgeType = suggestedNodes.find(s => s.nodeId === nodeId)?.relationship === 'SUPPORTS'
            ? 'supports'
            : 'challenges';
          promises.push(
            fetch('/api/graph/edges', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_id: sourceNode.id,
                target_id: nodeId,
                edge_type: edgeType,
                description: assessment.note,
              }),
            }).then(() => undefined)
          );
        }
      }

      await Promise.all(promises);
      onComplete(Array.from(assessments.values()));
    } catch {
      setError('Failed to save — please try again');
    } finally {
      setSaving(false);
    }
  }

  const allNodeIds = [
    ...connectedNodes.map(n => n.id),
    ...suggestedNodes.map(s => s.nodeId).filter(id => !connectedNodeIds.has(id)),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xs text-gray-500 dark:text-gray-400">Analysing connections…</div>
      </div>
    );
  }

  if (connectedNodes.length === 0 && suggestedNodes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Review nodes that may be affected by this {sourceNode.node_type}. Mark each as still valid, needing revision, or falsified.
      </p>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <div className="space-y-3">
        {/* Connected nodes */}
        {connectedNodes.map(n => (
          <NodeAssessmentCard
            key={n.id}
            node={n}
            assessment={assessments.get(n.id)}
            onAssessmentChange={assessment => setAssessment(n.id, assessment)}
            onNoteChange={note => setNote(n.id, note)}
            badge="connected"
          />
        ))}

        {/* LLM-suggested nodes */}
        {suggestedNodes.map(suggestion => {
          const n = nodeMap.get(suggestion.nodeId);
          if (!n) return null;
          return (
            <NodeAssessmentCard
              key={n.id}
              node={n}
              assessment={assessments.get(n.id)}
              onAssessmentChange={assessment => setAssessment(n.id, assessment)}
              onNoteChange={note => setNote(n.id, note)}
              badge="suggested"
              reasoning={suggestion.reasoning}
            />
          );
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || allNodeIds.length === 0}
          className="flex-1 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : 'Save & continue'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

interface NodeAssessmentCardProps {
  readonly node: Node;
  readonly assessment: NodeAssessment | undefined;
  readonly onAssessmentChange: (assessment: NodeAssessment['assessment']) => void;
  readonly onNoteChange: (note: string) => void;
  readonly badge: 'connected' | 'suggested';
  readonly reasoning?: string;
}

function NodeAssessmentCard({
  node,
  assessment,
  onAssessmentChange,
  onNoteChange,
  badge,
  reasoning,
}: NodeAssessmentCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{node.title}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
              {node.node_type}
            </span>
            {badge === 'suggested' && (
              <span className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                AI suggested
              </span>
            )}
          </div>
        </div>
      </div>

      {reasoning && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">{reasoning}</p>
      )}

      <div className="flex gap-1.5">
        {(['valid', 'needs_revision', 'falsified'] as const).map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onAssessmentChange(opt)}
            className={`flex-1 py-1 text-[10px] rounded border transition-colors ${
              assessment?.assessment === opt
                ? opt === 'falsified'
                  ? 'bg-red-500 text-white border-red-500'
                  : opt === 'needs_revision'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-green-500 text-white border-green-500'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-gray-400'
            }`}
          >
            {opt === 'valid' ? 'Still valid' : opt === 'needs_revision' ? 'Needs revision' : 'Falsified'}
          </button>
        ))}
      </div>

      {assessment?.assessment === 'needs_revision' && (
        <textarea
          value={assessment.note}
          onChange={e => onNoteChange(e.target.value)}
          placeholder="What changed? (creates a challenges/supports edge)"
          rows={2}
          className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      )}
    </div>
  );
}
