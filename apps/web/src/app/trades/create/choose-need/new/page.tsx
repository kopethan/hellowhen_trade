import { InventoryFormClient } from '../../../../../features/inventory/InventoryFormClient';

type NewNeedFromTradePageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string }>;
};

function chooseNeedHref(params: { needId?: string; offerId?: string }) {
  const queryParams = new URLSearchParams();
  if (params.needId) queryParams.set('needId', params.needId);
  if (params.offerId) queryParams.set('offerId', params.offerId);
  const query = queryParams.toString();
  return `/trades/create/choose-need${query ? `?${query}` : ''}`;
}

export default async function NewNeedFromTradePage({ searchParams }: NewNeedFromTradePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <InventoryFormClient
      kind="need"
      mode="create"
      cancelHref={chooseNeedHref(resolvedSearchParams)}
      afterCreateRedirect={{
        pathname: '/trades/create',
        selectedParam: 'needId',
        preservedParams: { offerId: resolvedSearchParams.offerId },
      }}
    />
  );
}
