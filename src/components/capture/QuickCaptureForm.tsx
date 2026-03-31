'use client';

import { useState, type FormEvent } from 'react';
import type { HunchType } from '@/lib/types/nodes';
import { getPageTypes, type CaptureTypeId } from '@/lib/config/captureTypes';

export interface CaptureFormData {
  readonly title: string;
  readonly description: string;
  readonly node_type: string;
  readonly hunch_type: HunchType;
  readonly confidence_level: number;
  readonly external_link_url?: string;
  readonly external_link_label?: string;
}

interface QuickCaptureFormProps {
  readonly onSubmit: (data: CaptureFormData) => void;
  readonly isSubmitting?: boolean;
}

const CONFIDENCE_LEVELS = [
  { level: 1, label: 'Gut feel' },
  { level: 2, label: 'Analogy' },
  { level: 3, label: 'Observed' },
  { level: 4, label: 'Early data' },
  { level: 5, label: 'Strong data' },
] as const;

const HUNCH_TYPES: { value: HunchType; label: string }[] = [
  { value: 'new', label: 'New hunch' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'test_result', label: 'Test result' },
  { value: 'external_validation', label: 'External validation' },
];

export function QuickCaptureForm({ onSubmit, isSubmitting = false }: QuickCaptureFormProps) {
  const [captureType, setCaptureType] = useState<CaptureTypeId>('hunch');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hunchType, setHunchType] = useState<HunchType>('new');
  const [confidence, setConfidence] = useState(3);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');

  const selectedConfig = getPageTypes().find(t => t.id === captureType);
  const canSubmit = title.trim().length > 0 && !isSubmitting;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      node_type: selectedConfig?.nodeType ?? 'hunch',
      hunch_type: hunchType,
      confidence_level: confidence,
      ...(linkUrl.trim() ? { external_link_url: linkUrl.trim(), external_link_label: linkLabel.trim() || linkUrl.trim() } : {}),
    });

    setCaptureType('hunch');
    setTitle('');
    setDescription('');
    setHunchType('new');
    setConfidence(3);
    setLinkUrl('');
    setLinkLabel('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="capture-type" className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Capture type
        </label>
        <select
          id="capture-type"
          value={captureType}
          onChange={e => setCaptureType(e.target.value as CaptureTypeId)}
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-node-hunch"
        >
          {getPageTypes().map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        {selectedConfig && (
          <p className="mt-1 text-xs text-gray-500">{selectedConfig.description}</p>
        )}
      </div>

      <div>
        <label htmlFor="title" className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="What's the hunch?"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Context, reasoning, source..."
          rows={4}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch resize-none"
        />
      </div>

      {selectedConfig?.fields.includes('hunch_type') && (
        <div className="flex-1">
          <label htmlFor="hunch-type" className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
            Hunch type
          </label>
          <select
            id="hunch-type"
            value={hunchType}
            onChange={e => setHunchType(e.target.value as HunchType)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-node-hunch"
          >
            {HUNCH_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      )}

      {selectedConfig?.fields.includes('confidence') && (
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
            Confidence
          </label>
          <div className="flex gap-1 pt-1">
            {CONFIDENCE_LEVELS.map(({ level, label }) => (
              <button
                key={level}
                type="button"
                onClick={() => setConfidence(level)}
                className={`flex-1 py-1.5 text-[10px] rounded-md transition-colors ${
                  level === confidence
                    ? 'bg-node-hunch text-white'
                    : 'bg-gray-800 text-gray-500 hover:bg-gray-750 hover:text-gray-400'
                }`}
                aria-label={`Confidence: ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedConfig?.fields.includes('external_link') && (
        <details className="group">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
            + Add external link
          </summary>
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch"
            />
            <input
              type="text"
              value={linkLabel}
              onChange={e => setLinkLabel(e.target.value)}
              placeholder="Label"
              className="w-32 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch"
            />
          </div>
        </details>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-node-assumption-bg text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting...' : 'Submit for Processing'}
      </button>
    </form>
  );
}
