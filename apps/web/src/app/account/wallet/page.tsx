import Link from 'next/link';
import { MobilePage, PageIntro } from '../../../components/MobilePage';
import { betaFeatures, MoneyOffNotice } from '../../../lib/betaFeatures';
import { WalletClient } from '../../../features/account/WalletClient';

export default function AccountWalletPage() {
  return (
    <MobilePage>
      <PageIntro
        eyebrow="Optional"
        title="Wallet"
        body={betaFeatures.walletVisible ? "Wallet money is optional and can be selected under I need or I offer when creating a trade." : "Money features are hidden for the beta launch while Hellowhen focuses on service and goods trades."}
        action={betaFeatures.walletVisible ? <Link href="/account/wallet/add" className="button primary">Add</Link> : undefined}
      />
      {betaFeatures.walletVisible ? <WalletClient /> : <MoneyOffNotice title="Wallet is hidden for beta" />}
    </MobilePage>
  );
}
