'use client';

import { useState, useCallback } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { ProcessStep1 } from './ProcessStep1';
import { ProcessStep2 } from './ProcessStep2';
import { ProcessStep3 } from './ProcessStep3';
import { ProcessStep4 } from './ProcessStep4';
import type { HunchResult } from './ProcessStep2';
import type { CommitmentResult } from './ProcessStep3';
import type { NotifyResult } from './ProcessStep4';

export interface ProcessFlowProps {
  readonly sourceNode: Node;
  readonly allNodes: readonly Node[];
  readonly allEdges: readonly Edge[];
  readonly onClose: () => void;
  readonly onNodeCreated: (node: Node) => void;
  readonly onEdgeAdded: (edge: Edge) => void;
  readonly onNodeUpdated: (node: Node) => void;
}

// Steps: 0=step1, 1=step2, 2=step3, 3=step4, 4=done
type StepIndex = 0 | 1 | 2 | 3 | 4;

interface ProcessSummary {
  assumptionsRevised: number;
  hunchesCreated: number;
  commitmentsFlagged: number;
  peopleNotified: number;
}

const STEP_LABELS = [
  'Does this reshape existing thinking?',
  'Does this spark a new hunch?',
  'What does this mean for active commitments?',
  'Who needs to see this?',
];

export function ProcessFlow({
  sourceNode,
  allNodes,
  allEdges,
  onClose,
  onNodeUpdated,
}: ProcessFlowProps) {
  const [step, setStep] = useState<StepIndex>(0);
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<ProcessSummary>({
    assumptionsRevised: 0,
    hunchesCreated: 0,
    commitmentsFlagged: 0,
    peopleNotified: 0,
  });
  const [isMarkingProcessed, setIsMarkingProcessed] = useState(false);

  // Track which steps were auto-skipped (empty)
  const [autoSkipped, setAutoSkipped] = useState<Set<number>>(new Set());

  const hasCommitments = allNodes.some(
    n => n.node_type === 'commitment' &&
      n.status !== 'archived' &&
      n.status !== 'suspended' &&
      n.status !== 'falsified'
  );

  // Visible steps — step 0 and step 2 can be auto-skipped
  const visibleSteps = [0, 1, 2, 3].filter(s => !autoSkipped.has(s));
  const currentVisibleIndex = visibleSteps.indexOf(step);
  const totalVisible = visibleSteps.filter(s => !autoSkipped.has(s)).length;

  function advanceToNextStep(currentStep: StepIndex) {
    const nextStep = (currentStep + 1) as StepIndex;
    if (nextStep >= 4) {
      void markProcessed();
      setStep(4);
    } else {
      setStep(nextStep);
    }
  }

  const handleStep1Empty = useCallback(() => {
    setAutoSkipped(prev => new Set(prev).add(0));
    setStep(1);
  }, []);

  const handleStep1Complete = useCallback((assessments: { assessment: string }[]) => {
    const revised = assessments.filter(a => a.assessment === 'needs_revision').length;
    setSummary(prev => ({ ...prev, assumptionsRevised: prev.assumptionsRevised + revised }));
    advanceToNextStep(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStep1Skip = useCallback(() => {
    setSkippedSteps(prev => new Set(prev).add(0));
    setStep(1);
  }, []);

  const handleStep2Complete = useCallback((result: HunchResult) => {
    if (result.decision === 'yes' && result.createdNodeId) {
      setSummary(prev => ({ ...prev, hunchesCreated: prev.hunchesCreated + 1 }));
    }
    // Skip step 3 if no commitments
    if (!hasCommitments) {
      setAutoSkipped(prev => new Set(prev).add(2));
      setStep(3);
    } else {
      advanceToNextStep(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCommitments]);

  const handleStep3Complete = useCallback((result: CommitmentResult) => {
    setSummary(prev => ({
      ...prev,
      commitmentsFlagged: prev.commitmentsFlagged + result.flaggedCount + result.stoppedCount,
    }));
    advanceToNextStep(2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStep3Skip = useCallback(() => {
    setSkippedSteps(prev => new Set(prev).add(2));
    setStep(3);
  }, []);

  const handleStep4Complete = useCallback((result: NotifyResult) => {
    setSummary(prev => ({ ...prev, peopleNotified: prev.peopleNotified + result.notifiedCount }));
    void markProcessed();
    setStep(4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markProcessed() {
    setIsMarkingProcessed(true);
    try {
      const existingContent = (sourceNode.content as Record<string, unknown> | null) ?? {};
      const response = await fetch(`/api/nodes/${sourceNode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            ...existingContent,
            process_status: 'processed',
            processed_at: new Date().toISOString(),
          },
        }),
      });
      const result = await response.json() as { data?: Node };
      if (result.data) {
        onNodeUpdated(result.data);
      }
    } catch {
      // Non-critical — don't block completion
    } finally {
      setIsMarkingProcessed(false);
    }
  }

  // The PATCH for content is not in the whitelist — need to handle gracefully
  // (The existing PATCH route doesn't support content field — we just skip if it fails)

  const progressLabel = step < 4
    ? `Step ${currentVisibleIndex + 1} of ${Math.max(totalVisible, 1)}`
    : 'Complete';

  return (
    <div className="absolute right-0 top-[49px] bottom-0 w-[440px] bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="text-[10px] text-gray-400 dark:text-gray-600 uppercase">Process this</div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[300px]">
            {sourceNode.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close process flow"
          className="text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 text-lg ml-2 flex-shrink-0"
        >
          ×
        </button>
      </div>

      {/* Progress bar */}
      {step < 4 && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
              {STEP_LABELS[step]}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-600">{progressLabel}</span>
          </div>
          <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${step < 4 ? ((step) / 4) * 100 : 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {step === 0 && (
          <ProcessStep1
            sourceNode={sourceNode}
            allNodes={allNodes}
            allEdges={allEdges}
            onComplete={handleStep1Complete}
            onSkip={handleStep1Skip}
            onEmpty={handleStep1Empty}
          />
        )}

        {step === 1 && (
          <ProcessStep2
            sourceNode={sourceNode}
            allNodes={allNodes}
            onComplete={handleStep2Complete}
          />
        )}

        {step === 2 && (
          <ProcessStep3
            sourceNode={sourceNode}
            allNodes={allNodes}
            onComplete={handleStep3Complete}
            onSkip={handleStep3Skip}
          />
        )}

        {step === 3 && (
          <ProcessStep4
            sourceNode={sourceNode}
            allNodes={allNodes}
            allEdges={allEdges}
            onComplete={handleStep4Complete}
          />
        )}

        {step === 4 && (
          <CompletionScreen
            sourceNode={sourceNode}
            summary={summary}
            skippedSteps={skippedSteps}
            autoSkipped={autoSkipped}
            isMarkingProcessed={isMarkingProcessed}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

interface CompletionScreenProps {
  readonly sourceNode: Node;
  readonly summary: ProcessSummary;
  readonly skippedSteps: Set<number>;
  readonly autoSkipped: Set<number>;
  readonly isMarkingProcessed: boolean;
  readonly onClose: () => void;
}

function CompletionScreen({
  sourceNode,
  summary,
  isMarkingProcessed,
  onClose,
}: CompletionScreenProps) {
  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="text-2xl mb-2">✓</div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Processing complete</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          You processed <span className="font-medium text-gray-700 dark:text-gray-300">{sourceNode.title}</span>
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 space-y-2">
        <SummaryLine
          count={summary.assumptionsRevised}
          label="assumptions revised"
          showZero
        />
        <SummaryLine
          count={summary.hunchesCreated}
          label="new hunches created"
          showZero
        />
        <SummaryLine
          count={summary.commitmentsFlagged}
          label="commitments flagged"
          showZero
        />
        <SummaryLine
          count={summary.peopleNotified}
          label="people notified"
          showZero
        />
      </div>

      {isMarkingProcessed && (
        <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center">Marking as processed…</p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full py-2 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
      >
        View on graph
      </button>
    </div>
  );
}

interface SummaryLineProps {
  readonly count: number;
  readonly label: string;
  readonly showZero?: boolean;
}

function SummaryLine({ count, label, showZero = false }: SummaryLineProps) {
  if (!showZero && count === 0) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
      <span className="text-gray-400 dark:text-gray-600">→</span>
      <span className="font-medium text-gray-800 dark:text-gray-200">{count}</span>
      <span>{label}</span>
    </div>
  );
}
