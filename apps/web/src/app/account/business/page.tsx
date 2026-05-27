import { redirect } from 'next/navigation';
import { MobilePage } from '../../../components/MobilePage';
import { TranslatedPageIntro } from '../../../components/TranslatedPageIntro';
import { betaFeatures } from '../../../lib/betaFeatures';
import { BusinessAccountsClient } from '../../../features/account/BusinessAccountsClient';

export default function AccountBusinessPage() {
  if (!betaFeatures.businessAccountsVisible) redirect('/account');

  return (
    <MobilePage>
      <TranslatedPageIntro
        eyebrowKey="account.items.business.title"
        titleKey="account.business.title"
        bodyKey="account.items.business.body"
      />
      <BusinessAccountsClient />
    </MobilePage>
  );
}
