'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStarterPlanIdea, starterPlanIdeaMode, starterPlanIdeaRequirementCounts, starterPlanIdeaRequirementSummary, starterPlanIdeaStopDestinationPrompt, starterPlanIdeaStopRequirementLabel } from '@hellowhen/shared';
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
  const requirementCounts = idea ? starterPlanIdeaRequirementCounts(idea) : null;

  function createVersion() {
    if (!idea) return;
    const href = `/plans/new?idea=${encodeURIComponent(idea.id)}`;
    router.push(auth.isAuthenticated ? href : authHref(href));
  }

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page plan-idea-detail-page">
        <header className="plans-filter-header">
          <Link className="plans-feed-icon-button" href="/plans" aria-label="Back to Plans"><WebIcon name="back" size={18} decorative /></Link>
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
                <span>{starterPlanIdeaRequirementSummary(idea)}</span>
              </div>
            </section>

            <section className="plan-idea-notice">
              <WebIcon name="plan" size={20} decorative />
              <div>
                <strong>Review first</strong>
                <span>This starter idea is not a real user Plan. It gives structure only: you still add confirmed addresses or real online links before publishing.</span>
              </div>
            </section>

            <section className="plan-idea-requirements" aria-label="What you need before publishing this Plan idea">
              <div>
                <strong>Before publishing, add</strong>
                <span>{starterPlanIdeaRequirementSummary(idea)}. Hellowhen will not save prompt text as an offline address.</span>
              </div>
              <div className="plan-idea-requirement-grid">
                {requirementCounts?.addressStops ? (
                  <span className="plan-idea-requirement-pill">
                    <span>{requirementCounts.addressStops}</span>
                    real address{requirementCounts.addressStops === 1 ? '' : 'es'}
                  </span>
                ) : null}
                {requirementCounts?.onlineLinkStops ? (
                  <span className="plan-idea-requirement-pill">
                    <span>{requirementCounts.onlineLinkStops}</span>
                    online link{requirementCounts.onlineLinkStops === 1 ? '' : 's'}
                  </span>
                ) : null}
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
                      <span className={`semantic-badge ${stop.mode === 'remote' ? 'info' : 'warning'}`}>{starterPlanIdeaStopRequirementLabel(stop)}</span>
                    </div>
                    <h3>{stop.title}</h3>
                    <p>{starterPlanIdeaStopDestinationPrompt(stop)}</p>
                    <small>{stop.mode === 'remote' ? 'Prompt only — add a real link in Create Plan.' : 'Prompt only — select a provider address in Create Plan.'}</small>
                  </div>
                </article>
              ))}
            </section>

            <section className="plan-idea-next-card">
              <div>
                <strong>Ready to customize?</strong>
                <span>Create your version opens Create Plan with these stops as editable prompts. Offline prompts stay blocked until a confirmed address is selected.</span>
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
