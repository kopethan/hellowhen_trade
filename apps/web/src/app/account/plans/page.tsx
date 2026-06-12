import { redirect } from 'next/navigation';

export default function AccountPlansPage() {
  // Legacy /account/plans is kept only as a safe redirect for old internal links.
  redirect('/account/membership');
}
