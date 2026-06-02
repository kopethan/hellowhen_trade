import { LegalPolicyClient } from '../../../features/legal/LegalPolicyClient';
import { publicPageMetadata } from '../../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Refund and Dispute Policy — Hellowhen Trade',
  description: 'Read Hellowhen Trade first beta dispute and refund information for service-for-service exchanges without money.',
  pathname: '/legal/refund-dispute',
});

export default function RefundDisputePage() {
  return <LegalPolicyClient policy="refundDispute" />;
}
