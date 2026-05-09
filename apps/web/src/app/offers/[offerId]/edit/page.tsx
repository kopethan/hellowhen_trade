import { InventoryFormClient } from '../../../../features/inventory/InventoryFormClient';

type EditOfferPageProps = {
  params: Promise<{ offerId: string }>;
};

export default async function EditOfferPage({ params }: EditOfferPageProps) {
  const { offerId } = await params;
  return <InventoryFormClient kind="offer" mode="edit" itemId={offerId} />;
}
