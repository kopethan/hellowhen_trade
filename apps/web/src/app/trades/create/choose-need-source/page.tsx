import { TradeSideChoosePage } from '../../../../features/trade/TradeSideChoosePage';

type ChooseNeedSourcePageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string; postType?: string; returnTo?: string }>;
};

export default async function ChooseNeedSourcePage({ searchParams }: ChooseNeedSourcePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const postType = resolvedSearchParams.postType === 'need_offer' || resolvedSearchParams.postType === 'open_need' || resolvedSearchParams.postType === 'open_offer'
    ? resolvedSearchParams.postType
    : 'need_offer';

  return (
    <TradeSideChoosePage
      side="need"
      currentNeedId={resolvedSearchParams.needId}
      currentOfferId={resolvedSearchParams.offerId}
      initialSource=""
      postType={postType}
      returnTo={resolvedSearchParams.returnTo === 'full' ? 'full' : ''}
    />
  );
}
