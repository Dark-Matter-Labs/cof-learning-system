'use client';

import { useState } from 'react';

interface Site {
  readonly name: string;
  readonly description: string;
}

interface Option {
  readonly name: string;
  readonly description: string;
  readonly goal_id: string;
}

interface Props {
  readonly goals: ReadonlyArray<{ id: string; title: string }>;
  readonly onNext: () => void;
  readonly onBack: () => void;
  readonly onSkip: () => void;
}

export function Step4Sites({ goals, onNext, onBack, onSkip }: Props) {
  const [sites, setSites] = useState<Site[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [siteName, setSiteName] = useState('');
  const [siteDesc, setSiteDesc] = useState('');
  const [optName, setOptName] = useState('');
  const [optDesc, setOptDesc] = useState('');
  const [optGoalId, setOptGoalId] = useState(goals[0]?.id ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSite = () => {
    if (!siteName.trim()) return;
    setSites(prev => [...prev, { name: siteName.trim(), description: siteDesc.trim() }]);
    setSiteName('');
    setSiteDesc('');
  };

  const addOption = () => {
    if (!optName.trim()) return;
    setOptions(prev => [...prev, { name: optName.trim(), description: optDesc.trim(), goal_id: optGoalId }]);
    setOptName('');
    setOptDesc('');
  };

  const handleNext = async () => {
    if (sites.length === 0 && options.length === 0) { onNext(); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites, options }),
      });
      if (!res.ok) throw new Error('Failed to save');
      onNext();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Where is your work happening?</h1>

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sites (places where work is active)</p>
        {sites.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{s.name}</span>
            {s.description && <span className="text-gray-400">— {s.description}</span>}
          </div>
        ))}
        <div className="flex gap-2">
          <input
            type="text"
            value={siteName}
            onChange={e => setSiteName(e.target.value)}
            placeholder="Name"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none"
          />
          <input
            type="text"
            value={siteDesc}
            onChange={e => setSiteDesc(e.target.value)}
            placeholder="Brief description"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none"
          />
          <button
            onClick={addSite}
            disabled={!siteName.trim()}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Strategic options (bets you&apos;re exploring)</p>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{o.name}</span>
            {goals.find(g => g.id === o.goal_id) && (
              <span className="text-gray-400">→ {goals.find(g => g.id === o.goal_id)?.title}</span>
            )}
          </div>
        ))}
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={optName}
            onChange={e => setOptName(e.target.value)}
            placeholder="Name"
            className="flex-1 min-w-32 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none"
          />
          <input
            type="text"
            value={optDesc}
            onChange={e => setOptDesc(e.target.value)}
            placeholder="Description"
            className="flex-1 min-w-32 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none"
          />
          {goals.length > 0 && (
            <select
              value={optGoalId}
              onChange={e => setOptGoalId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none"
            >
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          )}
          <button
            onClick={addOption}
            disabled={!optName.trim()}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            + Add
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <div className="flex gap-3">
          <button onClick={onSkip} className="text-sm text-gray-400 hover:text-gray-600">Skip</button>
          <button
            onClick={handleNext}
            disabled={isLoading}
            className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90"
          >
            {isLoading ? 'Saving...' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
