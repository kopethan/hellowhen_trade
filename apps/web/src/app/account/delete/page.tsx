import { MobilePage } from '../../../components/MobilePage';
import { TranslatedPageIntro } from '../../../components/TranslatedPageIntro';
import { AccountDeletionClient } from '../../../features/account/AccountDeletionClient';

export default function AccountDeletePage() {
  return (
    <MobilePage>
      <TranslatedPageIntro eyebrowKey="account.eyebrow" titleKey="account.deletion.title" bodyKey="account.deletion.body" />
      <AccountDeletionClient />
    </MobilePage>
  );
}
