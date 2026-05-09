import { InventoryDetailClient } from '../../../features/inventory/InventoryDetailClient';

type NeedDetailPageProps = {
  params: Promise<{ needId: string }>;
};

export default async function NeedDetailPage({ params }: NeedDetailPageProps) {
  const { needId } = await params;
  return <InventoryDetailClient kind="need" itemId={needId} />;
}
