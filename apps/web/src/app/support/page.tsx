import type { CreateGuestSupportTicketRequest } from '@hellowhen/contracts';
import { PublicSupportClient } from '../../features/account/PublicSupportClient';

type GuestSupportCategory = CreateGuestSupportTicketRequest['category'];

type PublicSupportPageProps = {
  searchParams?: Promise<{ category?: string | string[] }>;
};

const allowedGuestCategories: GuestSupportCategory[] = [
  'account_recovery',
  'account_issue',
  'safety_concern',
  'bug_report',
  'general_feedback',
];

function getInitialCategory(value?: string | string[]) {
  const requested = Array.isArray(value) ? value[0] : value;
  if (requested && allowedGuestCategories.includes(requested as GuestSupportCategory)) return requested as GuestSupportCategory;
  return 'account_recovery';
}

export default async function PublicSupportPage({ searchParams }: PublicSupportPageProps) {
  const params = await searchParams;
  return <PublicSupportClient initialCategory={getInitialCategory(params?.category)} />;
}
