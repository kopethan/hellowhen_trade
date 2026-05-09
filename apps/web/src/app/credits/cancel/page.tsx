import Link from 'next/link';

export default function CreditsCancelPage() {
  return (
    <section className="card" style={{ display: 'grid', gap: 12 }}>
      <span className="semantic-badge warning">Checkout cancelled</span>
      <h1>Demo top-up cancelled</h1>
      <p className="notice-box warning">No wallet money was added. This return page is kept for compatibility with existing test checkout URLs.</p>
      <Link href="/account/wallet" className="button primary">Open wallet</Link>
    </section>
  );
}
