'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import { Spinner } from '@/components/ui/Spinner';
import { CAPTURE_TYPES } from '@/lib/config/captureTypes';

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

const EDITABLE_TYPES = CAPTURE_TYPES
  .filter(t => t.supportsExtraction && !t.multiNodeExtraction)
  .map(t => ({ id: t.id, label: t.label }));

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

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const [editDescription, setEditDescription] = useState(node.description ?? '');
  const [editNodeType, setEditNodeType] = useState(node.node_type);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);

  const extraction = node.llm_extraction;
  const maturityLabel = extraction?.maturity ? MATURITY_LABELS[extraction.maturity] : null;

  // Displayed values — use saved edits if the user has saved at least once
  const displayTitle = savedOnce ? editTitle : node.title;
  const displayDescription = savedOnce ? (editDescription || null) : node.description;

  async function handleSaveEdits() {
    if (!editTitle.trim()) {
      setSaveError('Title cannot be empty');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/nodes/${node.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          node_type: editNodeType,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setSaveError(body.error ?? 'Failed to save — try again');
        return;
      }
      setSavedOnce(true);
      setEditing(false);
    } catch {
      setSaveError('Failed to save — try again');
    } finally {
      setIsSaving(false);
    }
  }

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
      {/* Header row with type badge and edit toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {getTypeLabel(savedOnce ? editNodeType : node.node_type)}
          </span>
          {maturityLabel && (
            <span className="text-[10px] text-gray-500 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              {maturityLabel}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setEditing(e => !e); setSaveError(null); }}
          className="text-[10px] text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-1 transition-colors"
        >
          {editing ? 'Cancel edit' : 'Edit'}
        </button>
      </div>

      {/* Inline edit form */}
      {editing ? (
        <div className="bg-gray-50 dark:bg-gray-900 border border-blue-900/40 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-gray-200 focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Description</label>
            <textarea
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              rows={3}
              className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-gray-200 focus:outline-none focus:border-gray-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Type</label>
            <select
              value={editNodeType}
              onChange={e => setEditNodeType(e.target.value)}
              className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-gray-200 focus:outline-none focus:border-gray-500"
            >
              {EDITABLE_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          {saveError && <p className="text-[10px] text-red-400">{saveError}</p>}
          <button
            type="button"
            onClick={() => void handleSaveEdits()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors disabled:opacity-50"
          >
            {isSaving && <Spinner size="sm" label="Saving" />}
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      ) : (
        /* Display the current (or edited) title + description above the extraction card */
        savedOnce && (
          <div className="bg-gray-50 dark:bg-gray-900 border border-green-900/30 rounded-lg px-4 py-3 space-y-1">
            <p className="text-sm font-medium text-gray-200">{displayTitle}</p>
            {displayDescription && (
              <p className="text-xs text-gray-500">{displayDescription}</p>
            )}
            <p className="text-[10px] text-green-600">Edits saved</p>
          </div>
        )
      )}

      {/* LLM extraction card */}
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
          onClick={() => void handlePromote()}
          disabled={isSubmitting || editing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#185FA5] text-white rounded-md disabled:opacity-50"
        >
          {isSubmitting && <Spinner size="sm" label="Promoting" />}
          {isSubmitting ? 'Promoting…' : 'Promote'}
        </button>
        <button
          type="button"
          onClick={() => void handleArchive()}
          disabled={isSubmitting || editing}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-md disabled:opacity-50"
        >
          Archive
        </button>
      </div>
      {editing && (
        <p className="text-[10px] text-gray-600">Save your edits before promoting.</p>
      )}
    </div>
  );
}
