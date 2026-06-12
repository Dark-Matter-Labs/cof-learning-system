'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { Node } from '@/lib/types/nodes';
import type { TensionAlert } from '@/lib/types/tension';
import { FlaggedItem } from '@/components/review/FlaggedItem';
import { Markdown } from '@/components/ui/Markdown';

interface SystemHealthClientProps {
  readonly flagged: readonly Node[];
  readonly tensions: readonly TensionAlert[];
  readonly learnings: readonly Node[];
}

const SEVERITY_COLORS: Record<string, { readonly text: string; readonly border: string }> = {
  high:   { text: 'text-red-400',   border: 'border-red-900/50' },
  medium: { text: 'text-amber-400', border: 'border-amber-900/50' },
  low:    { text: 'text-gray-500',  border: 'border-gray-200 dark:border-gray-800' },
};

export function SystemHealthClient({
  flagged: initialFlagged,
  tensions,
  learnings,
}: SystemHealthClientProps) {
  const [flagged, setFlagged] = useState<readonly Node[]>(initialFlagged);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const handleAccept = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'promoted' }),
      });
      if (res.ok) {
        setFlagged(prev => prev.filter(n => n.id !== id));
      } else {
        setItemErrors(prev => ({ ...prev, [id]: 'Failed to accept — try again' }));
      }
    } catch {
      setItemErrors(prev => ({ ...prev, [id]: 'Failed to accept — try again' }));
    }
  }, []);

  const handleArchive = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      if (res.ok) {
        setFlagged(prev => prev.filter(n => n.id !== id));
      } else {
        setItemErrors(prev => ({ ...prev, [id]: 'Failed to archive — try again' }));
      }
    } catch {
      setItemErrors(prev => ({ ...prev, [id]: 'Failed to archive — try again' }));
    }
  }, []);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Flagged for review
        </h2>
        {flagged.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-600">
            Nothing flagged — system is running cleanly.
          </p>
        ) : (
          <div className="space-y-2">
            {flagged.map(node => (
              <div key={node.id}>
                <FlaggedItem node={node} onAccept={handleAccept} onArchive={handleArchive} />
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

      {learnings.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Awaiting review
          </h2>
          <div className="space-y-1.5">
            {learnings.map(node => (
              <div key={node.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{node.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {node.node_type} · {new Date(node.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  href={`/capture/${node.id}/review`}
                  className="text-[10px] text-xco-teal hover:text-xco-ocean shrink-0 ml-2"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
