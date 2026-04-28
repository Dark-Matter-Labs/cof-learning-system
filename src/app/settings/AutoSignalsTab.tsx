'use client';

import { useState, useEffect, useCallback } from 'react';

interface SignalSource {
  readonly id: string;
  readonly source_type: string;
  readonly topic_node_id: string;
  readonly config: Record<string, unknown>;
  readonly enabled: boolean;
  readonly last_run_at: string | null;
}

export function AutoSignalsTab() {
  const [sources, setSources] = useState<SignalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{ created: number; skipped: number } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/signals/sources')
      .then(r => r.json() as Promise<{ data?: SignalSource[] }>)
      .then(body => setSources(body.data ?? []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSource = (id: string, enabled: boolean) => {
    fetch('/api/signals/sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    })
      .then(r => { if (!r.ok) throw new Error('Toggle failed'); return load(); })
      .catch(() => {});
  };

  const runScan = () => {
    setScanning(true);
    setScanError(null);
    fetch('/api/signals/scan', { method: 'POST' })
      .then(r => {
        if (!r.ok) throw new Error('Scan failed');
        return r.json() as Promise<{ data?: { created: number; skipped: number } }>;
      })
      .then(body => setLastScanResult(body.data ?? null))
      .catch(() => setScanError('Scan failed — check server logs'))
      .finally(() => setScanning(false));
  };

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Auto-signals</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Maximum 20 signals/day. All auto-signals require human review before joining the graph.
          </p>
        </div>
        <button
          type="button"
          onClick={runScan}
          disabled={scanning}
          className="px-3 py-1.5 text-xs bg-node-hunch text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {scanning ? 'Scanning…' : 'Run scan now'}
        </button>
      </div>

      {lastScanResult && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
          Last scan: {lastScanResult.created} signal{lastScanResult.created === 1 ? '' : 's'} created,{' '}
          {lastScanResult.skipped} skipped (quota or duplicate)
        </div>
      )}
      {scanError && (
        <p className="text-xs text-red-500">{scanError}</p>
      )}

      {sources.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No auto-signal sources configured. Sources are added automatically when you enable web scanning for a topic node.
        </p>
      ) : (
        <ul className="space-y-2">
          {sources.map(source => (
            <li key={source.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {source.source_type} — {(source.config.search_query as string | undefined) ?? source.topic_node_id}
                </p>
                {source.last_run_at && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Last run: {new Date(source.last_run_at).toLocaleDateString('en-GB')}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">{source.enabled ? 'On' : 'Off'}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={source.enabled}
                  onClick={() => toggleSource(source.id, !source.enabled)}
                  className={`w-8 h-4 rounded-full transition-colors ${source.enabled ? 'bg-node-hunch' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`block w-3 h-3 bg-white rounded-full shadow transition-transform mx-0.5 ${source.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
