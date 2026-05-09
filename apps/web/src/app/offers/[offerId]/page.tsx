import { InventoryDetailClient } from '../../../features/inventory/InventoryDetailClient';

export default function OfferDetailPage({ params }: { params: { offerId: string } }) {
  return <InventoryDetailClient kind="offer" itemId={params.offerId} />;
}
