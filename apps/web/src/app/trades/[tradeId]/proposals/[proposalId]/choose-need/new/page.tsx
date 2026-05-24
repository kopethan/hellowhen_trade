import { InventoryFormClient } from '../../../../../../../features/inventory/InventoryFormClient';

type NewProposalEditNeedPageProps = {
  params: Promise<{ tradeId: string; proposalId: string }>;
  searchParams?: Promise<{ proposalNeedId?: string; proposalOfferId?: string }>;
};

function chooseNeedHref(tradeId: string, proposalId: string, params: { proposalNeedId?: string; proposalOfferId?: string }) {
  const queryParams = new URLSearchParams();
  if (params.proposalNeedId) queryParams.set('proposalNeedId', params.proposalNeedId);
  if (params.proposalOfferId) queryParams.set('proposalOfferId', params.proposalOfferId);
  queryParams.set('source', 'mine');
  const query = queryParams.toString();
  return `/trades/${tradeId}/proposals/${proposalId}/choose-need${query ? `?${query}` : ''}`;
}

export default async function NewProposalEditNeedPage({ params, searchParams }: NewProposalEditNeedPageProps) {
  const { tradeId, proposalId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <InventoryFormClient
      kind="need"
      mode="create"
      cancelHref={chooseNeedHref(tradeId, proposalId, resolvedSearchParams)}
      afterCreateRedirect={{
        pathname: `/trades/${tradeId}/proposals/${proposalId}`,
        selectedParam: 'proposalNeedId',
        preservedParams: {
          editProposal: '1',
          proposalOfferId: resolvedSearchParams.proposalOfferId,
        },
      }}
    />
  );
}
