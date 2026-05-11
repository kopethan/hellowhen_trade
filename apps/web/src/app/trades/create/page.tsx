import { TradeCreateClient } from '../../../features/trade/TradeCreateClient';

type CreateTradePageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string; postType?: string }>;
};

export default async function CreateTradePage({ searchParams }: CreateTradePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return <TradeCreateClient initialNeedId={resolvedSearchParams.needId} initialOfferId={resolvedSearchParams.offerId} initialPostType={resolvedSearchParams.postType} />;
}
