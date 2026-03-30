'use client';

import { useState } from 'react';

interface Suggestion {
  readonly outcome_id: string;
  readonly outcome_title: string;
  readonly rationale: string;
}

interface TriggerOutcome {
  readonly id: string;
  readonly title: string;
}

interface ActionState {
  readonly action: 'accepted' | 'rejected' | 'edited';
  readonly final: unknown;
}

interface GoalRelevanceFieldProps {
  readonly suggestions: ReadonlyArray<Suggestion>;
  readonly triggerOutcomes: ReadonlyArray<TriggerOutcome>;
  readonly currentActions: Readonly<Record<string, ActionState>>;
  readonly onAction: (outcomeId: string, action: 'accepted' | 'rejected' | 'edited', finalOutcomeId: string) => void;
}

function SuggestionRow({
  suggestion,
  triggerOutcomes,
  currentAction,
  onAction,
}: {
  readonly suggestion: Suggestion;
  readonly triggerOutcomes: ReadonlyArray<TriggerOutcome>;
  readonly currentAction: ActionState | undefined;
  readonly onAction: (outcomeId: string, action: 'accepted' | 'rejected' | 'edited', finalOutcomeId: string) => void;
}) {
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);

  const action = currentAction?.action;

  const borderClass =
    action === 'accepted' ? 'border-teal-700/60' :
    action === 'rejected' ? 'border-red-900/60' :
    action === 'edited' ? 'border-blue-700/60' :
    'border-gray-800';

  return (
    <div className={`rounded-lg border p-2.5 bg-gray-900 ${borderClass}`}>
      <div className="text-xs font-semibold text-gray-200 mb-0.5">{suggestion.outcome_title}</div>
      <div className="text-[10px] text-gray-500 mb-2 leading-relaxed">{suggestion.rationale}</div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => {
            setShowLinkDropdown(false);
            onAction(suggestion.outcome_id, 'accepted', suggestion.outcome_id);
          }}
          className="text-[10px] text-teal-400 hover:text-teal-300 font-medium"
          aria-label={`Accept ${suggestion.outcome_title}`}
        >
          Accept
        </button>
        <button
          onClick={() => {
            setShowLinkDropdown(false);
            onAction(suggestion.outcome_id, 'rejected', suggestion.outcome_id);
          }}
          className="text-[10px] text-red-400 hover:text-red-300 font-medium"
          aria-label={`Reject ${suggestion.outcome_title}`}
        >
          Reject
        </button>
        <button
          onClick={() => setShowLinkDropdown(prev => !prev)}
          className="text-[10px] text-gray-500 hover:text-gray-400"
          aria-label={`Link to different outcome for ${suggestion.outcome_title}`}
        >
          Link to different outcome
        </button>
      </div>

      {showLinkDropdown && (
        <select
          className="mt-2 w-full bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded px-2 py-1"
          defaultValue=""
          onChange={e => {
            const selectedId = e.target.value;
            if (selectedId) {
              onAction(suggestion.outcome_id, 'edited', selectedId);
              setShowLinkDropdown(false);
            }
          }}
          aria-label="Select a different trigger outcome"
        >
          <option value="" disabled>Select outcome…</option>
          {triggerOutcomes.map(outcome => (
            <option key={outcome.id} value={outcome.id}>
              {outcome.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function GoalRelevanceField({
  suggestions,
  triggerOutcomes,
  currentActions,
  onAction,
}: GoalRelevanceFieldProps) {
  if (suggestions.length === 0) return null;

  return (
    <div>
      <h4 className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Goal Relevance</h4>
      <div className="space-y-2">
        {suggestions.map(suggestion => (
          <SuggestionRow
            key={suggestion.outcome_id}
            suggestion={suggestion}
            triggerOutcomes={triggerOutcomes}
            currentAction={currentActions[suggestion.outcome_id]}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}
