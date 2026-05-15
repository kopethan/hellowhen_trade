'use client';

import Link from 'next/link';
import type { PlanDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { planDateTime, planMediaSrc, planMetadata, planOwnerName, planStatusLabel } from './plansPresentation';

type PlansTab = 'feed' | 'mine';

function PlanCard({ plan }: { plan: PlanDto }) {
  const image = plan.media?.[0] ?? plan.places?.find((place) => place.media?.length)?.media?.[0] ?? null;
  const imageSrc = planMediaSrc(image);
  const participantText = `${plan.participantCount ?? 0}${plan.maxParticipants ? ` / ${plan.maxParticipants}` : ''} joined`;

  return (
    <Link href={`/plans/${plan.id}`} className="plan-preview-card" aria-label={`Open ${plan.title}`}>
      <div className="plan-preview-card__media" aria-hidden="true">
        {imageSrc ? <img src={imageSrc} alt="" loading="lazy" /> : <WebIcon name="trade" size={42} decorative />}
      </div>
      <div className="plan-preview-card__body">
        <div className="status-row">
          <span className="semantic-badge trade">Plan</span>
          <span className="semantic-badge instruction">{planStatusLabel(plan.status)}</span>
        </div>
        <h3>{plan.title}</h3>
        <p>{plan.description}</p>
        <p className="meta">{planMetadata(plan)}</p>
        <div className="plan-preview-card__footer">
          <span>{participantText}</span>
          <strong>{plan.places?.length ?? 0} stops</strong>
        </div>
        <p className="meta">By {planOwnerName(plan)} - {planDateTime(plan.startsAt)}</p>
      </div>
    </Link>
  );
}

export function PlansListClient() {
  const auth = useWebAuth();
  const [tab, setTab] = useState<PlansTab>('feed');
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canLoadMine = auth.hydrated && auth.isAuthenticated;
  const activeTab = tab === 'mine' && !canLoadMine ? 'feed' : tab;
  const emptyTitle = activeTab === 'mine' ? 'No hidden Plans yet' : 'No open Plans yet';
  const emptyBody = activeTab === 'mine'
    ? 'Create an internal test Plan to verify the hidden flow.'
    : 'When Plans are enabled internally, open Plans will appear here.';

  useEffect(() => {
    let mounted = true;
    async function loadPlans() {
      if (!auth.hydrated) return;
      setLoading(true);
      setError('');
      try {
        const response = activeTab === 'mine' ? await api.plans.mine() : await api.plans.feed({ take: 50 });
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
  }, [activeTab, auth.hydrated]);

  const sortedPlans = useMemo(() => [...plans].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()), [plans]);

  return (
    <PlansFeatureGate>
      <main className="mobile-page plans-page">
        <section className="page-intro">
          <div>
            <PlansInternalBadge />
            <h2>Plans</h2>
            <p>Internal preview for joinable activities. Keep hidden from first-launch users.</p>
          </div>
          <Link className="button primary page-intro__action" href={auth.isAuthenticated ? '/plans/new' : '/auth?next=/plans/new'}>Create</Link>
        </section>

        <section className="plans-tabs" aria-label="Plans view">
          <button type="button" className={activeTab === 'feed' ? 'is-active' : ''} onClick={() => setTab('feed')}>Feed</button>
          <button type="button" className={activeTab === 'mine' ? 'is-active' : ''} onClick={() => setTab('mine')} disabled={!canLoadMine}>Mine</button>
        </section>

        {error ? <section className="mobile-card mobile-card--soft"><p>{error}</p></section> : null}
        {loading ? <section className="mobile-card"><p className="meta">Loading Plans...</p></section> : null}
        {!loading && !error && sortedPlans.length === 0 ? (
          <section className="inventory-empty-state">
            <span className="inventory-empty-state__plus">+</span>
            <strong>{emptyTitle}</strong>
            <span>{emptyBody}</span>
            <Link className="button secondary" href={auth.isAuthenticated ? '/plans/new' : '/auth?next=/plans/new'}>Create a test Plan</Link>
          </section>
        ) : null}
        <section className="mobile-list">
          {sortedPlans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
        </section>
      </main>
    </PlansFeatureGate>
  );
}
