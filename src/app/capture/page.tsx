'use client';

import { QuickCaptureForm, type CaptureFormData, type EntryMode } from '@/components/capture/QuickCaptureForm';
import { HunchList } from '@/components/capture/HunchList';
import type { Node } from '@/lib/types/nodes';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function CapturePage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>(null);

  const fetchNodes = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('nodes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNodes(data as unknown as Node[]);
  };

  useEffect(() => {
    fetchNodes();

    const supabase = createClient();
    const channel = supabase
      .channel('nodes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, () => {
        fetchNodes();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async (formData: CaptureFormData) => {
    setIsSubmitting(true);
    try {
      const isCall = entryMode === 'call';
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title || undefined,
          description: formData.description,
          node_type: isCall ? 'meeting_notes' : undefined,
          content: isCall && formData.date
            ? { meeting_date: new Date(formData.date + 'T00:00:00').toISOString() }
            : undefined,
          insight_date: formData.date ? new Date(formData.date + 'T00:00:00').toISOString() : undefined,
          participant_ids: formData.participant_ids,
          external_link: formData.external_link_url
            ? { url: formData.external_link_url, label: formData.external_link_label ?? formData.external_link_url }
            : undefined,
          attachment: formData.attachment,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error((err as { error?: string }).error ?? 'Failed to capture');
      }

      await fetchNodes();
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-with-nav"><div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-cof-text-primary mb-2">Capture</h1>
      <p className="text-sm text-cof-text-secondary mb-6">Paste a transcript, drop a file, or write a thought.</p>

      {/* Quick-entry mode cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setEntryMode(entryMode === 'thought' ? null : 'thought')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            entryMode === 'thought'
              ? 'border-node-hunch bg-node-hunch/10'
              : 'border-cof-border hover:border-cof-border-strong bg-cof-bg-elevated'
          }`}
        >
          <div className="text-sm font-medium text-cof-text-primary mb-1">Quick thought</div>
          <div className="text-xs text-cof-text-secondary">Just a title and a few lines</div>
        </button>

        <button
          type="button"
          onClick={() => setEntryMode(entryMode === 'call' ? null : 'call')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            entryMode === 'call'
              ? 'border-node-hunch bg-node-hunch/10'
              : 'border-cof-border hover:border-cof-border-strong bg-cof-bg-elevated'
          }`}
        >
          <div className="text-sm font-medium text-cof-text-primary mb-1">Paste a call</div>
          <div className="text-xs text-cof-text-secondary">Transcript or meeting notes</div>
        </button>

        <button
          type="button"
          onClick={() => setEntryMode(entryMode === 'file' ? null : 'file')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            entryMode === 'file'
              ? 'border-node-hunch bg-node-hunch/10'
              : 'border-cof-border hover:border-cof-border-strong bg-cof-bg-elevated'
          }`}
        >
          <div className="text-sm font-medium text-cof-text-primary mb-1">Upload a file</div>
          <div className="text-xs text-cof-text-secondary">PDF · DOCX · TXT</div>
        </button>
      </div>

      <QuickCaptureForm key={entryMode ?? 'none'} onSubmit={handleSubmit} isSubmitting={isSubmitting} entryMode={entryMode} />

      <div className="mt-10">
        <h2 className="text-sm font-medium text-cof-text-tertiary uppercase tracking-wide mb-4">Recent Captures</h2>
        <HunchList nodes={nodes} />
      </div>
    </div></div>
  );
}
