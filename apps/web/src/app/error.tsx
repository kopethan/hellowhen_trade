'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { MobilePage } from '../components/MobilePage';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Hellowhen web route error', error);
  }, [error]);

  return (
    <MobilePage>
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge warning">Temporary issue</span>
        <h2>Hellowhen could not load this page</h2>
        <p>
          This can happen during a beta deploy or a short server connection issue. Try again in a moment,
          or contact support if it keeps happening.
        </p>
        {error.digest ? <p className="meta">Error reference: {error.digest}</p> : null}
        <div className="button-row">
          <button type="button" onClick={reset}>Try again</button>
          <Link href="/account/support" className="button secondary">Contact support</Link>
          <Link href="/trades" className="button secondary">Go to Trades</Link>
        </div>
      </section>
    </MobilePage>
  );
}
