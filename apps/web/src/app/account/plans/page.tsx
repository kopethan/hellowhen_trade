import { notFound } from 'next/navigation';
import { MobilePage } from '../../../components/MobilePage';
import { PlanSelectionClient } from '../../../features/account/PlanSelectionClient';
import { betaFeatures } from '../../../lib/betaFeatures';

export default function AccountPlansPage() {
  if (!betaFeatures.proSubscriptionFeatures.proAccountsVisible) notFound();

  return (
    <MobilePage>
      <PlanSelectionClient />
    </MobilePage>
  );
}
