'use client';

import { useEffect, useState } from 'react';

const NODE_TYPES = [
  { value: 'hunch', label: 'Hunch' },
  { value: 'assumption_background', label: 'Background Assumption' },
  { value: 'assumption_foreground', label: 'Foreground Assumption' },
  { value: 'test', label: 'Test' },
  { value: 'learning', label: 'Learning' },
  { value: 'option', label: 'Option' },
];

interface InlineCaptureCardProps {
  /** Screen coordinates (viewport) where the card should appear */
  readonly position: { x: number; y: number };
  readonly linkedNodeId?: string;
  readonly onClose: () => void;
  readonly onCreated: (nodeId: string) => void;
}

export function InlineCaptureCard({ position, onClose, onCreated }: InlineCaptureCardProps) {
  const [title, setTitle] = useState('');
  const [nodeType, setNodeType] = useState('hunch');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), node_type: nodeType, hunch_type: 'new', confidence_level: 3 }),
      });
      if (!res.ok) throw new Error('Failed');
      const { data } = await res.json();
      onCreated(data.id);
    } catch {
      // keep card open on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardW = 280;
  const cardH = 180;
  const left = Math.min(position.x, window.innerWidth - cardW - 16);
  const top = Math.min(position.y, window.innerHeight - cardH - 16);

  return (
    <div
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 flex flex-col gap-3"
      style={{ left, top, width: cardW }}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-xs text-gray-500 uppercase tracking-wider">New node</div>

      <input
        autoFocus
        type="text"
        placeholder="Title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
        className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 w-full"
      />

      <select
        value={nodeType}
        onChange={e => setNodeType(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-400 focus:outline-none w-full"
      >
        {NODE_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={!title.trim() || isSubmitting}
          className="flex-1 py-1.5 bg-node-hunch text-white text-xs rounded-md disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {isSubmitting ? 'Creating…' : 'Create'}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
