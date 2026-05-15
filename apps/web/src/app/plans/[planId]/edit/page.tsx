import { PlanEditClient } from '../../../../features/plans/PlanEditClient';
import { getPlansWebFlags } from '../../../../lib/serverFeatureFlags';

type PlanEditPageProps = {
  params: Promise<{ planId: string }>;
};

export default async function PlanEditPage({ params }: PlanEditPageProps) {
  const { planId } = await params;
  return <PlanEditClient planId={planId} {...getPlansWebFlags()} />;
}
