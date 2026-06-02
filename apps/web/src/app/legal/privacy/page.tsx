import { LegalPolicyClient } from '../../../features/legal/LegalPolicyClient';
import { publicPageMetadata } from '../../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Privacy Policy — Hellowhen Trade',
  description: 'Read how Hellowhen Trade handles account, profile, trade, support, report, and safety data during the first beta.',
  pathname: '/legal/privacy',
});

export default function PrivacyPage() {
  return <LegalPolicyClient policy="privacy" />;
}
