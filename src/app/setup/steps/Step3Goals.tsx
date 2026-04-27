'use client';

import { useState } from 'react';

interface Goal {
  readonly title: string;
  readonly description: string;
}

interface Props {
  readonly onNext: (goals: ReadonlyArray<{ id: string; title: string }>) => void;
  readonly onBack: () => void;
}

export function Step3Goals({ onNext, onBack }: Props) {
  const [goals, setGoals] = useState<Goal[]>([{ title: '', description: '' }]);
  const [showHelper, setShowHelper] = useState(false);
  const [helperInput, setHelperInput] = useState('');
  const [helperLoading, setHelperLoading] = useState(false);
  const [helperSuggestion, setHelperSuggestion] = useState<{ title: string; description: string } | null>(null);
  const [helperTargetIndex, setHelperTargetIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateGoal = (index: number, field: 'title' | 'description', value: string) => {
    setGoals(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
  };

  const addGoal = () => setGoals(prev => [...prev, { title: '', description: '' }]);

  const openHelper = (index: number) => {
    setHelperTargetIndex(index);
    setShowHelper(true);
    setHelperSuggestion(null);
    setHelperInput('');
  };

  const runHelper = async () => {
    if (!helperInput.trim()) return;
    setHelperLoading(true);
    try {
      const res = await fetch('/api/setup/goal-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: helperInput }),
      });
      const { data } = await res.json();
      setHelperSuggestion(data);
    } catch {
      // helper is optional, silently fail
    } finally {
      setHelperLoading(false);
    }
  };

  const acceptSuggestion = () => {
    if (helperSuggestion === null || helperTargetIndex === null) return;
    updateGoal(helperTargetIndex, 'title', helperSuggestion.title);
    updateGoal(helperTargetIndex, 'description', helperSuggestion.description);
    setShowHelper(false);
    setHelperSuggestion(null);
  };

  const handleNext = async () => {
    const validGoals = goals.filter(g => g.title.trim());
    if (validGoals.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals: validGoals }),
      });
      if (!res.ok) throw new Error('Failed to save goals');
      const { data } = await res.json();
      onNext(data.map((n: { id: string; title: string }) => ({ id: n.id, title: n.title })));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasValidGoals = goals.some(g => g.title.trim());

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">What are you trying to achieve?</h1>
      <p className="text-sm text-gray-500">List the 2–4 big goals that everything else orients around.</p>

      <div className="space-y-4">
        {goals.map((goal, i) => (
          <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Goal {i + 1}</p>
            <input
              type="text"
              value={goal.title}
              onChange={e => updateGoal(i, 'title', e.target.value)}
              placeholder="Goal title"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30"
            />
            <textarea
              value={goal.description}
              onChange={e => updateGoal(i, 'description', e.target.value)}
              placeholder="What would success look like?"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30 resize-none"
            />
          </div>
        ))}

        <button onClick={addGoal} className="text-sm text-gray-400 hover:text-gray-600">+ Add another goal</button>
      </div>

      <div className="border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50 space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Help me think through this</p>
        {!showHelper ? (
          <button onClick={() => openHelper(goals.length - 1)} className="text-xs text-gray-400 hover:text-gray-600 underline">
            Describe what you&apos;re trying to do and I&apos;ll help structure it
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={helperInput}
              onChange={e => setHelperInput(e.target.value)}
              placeholder="Describe what you're trying to do in plain language..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-transparent focus:outline-none resize-none"
            />
            <button
              onClick={runHelper}
              disabled={!helperInput.trim() || helperLoading}
              className="text-xs px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded disabled:opacity-40"
            >
              {helperLoading ? 'Thinking...' : 'Suggest a goal'}
            </button>
            {helperSuggestion && (
              <div className="p-3 border border-node-hunch/30 rounded-lg bg-node-hunch/5 space-y-1">
                <p className="text-sm font-medium">{helperSuggestion.title}</p>
                <p className="text-xs text-gray-500">{helperSuggestion.description}</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={acceptSuggestion} className="text-xs px-2 py-1 bg-node-hunch text-white rounded">Accept</button>
                  <button onClick={() => setHelperSuggestion(null)} className="text-xs px-2 py-1 border border-gray-200 rounded">Revise</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button
          onClick={handleNext}
          disabled={!hasValidGoals || isLoading}
          className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90"
        >
          {isLoading ? 'Saving...' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
