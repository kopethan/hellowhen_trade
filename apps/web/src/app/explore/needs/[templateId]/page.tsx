import { ExploreInventoryIdeaDetailClient } from '../../../../features/explore/ExploreInventoryIdeaDetailClient';
import { noIndexMetadata } from '../../../../lib/seo';

export const metadata = noIndexMetadata('Need idea — Hellowhen Explore');

export default async function ExploreNeedIdeaPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <ExploreInventoryIdeaDetailClient kind="need" templateId={templateId} />;
}
