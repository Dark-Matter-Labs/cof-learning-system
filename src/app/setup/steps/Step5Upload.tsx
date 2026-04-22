'use client';

import { useState } from 'react';
import { FileCaptureMode } from '@/components/capture/FileCaptureMode';

interface Props {
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step5Upload({ onNext, onBack }: Props) {
  const [uploadedCount, setUploadedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (file: File | null) => {
    setSelectedFile(file);
    if (!file) return;
    setIsSubmitting(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!uploadRes.ok) {
        setUploadError('Upload failed. Please try again.');
        return;
      }
      const { data: attachment } = await uploadRes.json();

      await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: file.name, node_type: 'hunch', attachment }),
      });
      setUploadedCount(prev => prev + 1);
      setSelectedFile(null);
    } catch {
      setUploadError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Upload existing documents</h1>
        <p className="text-sm text-gray-500 mt-2">Drop in papers, strategy docs, or notes. The system will extract what matters.</p>
      </div>

      <FileCaptureMode
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
        isUploading={isSubmitting}
        uploadError={uploadError}
      />

      {uploadedCount > 0 && (
        <p className="text-sm text-gray-500">{uploadedCount} {uploadedCount === 1 ? 'document' : 'documents'} queued for processing.</p>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button
          onClick={onNext}
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90"
        >
          {uploadedCount > 0 ? 'Continue →' : 'Skip →'}
        </button>
      </div>
    </div>
  );
}
