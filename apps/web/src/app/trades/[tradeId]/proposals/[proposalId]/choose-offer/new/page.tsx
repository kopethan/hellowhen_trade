import { InventoryCreateWizardClient } from '../../../../../../../features/inventory/InventoryCreateWizardClient';

type NewProposalEditOfferPageProps = {
  params: Promise<{ tradeId: string; proposalId: string }>;
  searchParams?: Promise<{ proposalNeedId?: string; proposalOfferId?: string }>;
};

function chooseOfferHref(tradeId: string, proposalId: string, params: { proposalNeedId?: string; proposalOfferId?: string }) {
  const queryParams = new URLSearchParams();
  if (params.proposalNeedId) queryParams.set('proposalNeedId', params.proposalNeedId);
  if (params.proposalOfferId) queryParams.set('proposalOfferId', params.proposalOfferId);
  queryParams.set('source', 'mine');
  const query = queryParams.toString();
  return `/trades/${tradeId}/proposals/${proposalId}/choose-offer${query ? `?${query}` : ''}`;
}

export default async function NewProposalEditOfferPage({ params, searchParams }: NewProposalEditOfferPageProps) {
  const { tradeId, proposalId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <InventoryCreateWizardClient
      kind="offer"
      cancelHref={chooseOfferHref(tradeId, proposalId, resolvedSearchParams)}
      afterCreateRedirect={{
        pathname: `/trades/${tradeId}/proposals/${proposalId}`,
        selectedParam: 'proposalOfferId',
        preservedParams: {
          editProposal: '1',
          proposalNeedId: resolvedSearchParams.proposalNeedId,
        },
      }}
    />
  );
}
