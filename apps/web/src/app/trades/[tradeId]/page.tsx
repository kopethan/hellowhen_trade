import { TradeDetailClient } from '../../../features/trade/TradeDetailClient';
import { mockTrades } from '../../../lib/mockData';

export default function TradeDetailPage({ params }: { params: { tradeId: string } }) {
  const initialTrade = mockTrades.find((item) => item.id === params.tradeId) ?? null;
  return <TradeDetailClient tradeId={params.tradeId} initialTrade={initialTrade} />;
}
