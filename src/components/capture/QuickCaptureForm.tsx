'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { PersonAutocomplete, type PersonOption } from './PersonAutocomplete';
import { FileCaptureMode } from './FileCaptureMode';
import type { Attachment } from '@/lib/types/nodes';

export interface CaptureFormData {
  readonly title: string;
  readonly description: string;
  readonly date?: string;
  readonly participant_ids?: readonly string[];
  readonly external_link_url?: string;
  readonly external_link_label?: string;
  readonly attachment?: Attachment;
}

export type EntryMode = 'thought' | 'call' | 'file' | null;

type SubmitPhase = 'idle' | 'capturing' | 'captured';

interface QuickCaptureFormProps {
  readonly onSubmit: (data: CaptureFormData) => Promise<void> | void;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('idle');

  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFileMode = entryMode === 'file';
  const isBusy = submitPhase !== 'idle' || isSubmitting;
  const canSubmit = isFileMode
    ? selectedFile !== null && !isUploading && !isBusy
    : title.trim().length > 0 && !isBusy;

  const descriptionRows = entryMode === 'call' ? 10 : 5;
  const descriptionPlaceholder = entryMode === 'call'
    ? 'Paste the transcript or meeting notes here...'
    : 'Paste a transcript, drop some notes, or write a thought.';

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setUploadError(null);
  };

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (isFileMode && selectedFile) {
      setIsUploading(true);
      setUploadError(null);
      try {
        const fd = new FormData();
        fd.append('file', selectedFile);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          throw new Error(err.error ?? 'Upload failed');
        }
        const attachment = await res.json() as Attachment;
        setIsUploading(false);
        try {
          await onSubmit({
            title: '',
            description: '',
            date: date || undefined,
            participant_ids: selectedPeople.length > 0 ? selectedPeople.map(p => p.id) : undefined,
            attachment,
          });
          setSelectedFile(null);
          setDate(new Date().toISOString().slice(0, 10));
          setSelectedPeople([]);
        } catch (captureErr) {
          setUploadError(captureErr instanceof Error ? captureErr.message : 'Capture failed — try again');
        }
      } catch (err) {
        setIsUploading(false);
        setUploadError(err instanceof Error ? err.message : 'Upload failed — try again');
      }
      return;
    }

    setSubmitPhase('capturing');
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        date: date || undefined,
        participant_ids: selectedPeople.length > 0 ? selectedPeople.map(p => p.id) : undefined,
        ...(linkUrl.trim() ? { external_link_url: linkUrl.trim(), external_link_label: linkLabel.trim() || linkUrl.trim() } : {}),
      });

      setSubmitPhase('captured');
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
      submitTimerRef.current = setTimeout(() => {
        setSubmitPhase('idle');
        setTitle('');
        setDescription('');
        setDate(new Date().toISOString().slice(0, 10));
        setSelectedPeople([]);
        setLinkUrl('');
        setLinkLabel('');
      }, 1000);
    } catch {
      setSubmitPhase('idle');
    }
  };

  const fileModeSubmitLabel = isUploading ? 'Uploading…' : isSubmitting ? 'Capturing…' : 'Upload & capture';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isFileMode ? (
        <FileCaptureMode
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          isUploading={isUploading}
          uploadError={uploadError}
        />
      ) : (
        <>
          <div>
            <label htmlFor="title" className="block text-xs text-cof-text-tertiary uppercase tracking-wide mb-1">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full bg-cof-bg-elevated border border-cof-border rounded-lg px-3 py-2 text-sm text-cof-text-primary placeholder:text-cof-text-tertiary focus:outline-none focus:border-node-hunch focus:ring-1 focus:ring-node-hunch/20 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-xs text-cof-text-tertiary uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={descriptionPlaceholder}
              rows={descriptionRows}
              className="w-full bg-cof-bg-elevated border border-cof-border rounded-lg px-3 py-2 text-sm text-cof-text-primary placeholder:text-cof-text-tertiary focus:outline-none focus:border-node-hunch focus:ring-1 focus:ring-node-hunch/20 resize-none transition-colors"
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor="capture-date" className="block text-xs text-cof-text-tertiary uppercase tracking-wide mb-1">
          When did this happen?
        </label>
        <input
          id="capture-date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-cof-bg-elevated border border-cof-border rounded-lg px-3 py-2 text-sm text-cof-text-primary focus:outline-none focus:border-node-hunch focus:ring-1 focus:ring-node-hunch/20 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs text-cof-text-tertiary uppercase tracking-wide mb-1">
          People involved
        </label>
        <PersonAutocomplete
          selectedPeople={selectedPeople}
          onChange={setSelectedPeople}
        />
      </div>

      {!isFileMode && (
        <details className="group">
          <summary className="text-xs text-cof-text-tertiary cursor-pointer hover:text-cof-text-secondary transition-colors">
            + Add external link
          </summary>
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 bg-cof-bg-elevated border border-cof-border rounded-lg px-3 py-1.5 text-sm text-cof-text-primary placeholder:text-cof-text-tertiary focus:outline-none focus:border-node-hunch focus:ring-1 focus:ring-node-hunch/20 transition-colors"
            />
            <input
              type="text"
              value={linkLabel}
              onChange={e => setLinkLabel(e.target.value)}
              placeholder="Label"
              className="w-32 bg-cof-bg-elevated border border-cof-border rounded-lg px-3 py-1.5 text-sm text-cof-text-primary placeholder:text-cof-text-tertiary focus:outline-none focus:border-node-hunch focus:ring-1 focus:ring-node-hunch/20 transition-colors"
            />
          </div>
        </details>
      )}

      {isFileMode ? (
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-node-assumption-bg text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {fileModeSubmitLabel}
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSubmit}
          className={`
            px-4 py-2 text-sm rounded-lg font-medium transition-all duration-200
            ${submitPhase === 'captured'
              ? 'bg-node-assumption-bg text-white'
              : 'bg-node-hunch text-white hover:opacity-90'
            }
            disabled:opacity-70
          `}
        >
          {submitPhase === 'idle' && 'Capture'}
          {submitPhase === 'capturing' && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/70 animate-pulse" />
              Capturing…
            </span>
          )}
          {submitPhase === 'captured' && '✓ Captured'}
        </button>
      )}
    </form>
  );
}
