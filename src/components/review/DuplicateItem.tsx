'use client';

import Link from 'next/link';

export interface ReviewDuplicate {
  readonly id: string; // duplicate_candidates row id
  readonly similarity: number;
  readonly node: { readonly id: string; readonly title: string };       // newer / likely duplicate
  readonly similarTo: { readonly id: string; readonly title: string };   // existing original
}

interface DuplicateItemProps {
  readonly dup: ReviewDuplicate;
  readonly onDismiss: (candidateId: string) => void;
  readonly onArchive: (dup: ReviewDuplicate) => void;
}

export function DuplicateItem({ dup, onDismiss, onArchive }: DuplicateItemProps) {
  const pct = Math.round(dup.similarity * 100);
  return (
    <div className="bg-cof-bg-elevated border border-cof-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] text-cof-text-secondary">This entry looks like an existing one</span>
        <span className="ml-auto text-[10px] text-amber-500">{pct}% similar</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
        <div className="border border-cof-border rounded p-2 min-w-0">
          <div className="text-[10px] text-cof-text-tertiary uppercase tracking-wide mb-0.5">New</div>
          <div className="text-xs font-medium text-cof-text-primary truncate">{dup.node.title}</div>
        </div>
        <div className="flex items-center text-cof-text-tertiary text-xs">↔</div>
        <Link href={`/capture/${dup.similarTo.id}`} className="border border-cof-border rounded p-2 min-w-0 hover:border-cof-border-strong transition-colors">
          <div className="text-[10px] text-cof-text-tertiary uppercase tracking-wide mb-0.5">Existing</div>
          <div className="text-xs font-medium text-xco-teal truncate">{dup.similarTo.title}</div>
        </Link>
      </div>
      <div className="flex items-center gap-2 justify-end mt-2">
        <button
          type="button"
          onClick={() => onDismiss(dup.id)}
          className="text-[10px] px-2 py-1 text-cof-text-tertiary hover:text-cof-text-secondary"
        >
          Not a duplicate
        </button>
        <button
          type="button"
          onClick={() => onArchive(dup)}
          className="text-[10px] px-2 py-1 bg-cof-bg-subtle border border-cof-border text-cof-text-secondary rounded hover:border-cof-border-strong"
        >
          Archive as duplicate
        </button>
      </div>
    </div>
  );
}
