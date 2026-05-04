'use client';

import { useState } from 'react';

const STAGES = [
  {
    letter: 'H',
    name: 'Hypothesis',
    definition: 'Emergent intuition about a future risk, value field, or option.',
  },
  {
    letter: 'U',
    name: 'Uncertainty',
    definition: "What's unknown, testable, reducible. The map of the question, not the answer.",
  },
  {
    letter: 'N',
    name: 'Navigation',
    definition: 'Active inquiry. Tests, prototypes, signals. The pathway being walked.',
  },
  {
    letter: 'C',
    name: 'Coherence',
    definition: 'Integration into a credible field of value, legitimacy, governance, capital.',
  },
  {
    letter: 'H',
    name: 'Holding',
    definition: 'Disciplined institutional capacity to keep learning alive. Live capability.',
  },
] as const;

interface HunchExplainerProps {
  readonly trigger?: React.ReactNode;
}

export function HunchExplainer({ trigger }: HunchExplainerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-cof-text-tertiary hover:text-cof-text-secondary transition-colors"
        aria-label="What is HUNCH?"
      >
        {trigger ?? '?'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-cof-bg-elevated border border-cof-border rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-cof-text-primary tracking-widest">HUNCH</h2>
                <p className="text-[11px] text-cof-text-tertiary mt-0.5 italic">
                  Hypothesis under uncertainty, navigated into coherence and held through learning.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-cof-text-tertiary hover:text-cof-text-secondary text-lg ml-4"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {STAGES.map(stage => (
                <div key={stage.name} className="flex gap-3">
                  <span className="text-xs font-bold text-node-hunch w-4 flex-shrink-0 pt-0.5">
                    {stage.letter}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-cof-text-primary">{stage.name}</span>
                    <p className="text-[11px] text-cof-text-tertiary mt-0.5 leading-relaxed">
                      {stage.definition}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
