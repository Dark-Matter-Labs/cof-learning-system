'use client';

import { useState, useCallback } from 'react';
import type { Node, LlmExtraction, HumanReview } from '@/lib/types/nodes';
import { ExtractionField } from './ExtractionField';
import { ConfidenceSlider } from './ConfidenceSlider';
import { DomainTagEditor } from './DomainTagEditor';
import { ConnectionSuggestion } from './ConnectionSuggestion';
import { GoalRelevanceField } from './GoalRelevanceField';

interface ReviewCardProps {
  readonly node: Node;
  readonly onPromote: (review: HumanReview) => void;
  readonly onSaveDraft: (review: HumanReview) => void;
  readonly onArchive: () => void;
  readonly isSubmitting?: boolean;
  readonly triggerOutcomes?: ReadonlyArray<{ readonly id: string; readonly title: string }>;
}

type FieldAction = 'accepted' | 'rejected' | 'edited';

interface FieldState {
  readonly action: FieldAction;
  readonly original: unknown;
  readonly final: unknown;
}

export function ReviewCard({ node, onPromote, onSaveDraft, onArchive, isSubmitting = false, triggerOutcomes = [] }: ReviewCardProps) {
  const extraction = node.llm_extraction;

  const [fields, setFields] = useState<Record<string, FieldState>>({});
  const [confidence, setConfidence] = useState<number>(extraction?.confidence_assessment?.level ?? 3);
  const [domainTags, setDomainTags] = useState<readonly string[]>(extraction?.domain_tags ?? []);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<number, 'accepted' | 'rejected'>>({});
  const [goalRelevanceActions, setGoalRelevanceActions] = useState<Record<string, { action: FieldAction; final: unknown }>>({});

  if (!extraction) return null;

  const handleFieldAction = useCallback((fieldName: string, action: FieldAction, finalValue: unknown, originalValue: unknown) => {
    setFields(prev => ({
      ...prev,
      [fieldName]: { action, original: originalValue, final: finalValue },
    }));
  }, []);

  const handleConnectionAction = useCallback((index: number, status: 'accepted' | 'rejected') => {
    setConnectionStatuses(prev => ({ ...prev, [index]: status }));
  }, []);

  const handleGoalRelevanceAction = useCallback(
    (outcomeId: string, action: FieldAction, finalOutcomeId: string) => {
      setGoalRelevanceActions(prev => ({ ...prev, [outcomeId]: { action, final: finalOutcomeId } }));
    },
    []
  );

  const buildReview = (): HumanReview => {
    const goalRelevanceFields: Record<string, FieldState> = {};
    for (const [outcomeId, state] of Object.entries(goalRelevanceActions)) {
      if (state.action === 'accepted' || state.action === 'edited') {
        goalRelevanceFields[`goal_relevance_${outcomeId}`] = {
          action: state.action,
          original: outcomeId,
          final: state.final,
        };
      }
    }

    return {
      reviewed_at: new Date().toISOString(),
      reviewer_id: node.author_id ?? '',
      fields: {
        ...fields,
        ...goalRelevanceFields,
        confidence: { action: confidence !== extraction.confidence_assessment?.level ? 'edited' : 'accepted', original: extraction.confidence_assessment?.level, final: confidence },
        domain_tags: { action: JSON.stringify(domainTags) !== JSON.stringify(extraction.domain_tags) ? 'edited' : 'accepted', original: extraction.domain_tags, final: domainTags },
      },
      connections_accepted: (extraction.suggested_connections ?? [])
        .filter((_, i) => connectionStatuses[i] === 'accepted')
        .map(c => ({ target_node_id: '', target_title: c.target_title, edge_type: c.edge_type })),
      connections_rejected: (extraction.suggested_connections ?? [])
        .filter((_, i) => connectionStatuses[i] === 'rejected')
        .map(c => c.target_title),
      connections_added: [],
    };
  };

  return (
    <div className="flex gap-6">
      {/* Left: extraction fields */}
      <div className="flex-1 space-y-3">
        <ExtractionField
          label="Title"
          value={extraction.title}
          currentAction={fields.title?.action}
          onAction={(action, value) => handleFieldAction('title', action, value, extraction.title)}
        />
        <ExtractionField
          label="Summary"
          value={extraction.summary}
          currentAction={fields.summary?.action}
          onAction={(action, value) => handleFieldAction('summary', action, value, extraction.summary)}
        />
        {extraction.structured_claim && (
          <ExtractionField
            label="Structured Claim"
            value={`If ${extraction.structured_claim.if}, then ${extraction.structured_claim.then}, because ${extraction.structured_claim.because}`}
            currentAction={fields.structured_claim?.action}
            onAction={(action, value) => handleFieldAction('structured_claim', action, value, extraction.structured_claim)}
          />
        )}
        {extraction.assumption_type && (
          <ExtractionField
            label="Assumption Type"
            value={extraction.assumption_type === 'background' ? 'Background (contextual given)' : 'Foreground (testable proposition)'}
            currentAction={fields.assumption_type?.action}
            onAction={(action, value) => handleFieldAction('assumption_type', action, value, extraction.assumption_type)}
          />
        )}
        <ConfidenceSlider
          aiLevel={extraction.confidence_assessment?.level ?? 3}
          humanLevel={confidence}
          onChange={setConfidence}
        />
        <DomainTagEditor tags={domainTags} onChange={setDomainTags} />
        {extraction.expected_signals && extraction.expected_signals.length > 0 && (
          <ExtractionField
            label="Expected Signals"
            value={extraction.expected_signals.join(', ')}
            currentAction={fields.expected_signals?.action}
            onAction={(action, value) => handleFieldAction('expected_signals', action, value, extraction.expected_signals?.join(', '))}
          />
        )}
        {extraction.goal_relevance && extraction.goal_relevance.length > 0 && (
          <GoalRelevanceField
            suggestions={extraction.goal_relevance}
            triggerOutcomes={triggerOutcomes}
            currentActions={Object.fromEntries(
              Object.entries(goalRelevanceActions).map(([id, state]) => [id, { action: state.action, final: state.final }])
            )}
            onAction={handleGoalRelevanceAction}
          />
        )}
      </div>

      {/* Right: connections + actions */}
      <div className="w-80 space-y-4">
        <div>
          <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2">Suggested Connections</h3>
          <div className="space-y-2">
            {(extraction.suggested_connections ?? []).map((conn, i) => (
              <ConnectionSuggestion
                key={i}
                targetTitle={conn.target_title}
                edgeType={conn.edge_type}
                rationale={conn.rationale}
                status={connectionStatuses[i]}
                onAccept={() => handleConnectionAction(i, 'accepted')}
                onReject={() => handleConnectionAction(i, 'rejected')}
              />
            ))}
            {(extraction.suggested_connections ?? []).length === 0 && (
              <p className="text-xs text-gray-600">No connections suggested</p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-800 pt-4 space-y-2">
          <button
            onClick={() => onPromote(buildReview())}
            disabled={isSubmitting}
            className="w-full bg-node-assumption-bg text-white rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Promote to Graph
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onSaveDraft(buildReview())}
              disabled={isSubmitting}
              className="flex-1 text-node-option text-sm py-2 hover:underline disabled:opacity-40"
            >
              Save as Draft
            </button>
            <button
              onClick={onArchive}
              disabled={isSubmitting}
              className="flex-1 text-node-assumption-fg text-sm py-2 hover:underline disabled:opacity-40"
            >
              Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
