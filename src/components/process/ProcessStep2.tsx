'use client';

import { useState, useEffect } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { SuggestedHunch } from '@/lib/agents/process';

export type HunchDecision = 'yes' | 'save_later' | 'no';

export interface HunchResult {
  readonly decision: HunchDecision;
  readonly createdNodeId?: string;
}

interface ProcessStep2Props {
  readonly sourceNode: Node;
  readonly allNodes: readonly Node[];
  readonly onComplete: (result: HunchResult) => void;
}

export function ProcessStep2({
  sourceNode,
  allNodes,
  onComplete,
}: ProcessStep2Props) {
  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<SuggestedHunch | null>(null);
  const [decision, setDecision] = useState<HunchDecision | null>(null);
  const [hunchTitle, setHunchTitle] = useState('');
  const [hunchDescription, setHunchDescription] = useState('');
  const [targetOutcomeId, setTargetOutcomeId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerOutcomes = allNodes.filter(n => n.node_type === 'trigger_outcome');

  useEffect(() => {
    async function fetchSuggestion() {
      try {
        const response = await fetch('/api/process/suggest/hunch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceNodeId: sourceNode.id }),
        });
        const result = await response.json() as { data?: SuggestedHunch | null; error?: string };
        if (result.data) {
          setSuggestion(result.data);
          if (result.data.hunch) {
            setHunchTitle(result.data.hunch.title);
            setHunchDescription(result.data.hunch.description);
            setTargetOutcomeId(result.data.hunch.target_outcome_id ?? '');
          }
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }

    void fetchSuggestion();
  }, [sourceNode.id]);

  async function handleSubmit() {
    if (!decision) return;

    setSaving(true);
    setError(null);

    try {
      if (decision === 'yes') {
        // Create hunch node
        const captureResponse = await fetch('/api/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: hunchTitle,
            description: hunchDescription,
            node_type: 'hunch',
          }),
        });

        const captureResult = await captureResponse.json() as { data?: Node; error?: string };

        if (!captureResponse.ok || captureResult.error) {
          setError(captureResult.error ?? 'Failed to create hunch');
          return;
        }

        if (captureResult.data) {
          const newNodeId = captureResult.data.id;

          // Link to source via evolved_from edge
          await fetch('/api/graph/edges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source_id: newNodeId,
              target_id: sourceNode.id,
              edge_type: 'evolved_from',
            }),
          });

          // Link to outcome if selected
          if (targetOutcomeId) {
            await fetch('/api/graph/edges', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_id: newNodeId,
                target_id: targetOutcomeId,
                edge_type: 'targets_outcome',
              }),
            });
          }

          onComplete({ decision: 'yes', createdNodeId: newNodeId });
          return;
        }
      } else if (decision === 'save_later') {
        // Tag source node with needs_hunch flag
        const content = (sourceNode.content as Record<string, unknown> | null) ?? {};
        await fetch(`/api/nodes/${sourceNode.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { ...content, needs_hunch: true },
          }),
        });
      }

      onComplete({ decision: decision ?? 'no' });
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xs text-gray-500 dark:text-gray-400">Generating hunch suggestion…</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Does this {sourceNode.node_type} spark a new strategic hunch worth exploring?
      </p>

      {/* LLM suggestion card */}
      {suggestion?.suggested && suggestion.hunch && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
          <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase mb-1">AI suggested hunch</div>
          <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{suggestion.hunch.title}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 italic">{suggestion.reasoning}</p>
        </div>
      )}

      {/* Decision options */}
      <div className="space-y-2">
        <label className="block text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-2">Your decision</label>

        {(['yes', 'save_later', 'no'] as const).map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => setDecision(opt)}
            className={`w-full text-left px-3 py-2 text-xs rounded-md border transition-colors ${
              decision === opt
                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-400 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
            }`}
          >
            {opt === 'yes' && 'Yes — create a new hunch'}
            {opt === 'save_later' && 'Not yet — save for later'}
            {opt === 'no' && 'No — confirms existing thinking'}
          </button>
        ))}
      </div>

      {/* Hunch creation form */}
      {decision === 'yes' && (
        <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-md p-3">
          <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase">New hunch</div>

          <div>
            <label htmlFor="hunch-title" className="block text-[10px] text-gray-500 dark:text-gray-600 mb-0.5">
              Title
            </label>
            <input
              id="hunch-title"
              type="text"
              value={hunchTitle}
              onChange={e => setHunchTitle(e.target.value)}
              className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Hunch title (max 10 words)"
            />
          </div>

          <div>
            <label htmlFor="hunch-description" className="block text-[10px] text-gray-500 dark:text-gray-600 mb-0.5">
              Description
            </label>
            <textarea
              id="hunch-description"
              value={hunchDescription}
              onChange={e => setHunchDescription(e.target.value)}
              rows={3}
              className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              placeholder="2-3 sentences describing the hunch"
            />
          </div>

          {triggerOutcomes.length > 0 && (
            <div>
              <label htmlFor="target-outcome" className="block text-[10px] text-gray-500 dark:text-gray-600 mb-0.5">
                Target outcome (optional)
              </label>
              <select
                id="target-outcome"
                value={targetOutcomeId}
                onChange={e => setTargetOutcomeId(e.target.value)}
                className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">No outcome</option>
                {triggerOutcomes.map(o => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!decision || saving || (decision === 'yes' && !hunchTitle.trim())}
        className="w-full py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
