import { MobilePage } from '../../components/MobilePage';
import { WebAuthSummary } from '../../components/WebAuthSummary';
import { AccountHubClient } from '../../features/account/AccountHubClient';

export default function AccountPage() {
  return (
    <MobilePage>
      <WebAuthSummary />
      <AccountHubClient />
    </MobilePage>
  );
}
