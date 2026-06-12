'use client';

import { useState, useCallback } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { TensionAlert } from '@/lib/types/tension';
import { ReviewItem, type ReviewKind } from '@/components/review/ReviewItem';
import { Markdown } from '@/components/ui/Markdown';

export interface ReviewQueueEntry {
  readonly node: Node;
  readonly kind: ReviewKind;
}

interface SystemHealthClientProps {
  readonly queue: readonly ReviewQueueEntry[];
  readonly tensions: readonly TensionAlert[];
  readonly sourceTitles: Readonly<Record<string, string>>;
}

const SEVERITY_COLORS: Record<string, { readonly text: string; readonly border: string }> = {
  high:   { text: 'text-red-400',   border: 'border-red-900/50' },
  medium: { text: 'text-amber-400', border: 'border-amber-900/50' },
  low:    { text: 'text-gray-500',  border: 'border-gray-200 dark:border-gray-800' },
};

export function SystemHealthClient({
  queue: initialQueue,
  tensions,
  sourceTitles,
}: SystemHealthClientProps) {
  const [queue, setQueue] = useState<readonly ReviewQueueEntry[]>(initialQueue);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const mutate = useCallback(async (id: string, status: 'promoted' | 'archived', verb: string) => {
    try {
      const res = await fetch(`/api/nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setQueue(prev => prev.filter(e => e.node.id !== id));
      } else {
        setItemErrors(prev => ({ ...prev, [id]: `Failed to ${verb} — try again` }));
      }
    } catch {
      setItemErrors(prev => ({ ...prev, [id]: `Failed to ${verb} — try again` }));
    }
  }, []);

  const handleAccept = useCallback((id: string) => mutate(id, 'promoted', 'accept'), [mutate]);
  const handleArchive = useCallback((id: string) => mutate(id, 'archived', 'archive'), [mutate]);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Review queue {queue.length > 0 && <span className="text-gray-400">· {queue.length}</span>}
        </h2>
        {queue.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-600">
            Nothing to review — system is running cleanly.
          </p>
        ) : (
          <div className="space-y-2">
            {queue.map(({ node, kind }) => (
              <div key={node.id}>
                <ReviewItem
                  node={node}
                  kind={kind}
                  sourceTitle={node.parent_node_id ? sourceTitles[node.parent_node_id] : undefined}
                  onAccept={handleAccept}
                  onArchive={handleArchive}
                />
                {itemErrors[node.id] && (
                  <p className="text-[10px] text-red-400 mt-1 ml-1">{itemErrors[node.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {tensions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Tension alerts
          </h2>
          <div className="space-y-2">
            {tensions.map(alert => {
              const colors = SEVERITY_COLORS[alert.severity] ?? { text: 'text-gray-500', border: 'border-gray-200 dark:border-gray-800' };
              return (
                <div
                  key={alert.id}
                  className={`bg-gray-50 dark:bg-gray-900 border rounded-lg p-3 ${colors.border}`}
                >
                  <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${colors.text}`}>
                    {alert.severity} · {alert.type.replace(/_/g, ' ')}
                  </div>
                  <div className="line-clamp-3">
                    <Markdown>{alert.description}</Markdown>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
