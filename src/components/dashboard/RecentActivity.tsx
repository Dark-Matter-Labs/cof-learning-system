import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { RecentActivityGroup } from '@/lib/dashboard/queries';

const TYPE_LABEL: Record<string, string> = {
  hunch: 'hunch',
  assumption_background: 'assumption',
  assumption_foreground: 'assumption',
  learning: 'learning',
  signal: 'signal',
  commitment: 'commitment',
  option: 'option',
  site: 'site',
  person: 'person',
  goal_space: 'goal',
};

export function RecentActivity({ groups }: { readonly groups: readonly RecentActivityGroup[] }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-widest text-cof-text-tertiary mb-4">
        Recent activity
      </p>
      {groups.length === 0 ? (
        <p className="text-sm text-cof-text-tertiary">No recent activity yet.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.label}>
              <p className="text-xs font-medium text-cof-text-tertiary mb-2">{group.label}</p>
              <ul className="space-y-1.5">
                {group.items.map(item => (
                  <li key={item.id} className="flex items-baseline gap-2">
                    <span className="text-[10px] text-cof-text-tertiary/60 uppercase tracking-wide flex-shrink-0 w-16 truncate">
                      {TYPE_LABEL[item.node_type] ?? item.node_type}
                    </span>
                    <Link href={`/capture/${item.id}`} className="text-sm text-cof-text-secondary hover:text-node-hunch transition-colors truncate">
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <Link href="/log" className="mt-4 block text-xs text-cof-text-tertiary hover:text-cof-text-secondary transition-colors">
        Open log →
      </Link>
    </Card>
  );
}
