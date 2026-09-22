'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PlanDto } from '@hellowhen/contracts';
import { getNormalWorkspaceMenuItems, type NormalWorkspaceMenuItem } from '@hellowhen/shared';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { WebIcon } from '../../components/WebIcon';
import { WebAccountHeaderAction } from '../../components/WebAccountHeaderAction';
import { hasCompletedWebOnboardingGuideForVisitor } from '../onboarding-guide/onboardingGuideStorage';
import { PlansFeatureGate } from './PlansFeatureGate';
import { PlanDtoPreviewDeck } from './PlanPreviewDeck';
import { planOwnerName } from './plansPresentation';
import { activePlanFilterCount, applyPlanFilters, buildPlanFeedQuery, buildPlanFilterHref, planFilterSummary, planFiltersFromSearchParams, planSearchQueryFromSearchParams } from './planFilters';

type PlansView = 'feed' | 'mine' | 'joined';

type PlanCardProps = {
  plan: PlanDto;
};

function PlanCard({ plan }: PlanCardProps) {
  const router = useRouter();
  const { t } = useWebTranslation();
  const participantText = t('plans.row.joined', { count: plan.participantCount ?? 0 });
  const placeCount = plan.places?.length ?? 0;
  const placeText = placeCount === 1 ? t('plans.row.placeOne', { count: placeCount }) : t('plans.row.placeMany', { count: placeCount });
  return (
    <article className="plan-deck-link" aria-label={t('plans.row.openAccessibility', { title: plan.title })}>
      <PlanDtoPreviewDeck plan={plan} onOpen={() => router.push(`/plans/${plan.id}`)} />
      <Link href={`/plans/${plan.id}`} className="plan-deck-link__meta">
        {placeText} · {participantText} · {t('plans.row.by', { owner: planOwnerName(plan) })}
      </Link>
    </article>
  );
}

type PlansListClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
};

function nextAuthHref(path: string) {
  return `/auth?next=${encodeURIComponent(path)}`;
}

const plansGuideIntroSeenKey = 'hellowhen.plans.guideIntro.seen.v1';

