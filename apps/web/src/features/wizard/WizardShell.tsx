'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { getWizardActiveStep, type WizardStepDefinition } from '@hellowhen/shared';
import { WebIcon } from '../../components/WebIcon';
import { WizardProgress } from './WizardProgress';

type WizardShellProps<TStepId extends string> = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  rightSlot?: ReactNode;
  steps: readonly WizardStepDefinition<TStepId>[];
  activeStepId: TStepId;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  stepLabel?: string;
  ofLabel?: string;
};

export function WizardShell<TStepId extends string>({
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  rightSlot,
  steps,
  activeStepId,
  children,
  footer,
  className,
  stepLabel,
  ofLabel,
}: WizardShellProps<TStepId>) {
  const activeStep = getWizardActiveStep(steps, activeStepId);

  return (
    <div className={className ? `wizard-shell ${className}` : 'wizard-shell'}>
      <header className="wizard-shell__header">
        <div className="wizard-shell__title-row">
          {backHref ? <Link className="web-back-button" href={backHref} aria-label={backLabel}><WebIcon name="back" size={18} decorative /></Link> : null}
          <div className="wizard-shell__title-copy">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {rightSlot ? <div className="wizard-shell__right-slot">{rightSlot}</div> : null}
        </div>
        <WizardProgress steps={steps} activeStepId={activeStepId} stepLabel={stepLabel} ofLabel={ofLabel} />
      </header>
      <main className="wizard-shell__body">
        {activeStep ? (
          <section className="wizard-shell__step-intro">
            <h2>{activeStep.title}</h2>
            {activeStep.description ? <p>{activeStep.description}</p> : null}
          </section>
        ) : null}
        {children}
      </main>
      {footer ? <div className="wizard-shell__footer-wrap">{footer}</div> : null}
    </div>
  );
}
