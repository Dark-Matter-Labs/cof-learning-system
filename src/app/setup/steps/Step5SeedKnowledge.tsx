'use client';

import { useState } from 'react';
import { Step5Write } from './Step5Write';
import { Step5Upload } from './Step5Upload';
import { Step5Chat } from './Step5Chat';

type SeedMode = 'write' | 'upload' | 'chat' | null;

interface Props {
  readonly goals: ReadonlyArray<{ id: string; title: string }>;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step5SeedKnowledge({ goals, onNext, onBack }: Props) {
  const [mode, setMode] = useState<SeedMode>(null);

  if (mode === 'write') return <Step5Write goals={goals} onNext={onNext} onBack={() => setMode(null)} />;
  if (mode === 'upload') return <Step5Upload onNext={onNext} onBack={() => setMode(null)} />;
  if (mode === 'chat') return <Step5Chat goals={goals} onNext={onNext} onBack={() => setMode(null)} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Seed your knowledge</h1>
        <p className="text-sm text-gray-500 mt-2">The system gets smarter the more it knows. Choose how you&apos;d like to start.</p>
      </div>

      <div className="space-y-3">
        {[
          { id: 'write' as const, emoji: '📝', title: 'Write your key assumptions', desc: 'What do you believe to be true about the world that shapes your work?' },
          { id: 'upload' as const, emoji: '📄', title: 'Upload existing documents', desc: 'Drop in papers, strategy docs, or notes. The system will extract what matters.' },
          { id: 'chat' as const, emoji: '💬', title: 'Talk through it', desc: 'Describe your thinking in plain language. I\'ll help structure it into the system.' },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => setMode(opt.id)}
            className="w-full text-left p-5 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-node-hunch/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          >
            <div className="flex gap-3 items-start">
              <span className="text-xl">{opt.emoji}</span>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{opt.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </div>
          </button>
        ))}

        <button
          onClick={onNext}
          className="w-full text-left p-4 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
        >
          <div className="flex gap-3 items-center">
            <span className="text-xl">⏭</span>
            <p className="text-sm text-gray-400">I&apos;ll add things as I go</p>
          </div>
        </button>
      </div>

      <div className="flex items-center justify-between pt-4">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
      </div>
    </div>
  );
}
