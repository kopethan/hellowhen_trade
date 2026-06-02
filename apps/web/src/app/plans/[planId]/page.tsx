import { permanentRedirect } from 'next/navigation';
import { noIndexMetadata } from '../../../lib/seo';
import { PlanDetailClient } from '../../../features/plans/PlanDetailClient';
import { getPlansWebFlags } from '../../../lib/serverFeatureFlags';

export const metadata = noIndexMetadata('Plan — Hellowhen Trade');


type PlanDetailPageProps = {
  params: Promise<{ planId: string }>;
};

export default async function PlanDetailPage({ params }: PlanDetailPageProps) {
  const { planId } = await params;
  const flags = getPlansWebFlags();
  if (!flags.plansEnabled) permanentRedirect('/trades');

  return <PlanDetailClient planId={planId} {...flags} />;
}
