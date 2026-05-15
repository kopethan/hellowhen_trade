import { PlanDetailClient } from '../../../features/plans/PlanDetailClient';
import { getPlansWebFlags } from '../../../lib/serverFeatureFlags';

type PlanDetailPageProps = {
  params: Promise<{ planId: string }>;
};

export default async function PlanDetailPage({ params }: PlanDetailPageProps) {
  const { planId } = await params;
  return <PlanDetailClient planId={planId} {...getPlansWebFlags()} />;
}
