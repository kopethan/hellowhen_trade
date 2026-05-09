import Link from 'next/link';

export default function CreditsSuccessPage() {
  return (
    <section className="card" style={{ display: 'grid', gap: 12 }}>
      <span className="semantic-badge success">Payment completed</span>
      <h1>Demo top-up completed</h1>
      <p className="notice-box info">Return to the Hellowhen app and refresh your Account wallet. This return page is kept for compatibility with existing test checkout URLs.</p>
      <p className="meta">No real payouts or live Stripe flows are enabled in this web shell phase.</p>
      <Link href="/account/wallet" className="button primary">Open wallet</Link>
    </section>
  );
}
