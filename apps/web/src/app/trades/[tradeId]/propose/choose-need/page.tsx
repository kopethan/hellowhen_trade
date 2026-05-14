import { TradeSideChoosePage } from '../../../../../features/trade/TradeSideChoosePage';

type ProposalChooseNeedPageProps = {
  params: Promise<{ tradeId: string }>;
  searchParams?: Promise<{ proposalNeedId?: string; proposalOfferId?: string; source?: string }>;
};

export default async function ProposalChooseNeedPage({ params, searchParams }: ProposalChooseNeedPageProps) {
  const { tradeId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <TradeSideChoosePage
      mode="proposal"
      tradeId={tradeId}
      side="need"
      currentNeedId={resolvedSearchParams.proposalNeedId}
      currentOfferId={resolvedSearchParams.proposalOfferId}
      initialSource={resolvedSearchParams.source === 'mine' || resolvedSearchParams.source === 'starter' ? resolvedSearchParams.source : ''}
    />
  );
}
