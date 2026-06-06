import { TradeSideChoosePage } from '../../../../features/trade/TradeSideChoosePage';

type ChooseOfferPageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string; source?: string; postType?: string; returnTo?: string }>;
};

export default async function ChooseOfferPage({ searchParams }: ChooseOfferPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return <TradeSideChoosePage side="offer" currentNeedId={resolvedSearchParams.needId} currentOfferId={resolvedSearchParams.offerId} initialSource={resolvedSearchParams.source === 'mine' || resolvedSearchParams.source === 'starter' ? resolvedSearchParams.source : ''} postType={resolvedSearchParams.postType === 'need_offer' || resolvedSearchParams.postType === 'open_need' || resolvedSearchParams.postType === 'open_offer' ? resolvedSearchParams.postType : 'need_offer'} returnTo={resolvedSearchParams.returnTo === 'full' ? 'full' : ''} />;
}
