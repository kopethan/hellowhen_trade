import { permanentRedirect } from 'next/navigation';
import { noIndexMetadata } from '../../lib/seo';
import { PlansListClient } from '../../features/plans/PlansListClient';
import { getPlansWebFlags } from '../../lib/serverFeatureFlags';

export const metadata = noIndexMetadata('Plans — Hellowhen Trade');


export default function PlansPage() {
  const flags = getPlansWebFlags();
  if (!flags.plansEnabled) permanentRedirect('/trades');

  return <PlansListClient {...flags} />;
}
