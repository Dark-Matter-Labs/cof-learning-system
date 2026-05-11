'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '@/components/ui/Spinner';

interface NodeSummary {
  readonly id: string;
  readonly title: string;
  readonly node_type: string;
  readonly description: string | null;
}

interface Candidate {
  readonly id: string;
  readonly merged_title: string;
  readonly merged_summary: string;
  readonly merged_node_type: string;
  readonly rationale: string;
  readonly created_at: string;
  readonly nodes: readonly NodeSummary[];
}

export function DistillationTab() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);

  const loadCandidates = useCallback(() => {
    setLoading(true);
    fetch('/api/distill/candidates')
      .then(r => r.json() as Promise<{ data?: Candidate[] }>)
      .then(body => setCandidates(body.data ?? []))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  const runDistillation = () => {
    setRunning(true);
    setRunResult(null);
    fetch('/api/distill/run', { method: 'POST' })
      .then(r => r.json() as Promise<{ data?: { created: number; errors: string[] } }>)
      .then(body => {
        setRunResult(body.data ?? { created: 0, errors: [] });
        if ((body.data?.created ?? 0) > 0) loadCandidates();
      })
      .catch(() => setRunResult({ created: 0, errors: ['Run failed — check server logs'] }))
      .finally(() => setRunning(false));
  };

  const act = (candidateId: string, action: 'accept' | 'reject') => {
    setActError(null);
    setActing(candidateId);
    fetch('/api/distill/candidates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: candidateId, action }),
    })
      .then(r => { if (!r.ok) throw new Error('Action failed'); return loadCandidates(); })
      .catch(() => setActError('Action failed — please try again'))
      .finally(() => setActing(null));
  };

  if (loading) return <p className="text-sm text-cof-text-tertiary">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-cof-text-primary">Distillation</h3>
          <p className="text-xs text-cof-text-tertiary mt-0.5">
            Find and merge near-duplicate nodes to keep the graph precise.
          </p>
        </div>
        <button
          type="button"
          onClick={runDistillation}
          disabled={running}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-node-hunch text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {running && <Spinner size="sm" label="Scanning" />}
          {running ? 'Scanning…' : 'Run distillation'}
        </button>
      </div>

      {runResult && (
        <div className="bg-cof-bg-subtle border border-cof-border rounded-lg p-3 text-xs text-cof-text-secondary">
          {runResult.created > 0
            ? `${runResult.created} merge candidate${runResult.created === 1 ? '' : 's'} found`
            : 'No near-duplicates found'}
          {runResult.errors.length > 0 && (
            <p className="text-red-500 mt-1">{runResult.errors.join(' · ')}</p>
          )}
        </div>
      )}

      {actError && (
        <p className="text-xs text-red-500">{actError}</p>
      )}

      {candidates.length === 0 ? (
        <p className="text-sm text-cof-text-tertiary">No pending merge candidates.</p>
      ) : (
        <ul className="space-y-4">
          {candidates.map(c => (
            <li key={c.id} className="border border-cof-border rounded-xl p-4 space-y-3 bg-cof-bg-elevated">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-cof-text-primary">Merge into: {c.merged_title}</p>
                  <p className="text-xs text-cof-text-secondary mt-0.5 leading-relaxed">{c.merged_summary}</p>
                </div>
                <span className="text-[10px] text-cof-text-tertiary border border-cof-border rounded px-1.5 py-0.5 flex-shrink-0">
                  {c.merged_node_type}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                {c.nodes.map(n => (
                  <div key={n.id} className="bg-cof-bg-subtle border border-cof-border rounded-lg p-2 text-xs flex-1 basis-40 min-w-0">
                    <p className="font-medium text-cof-text-primary truncate">{n.title}</p>
                    <p className="text-cof-text-tertiary mt-0.5">{n.node_type}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-cof-text-tertiary italic">{c.rationale}</p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={acting === c.id}
                  onClick={() => act(c.id, 'accept')}
                  className="text-xs px-3 py-1.5 bg-node-hunch text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {acting === c.id ? '…' : 'Accept merge'}
                </button>
                <button
                  type="button"
                  disabled={acting === c.id}
                  onClick={() => act(c.id, 'reject')}
                  className="text-xs px-3 py-1.5 border border-cof-border text-cof-text-secondary rounded-lg disabled:opacity-50 hover:border-cof-border-strong transition-colors"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
