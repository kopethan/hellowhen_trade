export default function CreditsSuccessPage() {
  return (
    <section className="card" style={{ display: 'grid', gap: 12 }}>
      <span className="semantic-badge success">Payment completed</span>
      <h1>Stripe test payment completed</h1>
      <p className="notice-box info">Return to the Hellowhen mobile app and pull to refresh your Account wallet. The webhook creates a credit_purchase ledger entry after Stripe confirms the test checkout session.</p>
      <p className="meta">Purchased credits are non-withdrawable fake/test credits. No real payouts or Stripe Connect flows are enabled.</p>
    </section>
  );
}
