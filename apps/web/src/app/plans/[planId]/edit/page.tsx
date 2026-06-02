import { permanentRedirect } from 'next/navigation';
import { noIndexMetadata } from '../../../../lib/seo';
import { PlanEditClient } from '../../../../features/plans/PlanEditClient';
import { getPlansWebFlags } from '../../../../lib/serverFeatureFlags';

export const metadata = noIndexMetadata('Edit Plan — Hellowhen Trade');


type PlanEditPageProps = {
  params: Promise<{ planId: string }>;
};

export default async function PlanEditPage({ params }: PlanEditPageProps) {
  const { planId } = await params;
  const flags = getPlansWebFlags();
  if (!flags.plansEnabled) permanentRedirect('/trades');

  return <PlanEditClient planId={planId} {...flags} />;
}
