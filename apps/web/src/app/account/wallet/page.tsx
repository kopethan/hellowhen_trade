import Link from 'next/link';
import { MobilePage, PageIntro } from '../../../components/MobilePage';
import { WalletClient } from '../../../features/account/WalletClient';

export default function AccountWalletPage() {
  return (
    <MobilePage>
      <PageIntro
        eyebrow="Optional"
        title="Wallet"
        body="Wallet money is optional and can be selected under I need or I offer when creating a trade."
        action={<Link href="/account/wallet/add" className="button primary">Add</Link>}
      />
      <WalletClient />
    </MobilePage>
  );
}
