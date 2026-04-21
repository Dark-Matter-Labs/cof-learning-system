'use client';

import { useRef } from 'react';
import type { GraphNode } from '@/lib/graph/layout';
import type { GraphView } from './GraphTopBar';

interface GraphBottomBarProps {
  readonly onFitView: () => void;
  readonly view: GraphView;
  readonly onChangeView: (v: GraphView) => void;
  readonly nodes: readonly GraphNode[];
  readonly onFocusNode: (id: string) => void;
}

const VIEWS: { id: GraphView; label: string }[] = [
  { id: 'force',    label: 'Force' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'tree',     label: 'Tree' },
  { id: 'workflow', label: 'Workflow' },
];

export function GraphBottomBar({ onFitView, view, onChangeView, nodes, onFocusNode }: GraphBottomBarProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value.toLowerCase();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!q) return;
    debounceTimer.current = setTimeout(() => {
      const match = nodes.find(n => n.title.toLowerCase().includes(q));
      if (match) onFocusNode(match.id);
    }, 250);
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-1.5 z-10">
      <button
        type="button"
        onClick={onFitView}
        aria-label="Fit view"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <span>⊡</span> Fit view
      </button>

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

      <div className="relative flex items-center">
        <svg
          className="absolute left-2 w-3 h-3 text-gray-400 dark:text-gray-600 pointer-events-none"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
        <input
          type="text"
          placeholder="Find node..."
          aria-label="Find node"
          onChange={handleSearch}
          className="w-36 pl-6 pr-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-indigo-400"
        />
      </div>

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

      <div className="flex items-center gap-0.5">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChangeView(id)}
            aria-pressed={view === id}
            className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
              view === id
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
