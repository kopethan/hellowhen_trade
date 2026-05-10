import { TradeSideChoosePage } from '../../../../features/trade/TradeSideChoosePage';

type ChooseOfferPageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string }>;
};

export default async function ChooseOfferPage({ searchParams }: ChooseOfferPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return <TradeSideChoosePage side="offer" currentNeedId={resolvedSearchParams.needId} currentOfferId={resolvedSearchParams.offerId} />;
}
