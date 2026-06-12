'use client';

import { useState } from 'react';
import type { FilterOption } from '@/lib/types/filter';
import { Markdown } from '@/components/ui/Markdown';

interface ReflectClientProps {
  readonly sites: readonly FilterOption[];
  readonly options: readonly FilterOption[];
  readonly goalSpaces: readonly FilterOption[];
}

type FilterState =
  | { readonly type: 'system' }
  | { readonly type: 'site' | 'option' | 'goal_space'; readonly id: string; readonly label: string };

type Status = 'idle' | 'loading' | 'done' | 'error';

export function ReflectClient({ sites, options, goalSpaces }: ReflectClientProps) {
  const [filter, setFilter] = useState<FilterState>({ type: 'system' });
  const [status, setStatus] = useState<Status>('idle');
  const [synthesis, setSynthesis] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const hasFilters = sites.length > 0 || options.length > 0 || goalSpaces.length > 0;
  const filterLabel = filter.type === 'system' ? 'Whole system' : filter.label;

  async function handleRunReflection() {
    setStatus('loading');
    setSynthesis('');
    setErrorMsg('');

    const body =
      filter.type === 'system'
        ? { type: 'system', label: 'Whole system' }
        : { type: filter.type, value: filter.id, label: filter.label };

    try {
      const res = await fetch('/api/reflect/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setErrorMsg('Reflection failed — try again');
        setStatus('error');
        return;
      }
      const json = await res.json() as { synthesis?: string };
      setSynthesis(json.synthesis ?? '');
      setStatus('done');
    } catch {
      setErrorMsg('Reflection failed — try again');
      setStatus('error');
    }
  }

  function handleFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === 'system') {
      setFilter({ type: 'system' });
    } else {
      const colonIdx = val.indexOf('::');
      const type = val.slice(0, colonIdx) as 'site' | 'option' | 'goal_space';
      const id = val.slice(colonIdx + 2);
      const opt = [...sites, ...options, ...goalSpaces].find(o => o.id === id);
      setFilter({ type, id, label: opt?.label ?? id });
    }
    setStatus('idle');
    setSynthesis('');
  }

  const selectValue = filter.type === 'system' ? 'system' : `${filter.type}::${filter.id}`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        Ask the system to synthesise what&apos;s known — for the whole picture, or filtered to one
        goal space, site, or option.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        {hasFilters ? (
          <select
            aria-label="Reflection scope"
            value={selectValue}
            onChange={handleFilterChange}
            className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-teal-500"
          >
            <option value="system">Whole system</option>
            {goalSpaces.length > 0 && (
              <optgroup label="Goal spaces">
                {goalSpaces.map(g => (
                  <option key={g.id} value={`goal_space::${g.id}`}>{g.label}</option>
                ))}
              </optgroup>
            )}
            {sites.length > 0 && (
              <optgroup label="Sites">
                {sites.map(s => (
                  <option key={s.id} value={`site::${s.id}`}>{s.label}</option>
                ))}
              </optgroup>
            )}
            {options.length > 0 && (
              <optgroup label="Options">
                {options.map(o => (
                  <option key={o.id} value={`option::${o.id}`}>{o.label}</option>
                ))}
              </optgroup>
            )}
          </select>
        ) : (
          <select
            aria-label="Reflection scope"
            value="system"
            disabled
            className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-gray-500"
          >
            <option value="system">Whole system</option>
          </select>
        )}

        <button
          type="button"
          onClick={() => void handleRunReflection()}
          disabled={status === 'loading'}
          className="text-sm bg-xco-ocean text-xco-paper rounded-lg px-4 py-1.5 hover:bg-xco-teal disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? 'Analysing…' : status === 'done' ? 'Re-run' : 'Run reflection'}
        </button>
      </div>

      {status === 'error' && <p className="text-sm text-red-400">{errorMsg}</p>}

      {status === 'done' && (
        synthesis ? (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-3">
              {filterLabel}
            </p>
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <Markdown>{synthesis}</Markdown>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No synthesis returned — there may be nothing captured for this scope yet.</p>
        )
      )}
    </div>
  );
}
