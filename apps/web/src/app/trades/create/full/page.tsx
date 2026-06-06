import { TradeCreateFullClient } from '../../../../features/trade/TradeCreateFullClient';

type CreateTradeFullPageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string; postType?: string }>;
};

export default async function CreateTradeFullPage({ searchParams }: CreateTradeFullPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return <TradeCreateFullClient initialNeedId={resolvedSearchParams.needId} initialOfferId={resolvedSearchParams.offerId} initialPostType={resolvedSearchParams.postType} />;
}
