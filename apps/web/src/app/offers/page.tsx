import { InventoryListClient } from '../../features/inventory/InventoryListClient';
import { publicPageMetadata } from '../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Offers — Hellowhen Trade',
  description: 'Create and manage Offers on Hellowhen Trade: skills, services, small help, creative work, and useful exchanges.',
  pathname: '/offers',
});

export default function OffersPage() {
  return <InventoryListClient kind="offer" />;
}
