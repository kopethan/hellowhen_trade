import { MobilePage } from '../../../components/MobilePage';
import { TranslatedPageIntro } from '../../../components/TranslatedPageIntro';
import { SavedLibraryClient } from '../../../features/account/SavedLibraryClient';

export default function AccountSavedPage() {
  return (
    <MobilePage>
      <TranslatedPageIntro
        eyebrowKey="account.eyebrow"
        titleKey="account.saved.title"
        bodyKey="account.saved.body"
      />
      <SavedLibraryClient />
    </MobilePage>
  );
}
