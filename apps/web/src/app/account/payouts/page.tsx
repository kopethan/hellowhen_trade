import { MobilePage, PageIntro } from '../../../components/MobilePage';
import { PayoutsClient } from '../../../features/account/PayoutsClient';

export default function PayoutsPage() {
  return (
    <MobilePage>
      <PageIntro
        eyebrow="Demo"
        title="Payouts"
        body="Connect a demo payout account and simulate payout requests for eligible trade earnings."
      />
      <PayoutsClient />
    </MobilePage>
  );
}
