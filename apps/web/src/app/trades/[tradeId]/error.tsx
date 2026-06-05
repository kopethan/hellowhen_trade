'use client';

import Link from 'next/link';

export default function TradeDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <article className="trade-detail-page">
      <section className="trade-hero-section">
        <span className="semantic-badge danger">Trade</span>
        <h2>Trade detail could not open.</h2>
        <p>Try again, or go back to the trade feed and open the trade from there.</p>
        <div className="button-row">
          <button type="button" className="button primary" onClick={reset}>Try again</button>
          <Link href="/trades" className="button secondary">Go to Trades</Link>
        </div>
      </section>
    </article>
  );
}
