import type { Metadata } from 'next';
import { TradeDetailClient } from '../../../features/trade/TradeDetailClient';
import { isWebDemoDataEnabled } from '../../../lib/demoMode';
import { mockTrades } from '../../../lib/mockData';
import { publicTradeDetailMetadata } from '../../../lib/tradeMetadata';

type TradeDetailPageProps = {
  params: Promise<{ tradeId: string }>;
};

export async function generateMetadata({ params }: TradeDetailPageProps): Promise<Metadata> {
  const { tradeId } = await params;
  return publicTradeDetailMetadata(tradeId);
}

export default async function TradeDetailPage({ params }: TradeDetailPageProps) {
  const { tradeId } = await params;
  const initialTrade = isWebDemoDataEnabled() ? mockTrades.find((item) => item.id === tradeId) ?? null : null;
  return <TradeDetailClient tradeId={tradeId} initialTrade={initialTrade} />;
}
