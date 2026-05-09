import { InventoryFormClient } from '../../../../features/inventory/InventoryFormClient';

export default function EditNeedPage({ params }: { params: { needId: string } }) {
  return <InventoryFormClient kind="need" mode="edit" itemId={params.needId} />;
}
