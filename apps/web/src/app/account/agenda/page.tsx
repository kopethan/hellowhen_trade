import { MobilePage } from '../../../components/MobilePage';
import { TranslatedPageIntro } from '../../../components/TranslatedPageIntro';
import { AgendaClient } from '../../../features/account/AgendaClient';

export default function AccountAgendaPage() {
  return (
    <MobilePage>
      <TranslatedPageIntro
        eyebrowKey="account.eyebrow"
        titleKey="account.agenda.title"
        bodyKey="account.agenda.body"
      />
      <AgendaClient />
    </MobilePage>
  );
}
