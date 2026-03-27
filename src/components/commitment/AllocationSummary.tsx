'use client';

import type { Node } from '@/lib/types/nodes';

function getStatus(node: Node): string {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    if (typeof c.status === 'string') return c.status;
  }
  return 'active';
}

function getAllocation(node: Node): number | null {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    if (typeof c.resource_allocation === 'number') return c.resource_allocation;
  }
  return null;
}

export function AllocationSummary({ commitments }: { readonly commitments: readonly Node[] }) {
  const allocations = commitments
    .filter(c => {
      const status = getStatus(c);
      return status === 'active' || status === 'proposed';
    })
    .map(c => ({
      title: c.title,
      allocation: getAllocation(c),
    }))
    .filter(c => c.allocation !== null) as { title: string; allocation: number }[];

  if (allocations.length === 0) return null;

  const total = allocations.reduce((sum, c) => sum + c.allocation, 0);

  return (
    <div className="px-3 pb-3">
      <div className="text-[9px] text-gray-600 uppercase tracking-wide mb-2">Allocation</div>
      <div className="space-y-1.5">
        {allocations.map(({ title, allocation }) => (
          <div key={title}>
            <div className="flex justify-between mb-0.5">
              <span className="text-[9px] text-gray-500 truncate flex-1 min-w-0">{title}</span>
              <span className="text-[9px] text-gray-600 ml-1">{allocation}%</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#185FA5]/70 rounded-full"
                style={{ width: `${allocation}%` }}
              />
            </div>
          </div>
        ))}
        <div className="flex justify-between pt-1 border-t border-gray-800 mt-1">
          <span className="text-[9px] text-gray-600">Total committed</span>
          <span className={`text-[9px] font-medium ${total > 100 ? 'text-red-400' : 'text-gray-400'}`}>
            {total}%
          </span>
        </div>
      </div>
    </div>
  );
}
