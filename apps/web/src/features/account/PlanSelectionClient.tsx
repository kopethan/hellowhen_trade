'use client';

import Link from 'next/link';
import { betaFeatures } from '../../lib/betaFeatures';
import { formatWebProMonthlyPrice, getWebProGate } from '../../lib/proGate';
import { useWebAuth } from '../../providers/WebAuthProvider';

type PlanCard = {
  id: 'free' | 'pro' | 'business';
  badge?: string;
  title: string;
  price: string;
  tagline: string;
  description: string;
  bullets: string[];
  boundary?: string;
  action: {
    label: string;
    kind: 'current' | 'link' | 'disabled';
    href?: string;
  };
  featured?: boolean;
};

function PlanAction({ action }: { action: PlanCard['action'] }) {
  if (action.kind === 'link' && action.href) return <Link className="button full" href={action.href}>{action.label}</Link>;
  return <button className="secondary full" type="button" disabled>{action.label}</button>;
}

function PlanCardView({ card }: { card: PlanCard }) {
  return (
    <article className={`plan-selection-card ${card.featured ? 'is-featured' : ''}`.trim()}>
      <div className="plan-selection-card__header">
        <div>
          {card.badge ? <span className={`semantic-badge ${card.featured ? 'success' : 'neutral'}`}>{card.badge}</span> : null}
          <h3>{card.title}</h3>
          <p>{card.tagline}</p>
        </div>
        <strong>{card.price}</strong>
      </div>
      <p className="plan-selection-card__description">{card.description}</p>
      <ul className="plan-selection-card__bullets">
        {card.bullets.map((bullet) => <li key={bullet}><span aria-hidden="true">✓</span> <span>{bullet}</span></li>)}
      </ul>
      {card.boundary ? <p className="plan-selection-card__boundary">{card.boundary}</p> : null}
      <PlanAction action={card.action} />
    </article>
  );
}

export function PlanSelectionClient() {
  const auth = useWebAuth();
  const gate = getWebProGate();
  const proPrice = formatWebProMonthlyPrice(gate);
  const trialCopy = betaFeatures.proSubscriptionFeatures.proTrialsEnabled
    ? `${gate.trialDays}-day trial planned`
    : 'Trial planned for a future Pro beta';

  const freeAction: PlanCard['action'] = auth.isAuthenticated
    ? { label: 'Current plan', kind: 'current' }
    : { label: 'Get started', kind: 'link', href: `/auth?next=${encodeURIComponent('/account/plans')}` };

  const proAction: PlanCard['action'] = betaFeatures.proSubscriptionFeatures.identityVerificationEnabled
    ? { label: 'Start Pro setup', kind: 'link', href: '/account/pro/setup' }
    : { label: 'Coming later', kind: 'disabled' };

  const cards: PlanCard[] = [
    {
      id: 'free',
      title: 'Free',
      price: '€0/month',
      tagline: 'Start trading needs and offers.',
      description: 'Use the core Hellowhen Trade marketplace as an individual user.',
      bullets: [
        'Create Needs and Offers',
        'Create normal one-to-one Trades',
        'Send and receive proposals',
        'Use public discussion and private proposal conversations',
        'Basic profile and account settings',
        'Report and support access',
      ],
      boundary: 'Professional tools, package proposals, portfolio features, and professional verification are not included.',
      action: freeAction,
    },
    {
      id: 'pro',
      badge: 'For professionals',
      title: 'Pro',
      price: `${proPrice}/month`,
      tagline: 'Show more value, build trust, and work faster.',
      description: 'For freelancers, creators, service providers, consultants, and professionals who want stronger profile, proposal, and discovery tools.',
      bullets: [
        'Verified Professional badge',
        'Professional profile section',
        'Pro Trade Packages',
        'Portfolio/gallery tools later',
        'Reusable proposal and offer templates later',
        'Basic analytics later',
        'Priority visibility experiments later',
      ],
      boundary: `Requires identity verification and an active or trialing Pro subscription. ${trialCopy}.`,
      action: proAction,
      featured: true,
    },
    {
      id: 'business',
      badge: 'Coming later',
      title: 'Business',
      price: 'Custom / later',
      tagline: 'For verified brands, teams, and organizations.',
      description: 'Business accounts are planned for brands, agencies, shops, studios, and teams that need organization-level verification, campaigns, libraries, and team controls.',
      bullets: [
        'Business verification / KYB later',
        'Team members and roles later',
        'Brand profile and library items later',
        'Campaign-style Needs and Offers later',
        'Sponsored placements later',
        'Business analytics and budgets later',
      ],
      boundary: 'Business is not part of the first Pro launch and will be designed separately.',
      action: { label: 'Coming later', kind: 'disabled' },
    },
  ];

  return (
    <div className="plan-selection-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Plans</p>
          <h2>Choose how you want to use Hellowhen</h2>
          <p>Free stays available for normal Need and Offer trades. Pro is a future professional upgrade, and Business will be designed later.</p>
        </div>
      </div>

      <section className="mobile-card mobile-card--soft plan-selection-note">
        <span className="semantic-badge instruction">Hidden preview</span>
        <h3>Not connected to billing yet</h3>
        <p>This page is a hidden pricing and plan-selection prototype. It does not start checkout, identity verification, native purchases, or public Pro onboarding.</p>
      </section>

      <div className="plan-selection-grid">
        {cards.map((card) => <PlanCardView key={card.id} card={card} />)}
      </div>

      <section className="mobile-card mobile-card--soft plan-selection-safety">
        <h3>Pro safety boundaries</h3>
        <p>Pro will never unlock moderation bypasses, private proposal access, report bypasses, or payment/payout access without later provider and compliance approval.</p>
      </section>
    </div>
  );
}
