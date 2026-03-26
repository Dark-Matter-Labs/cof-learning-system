'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';

interface InterventionFormProps {
  readonly commitments: readonly Node[];
  readonly assumptions: readonly Node[];
  readonly onClose: () => void;
  readonly onCreated: (nodeId: string) => void;
}

export function InterventionForm({ commitments, assumptions, onClose, onCreated }: InterventionFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [commitmentId, setCommitmentId] = useState('');
  const [assumptionId, setAssumptionId] = useState('');
  const [decisionRule, setDecisionRule] = useState('');
  const [signalsToWatch, setSignalsToWatch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Required';
    if (!commitmentId) newErrors.commitmentId = 'An intervention must serve a commitment';
    if (!assumptionId) newErrors.assumptionId = 'An intervention must test an assumption';
    if (!decisionRule.trim()) newErrors.decisionRule = 'Decision rule is required — be explicit about what you will do in each scenario';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      // Create the intervention node
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          node_type: 'intervention',
          hunch_type: 'new',
          confidence_level: 3,
          content: {
            decision_rule: decisionRule.trim(),
            signals_to_watch: signalsToWatch.trim(),
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to create intervention');
      const { data } = await res.json();
      const nodeId: string = data.id;

      // Create the two required edges in parallel
      await Promise.all([
        fetch('/api/graph/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: nodeId, target_id: commitmentId, edge_type: 'serves_commitment' }),
        }),
        fetch('/api/graph/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: nodeId, target_id: assumptionId, edge_type: 'tests_assumption' }),
        }),
      ]);

      onCreated(nodeId);
    } catch {
      // keep form open on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCommitment = commitments.find(c => c.id === commitmentId);
  const selectedAssumption = assumptions.find(a => a.id === assumptionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 w-[480px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-200">New intervention</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              An intervention bridges commitment and learning — both links are required.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-600 hover:text-gray-400 text-lg">×</button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What are you doing?"
              className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-600"
              autoFocus
            />
            {errors.title && <p className="text-[10px] text-red-400 mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What are you actually doing and why?"
              className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-200 rounded-lg px-3 py-2 h-20 resize-none focus:outline-none focus:border-gray-600"
            />
          </div>

          {/* Required: commitment link */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
            <label className="block text-[10px] text-[#185FA5] uppercase tracking-wide font-semibold mb-1.5">
              Required: Which commitment does this serve?
            </label>
            {commitments.length === 0 ? (
              <p className="text-[10px] text-gray-600 italic">No active commitments. Create one first.</p>
            ) : (
              <select
                value={commitmentId}
                onChange={e => setCommitmentId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-gray-600"
              >
                <option value="">— Select a commitment —</option>
                {commitments.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            )}
            {selectedCommitment && (
              <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{selectedCommitment.description}</p>
            )}
            {errors.commitmentId && <p className="text-[10px] text-red-400 mt-1">{errors.commitmentId}</p>}
          </div>

          {/* Required: assumption link */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
            <label className="block text-[10px] text-[#534AB7] uppercase tracking-wide font-semibold mb-1.5">
              Required: Which assumption does this test?
            </label>
            {assumptions.length === 0 ? (
              <p className="text-[10px] text-gray-600 italic">No assumptions in the graph yet.</p>
            ) : (
              <select
                value={assumptionId}
                onChange={e => setAssumptionId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-gray-600"
              >
                <option value="">— Select an assumption —</option>
                {assumptions.map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            )}
            {selectedAssumption && (
              <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{selectedAssumption.description}</p>
            )}
            {errors.assumptionId && <p className="text-[10px] text-red-400 mt-1">{errors.assumptionId}</p>}
          </div>

          {/* Decision rule */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
              Decision rule
              <span className="ml-1 text-gray-600 normal-case">(required — write before executing)</span>
            </label>
            <textarea
              value={decisionRule}
              onChange={e => setDecisionRule(e.target.value)}
              placeholder={`If [signal A], then [action X]. If [signal B], then [action Y].`}
              className="w-full bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded-lg px-3 py-2 h-24 resize-none focus:outline-none focus:border-gray-600 font-mono"
            />
            {errors.decisionRule && <p className="text-[10px] text-red-400 mt-1">{errors.decisionRule}</p>}
          </div>

          {/* Signals to watch */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
              Signals to watch for
            </label>
            <textarea
              value={signalsToWatch}
              onChange={e => setSignalsToWatch(e.target.value)}
              placeholder="What will you be looking for? What would confirm or disconfirm the assumption?"
              className="w-full bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded-lg px-3 py-2 h-20 resize-none focus:outline-none focus:border-gray-600"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSubmitting}
            className="text-xs bg-[#534AB7] hover:bg-[#4a42a3] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {isSubmitting ? 'Creating…' : 'Create intervention'}
          </button>
        </div>
      </div>
    </div>
  );
}
