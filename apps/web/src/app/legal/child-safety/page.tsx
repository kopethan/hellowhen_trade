import { ChildSafetyStandardsClient } from '../../../features/legal/ChildSafetyStandardsClient';
import { publicPageMetadata } from '../../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Child Safety Standards — Hellowhen Trade',
  description: 'Read Hellowhen standards prohibiting child sexual abuse and exploitation and learn how to report a child-safety concern.',
  pathname: '/legal/child-safety',
});

export default function ChildSafetyStandardsPage() {
  return <ChildSafetyStandardsClient />;
}
