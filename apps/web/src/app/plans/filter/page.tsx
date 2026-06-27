import { permanentRedirect } from 'next/navigation';
import { noIndexMetadata } from '../../../lib/seo';
import { PlanFilterClient } from '../../../features/plans/PlanFilterClient';
import { getPlansWebFlags } from '../../../lib/serverFeatureFlags';

export const metadata = noIndexMetadata('Plan filters — Hellowhen Trade');

export default function PlanFilterPage() {
  const flags = getPlansWebFlags();
  if (!flags.plansEnabled) permanentRedirect('/trades');

  return <PlanFilterClient {...flags} />;
}
