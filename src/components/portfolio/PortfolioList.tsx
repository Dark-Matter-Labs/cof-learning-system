'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Portfolio {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly status: string;
  readonly current_step: number;
  readonly updated_at: string;
}

interface PortfolioListProps {
  readonly portfolios: readonly Portfolio[];
}

function ProgressBar({ value, max }: { readonly value: number; readonly max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-cof-bg-subtle rounded-full overflow-hidden">
        <div
          className="h-full bg-node-learning rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-cof-text-tertiary tabular-nums">{pct}%</span>
    </div>
  );
}

export function PortfolioList({ portfolios }: PortfolioListProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const title = window.prompt('Portfolio title:');
    if (!title?.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      const body = await res.json() as { data?: { id: string }; error?: string };
      if (!res.ok || !body.data?.id) {
        setError(body.error ?? 'Failed to create portfolio');
        return;
      }
      router.push(`/portfolios/${body.data.id}`);
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-cof-text-primary">Portfolio Engineering</h1>
          <p className="text-sm text-cof-text-tertiary mt-1">
            Indicative portfolios for civilizational option fields. From cascading risk to capital structure.
          </p>
        </div>
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="text-xs bg-cof-bg-subtle border border-cof-border rounded px-3 py-2 text-cof-text-secondary hover:text-cof-text-primary hover:border-cof-border-strong transition-colors disabled:opacity-50"
        >
          {creating ? 'Creating…' : '+ New portfolio'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

      {portfolios.length === 0 ? (
        <div className="text-center py-16 text-cof-text-tertiary">
          <p className="text-sm mb-2">No portfolios yet.</p>
          <p className="text-xs">Start by creating your first portfolio engineering project.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {portfolios.map(p => (
            <Link
              key={p.id}
              href={`/portfolios/${p.id}`}
              className="block bg-cof-bg-elevated border border-cof-border rounded-lg p-4 hover:border-cof-border-strong transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-cof-text-primary truncate">{p.title}</h2>
                  {p.subtitle && (
                    <p className="text-xs text-cof-text-tertiary mt-0.5 truncate">{p.subtitle}</p>
                  )}
                </div>
                <span className="text-[10px] text-cof-text-tertiary ml-3 flex-shrink-0">
                  Step {p.current_step} of 13
                </span>
              </div>
              <ProgressBar value={p.current_step - 1} max={13} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
