import { PublicUserProfileClient } from '../../../features/users/PublicUserProfileClient';

type PublicUsernameProfilePageProps = {
  params: Promise<{ username: string }>;
};

export default async function PublicUsernameProfilePage({ params }: PublicUsernameProfilePageProps) {
  const { username } = await params;
  return <PublicUserProfileClient username={username} />;
}
