import { TradeCard } from '../../features/trade/TradeCard';
import { mockTrades } from '../../lib/mockData';

export default function TradeFeedPage() {
  return (
    <section>
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="eyebrow">Public Feed</p>
        <h1>Active trades</h1>
        <p>Patch 1 uses mock trades until the API is wired into the web shell.</p>
      </div>
      <div className="grid">
        {mockTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)}
      </div>
    </section>
  );
}
