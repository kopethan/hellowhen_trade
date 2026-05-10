import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MobilePage, PageIntro } from '../../../components/MobilePage';
import { betaFeatures } from '../../../lib/betaFeatures';
import { WalletClient } from '../../../features/account/WalletClient';

export default function AccountWalletPage() {
  if (!betaFeatures.walletVisible) redirect('/account');

  return (
    <MobilePage>
      <PageIntro
        eyebrow="Optional"
        title="Wallet"
        body="Manage optional exchange balances when this roadmap feature is enabled."
        action={<Link href="/account/wallet/add" className="button primary">Add</Link>}
      />
      <WalletClient />
    </MobilePage>
  );
}
