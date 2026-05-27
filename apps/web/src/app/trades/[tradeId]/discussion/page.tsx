import { TradePublicDiscussionClient } from '../../../../features/trade/TradePublicDiscussionClient';

type TradePublicDiscussionPageProps = {
  params: Promise<{ tradeId: string }>;
};

export default async function TradePublicDiscussionPage({ params }: TradePublicDiscussionPageProps) {
  const { tradeId } = await params;
  return <TradePublicDiscussionClient tradeId={tradeId} />;
}
