'use client';

import Link from 'next/link';
import type { Node } from '@/lib/types/nodes';

interface FlaggedItemProps {
  readonly node: Node;
  readonly onAccept: (id: string) => void;
  readonly onArchive: (id: string) => void;
}

const FLAG_REASON_LABELS: Record<string, string> = {
  watch_closely: 'Needs more evidence',
  needs_development: 'Needs development',
  cluster_dependent: 'Depends on other entries',
};

export function FlaggedItem({ node, onAccept, onArchive }: FlaggedItemProps) {
  const maturity = node.llm_extraction?.maturity ?? null;
  const reason = maturity ? (FLAG_REASON_LABELS[maturity] ?? maturity) : 'Flagged by LLM';

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border border-amber-900/30 rounded-lg p-3">
      <div className="mb-1.5">
        <p className="text-xs text-gray-800 dark:text-gray-200 font-medium truncate">{node.title}</p>
        {node.description && (
          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{node.description}</p>
        )}
        <p className="text-[10px] text-amber-500 mt-1">{reason}</p>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => onAccept(node.id)}
          className="text-[10px] px-2 py-1 bg-xco-ocean/10 border border-xco-ocean/20 text-xco-teal rounded hover:bg-xco-ocean/20"
        >
          Accept as-is
        </button>
        <Link
          href={`/capture/${node.id}/review`}
          className="text-[10px] px-2 py-1 bg-gray-800 border border-gray-700 text-gray-300 rounded hover:bg-gray-700"
        >
          Edit & promote
        </Link>
        <button
          type="button"
          onClick={() => onArchive(node.id)}
          className="text-[10px] px-2 py-1 text-gray-500 hover:text-gray-400"
        >
          Archive
        </button>
      </div>
    </div>
  );
}