export function PlansListClient({ plansEnabled }: PlansListClientProps) {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const router = useRouter();
  const [view, setView] = useState<PlansView>('feed');
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideIntroDismissed, setGuideIntroDismissed] = useState(false);
  const [guideIntroReady, setGuideIntroReady] = useState(false);
  const searchParams = useSearchParams();
  const searchParamKey = searchParams.toString();
  const activeFilters = useMemo(() => planFiltersFromSearchParams(searchParams), [searchParamKey, searchParams]);
  const activeSearchQuery = useMemo(() => planSearchQueryFromSearchParams(searchParams), [searchParamKey, searchParams]);
  const activeFilterCount = activePlanFilterCount(activeFilters, activeSearchQuery);
  const activeFilterSummary = useMemo(() => planFilterSummary(activeFilters, activeSearchQuery, t), [activeFilters, activeSearchQuery, t]);
  const filterHref = useMemo(() => buildPlanFilterHref('/plans/filter', activeFilters, activeSearchQuery), [activeFilters, activeSearchQuery]);

  const canLoadPrivateViews = auth.hydrated && auth.isAuthenticated;
  const shouldShowGuideIntro = guideIntroReady && auth.hydrated && !guideIntroDismissed;
  const activeView = view !== 'feed' && !canLoadPrivateViews ? 'feed' : view;
  const createPlanHref = auth.isAuthenticated ? '/plans/new' : nextAuthHref('/plans/new');
  const workspaceItems = getNormalWorkspaceMenuItems('plans').filter((item) => item.id !== 'plan_ideas');

  useEffect(() => {
    if (!auth.hydrated) return;
    try {
      const dismissed = window.localStorage.getItem(plansGuideIntroSeenKey) === '1';
      setGuideIntroDismissed(dismissed || hasCompletedWebOnboardingGuideForVisitor(auth.user?.id, 'plans'));
    } catch {
      setGuideIntroDismissed(hasCompletedWebOnboardingGuideForVisitor(auth.user?.id, 'plans'));
    } finally {
      setGuideIntroReady(true);
    }
  }, [auth.hydrated, auth.user?.id]);

  useEffect(() => {
    const requestedView = searchParams.get('view');
    if (requestedView === 'mine' || requestedView === 'joined' || requestedView === 'feed') setView(requestedView);
  }, [searchParamKey, searchParams]);

  const emptyTitle = activeView === 'mine' ? t('plans.list.empty.mineTitle') : activeView === 'joined' ? t('plans.list.empty.joinedTitle') : t('plans.list.empty.feedTitle');
  const emptyBody = activeView === 'mine'
    ? t('plans.list.empty.mine')
    : activeView === 'joined'
      ? t('plans.list.empty.joined')
      : activeFilterCount
        ? t('plans.list.empty.filtered')
        : t('plans.list.empty.feed');
  const viewLabel = activeView === 'mine' ? t('plans.collections.myPlans') : activeView === 'joined' ? t('plans.collections.joinedPlans') : t('plans.list.openPlans');

  useEffect(() => {
    let mounted = true;
    async function loadPlans() {
      if (!auth.hydrated) return;
      setLoading(true);
      setError('');
      try {
        const effectiveFilters = activeView === 'feed' ? activeFilters : [];
        const effectiveSearchQuery = activeView === 'feed' ? activeSearchQuery : '';
        const response = activeView === 'mine'
          ? await api.plans.mine()
          : activeView === 'joined'
            ? await api.plans.joined()
            : await api.plans.feed(buildPlanFeedQuery(effectiveFilters, effectiveSearchQuery));
        if (!mounted) return;
        setPlans(activeView === 'feed' ? applyPlanFilters(response.plans ?? [], effectiveFilters, effectiveSearchQuery) : response.plans ?? []);
      } catch (loadError) {
        if (!mounted) return;
        setPlans([]);
        setError(getFriendlyApiErrorMessage(loadError, t('plans.list.errors.body')));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadPlans();
    return () => { mounted = false; };
  }, [activeView, auth.hydrated, activeFilters, activeSearchQuery]);

  const sortedPlans = useMemo(() => [...plans].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()), [plans]);
  const activeOwnedPlans = useMemo(() => activeView === 'mine' ? sortedPlans.filter((plan) => plan.status !== 'cancelled') : sortedPlans, [activeView, sortedPlans]);
  const removedOwnedPlans = useMemo(() => activeView === 'mine' ? sortedPlans.filter((plan) => plan.status === 'cancelled') : [], [activeView, sortedPlans]);
  function selectView(nextView: PlansView) {
    setView(nextView);
    setMenuOpen(false);
  }

  function openWorkspaceItem(item: NormalWorkspaceMenuItem) {
    setMenuOpen(false);
    if (!canLoadPrivateViews && item.id !== 'plan_guide') {
      router.push(nextAuthHref('/plans'));
      return;
    }
    if (item.id === 'plan_guide') {
      router.push('/onboarding-guide?guide=plans&replay=1&next=/plans');
      return;
    }
    if (item.id === 'my_plans') {
      setView('mine');
      return;
    }
    if (item.id === 'joined_plans') {
      setView('joined');
      return;
    }
    if (item.id === 'my_places') {
      router.push('/places');
      return;
    }
    setView('feed');
    router.push('/plans');
  }

  function dismissGuideIntro() {
    setGuideIntroDismissed(true);
    try {
      window.localStorage.setItem(plansGuideIntroSeenKey, '1');
    } catch {
      // Ignore storage failures.
    }
  }

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page plans-feed-page web-app-page web-app-page--feed web-app-page--plans">
        <section className="plans-feed-shell" aria-label={t('plans.list.openPlans')}>
          <header className="feed-world-header plans-feed-header">
            <div className="feed-world-header__copy">
              <h1>{t('plans.common.title')}</h1>
            </div>
            <div className="feed-world-header__actions plans-feed-header__actions" aria-label={t('plans.feed.actions.menu')}>
              <Link className="feed-world-action plans-feed-icon-button plans-feed-icon-button--with-badge" href={filterHref} aria-label={activeFilterCount ? t('plans.feed.actions.filterActive', { count: activeFilterCount }) : t('plans.feed.actions.filter')}>
                <WebIcon name="filter" size={18} decorative />
                {activeFilterCount ? <span className="plans-feed-icon-button__badge">{activeFilterCount}</span> : null}
              </Link>
              <button
                type="button"
                className="feed-world-action plans-feed-icon-button plans-feed-icon-button--workspace"
                aria-label={t('plans.feed.actions.menu')}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
              >
                <WebIcon name="activity" size={18} decorative />
              </button>
              <Link className="feed-world-action plans-feed-icon-button plans-feed-icon-button--primary" href={createPlanHref} aria-label={t('plans.feed.actions.create')}>
                <WebIcon name="add" size={21} decorative />
              </Link>
              <WebAccountHeaderAction local />
            </div>
          </header>

          {menuOpen ? (
            <section className="plans-feed-menu plans-workspace-menu normal-workspace-menu normal-workspace-menu--plans" aria-label={t('plans.feed.actions.menu')}>
              {workspaceItems.map((item) => (
                <button key={item.id} type="button" className="plans-workspace-menu__item" onClick={() => openWorkspaceItem(item)} disabled={!canLoadPrivateViews && item.id !== 'plan_guide'}>
                  <span className={`plans-workspace-menu__icon plans-workspace-menu__icon--${item.tone}`}><WebIcon name={item.icon} size={17} decorative /></span>
                  <span>
                    <strong>{item.titleKey ? t(item.titleKey) : item.title}</strong>
                    <small>{item.bodyKey ? t(item.bodyKey) : item.body}</small>
                  </span>
                  <WebIcon name="arrow-right" size={16} decorative />
                </button>
              ))}
            </section>
          ) : null}

        </section>

        {shouldShowGuideIntro ? <PlansGuideIntroBanner onDismiss={dismissGuideIntro} /> : null}

        {activeView === 'feed' && activeFilterCount ? (
          <section className="plans-active-filter-card" aria-label={activeFilterCount === 1 ? t('plans.feed.activeFilters.one') : t('plans.feed.activeFilters.many', { count: activeFilterCount })}>
            <div>
              <strong>{activeFilterCount === 1 ? t('plans.feed.activeFilters.one') : t('plans.feed.activeFilters.many', { count: activeFilterCount })}</strong>
              <span>{activeFilterSummary || t('plans.feed.activeFilters.fallback')}</span>
            </div>
            <Link href="/plans">{t('plans.filters.reset')}</Link>
          </section>
        ) : null}
        {error ? <section className="mobile-card mobile-card--soft"><p>{error}</p></section> : null}
        {loading ? <section className="mobile-card"><p className="meta">{t('plans.list.loading')}</p></section> : null}
        {!loading && !error && sortedPlans.length === 0 ? (
          <section className="inventory-empty-state">
            <span className="inventory-empty-state__plus">+</span>
            <strong>{emptyTitle}</strong>
            <span>{emptyBody}</span>
            <div className="cta-row">
              <Link className="button secondary" href={createPlanHref}>{t('plans.feed.actions.create')}</Link>
              <Link className="button secondary" href="/explore">{t('navigation.tabs.explore')}</Link>
            </div>
          </section>
        ) : null}
        <section className="mobile-list plans-feed-deck-list" aria-label={viewLabel}>
          {(activeView === 'feed' ? sortedPlans : activeOwnedPlans).map((plan) => <PlanCard key={plan.id} plan={plan} />)}
        </section>
        {activeView === 'mine' && removedOwnedPlans.length ? (
          <section className="mobile-list plans-feed-deck-list" aria-label={t('plans.list.removed')}>
            <div className="plan-section-heading">
              <div>
                <p className="eyebrow">{t('plans.detail.values.private')}</p>
                <h2>{t('plans.list.removed')}</h2>
              </div>
            </div>
            {removedOwnedPlans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
          </section>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}

function PlansGuideIntroBanner({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useWebTranslation();
  return (
    <section className="home-guide-entry home-guide-entry--plans" aria-labelledby="plans-guide-entry-title">
      <span className="home-guide-entry__icon" aria-hidden="true"><WebIcon name="plan" size={18} decorative /></span>
      <div className="home-guide-entry__copy">
        <span className="semantic-badge instruction">{t('plans.feed.guide.badge')}</span>
        <h2 id="plans-guide-entry-title">{t('plans.feed.guide.title')}</h2>
        <p>{t('plans.feed.guide.body')}</p>
      </div>
      <div className="home-guide-entry__actions">
        <Link href="/onboarding-guide?guide=plans&replay=1&next=/plans" className="button primary">{t('onboarding.guide.start')}</Link>
        <button type="button" className="button secondary" onClick={onDismiss}>{t('onboarding.guide.dismiss')}</button>
      </div>
    </section>
  );
}
