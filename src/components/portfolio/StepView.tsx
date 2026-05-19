'use client';

import { useState } from 'react';
import { StepAIContent } from './StepAIContent';
import { STEP_AGENTS } from '@/lib/portfolio/agents';
import { Markdown } from '@/components/ui/Markdown';

interface Step {
  readonly id: string;
  readonly portfolio_id: string;
  readonly step_number: number;
  readonly step_name: string;
  readonly content: Record<string, unknown>;
  readonly ai_suggestions: { text: string; generated_at: string } | null;
  readonly human_input: string | null;
  readonly status: 'not_started' | 'ai_drafted' | 'in_review' | 'complete';
  readonly completed_at: string | null;
}

interface StepViewProps {
  readonly step: Step;
  readonly portfolioId: string;
  readonly onStepUpdated: (step: Step) => void;
}

export function StepView({ step, portfolioId, onStepUpdated }: StepViewProps) {
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const agent = STEP_AGENTS[step.step_number];
  const isImplemented = agent?.implemented ?? false;

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function handleGenerate() {
    if (!isImplemented) {
      showToast('This step is coming in a future update.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/steps/${step.step_number}/generate`, {
        method: 'POST',
      });
      const body = await res.json() as { data?: { content: string }; error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Generation failed');
        return;
      }
      const stepRes = await fetch(`/api/portfolios/${portfolioId}/steps/${step.step_number}`);
      const stepBody = await stepRes.json() as { data?: Step };
      if (stepBody.data) onStepUpdated(stepBody.data);
    } catch {
      setError('Network error — could not generate content');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const content = step.ai_suggestions?.text ?? editText;
      const res = await fetch(`/api/portfolios/${portfolioId}/steps/${step.step_number}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { text: content }, status: 'complete' }),
      });
      const body = await res.json() as { data?: Step; error?: string };
      if (!res.ok || !body.data) {
        setError(body.error ?? 'Failed to accept step');
        return;
      }
      onStepUpdated(body.data);
    } catch {
      setError('Network error');
    } finally {
      setAccepting(false);
    }
  }

  async function handleReopen() {
    const res = await fetch(`/api/portfolios/${portfolioId}/steps/${step.step_number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ai_drafted' }),
    });
    const body = await res.json() as { data?: Step };
    if (body.data) onStepUpdated(body.data);
  }

  async function handleSaveEdit() {
    const res = await fetch(`/api/portfolios/${portfolioId}/steps/${step.step_number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ human_input: editText, status: 'in_review' }),
    });
    const body = await res.json() as { data?: Step };
    if (body.data) onStepUpdated(body.data);
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {toastMsg && (
        <div className="mb-4 text-xs bg-cof-bg-subtle border border-cof-border rounded px-3 py-2 text-cof-text-secondary">
          {toastMsg}
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-cof-text-primary">
          Step {step.step_number} — {step.step_name}
        </h2>
        {agent?.implemented === false && (
          <p className="text-[11px] text-cof-text-tertiary mt-1">Coming in a future update.</p>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {step.status === 'not_started' && (
        <button
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="text-xs bg-cof-bg-subtle border border-cof-border rounded px-4 py-2 text-cof-text-secondary hover:text-cof-text-primary hover:border-cof-border-strong transition-colors disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate AI draft'}
        </button>
      )}

      {step.status === 'ai_drafted' && step.ai_suggestions && (
        <>
          <StepAIContent agentName={agent?.name ?? 'AI'} content={step.ai_suggestions.text} />
          <div className="flex gap-2">
            <button
              onClick={() => { setEditText(step.ai_suggestions?.text ?? ''); onStepUpdated({ ...step, status: 'in_review' }); }}
              className="text-xs border border-cof-border rounded px-3 py-1.5 text-cof-text-secondary hover:border-cof-border-strong transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => void handleAccept()}
              disabled={accepting}
              className="text-xs bg-node-learning/10 border border-node-learning/30 rounded px-3 py-1.5 text-node-learning hover:bg-node-learning/20 transition-colors disabled:opacity-50"
            >
              {accepting ? 'Saving…' : 'Accept →'}
            </button>
          </div>
        </>
      )}

      {step.status === 'in_review' && (
        <>
          <textarea
            value={editText || step.human_input || step.ai_suggestions?.text || ''}
            onChange={e => setEditText(e.target.value)}
            className="w-full h-48 text-xs bg-cof-bg-subtle border border-cof-border rounded p-3 text-cof-text-primary resize-none focus:outline-none focus:border-cof-border-strong mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void handleSaveEdit()}
              className="text-xs border border-cof-border rounded px-3 py-1.5 text-cof-text-secondary hover:border-cof-border-strong transition-colors"
            >
              Save draft
            </button>
            <button
              onClick={() => void handleAccept()}
              disabled={accepting}
              className="text-xs bg-node-learning/10 border border-node-learning/30 rounded px-3 py-1.5 text-node-learning hover:bg-node-learning/20 transition-colors disabled:opacity-50"
            >
              {accepting ? 'Saving…' : 'Accept →'}
            </button>
          </div>
        </>
      )}

      {step.status === 'complete' && (
        <>
          <div className="bg-cof-bg-subtle rounded-lg p-4 mb-4">
            <Markdown>
              {typeof step.content.text === 'string' ? step.content.text : step.ai_suggestions?.text ?? ''}
            </Markdown>
          </div>
          <button
            onClick={() => void handleReopen()}
            className="text-[11px] text-cof-text-tertiary hover:text-cof-text-secondary transition-colors"
          >
            Re-open
          </button>
        </>
      )}
    </div>
  );
}
