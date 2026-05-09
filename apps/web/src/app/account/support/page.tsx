import { MobilePage, PageIntro } from '../../../components/MobilePage';
import { SupportClient } from '../../../features/account/SupportClient';

export default function AccountSupportPage() {
  return (
    <MobilePage>
      <PageIntro
        eyebrow="Support"
        title="Get help"
        body="Create support tickets, attach screenshots, and follow replies from one mobile-web account screen."
      />
      <SupportClient />
    </MobilePage>
  );
}
