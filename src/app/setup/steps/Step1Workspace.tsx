'use client';

import { useState } from 'react';

interface Props {
  readonly onNext: () => void;
}

export function Step1Workspace({ onNext }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Failed to save workspace');
      const { data } = await res.json();
      localStorage.setItem('setup_context_id', data.id);
      localStorage.setItem('setup_workspace_name', name.trim());
      onNext();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">
        What are you working on?
      </h1>

      <div className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name this workspace"
          className="w-full px-4 py-3 text-lg border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30"
        />
        <div className="space-y-1">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the mission in a few sentences"
            rows={4}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30 resize-none"
          />
          <p className="text-xs text-gray-400">What is this team trying to achieve? This can evolve.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={!name.trim() || isLoading}
          className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {isLoading ? 'Saving...' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
