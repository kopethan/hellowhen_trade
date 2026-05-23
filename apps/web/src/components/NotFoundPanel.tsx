import Link from 'next/link';

export function NotFoundPanel() {
  return (
    <main className="utility-shell not-found-shell" aria-label="Page not found">
      <section className="app-card not-found-card">
        <span className="semantic-badge warning">404</span>
        <h1>Page not found</h1>
        <p>The page you requested could not be found.</p>
        <div className="button-row">
          <Link href="/trades" className="button primary">Go to Trades</Link>
          <Link href="/account/support" className="button secondary">Contact support</Link>
        </div>
      </section>
    </main>
  );
}
