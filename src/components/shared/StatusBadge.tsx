import type { NodeStatus } from '@/lib/types/nodes';

const STATUS_STYLES: Record<NodeStatus, string> = {
  raw: 'bg-gray-600 text-gray-200',
  processing: 'bg-node-option text-white',
  llm_reviewed: 'bg-node-test text-white',
  human_reviewed: 'bg-node-hunch text-white',
  promoted: 'bg-node-assumption-bg text-white',
  error: 'bg-red-600 text-white',
  archived: 'bg-gray-700 text-gray-300',
  falsified: 'bg-node-assumption-fg text-white',
  suspended: 'bg-node-option text-white',
};

interface StatusBadgeProps {
  readonly status: NodeStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`${STATUS_STYLES[status]} text-xs px-2 py-0.5 rounded-full`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
