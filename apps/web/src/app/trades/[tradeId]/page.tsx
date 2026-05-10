import { TradeDetailClient } from '../../../features/trade/TradeDetailClient';
import { isWebDemoDataEnabled } from '../../../lib/demoMode';
import { mockTrades } from '../../../lib/mockData';

type TradeDetailPageProps = {
  params: Promise<{ tradeId: string }>;
};

export default async function TradeDetailPage({ params }: TradeDetailPageProps) {
  const { tradeId } = await params;
  const initialTrade = isWebDemoDataEnabled() ? mockTrades.find((item) => item.id === tradeId) ?? null : null;
  return <TradeDetailClient tradeId={tradeId} initialTrade={initialTrade} />;
}
