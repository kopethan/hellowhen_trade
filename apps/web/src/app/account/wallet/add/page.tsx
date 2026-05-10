import { redirect } from 'next/navigation';
import { MobilePage, PageIntro } from '../../../../components/MobilePage';
import { betaFeatures } from '../../../../lib/betaFeatures';
import { AddMoneyClient } from '../../../../features/account/AddMoneyClient';

export default function AddMoneyPage() {
  if (!betaFeatures.walletVisible) redirect('/account');

  return (
    <MobilePage>
      <PageIntro
        eyebrow="Account"
        title="Add balance"
        body="Manage exchange balance when this roadmap feature is enabled."
      />
      <AddMoneyClient />
    </MobilePage>
  );
}
