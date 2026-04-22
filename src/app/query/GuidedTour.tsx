'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { TourResponse, TourChapter } from '@/lib/agents/query';
import { NodeCard } from './NodeCard';

const STATIC_CHAPTER_1: TourChapter = {
  title: 'What is this system?',
  narrative: "This is a COF (Cycles of Feedback) knowledge graph. It captures the team's hunches, assumptions, tests, learnings, and commitments as interconnected nodes. The graph evolves as the team learns — hunches get tested, assumptions get validated or falsified, and insights become commitments. Use it to understand what the team believes, what it's testing, and what it has learned.",
  nodeIds: [],
};

interface GuidedTourProps {
  readonly allNodes: ReadonlyArray<Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>>;
}

export function GuidedTour({ allNodes }: GuidedTourProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [llmChapters, setLlmChapters] = useState<TourChapter[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const allChapters: TourChapter[] = status === 'ready' ? [STATIC_CHAPTER_1, ...llmChapters] : [];
  const activeChapter = allChapters[activeIndex];
  const chapterNodeIds = new Set(activeChapter?.nodeIds ?? []);
  const chapterNodes = activeChapter
    ? allNodes.filter(n => chapterNodeIds.has(n.id))
    : [];

  async function handleStart() {
    setStatus('loading');
    try {
      const res = await fetch('/api/query/tour', { method: 'POST' });
      if (!res.ok) throw new Error('Tour failed');
      const data = await res.json() as TourResponse;
      setLlmChapters(data.chapters as TourChapter[]);
      setActiveIndex(0);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-sm">
          Get a guided walkthrough of the knowledge graph — what the team is working on, what it believes, and where attention is needed.
        </p>
        <button
          type="button"
          onClick={handleStart}
          className="px-6 py-2.5 bg-node-hunch text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          Start guided tour
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-6 pt-8">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full mb-1" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-red-500 mb-4">Failed to generate tour. Please try again.</p>
        <button
          type="button"
          onClick={handleStart}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-160px)]">
      <div className="w-44 flex-shrink-0 space-y-1 overflow-y-auto">
        {allChapters.map((ch, i) => (
          <button
            key={ch.title}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
              i === activeIndex
                ? 'bg-node-hunch/10 text-node-hunch font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {ch.title}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeChapter && (
          <>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {activeChapter.title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              {activeChapter.narrative}
            </p>
            {chapterNodes.length > 0 && (
              <div className="space-y-2 mb-6">
                {chapterNodes.map(n => (
                  <NodeCard key={n.id} node={n} />
                ))}
              </div>
            )}
            {activeIndex < allChapters.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveIndex(prev => prev + 1)}
                className="text-sm text-node-hunch hover:opacity-80"
              >
                Next chapter →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
