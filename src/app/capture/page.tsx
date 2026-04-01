'use client';

import { QuickCaptureForm, type CaptureFormData } from '@/components/capture/QuickCaptureForm';
import { HunchList } from '@/components/capture/HunchList';
import type { Node } from '@/lib/types/nodes';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function CapturePage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchNodes = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('nodes')
      .select('*')
      .eq('node_type', 'hunch')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNodes(data as unknown as Node[]);
  };

  useEffect(() => {
    fetchNodes();

    // Subscribe to realtime changes
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
      const content: Record<string, unknown> = {};
      if (formData.meeting_date) content.meeting_date = formData.meeting_date;
      if (formData.participants) {
        content.participants = formData.participants.split(',').map(s => s.trim()).filter(Boolean);
      }

      const insightDate = formData.insight_date
        ? new Date(formData.insight_date + 'T00:00:00').toISOString()
        : undefined;
      const meetingAsInsight = formData.meeting_date
        ? new Date(formData.meeting_date + 'T00:00:00').toISOString()
        : undefined;

      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          node_type: formData.node_type,
          hunch_type: formData.hunch_type,
          confidence_level: formData.confidence_level,
          external_link: formData.external_link_url
            ? { url: formData.external_link_url, label: formData.external_link_label }
            : undefined,
          content: Object.keys(content).length > 0 ? content : undefined,
          insight_date: insightDate ?? meetingAsInsight,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Failed to capture hunch');
      }

      await fetchNodes();
    } catch (error) {
      console.error('Capture failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-with-nav"><div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-6">Capture</h1>
      <QuickCaptureForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      <div className="mt-10">
        <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-4">Recent Hunches</h2>
        <HunchList nodes={nodes} />
      </div></div>
    </div>
  );
}
