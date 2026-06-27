import type { Metadata } from 'next';
import { PlanIdeaDetailClient } from '../../../../features/plans/PlanIdeaDetailClient';
import { getStarterPlanIdea } from '@hellowhen/shared';
import { publicPageMetadata } from '../../../../lib/seo';

type PlanIdeaDetailRouteParams = { ideaId: string };
type PlanIdeaDetailPageProps = {
  params: PlanIdeaDetailRouteParams | Promise<PlanIdeaDetailRouteParams>;
};

async function resolveIdeaId(params: PlanIdeaDetailPageProps['params']) {
  const resolvedParams = await params;
  return resolvedParams.ideaId;
}

export async function generateMetadata({ params }: PlanIdeaDetailPageProps): Promise<Metadata> {
  const ideaId = await resolveIdeaId(params);
  const idea = getStarterPlanIdea(ideaId);
  return publicPageMetadata({
    title: idea ? `${idea.title} — Plan idea` : 'Plan idea not found — Hellowhen Trade',
    description: idea?.description ?? 'Review a transparent starter Plan idea, then create your own editable version.',
    pathname: idea ? `/plans/ideas/${idea.id}` : '/plans',
  });
}

export default async function PlanIdeaDetailPage({ params }: PlanIdeaDetailPageProps) {
  const ideaId = await resolveIdeaId(params);
  return <PlanIdeaDetailClient ideaId={ideaId} />;
}
