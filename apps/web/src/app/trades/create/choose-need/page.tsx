import { TradeSideChoosePage } from '../../../../features/trade/TradeSideChoosePage';

type ChooseNeedPageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string }>;
};

export default async function ChooseNeedPage({ searchParams }: ChooseNeedPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return <TradeSideChoosePage side="need" currentNeedId={resolvedSearchParams.needId} currentOfferId={resolvedSearchParams.offerId} />;
}
