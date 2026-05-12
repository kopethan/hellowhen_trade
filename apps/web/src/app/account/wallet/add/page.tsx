import { redirect } from 'next/navigation';
import { MobilePage } from '../../../../components/MobilePage';
import { TranslatedPageIntro } from '../../../../components/TranslatedPageIntro';
import { betaFeatures } from '../../../../lib/betaFeatures';
import { AddMoneyClient } from '../../../../features/account/AddMoneyClient';

export default function AddMoneyPage() {
  if (!betaFeatures.walletVisible) redirect('/account');

  return (
    <MobilePage>
      <TranslatedPageIntro
        eyebrowKey="account.title"
        titleKey="account.addBalanceTitle"
        bodyKey="account.addBalanceBody"
      />
      <AddMoneyClient />
    </MobilePage>
  );
}
