import { redirect } from 'next/navigation';
import { MobilePage, PageIntro } from '../../../components/MobilePage';
import { betaFeatures } from '../../../lib/betaFeatures';
import { PayoutsClient } from '../../../features/account/PayoutsClient';

export default function PayoutsPage() {
  if (!betaFeatures.payoutsVisible) redirect('/account');

  return (
    <MobilePage>
      <PageIntro
        eyebrow="Account"
        title="Payouts"
        body="Manage payout settings when this roadmap feature is enabled."
      />
      <PayoutsClient />
    </MobilePage>
  );
}
