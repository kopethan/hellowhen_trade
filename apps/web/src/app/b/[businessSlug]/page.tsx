import { PublicBusinessProfileClient } from '../../../features/business/PublicBusinessProfileClient';

type PublicBusinessProfilePageProps = {
  params: Promise<{ businessSlug: string }>;
};

export default async function PublicBusinessProfilePage({ params }: PublicBusinessProfilePageProps) {
  const { businessSlug } = await params;
  return <PublicBusinessProfileClient businessSlug={businessSlug} />;
}
