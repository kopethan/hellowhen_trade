import { LegalPolicyClient } from '../../../features/legal/LegalPolicyClient';
import { publicPageMetadata } from '../../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Terms of Service — Hellowhen Trade',
  description: 'Read the Hellowhen Trade terms for using the first beta skill, service, Need, Offer, and Trade exchange platform.',
  pathname: '/legal/terms',
});

export default function TermsPage() {
  return <LegalPolicyClient policy="terms" />;
}
