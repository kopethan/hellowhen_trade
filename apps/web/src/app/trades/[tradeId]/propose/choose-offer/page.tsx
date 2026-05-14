import { TradeSideChoosePage } from '../../../../../features/trade/TradeSideChoosePage';

type ProposalChooseOfferPageProps = {
  params: Promise<{ tradeId: string }>;
  searchParams?: Promise<{ proposalNeedId?: string; proposalOfferId?: string; source?: string }>;
};

export default async function ProposalChooseOfferPage({ params, searchParams }: ProposalChooseOfferPageProps) {
  const { tradeId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <TradeSideChoosePage
      mode="proposal"
      tradeId={tradeId}
      side="offer"
      currentNeedId={resolvedSearchParams.proposalNeedId}
      currentOfferId={resolvedSearchParams.proposalOfferId}
      initialSource={resolvedSearchParams.source === 'mine' || resolvedSearchParams.source === 'starter' ? resolvedSearchParams.source : ''}
    />
  );
}
