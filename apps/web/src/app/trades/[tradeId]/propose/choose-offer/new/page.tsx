import { InventoryFormClient } from '../../../../../../features/inventory/InventoryFormClient';

type NewProposalOfferPageProps = {
  params: Promise<{ tradeId: string }>;
  searchParams?: Promise<{ proposalNeedId?: string; proposalOfferId?: string }>;
};

function chooseOfferHref(tradeId: string, params: { proposalNeedId?: string; proposalOfferId?: string }) {
  const queryParams = new URLSearchParams();
  if (params.proposalNeedId) queryParams.set('proposalNeedId', params.proposalNeedId);
  if (params.proposalOfferId) queryParams.set('proposalOfferId', params.proposalOfferId);
  const query = queryParams.toString();
  return `/trades/${tradeId}/propose/choose-offer${query ? `?${query}` : ''}`;
}

export default async function NewProposalOfferPage({ params, searchParams }: NewProposalOfferPageProps) {
  const { tradeId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <InventoryFormClient
      kind="offer"
      mode="create"
      cancelHref={chooseOfferHref(tradeId, resolvedSearchParams)}
      afterCreateRedirect={{
        pathname: `/trades/${tradeId}/proposals`,
        selectedParam: 'proposalOfferId',
        preservedParams: {
          proposalNeedId: resolvedSearchParams.proposalNeedId,
        },
      }}
    />
  );
}
