import { InventoryDetailClient } from '../../../features/inventory/InventoryDetailClient';

export default function NeedDetailPage({ params }: { params: { needId: string } }) {
  return <InventoryDetailClient kind="need" itemId={params.needId} />;
}
