'use client';

import { getWizardProgressLabel, getWizardProgressPercent, type WizardStepDefinition } from '@hellowhen/shared';

type WizardProgressProps<TStepId extends string> = {
  steps: readonly WizardStepDefinition<TStepId>[];
  activeStepId: TStepId;
  label?: string;
  stepLabel?: string;
  ofLabel?: string;
};

export function WizardProgress<TStepId extends string>({ steps, activeStepId, label, stepLabel, ofLabel }: WizardProgressProps<TStepId>) {
  const progressPercent = getWizardProgressPercent(steps, activeStepId);
  const progressLabel = label ?? getWizardProgressLabel(steps, activeStepId, { step: stepLabel, of: ofLabel });

  return (
    <section className="wizard-progress wizard-progress--compact" aria-label={progressLabel}>
      <div className="wizard-progress__label-row">
        <span>{progressLabel}</span>
      </div>
      <div className="wizard-progress__track" aria-hidden="true">
        <span className="wizard-progress__fill" style={{ width: `${progressPercent}%` }} />
      </div>
    </section>
  );
}
