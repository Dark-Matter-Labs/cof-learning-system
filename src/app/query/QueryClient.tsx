'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import { AskMode } from './AskMode';
import { GuidedTour } from './GuidedTour';

type Tab = 'ask' | 'tour';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ask', label: 'Ask' },
  { id: 'tour', label: 'Guided Tour' },
];

interface QueryClientProps {
  readonly nodes: ReadonlyArray<Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>>;
}

export function QueryClient({ nodes }: QueryClientProps) {
  const [tab, setTab] = useState<Tab>('ask');

  return (
    <div className="page-with-nav">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Query</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Ask questions about the knowledge graph or take a guided tour.
        </p>

        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                tab === id
                  ? 'border-node-hunch text-node-hunch font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'ask' ? <AskMode allNodes={nodes} /> : <GuidedTour allNodes={nodes} />}
      </div>
    </div>
  );
}
