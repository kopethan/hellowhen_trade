import { LegalPolicyClient } from '../../../features/legal/LegalPolicyClient';
import { publicPageMetadata } from '../../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Safety and Community Guidelines — Hellowhen Trade',
  description: 'Read Hellowhen Trade safety rules, community guidelines, 18+ first beta rules, reporting, and moderation information.',
  pathname: '/legal/safety',
});

export default function SafetyPage() {
  return <LegalPolicyClient policy="safety" />;
}
