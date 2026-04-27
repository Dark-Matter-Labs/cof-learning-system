import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('../steps/Step1Workspace', () => ({
  Step1Workspace: ({ onNext }: { onNext: () => void }) =>
    React.createElement('button', { onClick: onNext, 'data-testid': 'step1-next' }, 'Step 1 Next'),
}));
vi.mock('../steps/Step2Team', () => ({
  Step2Team: ({ onNext }: { onNext: () => void }) =>
    React.createElement('button', { onClick: onNext, 'data-testid': 'step2-next' }, 'Step 2 Next'),
}));
vi.mock('../steps/Step3Goals', () => ({
  Step3Goals: ({ onNext }: { onNext: (goals: ReadonlyArray<{ id: string; title: string }>) => void }) =>
    React.createElement('button', { onClick: () => onNext([{ id: 'g-1', title: 'Goal 1' }]), 'data-testid': 'step3-next' }, 'Step 3 Next'),
}));
vi.mock('../steps/Step4Sites', () => ({
  Step4Sites: ({ onNext }: { onNext: () => void }) =>
    React.createElement('button', { onClick: onNext, 'data-testid': 'step4-next' }, 'Step 4 Next'),
}));
vi.mock('../steps/Step5SeedKnowledge', () => ({
  Step5SeedKnowledge: ({ onNext }: { onNext: () => void }) =>
    React.createElement('button', { onClick: onNext, 'data-testid': 'step5-next' }, 'Step 5 Next'),
}));
vi.mock('../steps/Step6Complete', () => ({
  Step6Complete: () => React.createElement('div', { 'data-testid': 'step6' }, 'Complete'),
}));

import { SetupWizardClient } from '../SetupWizardClient';

describe('SetupWizardClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts on step 1', () => {
    render(React.createElement(SetupWizardClient));
    expect(screen.getByTestId('step1-next')).toBeInTheDocument();
  });

  it('advances to step 2 when step 1 calls onNext', async () => {
    const user = userEvent.setup();
    render(React.createElement(SetupWizardClient));
    await user.click(screen.getByTestId('step1-next'));
    expect(screen.getByTestId('step2-next')).toBeInTheDocument();
  });

  it('shows progress bar', () => {
    render(React.createElement(SetupWizardClient));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('saves progress to localStorage on step advance', async () => {
    const user = userEvent.setup();
    render(React.createElement(SetupWizardClient));
    await user.click(screen.getByTestId('step1-next'));
    expect(localStorage.getItem('setup_step')).toBe('2');
  });

  it('resumes from saved localStorage step', () => {
    localStorage.setItem('setup_step', '3');
    render(React.createElement(SetupWizardClient));
    expect(screen.getByTestId('step3-next')).toBeInTheDocument();
  });
});
