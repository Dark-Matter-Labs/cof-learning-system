'use client';

import { useState } from 'react';

interface Message {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

interface Captured {
  readonly title: string;
  readonly node_type: string;
}

interface Props {
  readonly goals: ReadonlyArray<{ id: string; title: string }>;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step5Chat({ goals, onNext, onBack }: Props) {
  const [history, setHistory] = useState<Message[]>([
    { role: 'assistant', content: 'What are the core hunches guiding your work right now?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [captured, setCaptured] = useState<Captured[]>([]);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    const newHistory: Message[] = [...history, { role: 'user', content: userMessage }];
    setHistory(newHistory);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/setup/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          message: userMessage,
          history: history,
          goals: goals.map(g => ({ title: g.title })),
        }),
      });
      if (!res.ok) throw new Error('Failed to send');
      const { reply, extracted } = await res.json();
      setHistory(prev => [...prev, { role: 'assistant', content: reply }]);
      if (extracted?.length > 0) {
        setCaptured(prev => [...prev, ...extracted]);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setHistory(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Talk through it</h1>
        <p className="text-sm text-gray-500 mt-2">I&apos;ll help structure your thinking into the graph as we go.</p>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-2xl text-sm text-gray-400">Thinking...</div>
          </div>
        )}
      </div>

      {captured.length > 0 && (
        <div className="border border-gray-100 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Captured so far</p>
          <div className="space-y-1">
            {captured.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">{c.node_type}</span>
                <span className="text-gray-700 dark:text-gray-300">{c.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type your response..."
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!input.trim() || isLoading}
          className="px-4 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button onClick={onNext} className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:opacity-90">
          {captured.length > 0 ? `Continue with ${captured.length} captured →` : 'Skip →'}
        </button>
      </div>
    </div>
  );
}
