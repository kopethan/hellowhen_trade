'use client';

import Link from 'next/link';
import { betaFeatures } from '../../lib/betaFeatures';
import { formatWebProMonthlyPrice, getWebProGate } from '../../lib/proGate';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';

type ProOnboardingStep = {
  id: string;
  label: string;
  title: string;
  body: string;
  status: 'available' | 'blocked' | 'placeholder';
};

function StepStatusBadge({ status }: { status: ProOnboardingStep['status'] }) {
  const { t } = useWebTranslation();
  if (status === 'available') return <span className="semantic-badge success">{t('account.proOnboarding.status.available')}</span>;
  if (status === 'blocked') return <span className="semantic-badge warning">{t('account.proOnboarding.status.blocked')}</span>;
  return <span className="semantic-badge instruction">{t('account.proOnboarding.status.placeholder')}</span>;
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
  const { t } = useWebTranslation();
  const gate = getWebProGate();
  const proPrice = formatWebProMonthlyPrice(gate);
  const identityConnected = betaFeatures.proSubscriptionFeatures.identityVerificationEnabled;
  const trialsEnabled = betaFeatures.proSubscriptionFeatures.proTrialsEnabled;

  const steps: ProOnboardingStep[] = [
    {
      id: 'review',
      label: t('account.proOnboarding.steps.review.label'),
      title: t('account.proOnboarding.steps.review.title'),
      body: t('account.proOnboarding.steps.review.body', { price: proPrice, trialDays: gate.trialDays }),
      status: 'available',
    },
    {
      id: 'identity',
      label: t('account.proOnboarding.steps.identity.label'),
      title: t('account.proOnboarding.steps.identity.title'),
      body: identityConnected
        ? t('account.proOnboarding.steps.identity.bodyConnected')
        : t('account.proOnboarding.steps.identity.bodyHidden'),
      status: 'blocked',
    },
    {
      id: 'subscription',
      label: t('account.proOnboarding.steps.subscription.label'),
      title: t('account.proOnboarding.steps.subscription.title'),
      body: trialsEnabled
        ? t('account.proOnboarding.steps.subscription.bodyTrials')
        : t('account.proOnboarding.steps.subscription.bodyPlaceholder'),
      status: 'placeholder',
    },
    {
      id: 'access',
      label: t('account.proOnboarding.steps.access.label'),
      title: t('account.proOnboarding.steps.access.title'),
      body: t('account.proOnboarding.steps.access.body'),
      status: 'placeholder',
    },
  ];

  return (
    <div className="pro-onboarding-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">{t('account.proOnboarding.eyebrow')}</p>
          <h2>{t('account.proOnboarding.title')}</h2>
          <p>{t('account.proOnboarding.intro')}</p>
        </div>
      </div>

      <section className="mobile-card mobile-card--soft pro-onboarding-summary">
        <div>
          <span className="semantic-badge instruction">{t('account.proOnboarding.summary.badge')}</span>
          <h3>{t('account.proOnboarding.summary.title')}</h3>
          <p>{t('account.proOnboarding.summary.body')}</p>
        </div>
        <div className="pro-onboarding-summary__price">
          <span>{t('account.proOnboarding.summary.priceLabel')}</span>
          <strong>{t('account.proOnboarding.summary.monthlyPrice', { price: proPrice })}</strong>
          <small>{t('account.proOnboarding.summary.trialLabel', { trialDays: gate.trialDays })}</small>
        </div>
      </section>

      {!auth.hydrated ? null : !auth.isAuthenticated ? (
        <section className="mobile-card mobile-card--soft pro-onboarding-auth">
          <span className="semantic-badge warning">{t('account.proOnboarding.auth.badge')}</span>
          <h3>{t('account.proOnboarding.auth.title')}</h3>
          <p>{t('account.proOnboarding.auth.body')}</p>
          <Link className="button primary" href={`/auth?next=${encodeURIComponent('/account/pro/setup')}`}>{t('account.proOnboarding.auth.action')}</Link>
        </section>
      ) : null}

      <div className="pro-onboarding-steps">
        {steps.map((step, index) => <ProOnboardingStepCard key={step.id} step={step} index={index} />)}
      </div>

      <section className="mobile-card mobile-card--soft pro-onboarding-actions">
        <h3>{t('account.proOnboarding.disabled.title')}</h3>
        <p>{t('account.proOnboarding.disabled.body')}</p>
        <div className="pro-onboarding-actions__row">
          <button className="button primary" type="button" disabled>{t('account.proOnboarding.disabled.verifyAction')}</button>
          <button className="secondary" type="button" disabled>{t('account.proOnboarding.disabled.subscribeAction')}</button>
        </div>
        <Link className="secondary full" href="/account/membership">{t('account.proOnboarding.disabled.backToMembership')}</Link>
      </section>
    </div>
  );
}
