import { ProposalConversationClient } from "../../../../../features/trade/ProposalConversationClient";

type ProposalConversationPageProps = {
  params: Promise<{ tradeId: string; proposalId: string }>;
};

export default async function ProposalConversationPage({
  params,
}: ProposalConversationPageProps) {
  const { tradeId, proposalId } = await params;
  return (
    <ProposalConversationClient tradeId={tradeId} proposalId={proposalId} />
  );
}
