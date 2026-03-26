'use client';

import { useState } from 'react';
import type { TensionAlert, TensionResolutionAction } from '@/lib/types/tension';

interface TensionAlertItemProps {
  readonly alert: TensionAlert;
  readonly onSelect: (alert: TensionAlert) => void;
  readonly onAcknowledge: (id: string) => void;
  readonly onResolve: (id: string, action: TensionResolutionAction, belief: string) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  high:   'bg-red-950/60 border border-red-900/50',
  medium: 'bg-amber-950/60 border border-amber-900/50',
  low:    'bg-gray-900 border border-gray-800',
};

const SEVERITY_ICON: Record<string, string> = {
  high:   '⚠',
  medium: '⚠',
  low:    '·',
};

const SEVERITY_TEXT: Record<string, string> = {
  high:   'text-red-400',
  medium: 'text-amber-400',
  low:    'text-gray-500',
};

const TYPE_LABELS: Record<string, string> = {
  assumption_challenged:  'Assumption challenged',
  test_diverged:          'Test diverged',
  signal_contradicts:     'Signal contradicts',
  commitment_stalled:     'Commitment stalled',
  assumption_unsupported: 'Assumption unsupported',
};

export function TensionAlertItem({ alert, onSelect, onAcknowledge, onResolve }: TensionAlertItemProps) {
  const [showModal, setShowModal] = useState(false);
  const [belief, setBelief] = useState('');
  const [action, setAction] = useState<TensionResolutionAction>('no_action');

  const handleResolve = () => {
    onResolve(alert.id, action, belief);
    setShowModal(false);
    setBelief('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(alert)}
        className={[
          'w-full text-left rounded-md p-2.5 mb-2',
          SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low,
        ].join(' ')}
      >
        <div className="flex items-start gap-1.5 mb-1">
          <span className={`text-sm ${SEVERITY_TEXT[alert.severity]}`}>
            {SEVERITY_ICON[alert.severity]}
          </span>
          <span className={`text-[10px] font-semibold ${SEVERITY_TEXT[alert.severity]} uppercase tracking-wide`}>
            {TYPE_LABELS[alert.type] ?? alert.type}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3">
          {alert.description}
        </p>
        <div
          className="mt-2 flex gap-2"
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onAcknowledge(alert.id)}
            className="text-[10px] text-gray-500 hover:text-gray-300 underline"
          >
            Acknowledge
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-[10px] text-gray-500 hover:text-gray-300 underline"
          >
            Resolve
          </button>
        </div>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 w-[360px] shadow-xl">
            <h3 className="text-sm font-bold text-gray-200 mb-1">Resolve tension</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">{alert.description}</p>

            <div className="mb-4">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                What do you now believe?
              </label>
              <textarea
                value={belief}
                onChange={e => setBelief(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded p-2 h-20 resize-none focus:outline-none focus:border-gray-600"
                placeholder="Describe your updated understanding…"
              />
            </div>

            <div className="mb-4">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-2">Action</label>
              <div className="space-y-1.5">
                {([
                  ['revise_assumption', 'Revise assumption'],
                  ['revise_commitment', 'Revise commitment'],
                  ['create_test',       'Create new test'],
                  ['no_action',         'No action needed'],
                ] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="resolution-action"
                      value={val}
                      checked={action === val}
                      onChange={() => setAction(val)}
                      className="accent-blue-500"
                    />
                    <span className="text-xs text-gray-400">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolve}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
