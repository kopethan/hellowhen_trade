import { permanentRedirect } from 'next/navigation';
import { noIndexMetadata } from '../../../../lib/seo';
import { getPlansWebFlags } from '../../../../lib/serverFeatureFlags';
import { PlanCreateClient } from '../../../../features/plans/PlanCreateClient';

export const metadata = noIndexMetadata('Manage Plan — Hellowhen Trade');

type PlanEditPageProps = {
  params: Promise<{ planId: string }>;
};

export default async function PlanEditPage({ params }: PlanEditPageProps) {
  const { planId } = await params;
  const flags = getPlansWebFlags();
  if (!flags.plansEnabled) permanentRedirect('/trades');

  return <PlanCreateClient {...flags} editingPlanId={planId} />;
}
