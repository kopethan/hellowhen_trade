'use client';

import Link from 'next/link';
import { betaFeatures } from '../../lib/betaFeatures';
import { formatWebPlusMonthlyPrice, formatWebPlusYearlyPrice, getWebPlusGate } from '../../lib/plusGate';
import { useWebAuth } from '../../providers/WebAuthProvider';

type PlanCard = {
  id: 'free' | 'plus';
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
  const gate = getWebPlusGate();
  const plusPrice = formatWebPlusMonthlyPrice(gate);
  const yearlyPrice = formatWebPlusYearlyPrice(gate);

  const freeAction: PlanCard['action'] = auth.isAuthenticated
    ? { label: 'Current plan', kind: 'current' }
    : { label: 'Get started', kind: 'link', href: `/auth?next=${encodeURIComponent('/account/plans')}` };

  const cards: PlanCard[] = [
    {
      id: 'free',
      title: 'Free',
      price: '€0/month',
      tagline: 'Core Hellowhen Trade access.',
      description: 'Use the marketplace to create Needs, Offers, Trades, and proposals with the normal safety tools included.',
      bullets: [
        'Create Needs and Offers',
        'Create normal one-to-one Trades',
        'Send and receive proposals',
        `Small AI assist quota planned later: ${gate.entitlements.monthlyAiAssistQuota} assists/month`,
        'Profile, support, reporting, and moderation tools',
      ],
      boundary: 'Free keeps the core marketplace available. Plus will not be required to trade safely.',
      action: freeAction,
    },
    {
      id: 'plus',
      badge: 'Hidden preview',
      title: 'Plus',
      price: `${plusPrice}/month`,
      tagline: 'AI helpers and personalization first.',
      description: 'A lightweight future paid tier for users who want help writing better posts and controlling how their previews look.',
      bullets: [
        'Improve Need and Offer title/description drafts',
        'Improve proposal messages before sending',
        'EN/FR translation helper planned',
        'Category, tag, safety, and readability suggestions planned',
        `${betaFeatures.plusSubscriptionFeatures.plusMonthlyAiAssistQuota} AI assists/month planned for Plus`,
        'Controlled preview themes and cover/image order customization planned',
      ],
      boundary: `Billing is not connected. Yearly may be planned later around ${yearlyPrice}/year. Ads removal and short video are not included in Plus v1. Plus never bypasses moderation, reports, trust, or safety rules.`,
      action: { label: 'Coming later', kind: 'disabled' },
      featured: true,
    },
  ];

  return (
    <div className="plan-selection-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Plus</p>
          <h2>Free + Plus preview</h2>
          <p>Plus is a hidden account preview for AI helpers and personalization. It is not public, not connected to billing, and does not start checkout.</p>
        </div>
      </div>

      <section className="mobile-card mobile-card--soft plan-selection-note">
        <span className="semantic-badge instruction">Hidden preview</span>
        <h3>Billing is not connected</h3>
        <p>This page is controlled by Plus feature flags. It shows planned copy only: no Apple billing, Google billing, Stripe checkout, Ad removal, or video upload is enabled.</p>
      </section>

      <div className="plan-selection-grid">
        {cards.map((card) => <PlanCardView key={card.id} card={card} />)}
      </div>

      <section className="mobile-card mobile-card--soft plan-selection-safety">
        <h3>Plus safety boundaries</h3>
        <p>Plus can suggest text and personalization, but users must approve every AI suggestion manually. Plus does not bypass moderation, reports, restricted-user rules, trust checks, or future money safety limits.</p>
      </section>
    </div>
  );
}
