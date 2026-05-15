'use client';

import Link from 'next/link';
import { betaFeatures } from '../../lib/betaFeatures';

export function PlansFeatureGate({ children }: { children: React.ReactNode }) {
  if (betaFeatures.plansEnabled) return <>{children}</>;

  return (
    <main className="mobile-page plans-page">
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">Hidden feature</span>
        <h2>Plans are disabled for this launch.</h2>
        <p>
          The Plans foundation is installed, but the backend flag is off. Keep this off for the first public Trade launch.
        </p>
        <div className="cta-row">
          <Link className="button secondary" href="/trades">Back to Trades</Link>
        </div>
      </section>
    </main>
  );
}

export function PlansInternalBadge() {
  if (betaFeatures.plansVisible) return null;
  return <span className="semantic-badge instruction">Internal preview</span>;
}
