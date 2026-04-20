'use client';

import { useState } from 'react';

interface FilterOption {
  readonly id: string;
  readonly label: string;
  readonly type: 'site' | 'option' | 'goal_space';
}

interface ReflectionSectionProps {
  readonly sites: readonly FilterOption[];
  readonly options: readonly FilterOption[];
  readonly goalSpaces: readonly FilterOption[];
}

type FilterState =
  | { readonly type: 'system' }
  | { readonly type: 'site' | 'option' | 'goal_space'; readonly id: string; readonly label: string };

export function ReflectionSection({ sites, options, goalSpaces }: ReflectionSectionProps) {
  const [filter, setFilter] = useState<FilterState>({ type: 'system' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [synthesis, setSynthesis] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const hasFilters = sites.length > 0 || options.length > 0 || goalSpaces.length > 0;

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
      setErrorMsg('Failed to reach reflection service');
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
      const all = [...sites, ...options, ...goalSpaces];
      const opt = all.find(o => o.id === id);
      setFilter({ type, id, label: opt?.label ?? id });
    }
    setStatus('idle');
    setSynthesis('');
  }

  const selectValue =
    filter.type === 'system' ? 'system' : `${filter.type}::${filter.id}`;

  const filterLabel = filter.type === 'system' ? 'System' : filter.label;

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        System Reflection
      </h2>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {hasFilters ? (
          <select
            value={selectValue}
            onChange={handleFilterChange}
            className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-teal-500"
          >
            <option value="system">Whole system</option>
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
            {goalSpaces.length > 0 && (
              <optgroup label="Goal spaces">
                {goalSpaces.map(g => (
                  <option key={g.id} value={`goal_space::${g.id}`}>{g.label}</option>
                ))}
              </optgroup>
            )}
          </select>
        ) : (
          <p className="text-[10px] text-gray-500">
            No filters available yet — add more captures first
          </p>
        )}

        <button
          type="button"
          onClick={handleRunReflection}
          disabled={status === 'loading'}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-1.5 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? 'Analysing...' : 'Run reflection'}
        </button>
      </div>

      {status === 'error' && (
        <p className="text-xs text-red-400 mb-3">{errorMsg}</p>
      )}

      {status === 'done' && synthesis && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">
            {filterLabel}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {synthesis}
          </p>
        </div>
      )}
    </section>
  );
}
