import { InventoryFormClient } from '../../../../features/inventory/InventoryFormClient';

type EditNeedPageProps = {
  params: Promise<{ needId: string }>;
};

export default async function EditNeedPage({ params }: EditNeedPageProps) {
  const { needId } = await params;
  return <InventoryFormClient kind="need" mode="edit" itemId={needId} />;
}
