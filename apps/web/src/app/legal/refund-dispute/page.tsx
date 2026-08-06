import { LegalPolicyClient } from '../../../features/legal/LegalPolicyClient';
import { publicPageMetadata } from '../../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Refund and Dispute Policy — Hellowhen Trade',
  description: 'Read Hellowhen Trade dispute and refund information for service-for-service exchanges without in-app payments.',
  pathname: '/legal/refund-dispute',
});

export default function RefundDisputePage() {
  return <LegalPolicyClient policy="refundDispute" />;
}
