'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Node } from '@/lib/types/nodes';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfidenceIndicator } from '@/components/shared/ConfidenceIndicator';
import Link from 'next/link';

export default function HunchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [node, setNode] = useState<Node | null>(null);
  const [processingTooLong, setProcessingTooLong] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchNode = async () => {
      const { data } = await supabase
        .from('nodes')
        .select('*')
        .eq('id', params.id)
        .single();
      if (data) setNode(data as unknown as Node);
    };
    fetchNode();

    // Subscribe to updates for this node
    const channel = supabase
      .channel(`node-${params.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'nodes',
        filter: `id=eq.${params.id}`,
      }, (payload) => {
        setNode(payload.new as unknown as Node);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  useEffect(() => {
    if (node?.status !== 'processing') { setProcessingTooLong(false); return; }
    const timer = setTimeout(() => setProcessingTooLong(true), 30000);
    return () => clearTimeout(timer);
  }, [node?.status]);

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      const response = await fetch('/api/capture/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: params.id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        setRetryError(body.error ?? `Server error (${response.status})`);
      } else {
        const supabase = createClient();
        const { data } = await supabase.from('nodes').select('*').eq('id', params.id).single();
        if (data) setNode(data as unknown as Node);
      }
    } catch {
      setRetryError('Network error — check your connection');
    } finally {
      setRetrying(false);
    }
  };

  if (!node) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-48" />
          <div className="h-24 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-gray-200">{node.title}</h1>
          {node.description && (
            <p className="mt-1 text-sm text-gray-500">{node.description}</p>
          )}
        </div>
        <StatusBadge status={node.status} />
      </div>

      <div className="flex items-center gap-4 mb-6">
        <ConfidenceIndicator level={node.confidence_level} />
        <span className="text-xs text-gray-600">
          {new Date(node.created_at).toLocaleDateString()}
        </span>
      </div>

      {node.status === 'raw' && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-500 mb-3">This capture hasn&apos;t been processed yet.</p>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#185FA5] text-white rounded-md disabled:opacity-50"
          >
            {retrying ? 'Processing…' : 'Process with AI'}
          </button>
          {retryError && <p className="mt-2 text-xs text-red-400">{retryError}</p>}
        </div>
      )}

      {node.status === 'processing' && (
        <div className="bg-node-option/10 border border-node-option/30 rounded-lg p-4 text-center">
          <p className="text-sm text-node-option">{retrying ? 'Retrying…' : 'Processing with AI...'}</p>
          <div className="mt-2 w-full bg-gray-800 rounded-full h-1">
            <div className="bg-node-option h-1 rounded-full animate-pulse w-2/3" />
          </div>
          {retryError && <p className="mt-2 text-xs text-red-400">{retryError}</p>}
          {(processingTooLong || retryError) && !retrying && (
            <button
              onClick={handleRetry}
              className="mt-3 text-xs text-node-option underline hover:no-underline disabled:opacity-50"
            >
              {retryError ? 'Try again' : 'Taking longer than expected — retry'}
            </button>
          )}
        </div>
      )}

      {node.status === 'error' && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-400">Processing failed</p>
          {retryError && <p className="text-xs text-red-500 mt-1">{retryError}</p>}
          {node.llm_extraction && typeof node.llm_extraction === 'object' && 'error' in node.llm_extraction && (
            <p className="text-xs text-red-500 mt-1">{String((node.llm_extraction as Record<string, unknown>).error)}</p>
          )}
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="mt-3 bg-red-600 text-white text-sm px-4 py-1.5 rounded hover:bg-red-500 disabled:opacity-50"
          >
            {retrying ? 'Retrying…' : 'Retry Processing'}
          </button>
        </div>
      )}

      {node.status === 'llm_reviewed' && (
        <Link
          href={`/capture/${node.id}/review`}
          className="block bg-node-assumption-bg text-white text-center rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Review AI Extraction
        </Link>
      )}
    </div>
  );
}
