'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { ReflectionReport } from '@/lib/agents/reflection';

interface ReflectionPanelProps {
  readonly reflectionDue: boolean;
  /** Optional pre-parsed report — used in tests to render the done state directly. */
  readonly initialReport?: ReflectionReport;
}

export function ReflectionPanel({ reflectionDue, initialReport }: ReflectionPanelProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>(
    initialReport ? 'done' : 'idle',
  );
  const [rawOutput, setRawOutput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function runReflection() {
    setStatus('running');
    setRawOutput('');
    setErrorMessage('');

    let response: Response;
    try {
      response = await fetch('/api/reflection/run', { method: 'POST' });
    } catch {
      setErrorMessage('Failed to reach the reflection service');
      setStatus('error');
      return;
    }

    if (!response.ok) {
      if (response.status === 429) {
        setErrorMessage('Reflection already run in the last 24 hours');
      } else {
        setErrorMessage('Failed to run reflection');
      }
      setStatus('error');
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setRawOutput((prev) => prev + decoder.decode(value, { stream: true }));
    }
    setStatus('done');
  }

  const parsedReport = useMemo<ReflectionReport | null>(() => {
    if (initialReport) return initialReport;
    if (status !== 'done' || !rawOutput) return null;
    try {
      const cleaned = rawOutput
        .replace(/^```(?:json)?\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim();
      return JSON.parse(cleaned) as ReflectionReport;
    } catch {
      return null;
    }
  }, [status, rawOutput, initialReport]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          System Reflection
        </h2>

        <div className="flex items-center gap-2">
          {/* Threshold badge */}
          {reflectionDue && status === 'idle' && (
            <span className="text-[10px] text-teal-400 bg-teal-900/20 border border-teal-900/30 rounded px-2 py-0.5">
              Run Reflection?
            </span>
          )}

          {/* Run button */}
          <button
            onClick={runReflection}
            disabled={status === 'running'}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-1.5 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'running' ? 'Analyzing...' : 'Run Reflection'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {status === 'error' && (
        <p className="text-xs text-red-400 mt-2">{errorMessage}</p>
      )}

      {/* Streaming output */}
      {status === 'running' && rawOutput && (
        <pre className="text-[10px] text-gray-400 whitespace-pre-wrap break-words mt-2 font-mono">
          {rawOutput}
        </pre>
      )}

      {/* Parsed report sections */}
      {status === 'done' && parsedReport && (
        <div className="space-y-2 mt-2">
          {/* Patterns */}
          <details>
            <summary className="text-[10px] text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-400">
              Patterns
            </summary>
            <ul className="mt-1.5 space-y-1 pl-3">
              {parsedReport.patterns.map((pattern, i) => (
                <li key={i} className="text-xs text-gray-400">
                  {pattern}
                </li>
              ))}
            </ul>
          </details>

          {/* Contradictions */}
          <details>
            <summary className="text-[10px] text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-400">
              Contradictions
            </summary>
            <ul className="mt-1.5 space-y-1 pl-3">
              {parsedReport.contradictions.map((c, i) => (
                <li key={i} className="text-xs text-gray-400">
                  <span>{c.description}</span>
                  {c.node_ids.length > 0 && (
                    <span className="text-[10px] text-gray-600 ml-1">
                      ({c.node_ids.join(', ')})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>

          {/* Coverage Gaps */}
          <details>
            <summary className="text-[10px] text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-400">
              Coverage Gaps
            </summary>
            <ul className="mt-1.5 space-y-1 pl-3">
              {parsedReport.coverage_gaps.map((gap, i) => (
                <li key={i} className="text-xs text-gray-400">
                  {gap}
                </li>
              ))}
            </ul>
          </details>

          {/* Trajectory */}
          <details>
            <summary className="text-[10px] text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-400">
              Trajectory
            </summary>
            <p className="mt-1.5 pl-3 text-xs text-gray-400 leading-relaxed">
              {parsedReport.trajectory}
            </p>
          </details>

          {/* Recommendations */}
          <details>
            <summary className="text-[10px] text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-400">
              Recommendations
            </summary>
            <ul className="mt-1.5 space-y-2 pl-3">
              {parsedReport.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start justify-between gap-2">
                  <span className="text-xs text-gray-400 flex-1">{rec.text}</span>
                  {rec.action_type !== null && (
                    <ActionButton
                      actionType={rec.action_type}
                      targetNodeId={rec.target_node_id}
                    />
                  )}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {/* Fallback: done but unparseable */}
      {status === 'done' && !parsedReport && rawOutput && (
        <pre className="text-[10px] text-gray-400 whitespace-pre-wrap break-words mt-2 font-mono">
          {rawOutput}
        </pre>
      )}
    </div>
  );
}

// ── ActionButton sub-component ────────────────────────────────────────────────

interface ActionButtonProps {
  readonly actionType: 'stop' | 'strengthen' | 'reframe';
  readonly targetNodeId: string | null;
}

function ActionButton({ actionType, targetNodeId }: ActionButtonProps) {
  const label = actionType.charAt(0).toUpperCase() + actionType.slice(1);

  // reframe with a specific target node links to /capture/new (create a reframed perspective)
  // stop/strengthen with a specific target node links to /capture/{id}/review
  // any action_type with null target_node_id shows plain text (no link)
  const href =
    targetNodeId === null
      ? null
      : actionType === 'reframe'
        ? '/capture/new'
        : `/capture/${targetNodeId}/review`;

  if (href !== null) {
    return (
      <Link
        href={href}
        className="text-xs text-teal-400 hover:text-teal-300 shrink-0"
      >
        {label}
      </Link>
    );
  }

  // action_type is set but target_node_id is null and not reframe — show plain label
  return (
    <span className="text-xs text-teal-400 shrink-0">{label}</span>
  );
}
