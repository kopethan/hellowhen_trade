import { permanentRedirect } from 'next/navigation';
import { noIndexMetadata } from '../../../lib/seo';
import { PlanCreateClient } from '../../../features/plans/PlanCreateClient';
import { getPlansWebFlags } from '../../../lib/serverFeatureFlags';

export const metadata = noIndexMetadata('Create Plan — Hellowhen Trade');


export default function NewPlanPage() {
  const flags = getPlansWebFlags();
  if (!flags.plansEnabled) permanentRedirect('/trades');

  return <PlanCreateClient {...flags} />;
}
