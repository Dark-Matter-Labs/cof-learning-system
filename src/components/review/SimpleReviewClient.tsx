'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import { Spinner } from '@/components/ui/Spinner';

const NODE_TYPE_LABELS: Record<string, string> = {
  hunch: 'Hunch',
  assumption_background: 'Background Assumption',
  assumption_foreground: 'Active Assumption',
  test: 'Test',
  signal: 'Signal',
  learning: 'Learning',
  option: 'Option',
};

const MATURITY_LABELS: Record<string, string> = {
  watch_closely: 'Watch closely',
  needs_development: 'Needs development',
  cluster_dependent: 'Cluster dependent',
};

function getTypeLabel(nodeType: string): string {
  return NODE_TYPE_LABELS[nodeType]
    ?? nodeType.charAt(0).toUpperCase() + nodeType.slice(1).replace(/_/g, ' ');
}

interface SimpleReviewClientProps {
  readonly node: Node;
  readonly onPromote: (note: string) => Promise<void>;
  readonly onArchive: () => Promise<void>;
  readonly isSubmitting: boolean;
}

export function SimpleReviewClient({ node, onPromote, onArchive, isSubmitting }: SimpleReviewClientProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const extraction = node.llm_extraction;
  const maturityLabel = extraction?.maturity ? MATURITY_LABELS[extraction.maturity] : null;

  async function handlePromote() {
    setError(null);
    try {
      await onPromote(note);
    } catch {
      setError('Failed — try again');
    }
  }

  async function handleArchive() {
    setError(null);
    try {
      await onArchive();
    } catch {
      setError('Failed — try again');
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {getTypeLabel(node.node_type)}
        </span>
        {maturityLabel && (
          <span className="text-[10px] text-gray-500 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {maturityLabel}
          </span>
        )}
      </div>

      {extraction && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3">
          {extraction.summary && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{extraction.summary}</p>
          )}
          {extraction.structured_claim && (
            <div className="space-y-1 text-xs text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-gray-800 pt-3">
              <p><span className="font-medium text-gray-700 dark:text-gray-400">If</span> {extraction.structured_claim.if}</p>
              <p><span className="font-medium text-gray-700 dark:text-gray-400">Then</span> {extraction.structured_claim.then}</p>
              <p><span className="font-medium text-gray-700 dark:text-gray-400">Because</span> {extraction.structured_claim.because}</p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 pt-3">
            <span className="text-[10px] text-gray-500">
              {extraction.confidence_assessment.level}/5 · {extraction.confidence_assessment.basis.replace(/_/g, ' ')}
            </span>
            {extraction.domain_tags.length > 0 && (
              <div className="flex gap-1 flex-wrap justify-end">
                {extraction.domain_tags.map(tag => (
                  <span key={tag} className="text-[10px] bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a note to supplement this entry (optional)"
        rows={3}
        className="w-full text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#185FA5] resize-none"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePromote}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#185FA5] text-white rounded-md disabled:opacity-50"
        >
          {isSubmitting && <Spinner size="sm" label="Promoting" />}
          {isSubmitting ? 'Promoting…' : 'Promote'}
        </button>
        <button
          type="button"
          onClick={handleArchive}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-md disabled:opacity-50"
        >
          Archive
        </button>
      </div>
    </div>
  );
}
