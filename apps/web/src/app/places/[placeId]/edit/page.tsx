import { permanentRedirect } from 'next/navigation';
import { noIndexMetadata } from '../../../../lib/seo';
import { PlaceCreateClient } from '../../../../features/plans/PlaceCreateClient';
import { getPlansWebFlags } from '../../../../lib/serverFeatureFlags';

export const metadata = noIndexMetadata('Edit Place — Hellowhen Trade');

export default function EditPlacePage({ params }: { params: { placeId: string } }) {
  const flags = getPlansWebFlags();
  if (!flags.plansEnabled) permanentRedirect('/trades');

  return <PlaceCreateClient {...flags} placeId={params.placeId} />;
}
