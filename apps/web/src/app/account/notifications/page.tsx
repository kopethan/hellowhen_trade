import { MobilePage } from '../../../components/MobilePage';
import { TranslatedPageIntro } from '../../../components/TranslatedPageIntro';
import { NotificationsClient } from '../../../features/account/NotificationsClient';

export default function AccountNotificationsPage() {
  return (
    <MobilePage>
      <TranslatedPageIntro
        eyebrowKey="account.eyebrow"
        titleKey="account.notifications.title"
        bodyKey="account.notifications.body"
      />
      <NotificationsClient />
    </MobilePage>
  );
}
