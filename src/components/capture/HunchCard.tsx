'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfidenceIndicator } from '@/components/shared/ConfidenceIndicator';
import Link from 'next/link';

interface HunchCardProps {
  readonly node: Node;
}

export function HunchCard({ node }: HunchCardProps) {
  const [dismissed, setDismissed] = useState(false);

  const reviewLink = node.status === 'llm_reviewed'
    ? `/capture/${node.id}/review`
    : `/capture/${node.id}`;

  const handleDismiss = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
    await fetch(`/api/nodes/${node.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
  };

  if (dismissed) return null;

  const isError = node.status === 'error';

  return (
    <Link
      href={reviewLink}
      className={`block border rounded-lg p-4 hover:border-gray-700 transition-colors ${isError ? 'bg-red-950/20 border-red-900/40' : 'bg-gray-900 border-gray-800'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-200 truncate">{node.title}</h3>
          {node.description && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{node.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={node.status} />
          {isError && (
            <button
              type="button"
              onClick={handleDismiss}
              title="Dismiss"
              className="text-gray-600 hover:text-gray-400 text-xs leading-none"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <ConfidenceIndicator level={node.confidence_level} />
        <span className="text-xs text-gray-600">
          {new Date(node.created_at).toLocaleDateString()}
        </span>
      </div>
      {isError && (
        <div className="mt-2 text-xs text-red-400">
          {node.llm_extraction && typeof node.llm_extraction === 'object' && 'error' in node.llm_extraction
            ? String((node.llm_extraction as { error: unknown }).error)
            : 'Processing failed'} — <span className="underline">retry</span> or <span className="underline" onClick={handleDismiss}>dismiss</span>
        </div>
      )}
    </Link>
  );
}
