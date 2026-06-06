import { InventoryFormClient } from '../../../../features/inventory/InventoryFormClient';

export default function NewOfferFullPage() {
  return <InventoryFormClient kind="offer" mode="create" cancelHref="/offers/new" />;
}
