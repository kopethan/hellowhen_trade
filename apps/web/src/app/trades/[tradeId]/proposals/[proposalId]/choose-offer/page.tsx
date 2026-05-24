import { ProposalSideChoosePage } from '../../../../../../features/trade/ProposalSideChoosePage';

type ProposalChooseOfferPageProps = {
  params: Promise<{ tradeId: string; proposalId: string }>;
  searchParams?: Promise<{ proposalNeedId?: string; proposalOfferId?: string; source?: string }>;
};

export default async function ProposalChooseOfferPage({
  params,
  searchParams,
}: ProposalChooseOfferPageProps) {
  const { tradeId, proposalId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <ProposalSideChoosePage
      side="offer"
      tradeId={tradeId}
      proposalId={proposalId}
      currentNeedId={resolvedSearchParams.proposalNeedId}
      currentOfferId={resolvedSearchParams.proposalOfferId}
      initialSource={resolvedSearchParams.source === 'mine' || resolvedSearchParams.source === 'starter' ? resolvedSearchParams.source : ''}
    />
  );
}
