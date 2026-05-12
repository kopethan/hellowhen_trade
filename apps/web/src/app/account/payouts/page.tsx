import { redirect } from 'next/navigation';
import { MobilePage } from '../../../components/MobilePage';
import { TranslatedPageIntro } from '../../../components/TranslatedPageIntro';
import { betaFeatures } from '../../../lib/betaFeatures';
import { PayoutsClient } from '../../../features/account/PayoutsClient';

export default function PayoutsPage() {
  if (!betaFeatures.payoutsVisible) redirect('/account');

  return (
    <MobilePage>
      <TranslatedPageIntro
        eyebrowKey="account.title"
        titleKey="account.payouts.title"
        bodyKey="account.payoutsPageBody"
      />
      <PayoutsClient />
    </MobilePage>
  );
}
