import { notFound } from 'next/navigation';
import { MobilePage } from '../../../components/MobilePage';
import { TranslatedPageIntro } from '../../../components/TranslatedPageIntro';
import { SavedLibraryClient } from '../../../features/account/SavedLibraryClient';
import { betaFeatures } from '../../../lib/betaFeatures';

export default function AccountSavedPage() {
  if (!betaFeatures.savedLibraryEnabled) notFound();

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
