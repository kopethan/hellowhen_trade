import type { Metadata } from 'next';
import { TradeIdeaDetailClient } from '../../../../features/trade/TradeIdeaDetailClient';
import { parseFeedTradeIdeaKey } from '../../../../features/trade/tradeFeedIdeas';
import { publicPageMetadata } from '../../../../lib/seo';


type TradeIdeaDetailRouteParams = { ideaId: string };
type TradeIdeaDetailPageProps = {
  params: TradeIdeaDetailRouteParams | Promise<TradeIdeaDetailRouteParams>;
};

async function resolveIdeaId(params: TradeIdeaDetailPageProps['params']) {
  const resolvedParams = await params;
  return resolvedParams.ideaId;
}

export async function generateMetadata({ params }: TradeIdeaDetailPageProps): Promise<Metadata> {
  const ideaId = await resolveIdeaId(params);
  const validIdeaId = parseFeedTradeIdeaKey(ideaId);
  return publicPageMetadata({
    title: validIdeaId ? 'Trade idea — Hellowhen Trade' : 'Trade idea not found — Hellowhen Trade',
    description: 'Review a transparent starter trade idea, choose an optional expiry, then create your own editable version.',
    pathname: validIdeaId ? `/trades/ideas/${validIdeaId}` : '/trades',
  });
}

export default async function TradeIdeaDetailPage({ params }: TradeIdeaDetailPageProps) {
  const ideaId = await resolveIdeaId(params);
  return <TradeIdeaDetailClient ideaId={ideaId} />;
}
