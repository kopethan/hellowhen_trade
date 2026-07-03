'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PlanDto } from '@hellowhen/contracts';
import { buildPlanFeedItems, getNormalWorkspaceMenuItems, mergeRecentStarterPlanIdeaIds, selectStarterPlanIdeaKeys, starterPlanIdeas, type NormalWorkspaceMenuItem, type StarterPlanIdeaKey } from '@hellowhen/shared';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { WebIcon } from '../../components/WebIcon';
import { PlansFeatureGate } from './PlansFeatureGate';
import { PlanDtoPreviewDeck, PlanPreviewDeck } from './PlanPreviewDeck';
import { planOwnerName } from './plansPresentation';
import { activePlanFilterCount, applyPlanFilters, buildPlanFeedQuery, buildPlanFilterHref, planFilterSummary, planFiltersFromSearchParams, planSearchQueryFromSearchParams } from './planFilters';

type PlansView = 'feed' | 'mine' | 'joined';

type PlanCardProps = {
  plan: PlanDto;
};

function PlanCard({ plan }: PlanCardProps) {
  const router = useRouter();
  const participantText = `${plan.participantCount ?? 0} joined`;
  const placeText = `${plan.places?.length ?? 0} place${plan.places?.length === 1 ? '' : 's'}`;
  return (
    <article className="plan-deck-link" aria-label={`Open ${plan.title}`}>
      <PlanDtoPreviewDeck plan={plan} onOpen={() => router.push(`/plans/${plan.id}`)} />
      <Link href={`/plans/${plan.id}`} className="plan-deck-link__meta">
        {placeText} · {participantText} · By {planOwnerName(plan)}
      </Link>
    </article>
  );
}

function PlanIdeaCard({ ideaKey, onOpen }: { ideaKey: StarterPlanIdeaKey; onOpen?: () => void }) {
  const router = useRouter();
  const idea = starterPlanIdeas[ideaKey];
  function openIdea() {
    onOpen?.();
    router.push(`/plans/ideas/${idea.id}`);
  }
  return (
    <article className="plan-deck-link plan-idea-card" aria-label={`Open Plan idea ${idea.title}`}>
      <PlanPreviewDeck
        title={idea.title}
        description={idea.description}
        rangeLabel="Starter Plan idea"
        badgeLabel={`Plan idea · ${idea.pack}`}
        places={idea.stops.map((stop, index) => ({
          id: `${idea.id}-${index}`,
          mode: stop.mode,
          title: stop.title,
          location: stop.mode === 'remote' ? stop.onlineLabel ?? stop.onlineUrl : stop.location,
          time: stop.time,
        }))}
        onOpen={openIdea}
        actionLabel="Open Plan idea"
      />
      <Link href={`/plans/ideas/${idea.id}`} className="plan-deck-link__meta" onClick={onOpen}>
        {idea.stops.length} starter stops · Create your version
      </Link>
    </article>
  );
}

type PlansListClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
};

const viewLabels: Record<PlansView, string> = {
  feed: 'Open plans',
  mine: 'My plans',
  joined: 'Joined plans',
};

function nextAuthHref(path: string) {
  return `/auth?next=${encodeURIComponent(path)}`;
}

const recentPlanIdeaStorageKey = 'hellowhen_recent_plan_ideas_v1';
const anonymousPlanIdeaStorageKey = 'hellowhen_plan_idea_anon_key_v1';
const plansGuideIntroSeenKey = 'hellowhen.plans.guideIntro.seen.v1';

