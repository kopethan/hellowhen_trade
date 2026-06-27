import { permanentRedirect } from 'next/navigation';
import { noIndexMetadata } from '../../lib/seo';
import { PlacesManageClient } from '../../features/plans/PlacesManageClient';
import { getPlansWebFlags } from '../../lib/serverFeatureFlags';

export const metadata = noIndexMetadata('My Places — Hellowhen Trade');

export default function PlacesPage() {
  const flags = getPlansWebFlags();
  if (!flags.plansEnabled) permanentRedirect('/trades');

  return <PlacesManageClient {...flags} />;
}
