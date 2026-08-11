import { MobilePage } from '../../../components/MobilePage';
import { TranslatedPageIntro } from '../../../components/TranslatedPageIntro';
import { AccountDeletionClient } from '../../../features/account/AccountDeletionClient';
import { publicPageMetadata } from '../../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Delete your Hellowhen account',
  description: 'Learn how to request deletion of your Hellowhen account and associated data.',
  pathname: '/account/delete',
});

export default function AccountDeletePage() {
  return (
    <MobilePage>
      <TranslatedPageIntro eyebrowKey="account.eyebrow" titleKey="account.deletion.web.title" bodyKey="account.deletion.web.body" />
      <AccountDeletionClient />
    </MobilePage>
  );
}
