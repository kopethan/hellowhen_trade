import { InventoryFormClient } from '../../../../../features/inventory/InventoryFormClient';

type NewOfferFromTradePageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string }>;
};

function chooseOfferHref(params: { needId?: string; offerId?: string }) {
  const queryParams = new URLSearchParams();
  if (params.needId) queryParams.set('needId', params.needId);
  if (params.offerId) queryParams.set('offerId', params.offerId);
  const query = queryParams.toString();
  return `/trades/create/choose-offer${query ? `?${query}` : ''}`;
}

export default async function NewOfferFromTradePage({ searchParams }: NewOfferFromTradePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <InventoryFormClient
      kind="offer"
      mode="create"
      cancelHref={chooseOfferHref(resolvedSearchParams)}
      afterCreateRedirect={{
        pathname: '/trades/create',
        selectedParam: 'offerId',
        preservedParams: { needId: resolvedSearchParams.needId },
      }}
    />
  );
}
