'use client';

import Link from 'next/link';
import type { Node } from '@/lib/types/nodes';

export type ReviewKind = 'flagged' | 'awaiting';

interface ReviewItemProps {
  readonly node: Node;
  readonly kind: ReviewKind;
  readonly sourceTitle?: string;
  readonly onAccept: (id: string) => void;
  readonly onArchive: (id: string) => void;
}

const FLAG_REASON_LABELS: Record<string, string> = {
  watch_closely: 'Needs more evidence',
  needs_development: 'Needs development',
  cluster_dependent: 'Depends on other entries',
};

function reasonFor(node: Node, kind: ReviewKind): string {
  if (kind === 'awaiting') return 'Awaiting sign-off';
  const maturity = node.llm_extraction?.maturity ?? null;
  if (maturity) return FLAG_REASON_LABELS[maturity] ?? maturity;
  if (node.parent_node_id) return 'Low extraction confidence';
  return 'Flagged by LLM';
}

export function ReviewItem({ node, kind, sourceTitle, onAccept, onArchive }: ReviewItemProps) {
  const reason = reasonFor(node, kind);
  const isAwaiting = kind === 'awaiting';

  return (
    <div className={`bg-gray-50 dark:bg-gray-900 border rounded-lg p-3 ${isAwaiting ? 'border-gray-200 dark:border-gray-800' : 'border-amber-900/30'}`}>
      <div className="mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-gray-800 dark:text-gray-200 font-medium truncate">{node.title}</p>
          <span className="text-[10px] text-gray-500">{node.node_type}</span>
          {node.parent_node_id && (
            <span className="text-[10px] text-xco-teal">from {sourceTitle ?? 'extracted'}</span>
          )}
        </div>
        {node.description && (
          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{node.description}</p>
        )}
        <p className={`text-[10px] mt-1 ${isAwaiting ? 'text-gray-500' : 'text-amber-500'}`}>{reason}</p>
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
          Edit &amp; promote
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
