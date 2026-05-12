import { PublicUserProfileClient } from '../../../features/users/PublicUserProfileClient';

type PublicUserProfilePageProps = {
  params: Promise<{ userId: string }>;
};

export default async function PublicUserProfilePage({ params }: PublicUserProfilePageProps) {
  const { userId } = await params;
  return <PublicUserProfileClient userId={userId} />;
}
