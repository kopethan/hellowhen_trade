import { Suspense } from 'react';
import { OnboardingGuideClient } from '../../features/onboarding-guide/OnboardingGuideClient';
import { publicPageMetadata } from '../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Hellowhen — Guide',
  description: 'Learn the basics of Hellowhen guides for global onboarding, Trade, and Plans.',
  pathname: '/onboarding-guide',
});

export default function OnboardingGuidePage() {
  return (
    <Suspense fallback={null}>
      <OnboardingGuideClient />
    </Suspense>
  );
}
