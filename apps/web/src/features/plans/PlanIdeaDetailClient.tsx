'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStarterPlanIdea, starterPlanIdeaMode, starterPlanIdeaRequirementCounts, starterPlanIdeaStopDestinationPrompt } from '@hellowhen/shared';
import { PlansFeatureGate } from './PlansFeatureGate';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { WebIcon } from '../../components/WebIcon';
import { useWebTranslation } from '../../providers/WebI18nProvider';

type PlanIdeaDetailClientProps = {
  ideaId: string;
  plansEnabled?: boolean;
};

function authHref(path: string) {
  return `/auth?next=${encodeURIComponent(path)}`;
}

export function PlanIdeaDetailClient({ ideaId, plansEnabled }: PlanIdeaDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const idea = getStarterPlanIdea(ideaId);
  const requirementCounts = idea ? starterPlanIdeaRequirementCounts(idea) : null;
  const fromExplore = searchParams.get('from') === 'explore';
  const returnHref = fromExplore ? '/explore' : '/plans';
  const requirementSummary = requirementCounts ? [
    requirementCounts.addressStops ? (requirementCounts.addressStops === 1 ? t('plans.ideaDetail.requirements.realAddressOne', { count: requirementCounts.addressStops }) : t('plans.ideaDetail.requirements.realAddressMany', { count: requirementCounts.addressStops })) : '',
    requirementCounts.onlineLinkStops ? (requirementCounts.onlineLinkStops === 1 ? t('plans.ideaDetail.requirements.onlineLinkOne', { count: requirementCounts.onlineLinkStops }) : t('plans.ideaDetail.requirements.onlineLinkMany', { count: requirementCounts.onlineLinkStops })) : '',
  ].filter(Boolean).join(' + ') : '';
  const returnLabel = fromExplore ? t('navigation.tabs.explore') : t('plans.ideaDetail.actions.backToPlans');

  function createVersion() {
    if (!idea) return;
    const href = `/plans/new?idea=${encodeURIComponent(idea.id)}`;
    router.push(auth.isAuthenticated ? href : authHref(href));
  }

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page plan-idea-detail-page">
        <header className="plans-filter-header">
          <Link className="plans-feed-icon-button" href={returnHref} aria-label={returnLabel}><WebIcon name="back" size={18} decorative /></Link>
          <div>
            <h1>{t('plans.ideaDetail.title')}</h1>
            <p>{t('plans.ideaDetail.review.body')}</p>
          </div>
        </header>

        {!idea ? (
          <section className="inventory-empty-state">
            <span className="inventory-empty-state__plus">?</span>
            <strong>{t('plans.ideaDetail.notFound.title')}</strong>
            <span>{t('plans.ideaDetail.notFound.body')}</span>
            <Link className="button secondary" href={returnHref}>{returnLabel}</Link>
          </section>
        ) : (
          <>
            <section className="plan-idea-hero">
              <div className="plan-idea-hero__top">
                <span className="semantic-badge instruction">{t('plans.ideaDetail.badge', { pack: idea.pack })}</span>
                <span className="semantic-badge plan">{starterPlanIdeaMode(idea) === 'remote' ? t('plans.detail.values.online') : t('plans.detail.values.local')}</span>
              </div>
              <h2>{idea.title}</h2>
              <p>{idea.description}</p>
              <div className="plan-idea-hero__meta">
                <span>{idea.stops.length === 1 ? t('plans.deck.ideaStopsOne', { count: idea.stops.length }) : t('plans.deck.ideaStopsMany', { count: idea.stops.length })}</span>
                <span>{idea.category}</span>
                <span>{requirementSummary}</span>
              </div>
            </section>

            <section className="plan-idea-notice">
              <WebIcon name="plan" size={20} decorative />
              <div>
                <strong>{t('plans.ideaDetail.review.title')}</strong>
                <span>{t('plans.ideaDetail.review.body')}</span>
              </div>
            </section>

            <section className="plan-idea-requirements" aria-label={t('plans.ideaDetail.requirements.title')}>
              <div>
                <strong>{t('plans.ideaDetail.requirements.title')}</strong>
                <span>{t('plans.ideaDetail.requirements.body', { requirements: requirementSummary })}</span>
              </div>
              <div className="plan-idea-requirement-grid">
                {requirementCounts?.addressStops ? (
                  <span className="plan-idea-requirement-pill">
                    <span>{requirementCounts.addressStops}</span>
                    {requirementCounts.addressStops === 1 ? t('plans.ideaDetail.requirements.realAddressOne', { count: requirementCounts.addressStops }) : t('plans.ideaDetail.requirements.realAddressMany', { count: requirementCounts.addressStops })}
                  </span>
                ) : null}
                {requirementCounts?.onlineLinkStops ? (
                  <span className="plan-idea-requirement-pill">
                    <span>{requirementCounts.onlineLinkStops}</span>
                    {requirementCounts.onlineLinkStops === 1 ? t('plans.ideaDetail.requirements.onlineLinkOne', { count: requirementCounts.onlineLinkStops }) : t('plans.ideaDetail.requirements.onlineLinkMany', { count: requirementCounts.onlineLinkStops })}
                  </span>
                ) : null}
              </div>
            </section>

            <section className="plan-idea-stops" aria-label={t('plans.create.timeline.buildAccessibility')}>
              {idea.stops.map((stop, index) => (
                <article key={`${idea.id}-${stop.title}`} className="plan-idea-stop">
                  <span className="plan-idea-stop__number">{index + 1}</span>
                  <div>
                    <div className="plan-idea-stop__badges">
                      <span className="semantic-badge place">{stop.mode === 'remote' ? t('plans.detail.values.online') : t('plans.detail.values.local')}</span>
                      <span className="semantic-badge time">{stop.time}</span>
                      <span className={`semantic-badge ${stop.mode === 'remote' ? 'info' : 'warning'}`}>{stop.mode === 'remote' ? t('plans.ideaDetail.requirements.onlineRequired') : t('plans.ideaDetail.requirements.addressRequired')}</span>
                    </div>
                    <h3>{stop.title}</h3>
                    <p>{starterPlanIdeaStopDestinationPrompt(stop)}</p>
                    <small>{stop.mode === 'remote' ? t('plans.ideaDetail.requirements.onlinePrompt') : t('plans.ideaDetail.requirements.offlinePrompt')}</small>
                  </div>
                </article>
              ))}
            </section>

            <section className="plan-idea-next-card">
              <div>
                <strong>{t('plans.ideaDetail.nextStep.title')}</strong>
                <span>{t('plans.ideaDetail.nextStep.body')}</span>
              </div>
              <div className="plan-idea-actions">
                <Link className="button secondary" href={returnHref}>{returnLabel}</Link>
                <button type="button" className="button primary" onClick={createVersion}>{t('plans.ideaDetail.actions.createVersion')}</button>
              </div>
            </section>
          </>
        )}
      </main>
    </PlansFeatureGate>
  );
}
