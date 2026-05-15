'use client';

import Link from 'next/link';
import { betaFeatures } from '../../lib/betaFeatures';

type PlansFeatureGateProps = {
  children: React.ReactNode;
  plansEnabled?: boolean;
};

export function PlansFeatureGate({ children, plansEnabled = betaFeatures.plansEnabled }: PlansFeatureGateProps) {
  if (plansEnabled) return <>{children}</>;

  return (
    <main className="mobile-page plans-page">
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">Hidden feature</span>
        <h2>Plans are disabled in the web build.</h2>
        <p>
          Set NEXT_PUBLIC_PLANS_ENABLED=true in the root .env file and restart the web dev server to preview this hidden feature.
        </p>
        <div className="cta-row">
          <Link className="button secondary" href="/trades">Back to Trades</Link>
        </div>
      </section>
    </main>
  );
}

export function PlansInternalBadge({ plansVisible = betaFeatures.plansVisible }: { plansVisible?: boolean }) {
  if (plansVisible) return null;
  return <span className="semantic-badge instruction">Internal preview</span>;
}
