'use client';

import type { Node, NodeStatus } from '@/lib/types/nodes';

const TYPE_COLORS: Record<string, string> = {
  hunch: '#7F77DD',
  assumption_background: '#1D9E75',
  assumption_foreground: '#D85A30',
  test: '#D4537E',
  learning: '#378ADD',
  option: '#BA7517',
  entity: '#888780',
  site: '#639922',
  commitment: '#185FA5',
  intervention: '#534AB7',
  signal: '#A32D2D',
  goal_space: '#0F6E56',
  trigger_outcome: '#085041',
};

interface NodeCardProps {
  readonly node: Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>;
  readonly onClick?: () => void;
}

export function NodeCard({ node, onClick }: NodeCardProps) {
  const color = TYPE_COLORS[node.node_type] ?? '#888780';
  const label = node.node_type.replace(/_/g, ' ');

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded text-white uppercase tracking-wide"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      </div>
      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">{node.title}</p>
      {node.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5 line-clamp-2">
          {node.description}
        </p>
      )}
    </button>
  );
}
