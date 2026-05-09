import { InventoryFormClient } from '../../../../features/inventory/InventoryFormClient';

export default function EditOfferPage({ params }: { params: { offerId: string } }) {
  return <InventoryFormClient kind="offer" mode="edit" itemId={params.offerId} />;
}
