import { InventoryFormClient } from '../../../../features/inventory/InventoryFormClient';

export default function NewNeedFullPage() {
  return <InventoryFormClient kind="need" mode="create" cancelHref="/needs/new" />;
}
