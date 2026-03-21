import type { Node } from '@/lib/types/nodes';
import { HunchCard } from './HunchCard';
import { EmptyState } from '@/components/shared/EmptyState';

interface HunchListProps {
  readonly nodes: readonly Node[];
}

export function HunchList({ nodes }: HunchListProps) {
  if (nodes.length === 0) {
    return (
      <EmptyState
        title="No hunches yet"
        description="Capture your first hunch to get started"
      />
    );
  }

  return (
    <div className="space-y-3">
      {nodes.map(node => (
        <HunchCard key={node.id} node={node} />
      ))}
    </div>
  );
}
