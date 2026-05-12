import { MobilePage } from '../../components/MobilePage';
import { TranslatedPageIntro } from '../../components/TranslatedPageIntro';
import { WebAuthSummary } from '../../components/WebAuthSummary';
import { AccountHubClient } from '../../features/account/AccountHubClient';

export default function AccountPage() {
  return (
    <MobilePage>
      <TranslatedPageIntro
        eyebrowKey="account.eyebrow"
        titleKey="account.title"
        bodyKey="account.body"
      />
      <WebAuthSummary />
      <AccountHubClient />
    </MobilePage>
  );
}
