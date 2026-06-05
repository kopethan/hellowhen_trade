import type { Metadata } from 'next';
import { TradeDetailClient } from '../../../features/trade/TradeDetailClient';
import { isWebDemoDataEnabled } from '../../../lib/demoMode';
import { mockTrades } from '../../../lib/mockData';
import { publicTradeDetailMetadata } from '../../../lib/tradeMetadata';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type TradeDetailRouteParams = { tradeId: string };
type TradeDetailPageProps = {
  params: TradeDetailRouteParams | Promise<TradeDetailRouteParams>;
};

async function resolveTradeId(params: TradeDetailPageProps['params']) {
  const resolvedParams = await params;
  return resolvedParams.tradeId;
}

export async function generateMetadata({ params }: TradeDetailPageProps): Promise<Metadata> {
  const tradeId = await resolveTradeId(params);
  return publicTradeDetailMetadata(tradeId);
}

export default async function TradeDetailPage({ params }: TradeDetailPageProps) {
  const tradeId = await resolveTradeId(params);
  const initialTrade = isWebDemoDataEnabled() ? mockTrades.find((item) => item.id === tradeId) ?? null : null;
  return <TradeDetailClient tradeId={tradeId} initialTrade={initialTrade} />;
}
