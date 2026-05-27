'use client';

import Link from 'next/link';
import { betaFeatures } from '../../lib/betaFeatures';
import { formatWebProMonthlyPrice, getWebProGate } from '../../lib/proGate';
import { useWebAuth } from '../../providers/WebAuthProvider';

type ProOnboardingStep = {
  id: string;
  label: string;
  title: string;
  body: string;
  status: 'available' | 'blocked' | 'placeholder';
};

function StepStatusBadge({ status }: { status: ProOnboardingStep['status'] }) {
  if (status === 'available') return <span className="semantic-badge success">Ready later</span>;
  if (status === 'blocked') return <span className="semantic-badge warning">Required</span>;
  return <span className="semantic-badge instruction">Placeholder</span>;
}

function ProOnboardingStepCard({ step, index }: { step: ProOnboardingStep; index: number }) {
  return (
    <article className="pro-onboarding-step">
      <div className="pro-onboarding-step__number" aria-hidden="true">{index + 1}</div>
      <div className="pro-onboarding-step__body">
        <div className="pro-onboarding-step__header">
          <span className="eyebrow">{step.label}</span>
          <StepStatusBadge status={step.status} />
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
      </div>
    </article>
  );
}

export function ProOnboardingClient() {
  const auth = useWebAuth();
  const gate = getWebProGate();
  const proPrice = formatWebProMonthlyPrice(gate);
  const identityConnected = betaFeatures.proSubscriptionFeatures.identityVerificationEnabled;
  const trialsEnabled = betaFeatures.proSubscriptionFeatures.proTrialsEnabled;

  const steps: ProOnboardingStep[] = [
    {
      id: 'review',
      label: 'Review',
      title: 'Review the Pro upgrade',
      body: `Pro is planned at ${proPrice}/month with a ${gate.trialDays}-day trial model. It is for verified professionals who need stronger profile, proposal, and package tools.`,
      status: 'available',
    },
    {
      id: 'identity',
      label: 'Identity',
      title: 'Verify identity',
      body: identityConnected
        ? 'Identity verification will be required before Pro access. This skeleton does not connect to a verification provider yet.'
        : 'Identity verification is required for Pro, but the provider is not connected in this hidden prototype.',
      status: 'blocked',
    },
    {
      id: 'subscription',
      label: 'Billing',
      title: 'Start the Pro subscription',
      body: trialsEnabled
        ? 'A trialing or active subscription will be required after identity verification. Checkout is intentionally not connected yet.'
        : 'Subscription billing is not connected yet. This step stays as a placeholder until the billing provider is selected and implemented.',
      status: 'placeholder',
    },
    {
      id: 'access',
      label: 'Access',
      title: 'Unlock Pro features later',
      body: 'After verified identity and an active or trialing subscription, Pro can unlock features like Pro Trade Packages, professional profile sections, and future portfolio tools.',
      status: 'placeholder',
    },
  ];

  return (
    <div className="pro-onboarding-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Pro setup</p>
          <h2>Professional upgrade preview</h2>
          <p>This hidden flow explains the future Pro onboarding path without starting verification, checkout, or native purchases.</p>
        </div>
      </div>

      <section className="mobile-card mobile-card--soft pro-onboarding-summary">
        <div>
          <span className="semantic-badge instruction">Hidden prototype</span>
          <h3>Pro requires verification + subscription</h3>
          <p>Pro access will only be available when identity is verified and the subscription status is active or trialing.</p>
        </div>
        <div className="pro-onboarding-summary__price">
          <span>Planned price</span>
          <strong>{proPrice}/month</strong>
          <small>{gate.trialDays}-day trial planned</small>
        </div>
      </section>

      {!auth.hydrated ? null : !auth.isAuthenticated ? (
        <section className="mobile-card mobile-card--soft pro-onboarding-auth">
          <span className="semantic-badge warning">Sign in required</span>
          <h3>Create or sign in to continue later</h3>
          <p>This skeleton does not create a Pro account yet, but the real flow will require an authenticated account first.</p>
          <Link className="button primary" href={`/auth?next=${encodeURIComponent('/account/pro/setup')}`}>Login or register</Link>
        </section>
      ) : null}

      <div className="pro-onboarding-steps">
        {steps.map((step, index) => <ProOnboardingStepCard key={step.id} step={step} index={index} />)}
      </div>

      <section className="mobile-card mobile-card--soft pro-onboarding-actions">
        <h3>Provider steps are intentionally disabled</h3>
        <p>No payment provider, identity provider, checkout session, native purchase, or Pro entitlement activation is connected in this prototype.</p>
        <div className="pro-onboarding-actions__row">
          <button className="button primary" type="button" disabled>Start verification later</button>
          <button className="secondary" type="button" disabled>Start subscription later</button>
        </div>
        <Link className="secondary full" href="/account/plans">Back to plans</Link>
      </section>
    </div>
  );
}
