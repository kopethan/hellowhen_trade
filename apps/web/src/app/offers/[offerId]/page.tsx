import { InventoryDetailClient } from '../../../features/inventory/InventoryDetailClient';

type OfferDetailPageProps = {
  params: Promise<{ offerId: string }>;
};

export default async function OfferDetailPage({ params }: OfferDetailPageProps) {
  const { offerId } = await params;
  return <InventoryDetailClient kind="offer" itemId={offerId} />;
}
