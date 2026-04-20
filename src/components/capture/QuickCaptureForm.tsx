'use client';

import { useState, type FormEvent } from 'react';
import { PersonAutocomplete, type PersonOption } from './PersonAutocomplete';

export interface CaptureFormData {
  readonly title: string;
  readonly description: string;
  readonly date?: string;
  readonly participant_ids?: readonly string[];
  readonly external_link_url?: string;
  readonly external_link_label?: string;
}

export type EntryMode = 'thought' | 'call' | null;

interface QuickCaptureFormProps {
  readonly onSubmit: (data: CaptureFormData) => void;
  readonly isSubmitting?: boolean;
  readonly entryMode?: EntryMode;
}

export function QuickCaptureForm({ onSubmit, isSubmitting = false, entryMode = null }: QuickCaptureFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedPeople, setSelectedPeople] = useState<ReadonlyArray<PersonOption>>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');

  const canSubmit = title.trim().length > 0 && !isSubmitting;

  const descriptionRows = entryMode === 'call' ? 10 : 5;
  const descriptionPlaceholder = entryMode === 'call'
    ? 'Paste the transcript or meeting notes here...'
    : 'Paste a transcript, drop some notes, or write a thought.';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      date: date || undefined,
      participant_ids: selectedPeople.length > 0 ? selectedPeople.map(p => p.id) : undefined,
      ...(linkUrl.trim() ? { external_link_url: linkUrl.trim(), external_link_label: linkLabel.trim() || linkUrl.trim() } : {}),
    });

    setTitle('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setSelectedPeople([]);
    setLinkUrl('');
    setLinkLabel('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="What's on your mind?"
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
          placeholder={descriptionPlaceholder}
          rows={descriptionRows}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch resize-none"
        />
      </div>

      <div>
        <label htmlFor="capture-date" className="block text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
          When did this happen?
        </label>
        <input
          id="capture-date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-node-hunch"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
          People involved
        </label>
        <PersonAutocomplete
          selectedPeople={selectedPeople}
          onChange={setSelectedPeople}
        />
      </div>

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

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-node-assumption-bg text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Capturing...' : 'Capture'}
      </button>
    </form>
  );
}
