import { STEP_NAMES } from '@/lib/portfolio/agents';

interface Step {
  readonly step_number: number;
  readonly status: string;
}

interface StepNavigatorProps {
  readonly steps: readonly Step[];
  readonly activeStep: number;
  readonly onSelectStep: (stepNumber: number) => void;
}

function stepIcon(status: string): string {
  if (status === 'complete') return '✓';
  return '○';
}

export function StepNavigator({ steps, activeStep, onSelectStep }: StepNavigatorProps) {
  return (
    <div className="w-44 flex-shrink-0 border-r border-cof-border overflow-y-auto">
      <div className="p-3 space-y-0.5">
        {steps.map(step => {
          const isActive = step.step_number === activeStep;
          return (
            <button
              key={step.step_number}
              type="button"
              onClick={() => onSelectStep(step.step_number)}
              className={`w-full flex items-start gap-2 px-2 py-2 rounded text-left transition-colors text-[11px] ${
                isActive
                  ? 'bg-cof-bg-subtle text-cof-text-primary'
                  : 'hover:bg-cof-bg-subtle text-cof-text-tertiary'
              }`}
            >
              <span className={`flex-shrink-0 w-3 ${step.status === 'complete' ? 'text-emerald-500' : 'text-cof-text-tertiary'}`}>
                {isActive && step.status !== 'complete' ? '▶' : stepIcon(step.status)}
              </span>
              <span className={isActive ? 'text-cof-text-primary font-semibold' : ''}>
                {step.step_number}. {STEP_NAMES[step.step_number]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