function createAnonymousPlanIdeaKey() {
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readRecentPlanIdeaIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(recentPlanIdeaStorageKey);
    const parsed = raw ? JSON.parse(raw) as string[] : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readAnonymousPlanIdeaKey() {
  if (typeof window === 'undefined') return 'anonymous';
  const existing = window.localStorage.getItem(anonymousPlanIdeaStorageKey);
  if (existing) return existing;
  const next = createAnonymousPlanIdeaKey();
  window.localStorage.setItem(anonymousPlanIdeaStorageKey, next);
  return next;
}

export function PlansListClient({ plansEnabled }: PlansListClientProps) {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const router = useRouter();
  const [view, setView] = useState<PlansView>('feed');
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentStarterIdeaIds, setRecentStarterIdeaIds] = useState<string[]>([]);
  const [anonymousStarterKey, setAnonymousStarterKey] = useState('anonymous');
  const [starterRefreshKey, setStarterRefreshKey] = useState('stable-plan-ideas');
  const [guideIntroDismissed, setGuideIntroDismissed] = useState(false);
  const [guideIntroReady, setGuideIntroReady] = useState(false);
  const searchParams = useSearchParams();
  const searchParamKey = searchParams.toString();
  const activeFilters = useMemo(() => planFiltersFromSearchParams(searchParams), [searchParamKey, searchParams]);
  const activeSearchQuery = useMemo(() => planSearchQueryFromSearchParams(searchParams), [searchParamKey, searchParams]);
  const activeFilterCount = activePlanFilterCount(activeFilters, activeSearchQuery);
  const activeFilterSummary = useMemo(() => planFilterSummary(activeFilters, activeSearchQuery), [activeFilters, activeSearchQuery]);
  const filterHref = useMemo(() => buildPlanFilterHref('/plans/filter', activeFilters, activeSearchQuery), [activeFilters, activeSearchQuery]);

  const canLoadPrivateViews = auth.hydrated && auth.isAuthenticated;
  const shouldShowGuideIntro = guideIntroReady && auth.hydrated && !auth.isAuthenticated && !guideIntroDismissed;
  const activeView = view !== 'feed' && !canLoadPrivateViews ? 'feed' : view;
  const createPlanHref = auth.isAuthenticated ? '/plans/new' : nextAuthHref('/plans/new');
  const workspaceItems = getNormalWorkspaceMenuItems('plans');

  useEffect(() => {
    setRecentStarterIdeaIds(readRecentPlanIdeaIds());
    setAnonymousStarterKey(readAnonymousPlanIdeaKey());
    setStarterRefreshKey(`plan-refresh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  }, []);

  useEffect(() => {
    try {
      setGuideIntroDismissed(window.localStorage.getItem(plansGuideIntroSeenKey) === '1');
    } catch {
      setGuideIntroDismissed(false);
    } finally {
      setGuideIntroReady(true);
    }
  }, []);

  useEffect(() => {
    const requestedView = searchParams.get('view');
    if (requestedView === 'mine' || requestedView === 'joined' || requestedView === 'feed') setView(requestedView);
  }, [searchParamKey, searchParams]);

  const emptyTitle = activeView === 'mine' ? 'No Plans created yet' : activeView === 'joined' ? 'No joined Plans yet' : 'No open Plans yet';
  const emptyBody = activeView === 'mine'
    ? 'Create your first Plan when you are ready.'
    : activeView === 'joined'
      ? 'Plans you join will appear here.'
      : activeFilterCount
        ? 'No Plans match this search and filters yet. Try changing the search words or resetting one or two filters.'
        : 'Open Plans will appear here when they are available.';

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
        setError(getFriendlyApiErrorMessage(loadError, 'Could not load Plans.'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadPlans();
    return () => { mounted = false; };
  }, [activeView, auth.hydrated, activeFilters, activeSearchQuery]);

  const sortedPlans = useMemo(() => [...plans].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()), [plans]);
  const hasActiveSearchOrFilters = activeFilterCount > 0;
  const starterIdeaKeys = useMemo(() => selectStarterPlanIdeaKeys({
    realPlanCount: sortedPlans.length,
    hasActiveSearchOrFilters: activeView !== 'feed' || hasActiveSearchOrFilters,
    userKey: auth.user?.id ?? anonymousStarterKey,
    refreshKey: starterRefreshKey,
    dayKey: 'stable-plan-ideas',
    recentIdeaIds: recentStarterIdeaIds,
  }), [activeView, anonymousStarterKey, auth.user?.id, hasActiveSearchOrFilters, recentStarterIdeaIds, sortedPlans.length, starterRefreshKey]);
  const feedItems = useMemo(() => buildPlanFeedItems(sortedPlans.length, starterIdeaKeys), [sortedPlans.length, starterIdeaKeys]);

  function markStarterIdeaSeen(ideaKey: StarterPlanIdeaKey) {
    const next = mergeRecentStarterPlanIdeaIds(recentStarterIdeaIds, [ideaKey]);
    setRecentStarterIdeaIds(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(recentPlanIdeaStorageKey, JSON.stringify(next));
  }

  function selectView(nextView: PlansView) {
    setView(nextView);
    setMenuOpen(false);
  }

  function openWorkspaceItem(item: NormalWorkspaceMenuItem) {
    setMenuOpen(false);
    if (!canLoadPrivateViews && item.id !== 'plan_ideas' && item.id !== 'plan_guide') {
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
        <section className="plans-feed-shell" aria-label="Plans feed">
          <header className="feed-world-header plans-feed-header">
            <div className="feed-world-header__copy">
              <h1>Plans</h1>
            </div>
            <div className="feed-world-header__actions plans-feed-header__actions" aria-label="Plan actions">
              <Link className="feed-world-action plans-feed-icon-button plans-feed-icon-button--with-badge" href={filterHref} aria-label={activeFilterCount ? `Filter Plans, ${activeFilterCount} active` : 'Filter Plans'}>
                <WebIcon name="filter" size={18} decorative />
                {activeFilterCount ? <span className="plans-feed-icon-button__badge">{activeFilterCount}</span> : null}
              </Link>
              <button
                type="button"
                className="feed-world-action plans-feed-icon-button"
                aria-label="Open Plans menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
              >
                <WebIcon name="activity" size={18} decorative />
              </button>
              <Link className="feed-world-action plans-feed-icon-button plans-feed-icon-button--primary" href={createPlanHref} aria-label="Create Plan">
                <WebIcon name="add" size={21} decorative />
              </Link>
            </div>
          </header>

          {menuOpen ? (
            <section className="plans-feed-menu plans-workspace-menu normal-workspace-menu normal-workspace-menu--plans" aria-label="Plans workspace menu">
              {workspaceItems.map((item) => (
                <button key={item.id} type="button" className="plans-workspace-menu__item" onClick={() => openWorkspaceItem(item)} disabled={!canLoadPrivateViews && item.id !== 'plan_ideas' && item.id !== 'plan_guide'}>
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
          <section className="plans-active-filter-card" aria-label="Active Plan filters">
            <div>
              <strong>{activeFilterCount} active Plan filter{activeFilterCount === 1 ? '' : 's'}</strong>
              <span>{activeFilterSummary || 'Filtered Plan results'}</span>
            </div>
            <Link href="/plans">Reset</Link>
          </section>
        ) : null}
        {error ? <section className="mobile-card mobile-card--soft"><p>{error}</p></section> : null}
        {loading ? <section className="mobile-card"><p className="meta">Loading Plans...</p></section> : null}
        {!loading && !error && sortedPlans.length === 0 && starterIdeaKeys.length === 0 ? (
          <section className="inventory-empty-state">
            <span className="inventory-empty-state__plus">+</span>
            <strong>{emptyTitle}</strong>
            <span>{emptyBody}</span>
            <Link className="button secondary" href={createPlanHref}>Create Plan</Link>
          </section>
        ) : null}
        <section className="mobile-list plans-feed-deck-list" aria-label={viewLabels[activeView]}>
          {activeView === 'feed' ? feedItems.map((item) => {
            if (item.type === 'idea') return <PlanIdeaCard key={`idea-${item.ideaKey}`} ideaKey={item.ideaKey} onOpen={() => markStarterIdeaSeen(item.ideaKey)} />;
            const plan = sortedPlans[item.planIndex];
            return plan ? <PlanCard key={plan.id} plan={plan} /> : null;
          }) : sortedPlans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
        </section>
      </main>
    </PlansFeatureGate>
  );
}

function PlansGuideIntroBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section className="home-guide-entry home-guide-entry--plans" aria-labelledby="plans-guide-entry-title">
      <span className="home-guide-entry__icon" aria-hidden="true"><WebIcon name="plan" size={18} decorative /></span>
      <div className="home-guide-entry__copy">
        <span className="semantic-badge instruction">Plans guide</span>
        <h2 id="plans-guide-entry-title">New to Plans?</h2>
        <p>Take a quick tour of Plans, Places, joining, creating, and safety.</p>
      </div>
      <div className="home-guide-entry__actions">
        <Link href="/onboarding-guide?guide=plans&replay=1&next=/plans" className="button primary">Open guide</Link>
        <button type="button" className="button secondary" onClick={onDismiss}>Dismiss</button>
      </div>
    </section>
  );
}
