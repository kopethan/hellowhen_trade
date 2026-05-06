export default function WalletPage() {
  return (
    <section className="card">
      <p className="eyebrow">Fake credits only</p>
      <h1>Wallet / Credits</h1>
      <p>
        Patch 1 prepares the wallet and ledger model. Real money, Stripe, Stripe Connect, and payouts are intentionally disabled.
      </p>
      <div className="grid">
        <div><span className="badge">Purchased</span><p>Non-withdrawable spending balance.</p></div>
        <div><span className="badge">Earned</span><p>Payout-eligible later after completion and hold period.</p></div>
        <div><span className="badge">Ledger</span><p>Every balance change must create an entry.</p></div>
      </div>
    </section>
  );
}
