import { ProposalConversationClient } from "../../../../../features/trade/ProposalConversationClient";

type ProposalConversationPageProps = {
  params: Promise<{ tradeId: string; proposalId: string }>;
  searchParams?: Promise<{
    editProposal?: string;
    proposalNeedId?: string;
    proposalOfferId?: string;
  }>;
};

export default async function ProposalConversationPage({
  params,
  searchParams,
}: ProposalConversationPageProps) {
  const { tradeId, proposalId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <ProposalConversationClient
      tradeId={tradeId}
      proposalId={proposalId}
      initialEditProposal={resolvedSearchParams.editProposal === "1"}
      initialProposalNeedId={resolvedSearchParams.proposalNeedId}
      initialProposalOfferId={resolvedSearchParams.proposalOfferId}
    />
  );
}
