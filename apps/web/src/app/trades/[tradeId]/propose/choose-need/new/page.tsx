import { InventoryFormClient } from '../../../../../../features/inventory/InventoryFormClient';

type NewProposalNeedPageProps = {
  params: Promise<{ tradeId: string }>;
  searchParams?: Promise<{ proposalNeedId?: string; proposalOfferId?: string }>;
};

function chooseNeedHref(tradeId: string, params: { proposalNeedId?: string; proposalOfferId?: string }) {
  const queryParams = new URLSearchParams();
  if (params.proposalNeedId) queryParams.set('proposalNeedId', params.proposalNeedId);
  if (params.proposalOfferId) queryParams.set('proposalOfferId', params.proposalOfferId);
  const query = queryParams.toString();
  return `/trades/${tradeId}/propose/choose-need${query ? `?${query}` : ''}`;
}

export default async function NewProposalNeedPage({ params, searchParams }: NewProposalNeedPageProps) {
  const { tradeId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <InventoryFormClient
      kind="need"
      mode="create"
      cancelHref={chooseNeedHref(tradeId, resolvedSearchParams)}
      afterCreateRedirect={{
        pathname: `/trades/${tradeId}`,
        selectedParam: 'proposalNeedId',
        preservedParams: {
          proposalOfferId: resolvedSearchParams.proposalOfferId,
        },
      }}
    />
  );
}
