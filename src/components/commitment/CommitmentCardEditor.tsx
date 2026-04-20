'use client';

import { useState, useRef, useEffect } from 'react';
import type { Node } from '@/lib/types/nodes';

export interface CommitmentUpdates {
  readonly title: string;
  readonly description: string | null;
  readonly content: {
    readonly status: string;
    readonly resource_allocation: number | null;
  };
}

interface CommitmentCardEditorProps {
  readonly commitment: Node;
  readonly onSave: (id: string, updates: CommitmentUpdates) => Promise<void>;
  readonly onCancel: () => void;
}

const STATUS_OPTIONS = ['active', 'proposed', 'achieved', 'abandoned'] as const;

function getInitialContent(node: Node): { status: string; resource_allocation: number | null } {
  if (node.content && typeof node.content === 'object') {
    const c = node.content as Record<string, unknown>;
    return {
      status: typeof c.status === 'string' ? c.status : 'active',
      resource_allocation: typeof c.resource_allocation === 'number' ? c.resource_allocation : null,
    };
  }
  return { status: 'active', resource_allocation: null };
}

interface ControlsRowProps {
  readonly status: string;
  readonly onStatusChange: (v: string) => void;
  readonly allocation: string;
  readonly onAllocationChange: (v: string) => void;
}

function ControlsRow({ status, onStatusChange, allocation, onAllocationChange }: ControlsRowProps) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={e => onStatusChange(e.target.value)}
        className="text-[10px] bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-[#185FA5]"
      >
        {STATUS_OPTIONS.map(s => (
          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={100}
          value={allocation}
          onChange={e => onAllocationChange(e.target.value)}
          placeholder="0"
          className="w-14 text-[10px] bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-[#185FA5]"
        />
        <span className="text-[10px] text-gray-500">%</span>
      </div>
    </div>
  );
}

export function CommitmentCardEditor({ commitment, onSave, onCancel }: CommitmentCardEditorProps) {
  const initial = getInitialContent(commitment);
  const [title, setTitle] = useState(commitment.title);
  const [description, setDescription] = useState(commitment.description ?? '');
  const [status, setStatus] = useState(initial.status);
  const [allocation, setAllocation] = useState(initial.resource_allocation?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(commitment.id, {
        title: title.trim(),
        description: description.trim() || null,
        content: {
          status,
          resource_allocation: allocation !== '' ? Number(allocation) : null,
        },
      });
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full border-l-[3px] border-[#185FA5] bg-gray-50 dark:bg-gray-900 rounded-r-md mb-2 p-2.5 space-y-2">
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full text-xs font-semibold bg-transparent border-b border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#185FA5] pb-0.5"
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={3}
        className="w-full text-[10px] bg-transparent border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 focus:outline-none focus:border-[#185FA5] p-1 resize-none"
      />
      <ControlsRow
        status={status}
        onStatusChange={setStatus}
        allocation={allocation}
        onAllocationChange={setAllocation}
      />
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="text-[10px] bg-[#185FA5] text-white px-2.5 py-1 rounded disabled:opacity-50"
        >
          {saving ? 'Saving\u2026' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
