'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStarterPlanIdea, starterPlanIdeaMode } from '@hellowhen/shared';
import { PlansFeatureGate } from './PlansFeatureGate';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { WebIcon } from '../../components/WebIcon';

type PlanIdeaDetailClientProps = {
  ideaId: string;
  plansEnabled?: boolean;
};

function authHref(path: string) {
  return `/auth?next=${encodeURIComponent(path)}`;
}

export function PlanIdeaDetailClient({ ideaId, plansEnabled }: PlanIdeaDetailClientProps) {
  const router = useRouter();
  const auth = useWebAuth();
  const idea = getStarterPlanIdea(ideaId);

  function createVersion() {
    if (!idea) return;
    const href = `/plans/new?idea=${encodeURIComponent(idea.id)}`;
    router.push(auth.isAuthenticated ? href : authHref(href));
  }

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page plan-idea-detail-page">
        <header className="plans-filter-header">
          <Link className="plans-feed-icon-button" href="/plans" aria-label="Back to Plans">‹</Link>
          <div>
            <h1>Plan idea</h1>
            <p>Review a transparent starter Plan before creating your own version.</p>
          </div>
        </header>

        {!idea ? (
          <section className="inventory-empty-state">
            <span className="inventory-empty-state__plus">?</span>
            <strong>Plan idea not found</strong>
            <span>This starter Plan idea is not available anymore.</span>
            <Link className="button secondary" href="/plans">Back to Plans</Link>
          </section>
        ) : (
          <>
            <section className="plan-idea-hero">
              <div className="plan-idea-hero__top">
                <span className="semantic-badge instruction">Plan idea · {idea.pack}</span>
                <span className="semantic-badge plan">{starterPlanIdeaMode(idea) === 'remote' ? 'Online' : 'Local'}</span>
              </div>
              <h2>{idea.title}</h2>
              <p>{idea.description}</p>
              <div className="plan-idea-hero__meta">
                <span>{idea.stops.length} starter stops</span>
                <span>{idea.category}</span>
                <span>Create your version</span>
              </div>
            </section>

            <section className="plan-idea-notice">
              <WebIcon name="plan" size={20} decorative />
              <div>
                <strong>Customize first</strong>
                <span>This is a starter idea, not a real user Plan. It will open Create Plan with editable stops, and nothing is published until you review and create it.</span>
              </div>
            </section>

            <section className="plan-idea-stops" aria-label="Starter Plan stops">
              {idea.stops.map((stop, index) => (
                <article key={`${idea.id}-${stop.title}`} className="plan-idea-stop">
                  <span className="plan-idea-stop__number">{index + 1}</span>
                  <div>
                    <div className="plan-idea-stop__badges">
                      <span className="semantic-badge place">{stop.mode === 'remote' ? 'Online' : 'Offline'}</span>
                      <span className="semantic-badge time">{stop.time}</span>
                    </div>
                    <h3>{stop.title}</h3>
                    <p>{stop.mode === 'remote' ? stop.onlineLabel || 'Online place' : stop.location || 'Public meeting point'}</p>
                  </div>
                </article>
              ))}
            </section>

            <section className="plan-idea-next-card">
              <div>
                <strong>Ready to edit?</strong>
                <span>Create your version opens the normal Create Plan flow with this idea prefilled.</span>
              </div>
              <div className="plan-idea-actions">
                <Link className="button secondary" href="/plans">Back to Plans</Link>
                <button type="button" className="button primary" onClick={createVersion}>Create your version</button>
              </div>
            </section>
          </>
        )}
      </main>
    </PlansFeatureGate>
  );
}
