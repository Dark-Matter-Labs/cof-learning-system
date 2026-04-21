'use client';

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
  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value.toLowerCase();
    if (!q) return;
    const match = nodes.find(n => n.title.toLowerCase().includes(q));
    if (match) onFocusNode(match.id);
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

      <input
        type="text"
        placeholder="Find node..."
        onChange={handleSearch}
        className="w-36 px-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-indigo-400"
      />

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

      <div className="flex items-center gap-0.5">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChangeView(id)}
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
