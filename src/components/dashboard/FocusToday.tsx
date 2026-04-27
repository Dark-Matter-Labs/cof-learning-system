'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { FocusItem } from '@/lib/dashboard/queries';

interface FocusTodayProps {
  readonly items: readonly FocusItem[];
}

const TYPE_ICON: Record<FocusItem['type'], string> = {
  tension: '⚠',
  stale_commitment: '📌',
  unprocessed_captures: '💭',
  signal_ready: '✨',
};

function getDismissKey(): string {
  return `focus_dismissed_${new Date().toISOString().slice(0, 10)}`;
}

export function FocusToday({ items }: FocusTodayProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const raw = localStorage.getItem(getDismissKey());
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setDismissedIds(new Set(parsed as string[]));
    } catch {
      // ignore malformed localStorage data
    }
  }, []);

  const dismiss = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(getDismissKey(), JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const visible = items.filter(item => !dismissedIds.has(item.id)).slice(0, 4);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
        Your focus today
      </p>
      {visible.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">All clear — nothing needs your attention right now.</p>
      ) : (
        <ul className="space-y-4">
          {visible.map(item => (
            <li key={item.id} className="flex items-start gap-3">
              <span className="text-base mt-0.5 flex-shrink-0">{TYPE_ICON[item.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.subtitle}</p>
                <Link href={item.href} className="text-xs text-node-hunch hover:underline mt-1 inline-block">
                  Resolve →
                </Link>
              </div>
              <button
                type="button"
                aria-label={`Dismiss ${item.title}`}
                onClick={() => dismiss(item.id)}
                className="flex-shrink-0 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 text-xs mt-0.5 transition-colors"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length > 4 && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          +{items.length - 4} more
        </p>
      )}
    </div>
  );
}
