'use client';

import { useState, useEffect } from 'react';
import { ConvergenceSparkline } from '@/components/graph/convergence/ConvergenceSparkline';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { REFLECTION_QUESTIONS } from './questions';
import type { DecisionEntry, ReflectionSessionPayload, GoalSpaceInfo, ReflectionSession } from './types';
import type { ConvergenceData } from '@/lib/types/convergence';

interface ReflectClientProps {
  readonly goalSpaces: readonly GoalSpaceInfo[];
  readonly lastSession: ReflectionSession | null;
  readonly userId: string;
}

export function ReflectClient({ goalSpaces, lastSession, userId }: ReflectClientProps) {
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [sparklineData, setSparklineData] = useState<Record<string, ConvergenceData>>({});
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const q of REFLECTION_QUESTIONS) {
      initial[q.id] = lastSession?.human_responses?.[q.id] ?? '';
    }
    return initial;
  });
  const [decisions, setDecisions] = useState<readonly DecisionEntry[]>([]);
  const [newDecisionText, setNewDecisionText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (goalSpaces.length === 0) return;
    Promise.all(
      goalSpaces.map(gs =>
        fetch(`/api/convergence/snapshots?goal_space_id=${gs.id}&days=${days}`)
          .then(r => r.json())
          .then(json => ({ goalSpaceId: gs.id, data: json.data ?? null }))
          .catch(() => ({ goalSpaceId: gs.id, data: null }))
      )
    ).then(results => {
      const map: Record<string, ConvergenceData> = {};
      for (const r of results) {
        if (r.data) map[r.goalSpaceId] = r.data;
      }
      setSparklineData(map);
    });
  }, [goalSpaces, days]);

  const windowButtonClass = (d: 30 | 60 | 90) =>
    days === d
      ? 'px-3 py-1 text-sm rounded bg-xco-ocean text-xco-paper'
      : 'px-3 py-1 text-sm rounded bg-cof-bg-subtle text-cof-text-secondary hover:bg-cof-border';

  const handleAddDecision = () => {
    if (newDecisionText.trim()) {
      setDecisions(prev => [...prev, { text: newDecisionText.trim(), node_id: null }]);
      setNewDecisionText('');
    }
  };

  const handleRemoveDecision = (idx: number) => {
    setDecisions(prev => prev.filter((_, i) => i !== idx));
  };

  async function handleSave() {
    setSaving(true);
    setSaveResult('idle');
    const convergenceSnapshot: Record<string, { score: number; computed_at: string }> = {};
    for (const [gsId, data] of Object.entries(sparklineData)) {
      if (data.latest) {
        convergenceSnapshot[gsId] = { score: data.latest.score, computed_at: data.latest.computed_at };
      }
    }
    const payload: ReflectionSessionPayload = {
      machine_reflection: {},
      human_responses: answers,
      decisions,
      convergence_snapshot: convergenceSnapshot,
      participants: [userId],
      node_count_at_reflection: 0,
      triggered_by: 'on_demand',
    };
    try {
      const res = await fetch('/api/reflect/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const body = await res.json() as { id?: string };
        setSessionId(body.id ?? null);
        setSaveResult('success');
      } else {
        setSaveResult('error');
      }
    } catch {
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Trajectory Overview */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Trajectory Overview</h2>
          <div className="flex gap-2">
            <button className={windowButtonClass(30)} onClick={() => setDays(30)}>30d</button>
            <button className={windowButtonClass(60)} onClick={() => setDays(60)}>60d</button>
            <button className={windowButtonClass(90)} onClick={() => setDays(90)}>90d</button>
          </div>
        </div>
        {goalSpaces.length === 0 ? (
          <p className="text-sm text-gray-500">No goal spaces found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {goalSpaces.map(gs => (
              <div key={gs.id} className="bg-gray-100 dark:bg-gray-800 rounded p-4">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">{gs.title}</p>
                <ConvergenceSparkline snapshots={sparklineData[gs.id]?.history ?? []} />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Score: {sparklineData[gs.id]?.latest?.score?.toFixed(1) ?? '---'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Guided Questions */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Reflection Questions</h2>
        <div className="space-y-4">
          {REFLECTION_QUESTIONS.map(q => (
            <div key={q.id}>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{q.text}</label>
              <textarea
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 text-gray-900 dark:text-gray-100 min-h-[80px] focus:outline-none focus:border-teal-500"
                value={answers[q.id] ?? ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Decisions Log */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Decisions</h2>
        {decisions.length > 0 && (
          <ul className="space-y-2 mb-4">
            {decisions.map((d, idx) => (
              <li key={idx} className="flex items-start justify-between bg-gray-100 dark:bg-gray-800 rounded p-3">
                <span className="text-sm text-gray-800 dark:text-gray-200 flex-1">{d.text}</span>
                {d.node_id && (
                  <span className="text-xs text-xco-teal ml-2 shrink-0">node: {d.node_id}</span>
                )}
                <button
                  className="text-gray-500 hover:text-red-400 ml-3 text-xs shrink-0"
                  onClick={() => handleRemoveDecision(idx)}
                  aria-label="Remove decision"
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Record a decision..."
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-teal-500"
            value={newDecisionText}
            onChange={e => setNewDecisionText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddDecision(); }}
          />
          <button
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
            onClick={handleAddDecision}
          >
            Add
          </button>
        </div>
      </section>

      {/* Section 4: Save */}
      <section className="mb-8">
        <button
          className="px-6 py-2 bg-xco-ocean text-xco-paper rounded hover:bg-xco-teal disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Reflection Session'}
        </button>
        {saveResult === 'success' && (
          <p className="mt-2 text-sm text-xco-teal">Session saved</p>
        )}
        {saveResult === 'error' && (
          <p className="mt-2 text-sm text-red-400">Failed to save</p>
        )}
        {saveResult === 'success' && sessionId && (
          <FeedbackWidget sourceType="reflection" sourceId={sessionId} />
        )}
      </section>
    </div>
  );
}
