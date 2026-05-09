import { MobilePage, PageIntro } from '../../../../components/MobilePage';
import { AddMoneyClient } from '../../../../features/account/AddMoneyClient';

export default function AddMoneyPage() {
  return (
    <MobilePage>
      <PageIntro
        eyebrow="Demo"
        title="Add money"
        body="Try the wallet top-up simulation. No real Stripe integration or card charge is used in this phase."
      />
      <AddMoneyClient />
    </MobilePage>
  );
}
