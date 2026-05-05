'use client';

import { useState, useEffect, useCallback } from 'react';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';

type NewsletterType = 'mission_pathways' | 'close_contacts';

interface Newsletter {
  readonly id: string;
  readonly type: NewsletterType;
  readonly content: string;
  readonly created_at: string;
}

const TAB_LABELS: Record<NewsletterType, string> = {
  mission_pathways: 'Mission Pathways',
  close_contacts: 'Close Contacts',
};

export function NewsletterTabs() {
  const [activeTab, setActiveTab] = useState<NewsletterType>('mission_pathways');
  const [generating, setGenerating] = useState(false);
  const [currentOutput, setCurrentOutput] = useState<string | null>(null);
  const [history, setHistory] = useState<Newsletter[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const loadHistory = useCallback(async (type: NewsletterType) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const res = await fetch(`/api/newsletters?type=${type}`);
      const body = await res.json() as { data?: Newsletter[]; error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Failed to load history');
        return;
      }
      setHistory(body.data ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    setCurrentOutput(null);
    setExpandedId(null);
    setCurrentId(null);
    void loadHistory(activeTab);
  }, [activeTab, loadHistory]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/newsletters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeTab }),
      });
      const body = await res.json() as { data?: Newsletter; error?: string };
      if (!res.ok || !body.data) {
        setError(body.error ?? 'Failed to generate newsletter');
        return;
      }
      setCurrentOutput(body.data.content);
      setCurrentId(body.data.id);
      setHistory(prev => [body.data!, ...prev]);
    } catch {
      setError('Network error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="flex gap-4 mb-6 border-b border-cof-border">
        {(['mission_pathways', 'close_contacts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-node-hunch border-b-2 border-node-hunch'
                : 'text-cof-text-tertiary hover:text-cof-text-secondary'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <button
        onClick={() => void handleGenerate()}
        disabled={generating}
        className="mb-6 px-4 py-2 text-sm bg-node-hunch text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {generating ? 'Generating...' : `Generate ${TAB_LABELS[activeTab]} brief`}
      </button>

      {error && (
        <p className="mb-4 text-sm text-red-400">{error}</p>
      )}

      {currentOutput && (
        <div className="mb-8">
          <p className="text-xs text-cof-text-tertiary mb-2">Just generated — select all and copy</p>
          <textarea
            readOnly
            value={currentOutput}
            rows={16}
            className="w-full font-mono text-sm bg-cof-bg-elevated border border-cof-border rounded-md p-4 text-cof-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-node-hunch"
          />
          {currentId && (
            <FeedbackWidget sourceType="newsletter" sourceId={currentId} />
          )}
        </div>
      )}

      <div>
        <h2 className="text-xs text-cof-text-tertiary uppercase tracking-widest mb-3">History</h2>
        {loadingHistory ? (
          <p className="text-sm text-cof-text-tertiary">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-cof-text-tertiary">No newsletters generated yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map(item => (
              <div key={item.id} className="border border-cof-border rounded-md overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full flex items-start justify-between gap-4 px-4 py-3 text-left hover:bg-cof-bg-elevated transition-colors"
                >
                  <span className="text-xs text-cof-text-tertiary shrink-0">
                    {new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-sm text-cof-text-secondary truncate flex-1">
                    {item.content.slice(0, 80)}…
                  </span>
                  <span className="text-xs text-cof-text-tertiary shrink-0">
                    {expandedId === item.id ? '▲' : '▼'}
                  </span>
                </button>
                {expandedId === item.id && (
                  <div className="px-4 pb-4 border-t border-cof-border">
                    <textarea
                      readOnly
                      value={item.content}
                      rows={16}
                      className="w-full mt-3 font-mono text-sm bg-cof-bg-elevated border border-cof-border rounded-md p-4 text-cof-text-primary resize-none focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
