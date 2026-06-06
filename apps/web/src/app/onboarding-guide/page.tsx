import { Suspense } from 'react';
import { OnboardingGuideClient } from '../../features/onboarding-guide/OnboardingGuideClient';
import { publicPageMetadata } from '../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Hellowhen Trade — Guide',
  description: 'Learn the basics of Hellowhen Trade: create needs, create offers, discover trades, send proposals, and stay safe.',
  pathname: '/onboarding-guide',
});

export default function OnboardingGuidePage() {
  return (
    <Suspense fallback={null}>
      <OnboardingGuideClient />
    </Suspense>
  );
}
