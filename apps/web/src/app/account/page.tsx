import { MobilePage, PageIntro } from '../../components/MobilePage';
import { WebAuthSummary } from '../../components/WebAuthSummary';
import { AccountHubClient } from '../../features/account/AccountHubClient';

export default function AccountPage() {
  return (
    <MobilePage>
      <PageIntro
        eyebrow="Private"
        title="Account"
        body="Your profile, optional wallet money, payouts, settings, and support live here."
      />
      <WebAuthSummary />
      <AccountHubClient />
    </MobilePage>
  );
}
