import { TradeDetailClient } from '../../../features/trade/TradeDetailClient';
import { mockTrades } from '../../../lib/mockData';

type TradeDetailPageProps = {
  params: Promise<{ tradeId: string }>;
};

export default async function TradeDetailPage({ params }: TradeDetailPageProps) {
  const { tradeId } = await params;
  const initialTrade = mockTrades.find((item) => item.id === tradeId) ?? null;
  return <TradeDetailClient tradeId={tradeId} initialTrade={initialTrade} />;
}
