'use client';

import { useState, useEffect } from 'react';
import { Step1Workspace } from './steps/Step1Workspace';
import { Step2Team } from './steps/Step2Team';
import { Step3Goals } from './steps/Step3Goals';
import { Step4Sites } from './steps/Step4Sites';
import { Step5SeedKnowledge } from './steps/Step5SeedKnowledge';
import { Step6Complete } from './steps/Step6Complete';

const TOTAL_STEPS = 6;

export function SetupWizardClient() {
  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState<ReadonlyArray<{ id: string; title: string }>>([]);

  useEffect(() => {
    const saved = localStorage.getItem('setup_step');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 1 && parsed <= TOTAL_STEPS) setStep(parsed);
    }
  }, []);

  const advance = (nextStep: number) => {
    setStep(nextStep);
    localStorage.setItem('setup_step', String(nextStep));
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
      <div
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        className="h-0.5 bg-gray-100 dark:bg-gray-800"
      >
        <div
          className="h-full bg-node-hunch transition-all duration-300"
          style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          {step === 1 && <Step1Workspace onNext={() => advance(2)} />}
          {step === 2 && <Step2Team onNext={() => advance(3)} onBack={() => advance(1)} />}
          {step === 3 && (
            <Step3Goals
              onNext={(createdGoals) => { setGoals(createdGoals); advance(4); }}
              onBack={() => advance(2)}
            />
          )}
          {step === 4 && (
            <Step4Sites
              goals={goals}
              onNext={() => advance(5)}
              onBack={() => advance(3)}
              onSkip={() => advance(5)}
            />
          )}
          {step === 5 && (
            <Step5SeedKnowledge
              goals={goals}
              onNext={() => advance(6)}
              onBack={() => advance(4)}
            />
          )}
          {step === 6 && <Step6Complete />}
        </div>
      </div>
    </div>
  );
}
