import { MobilePage } from '../../components/MobilePage';
import { AccountHubClient } from '../../features/account/AccountHubClient';

export default function MePage() {
  return (
    <MobilePage className="web-app-page web-app-page--me">
      <AccountHubClient />
    </MobilePage>
  );
}
