import { HellowhenPlaceDetailClient } from '../../../../features/explore/HellowhenPlaceDetailClient';
import { noIndexMetadata } from '../../../../lib/seo';

export const metadata = noIndexMetadata('Hellowhen Place — Explore');

export default async function ExplorePlacePage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  return <HellowhenPlaceDetailClient placeId={placeId} />;
}
