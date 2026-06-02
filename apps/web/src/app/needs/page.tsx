import { InventoryListClient } from '../../features/inventory/InventoryListClient';
import { publicPageMetadata } from '../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Needs — Hellowhen Trade',
  description: 'Create and manage Needs on Hellowhen Trade: services, skills, help, creative work, and useful exchanges.',
  pathname: '/needs',
});

export default function NeedsPage() {
  return <InventoryListClient kind="need" />;
}
