import { notFound } from 'next/navigation';
import { MobilePage } from '../../../../components/MobilePage';
import { ProOnboardingClient } from '../../../../features/account/ProOnboardingClient';
import { betaFeatures } from '../../../../lib/betaFeatures';

export default function AccountProSetupPage() {
  if (!betaFeatures.proSubscriptionFeatures.proAccountsVisible) notFound();

  return (
    <MobilePage>
      <ProOnboardingClient />
    </MobilePage>
  );
}
