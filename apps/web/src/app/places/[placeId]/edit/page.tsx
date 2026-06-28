import { permanentRedirect } from 'next/navigation';
import { noIndexMetadata } from '../../../../lib/seo';
import { PlaceCreateClient } from '../../../../features/plans/PlaceCreateClient';
import { getPlansWebFlags } from '../../../../lib/serverFeatureFlags';

export const metadata = noIndexMetadata('Edit Place — Hellowhen Trade');

type EditPlacePageProps = {
  params: Promise<{ placeId: string }>;
};

export default async function EditPlacePage({ params }: EditPlacePageProps) {
  const { placeId } = await params;
  const flags = getPlansWebFlags();
  if (!flags.plansEnabled) permanentRedirect('/trades');

  return <PlaceCreateClient {...flags} placeId={placeId} />;
}
