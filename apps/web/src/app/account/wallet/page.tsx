import { redirect } from 'next/navigation';
import { MobilePage } from '../../../components/MobilePage';
import { TranslatedPageIntro, TranslatedPageIntroLinkAction } from '../../../components/TranslatedPageIntro';
import { betaFeatures } from '../../../lib/betaFeatures';
import { WalletClient } from '../../../features/account/WalletClient';

export default function AccountWalletPage() {
  if (!betaFeatures.walletVisible) redirect('/account');

  return (
    <MobilePage>
      <TranslatedPageIntro
        eyebrowKey="account.wallet.optionalWallet"
        titleKey="account.wallet.title"
        bodyKey="account.walletPageBody"
        action={<TranslatedPageIntroLinkAction href="/account/wallet/add" labelKey="common.actions.add" />}
      />
      <WalletClient />
    </MobilePage>
  );
}
