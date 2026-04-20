'use client';

import { useState, useEffect } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { CommitmentAssessment } from '@/lib/agents/process';

type CommitmentDecision = 'on_track' | 'needs_attention' | 'reframe' | 'stop';

interface CommitmentState {
  readonly commitmentId: string;
  readonly decision: CommitmentDecision | null;
  readonly flagReason: string;
  readonly stopLearning: string;
}

export interface CommitmentResult {
  readonly flaggedCount: number;
  readonly stoppedCount: number;
  readonly createdNodeIds: string[];
}

interface ProcessStep3Props {
  readonly sourceNode: Node;
  readonly allNodes: readonly Node[];
  readonly onComplete: (result: CommitmentResult) => void;
  readonly onSkip: () => void;
}

export function ProcessStep3({
  sourceNode,
  allNodes,
  onComplete,
  onSkip,
}: ProcessStep3Props) {
  const commitments = allNodes.filter(n =>
    n.node_type === 'commitment' &&
    n.status !== 'archived' &&
    n.status !== 'suspended' &&
    n.status !== 'falsified'
  );

  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<CommitmentAssessment[]>([]);
  const [states, setStates] = useState<Map<string, CommitmentState>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (commitments.length === 0) {
      setLoading(false);
      return;
    }

    async function fetchSuggestions() {
      try {
        const response = await fetch('/api/process/suggest/commitments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceNodeId: sourceNode.id }),
        });
        const result = await response.json() as { data?: CommitmentAssessment[]; error?: string };
        if (result.data) {
          setSuggestions(result.data);

          // Pre-populate decisions from LLM assessments
          const initialStates = new Map<string, CommitmentState>();
          for (const a of result.data) {
            initialStates.set(a.commitmentId, {
              commitmentId: a.commitmentId,
              decision: mapAssessmentToDecision(a.assessment),
              flagReason: '',
              stopLearning: '',
            });
          }
          setStates(initialStates);
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }

    void fetchSuggestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceNode.id]);

  function mapAssessmentToDecision(assessment: CommitmentAssessment['assessment']): CommitmentDecision {
    switch (assessment) {
      case 'ON_TRACK': return 'on_track';
      case 'NEEDS_ATTENTION': return 'needs_attention';
      case 'REFRAME': return 'reframe';
      case 'STOP': return 'stop';
    }
  }

  function setDecision(commitmentId: string, decision: CommitmentDecision) {
    setStates(prev => {
      const current = prev.get(commitmentId) ?? {
        commitmentId,
        decision: null,
        flagReason: '',
        stopLearning: '',
      };
      return new Map(prev).set(commitmentId, { ...current, decision });
    });
  }

  function setFlagReason(commitmentId: string, flagReason: string) {
    setStates(prev => {
      const current = prev.get(commitmentId);
      if (!current) return prev;
      return new Map(prev).set(commitmentId, { ...current, flagReason });
    });
  }

  function setStopLearning(commitmentId: string, stopLearning: string) {
    setStates(prev => {
      const current = prev.get(commitmentId);
      if (!current) return prev;
      return new Map(prev).set(commitmentId, { ...current, stopLearning });
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const createdNodeIds: string[] = [];
    let flaggedCount = 0;
    let stoppedCount = 0;

    try {
      const promises: Promise<void>[] = [];

      for (const [commitmentId, state] of states) {
        if (state.decision === 'needs_attention' || state.decision === 'reframe') {
          flaggedCount++;
          const content = {};
          promises.push(
            fetch(`/api/nodes/${commitmentId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: {
                  ...content,
                  flagged: true,
                  flag_reason: state.flagReason || 'Flagged during processing',
                },
              }),
            }).then(() => undefined)
          );
        } else if (state.decision === 'stop') {
          stoppedCount++;
          // Suspend commitment
          promises.push(
            fetch(`/api/nodes/${commitmentId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'suspended' }),
            }).then(() => undefined)
          );

          // Create learning node from what was learned
          if (state.stopLearning.trim()) {
            promises.push(
              fetch('/api/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: state.stopLearning.trim().slice(0, 80),
                  description: state.stopLearning.trim(),
                  node_type: 'learning',
                }),
              }).then(async r => {
                const res = await r.json() as { data?: Node };
                if (res.data) {
                  createdNodeIds.push(res.data.id);
                  // Link learning to commitment via produces
                  await fetch('/api/graph/edges', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      source_id: commitmentId,
                      target_id: res.data.id,
                      edge_type: 'produced',
                    }),
                  });
                }
              })
            );
          }
        }
      }

      await Promise.all(promises);
      onComplete({ flaggedCount, stoppedCount, createdNodeIds });
    } catch {
      setError('Failed to save — please try again');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xs text-gray-500 dark:text-gray-400">Analysing commitment impact…</div>
      </div>
    );
  }

  if (commitments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        How does this {sourceNode.node_type} affect active commitments? Review each and update its status.
      </p>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <div className="space-y-3">
        {commitments.map(commitment => {
          const state = states.get(commitment.id);
          const aiSuggestion = suggestions.find(s => s.commitmentId === commitment.id);

          return (
            <CommitmentCard
              key={commitment.id}
              commitment={commitment}
              state={state}
              aiReasoning={aiSuggestion?.reasoning}
              onDecisionChange={decision => setDecision(commitment.id, decision)}
              onFlagReasonChange={reason => setFlagReason(commitment.id, reason)}
              onStopLearningChange={learning => setStopLearning(commitment.id, learning)}
            />
          );
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
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

interface CommitmentCardProps {
  readonly commitment: Node;
  readonly state: CommitmentState | undefined;
  readonly aiReasoning: string | undefined;
  readonly onDecisionChange: (decision: CommitmentDecision) => void;
  readonly onFlagReasonChange: (reason: string) => void;
  readonly onStopLearningChange: (learning: string) => void;
}

const DECISION_OPTIONS: { id: CommitmentDecision; label: string }[] = [
  { id: 'on_track', label: 'On track' },
  { id: 'needs_attention', label: 'Needs attention' },
  { id: 'reframe', label: 'Reframe' },
  { id: 'stop', label: 'Stop' },
];

function CommitmentCard({
  commitment,
  state,
  aiReasoning,
  onDecisionChange,
  onFlagReasonChange,
  onStopLearningChange,
}: CommitmentCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3 space-y-2">
      <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{commitment.title}</div>

      {aiReasoning && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">{aiReasoning}</p>
      )}

      <div className="flex gap-1">
        {DECISION_OPTIONS.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onDecisionChange(opt.id)}
            className={`flex-1 py-1 text-[10px] rounded border transition-colors ${
              state?.decision === opt.id
                ? opt.id === 'stop'
                  ? 'bg-red-500 text-white border-red-500'
                  : opt.id === 'needs_attention' || opt.id === 'reframe'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-green-500 text-white border-green-500'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-gray-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {(state?.decision === 'needs_attention' || state?.decision === 'reframe') && (
        <textarea
          value={state.flagReason}
          onChange={e => onFlagReasonChange(e.target.value)}
          placeholder="Why does this need attention?"
          rows={2}
          className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      )}

      {state?.decision === 'stop' && (
        <textarea
          value={state.stopLearning}
          onChange={e => onStopLearningChange(e.target.value)}
          placeholder="What did you learn from stopping this commitment?"
          rows={2}
          className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      )}
    </div>
  );
}
