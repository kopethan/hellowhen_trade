'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PlanDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { PlansFeatureGate } from './PlansFeatureGate';
import { PlanDtoPreviewDeck } from './PlanPreviewDeck';
import { planOwnerName } from './plansPresentation';

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

export function PlansListClient({ plansEnabled }: PlansListClientProps) {
  const auth = useWebAuth();
  const [view, setView] = useState<PlansView>('feed');
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const canLoadPrivateViews = auth.hydrated && auth.isAuthenticated;
  const activeView = view !== 'feed' && !canLoadPrivateViews ? 'feed' : view;
  const createPlanHref = auth.isAuthenticated ? '/plans/new' : nextAuthHref('/plans/new');
  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    if (requestedView === 'mine' || requestedView === 'joined' || requestedView === 'feed') setView(requestedView);
  }, []);

  const emptyTitle = activeView === 'mine' ? 'No Plans created yet' : activeView === 'joined' ? 'No joined Plans yet' : 'No open Plans yet';
  const emptyBody = activeView === 'mine'
    ? 'Create your first Plan when you are ready.'
    : activeView === 'joined'
      ? 'Plans you join will appear here.'
      : 'Open Plans will appear here when they are available.';

  useEffect(() => {
    let mounted = true;
    async function loadPlans() {
      if (!auth.hydrated) return;
      setLoading(true);
      setError('');
      try {
        const response = activeView === 'mine'
          ? await api.plans.mine()
          : activeView === 'joined'
            ? await api.plans.joined()
            : await api.plans.feed({ take: 50 });
        if (!mounted) return;
        setPlans(response.plans ?? []);
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
  }, [activeView, auth.hydrated]);

  const sortedPlans = useMemo(() => [...plans].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()), [plans]);

  function selectView(nextView: PlansView) {
    setView(nextView);
    setFiltersOpen(false);
    setMenuOpen(false);
  }

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page plans-feed-page">
        <section className="plans-feed-shell" aria-label="Plans feed">
          <header className="plans-feed-header">
            <div>
              <h1>Plans</h1>
            </div>
            <div className="plans-feed-header__actions" aria-label="Plan actions">
              <button
                type="button"
                className="plans-feed-icon-button"
                aria-label="Filter Plans"
                aria-expanded={filtersOpen}
                onClick={() => { setFiltersOpen((current) => !current); setMenuOpen(false); }}
              >
                <span aria-hidden="true">◇</span>
              </button>
              <button
                type="button"
                className="plans-feed-icon-button"
                aria-label="Open Plans menu"
                aria-expanded={menuOpen}
                onClick={() => { setMenuOpen((current) => !current); setFiltersOpen(false); }}
              >
                <span aria-hidden="true">☰</span>
              </button>
              <Link className="plans-feed-icon-button plans-feed-icon-button--primary" href={createPlanHref} aria-label="Create Plan">
                <span aria-hidden="true">+</span>
              </Link>
            </div>
          </header>

          {filtersOpen ? (
            <section className="plans-feed-popover" aria-label="Plan filters">
              {(Object.keys(viewLabels) as PlansView[]).map((nextView) => (
                <button
                  key={nextView}
                  type="button"
                  className={activeView === nextView ? 'is-active' : ''}
                  disabled={nextView !== 'feed' && !canLoadPrivateViews}
                  onClick={() => selectView(nextView)}
                >
                  {viewLabels[nextView]}
                </button>
              ))}
            </section>
          ) : null}

          {menuOpen ? (
            <section className="plans-feed-menu" aria-label="Plans menu">
              <button type="button" onClick={() => selectView('mine')} disabled={!canLoadPrivateViews}>My plans</button>
              <button type="button" onClick={() => selectView('joined')} disabled={!canLoadPrivateViews}>Joined plans</button>
              <button type="button" disabled>My places</button>
              <button type="button" disabled>Hellowhen Place Library</button>
              <button type="button" disabled>Create place</button>
              <Link href={createPlanHref}>Create plan</Link>
            </section>
          ) : null}

          <div className="plans-feed-view-label" aria-live="polite">
            <span>{viewLabels[activeView]}</span>
          </div>
        </section>

        {error ? <section className="mobile-card mobile-card--soft"><p>{error}</p></section> : null}
        {loading ? <section className="mobile-card"><p className="meta">Loading Plans...</p></section> : null}
        {!loading && !error && sortedPlans.length === 0 ? (
          <section className="inventory-empty-state">
            <span className="inventory-empty-state__plus">+</span>
            <strong>{emptyTitle}</strong>
            <span>{emptyBody}</span>
            <Link className="button secondary" href={createPlanHref}>Create Plan</Link>
          </section>
        ) : null}
        <section className="mobile-list plans-feed-deck-list" aria-label={viewLabels[activeView]}>
          {sortedPlans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
        </section>
      </main>
    </PlansFeatureGate>
  );
}
