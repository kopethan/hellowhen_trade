import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="hero">
      <div className="card">
        <p className="eyebrow">Trade-first MVP</p>
        <h1>Needs, offers, and public trades.</h1>
        <p>
          Hellowhen starts clean: no Plans, no old action bar, no place/feed complexity.
          The MVP focuses on publishing trades and preparing a safe fake-credit ledger for later payment review.
        </p>
        <div className="cta-row">
          <Link href="/trades" className="button primary">Open Trade Feed</Link>
          <Link href="/wallet" className="button">View Credits Placeholder</Link>
        </div>
      </div>
      <div className="card">
        <h2>MVP modules</h2>
        <div className="grid">
          <Feature title="Public feed" body="Active trades are visible to everyone." />
          <Feature title="Private needs/offers" body="Needs and offers stay owner-managed." />
          <Feature title="Ledger-first credits" body="Fake credits only in Patch 1." />
        </div>
      </div>
    </section>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <article>
      <span className="badge">Trade</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </article>
  );
}
