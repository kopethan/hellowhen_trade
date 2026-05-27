import { TradePrivateProposalsClient } from '../../../../features/trade/TradePrivateProposalsClient';

type TradePrivateProposalsPageProps = {
  params: Promise<{ tradeId: string }>;
};

export default async function TradePrivateProposalsPage({ params }: TradePrivateProposalsPageProps) {
  const { tradeId } = await params;
  return <TradePrivateProposalsClient tradeId={tradeId} />;
}
