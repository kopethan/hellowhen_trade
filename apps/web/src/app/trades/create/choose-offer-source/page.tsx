import { TradeSideChoosePage } from '../../../../features/trade/TradeSideChoosePage';

type ChooseOfferSourcePageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string; postType?: string; returnTo?: string }>;
};

export default async function ChooseOfferSourcePage({ searchParams }: ChooseOfferSourcePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const postType = resolvedSearchParams.postType === 'need_offer' || resolvedSearchParams.postType === 'open_need' || resolvedSearchParams.postType === 'open_offer'
    ? resolvedSearchParams.postType
    : 'need_offer';

  return (
    <TradeSideChoosePage
      side="offer"
      currentNeedId={resolvedSearchParams.needId}
      currentOfferId={resolvedSearchParams.offerId}
      initialSource=""
      postType={postType}
      returnTo={resolvedSearchParams.returnTo === 'full' ? 'full' : ''}
    />
  );
}
