import { LegalOverviewClient } from '../../features/legal/LegalOverviewClient';
import { publicPageMetadata } from '../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Legal and safety — Hellowhen Trade',
  description: 'Read Hellowhen Trade legal, privacy, safety, terms, and dispute information for the first beta.',
  pathname: '/legal',
});

export default function LegalPage() {
  return <LegalOverviewClient />;
}
