import { ExploreInventoryIdeaDetailClient } from '../../../../features/explore/ExploreInventoryIdeaDetailClient';
import { noIndexMetadata } from '../../../../lib/seo';

export const metadata = noIndexMetadata('Offer idea — Hellowhen Explore');

export default async function ExploreOfferIdeaPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <ExploreInventoryIdeaDetailClient kind="offer" templateId={templateId} />;
}
