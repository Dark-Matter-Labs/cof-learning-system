import type { Node } from '@/lib/types/nodes';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfidenceIndicator } from '@/components/shared/ConfidenceIndicator';
import Link from 'next/link';

interface HunchCardProps {
  readonly node: Node;
}

export function HunchCard({ node }: HunchCardProps) {
  const reviewLink = node.status === 'llm_reviewed'
    ? `/capture/${node.id}/review`
    : `/capture/${node.id}`;

  return (
    <Link
      href={reviewLink}
      className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-200 truncate">{node.title}</h3>
          {node.description && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{node.description}</p>
          )}
        </div>
        <StatusBadge status={node.status} />
      </div>
      <div className="mt-3 flex items-center gap-4">
        <ConfidenceIndicator level={node.confidence_level} />
        <span className="text-xs text-gray-600">
          {new Date(node.created_at).toLocaleDateString()}
        </span>
      </div>
      {node.status === 'error' && node.llm_extraction && typeof node.llm_extraction === 'object' && 'error' in node.llm_extraction && (
        <div className="mt-2 text-xs text-red-400">
          Processing failed — click to retry
        </div>
      )}
    </Link>
  );
}
