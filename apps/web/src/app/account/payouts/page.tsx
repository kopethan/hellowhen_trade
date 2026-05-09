import { MobilePage, PageIntro } from '../../../components/MobilePage';
import { MoneyOffNotice, betaFeatures } from '../../../lib/betaFeatures';
import { PayoutsClient } from '../../../features/account/PayoutsClient';

export default function PayoutsPage() {
  return (
    <MobilePage>
      <PageIntro
        eyebrow={betaFeatures.payoutsVisible ? "Demo" : "Beta"}
        title="Payouts"
        body={betaFeatures.payoutsVisible ? "Connect a demo payout account and simulate payout requests for eligible trade earnings." : "Payouts are hidden for the beta launch while real-money flows stay disabled."}
      />
      {betaFeatures.payoutsVisible ? <PayoutsClient /> : <MoneyOffNotice title="Payouts are hidden for beta" />}
    </MobilePage>
  );
}
