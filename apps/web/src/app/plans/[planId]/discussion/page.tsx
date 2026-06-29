import { permanentRedirect } from 'next/navigation';
import { noIndexMetadata } from '../../../../lib/seo';
import { PlanPublicDiscussionClient } from '../../../../features/plans/PlanPublicDiscussionClient';
import { getPlansWebFlags } from '../../../../lib/serverFeatureFlags';

export const metadata = noIndexMetadata('Plan public discussion — Hellowhen Trade');

type PlanPublicDiscussionPageProps = {
  params: Promise<{ planId: string }>;
};

export default async function PlanPublicDiscussionPage({ params }: PlanPublicDiscussionPageProps) {
  const { planId } = await params;
  const flags = getPlansWebFlags();
  if (!flags.plansEnabled) permanentRedirect('/trades');

  return <PlanPublicDiscussionClient planId={planId} />;
}
