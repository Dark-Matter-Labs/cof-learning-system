'use client';

import { useState } from 'react';

interface Props {
  readonly goals: ReadonlyArray<{ id: string; title: string }>;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step5Write({ goals, onNext, onBack }: Props) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'write', content: content.trim(), goals }),
      });
      if (!res.ok) throw new Error('Failed to process');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Processing your thinking</h1>
          <p className="text-sm text-gray-500 mt-2">Your assumptions are being connected to the knowledge graph. This happens in the background — you can keep going.</p>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
          <button onClick={onNext} className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:opacity-90">Continue →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Write your key assumptions</h1>
        <p className="text-sm text-gray-500 mt-2">What do you believe to be true about the world that shapes your work? Any format — list, prose, rough notes.</p>
      </div>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="e.g. 3-4° warming is now unavoidable. Existing capital structures are not designed for this. Formation finance requires new instruments..."
        rows={12}
        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30 resize-none text-sm"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isLoading}
          className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90"
        >
          {isLoading ? 'Processing...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
