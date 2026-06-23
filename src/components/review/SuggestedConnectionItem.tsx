'use client';

import Link from 'next/link';

export interface ReviewEdgeSuggestion {
  readonly id: string; // edge_suggestions row id
  readonly similarity: number;
  readonly edgeType: string;
  readonly rationale: string | null;
  readonly source: { readonly id: string; readonly title: string };
  readonly target: { readonly id: string; readonly title: string };
}

interface SuggestedConnectionItemProps {
  readonly suggestion: ReviewEdgeSuggestion;
  readonly onAccept: (suggestion: ReviewEdgeSuggestion) => void;
  readonly onDismiss: (suggestionId: string) => void;
}

export function SuggestedConnectionItem({ suggestion, onAccept, onDismiss }: SuggestedConnectionItemProps) {
  const pct = Math.round(suggestion.similarity * 100);
  const edgeLabel = suggestion.edgeType.replace(/_/g, ' ');
  return (
    <div className="bg-cof-bg-elevated border border-cof-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] text-cof-text-secondary">Suggested connection</span>
        <span className="ml-auto text-[10px] text-amber-500">{pct}% match</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
        <div className="border border-cof-border rounded p-2 min-w-0">
          <div className="text-[10px] text-cof-text-tertiary uppercase tracking-wide mb-0.5">This entry</div>
          <div className="text-xs font-medium text-cof-text-primary truncate">{suggestion.source.title}</div>
        </div>
        <div className="flex flex-col items-center justify-center text-cof-text-tertiary text-[10px]">
          <span>{edgeLabel}</span>
          <span>→</span>
        </div>
        <Link href={`/capture/${suggestion.target.id}`} className="border border-cof-border rounded p-2 min-w-0 hover:border-cof-border-strong transition-colors">
          <div className="text-[10px] text-cof-text-tertiary uppercase tracking-wide mb-0.5">Connects to</div>
          <div className="text-xs font-medium text-xco-teal truncate">{suggestion.target.title}</div>
        </Link>
      </div>
      {suggestion.rationale && (
        <p className="text-[11px] text-cof-text-secondary mt-2">{suggestion.rationale}</p>
      )}
      <div className="flex items-center gap-2 justify-end mt-2">
        <button
          type="button"
          onClick={() => onDismiss(suggestion.id)}
          className="text-[10px] px-2 py-1 text-cof-text-tertiary hover:text-cof-text-secondary"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => onAccept(suggestion)}
          className="text-[10px] px-2 py-1 bg-cof-bg-subtle border border-cof-border text-cof-text-secondary rounded hover:border-cof-border-strong"
        >
          Add connection
        </button>
      </div>
    </div>
  );
}
