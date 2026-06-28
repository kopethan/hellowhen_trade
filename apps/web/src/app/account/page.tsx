import { MobilePage } from '../../components/MobilePage';
import { AccountHubClient } from '../../features/account/AccountHubClient';

export default function AccountPage() {
  return (
    <MobilePage className="web-app-page web-app-page--me">
      <AccountHubClient />
    </MobilePage>
  );
}
