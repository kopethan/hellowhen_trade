import { MobilePage } from '../../../components/MobilePage';
import { TranslatedPageIntro } from '../../../components/TranslatedPageIntro';
import { SupportClient } from '../../../features/account/SupportClient';

export default function AccountSupportPage() {
  return (
    <MobilePage>
      <TranslatedPageIntro
        eyebrowKey="support.title"
        titleKey="support.getHelpTitle"
        bodyKey="support.pageBody"
      />
      <SupportClient />
    </MobilePage>
  );
}
