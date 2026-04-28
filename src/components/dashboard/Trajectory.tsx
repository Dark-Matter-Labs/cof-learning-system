import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { TrajectoryItem } from '@/lib/dashboard/queries';

function Delta({ direction, delta }: { readonly direction: TrajectoryItem['direction']; readonly delta: number }) {
  if (direction === 'up') return <span className="text-xs font-medium text-green-600 dark:text-green-400">{`↗ +${delta}`}</span>;
  if (direction === 'down') return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{`↘ −${Math.abs(delta)}`}</span>;
  return <span className="text-xs text-gray-400">→ 0</span>;
}

export function Trajectory({ items }: { readonly items: readonly TrajectoryItem[] }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-widest text-cof-text-tertiary mb-4">
        Trajectory
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-cof-text-tertiary">No goal spaces configured yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.goalSpaceId} className="flex items-center justify-between gap-2">
              <span className="text-sm text-cof-text-secondary truncate">{item.goalSpaceTitle}</span>
              <Delta direction={item.direction} delta={item.delta} />
            </li>
          ))}
        </ul>
      )}
      <Link href="/reflect" className="mt-4 block text-xs text-cof-text-tertiary hover:text-cof-text-secondary transition-colors">
        Run reflection →
      </Link>
    </Card>
  );
}
