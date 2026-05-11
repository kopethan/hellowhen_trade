import { InventoryFormClient } from '../../../../../features/inventory/InventoryFormClient';

type NewNeedFromTradePageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string; postType?: string }>;
};

function chooseNeedHref(params: { needId?: string; offerId?: string; postType?: string }) {
  const queryParams = new URLSearchParams();
  if (params.postType) queryParams.set('postType', params.postType);
  if (params.needId && params.postType !== 'open_offer') queryParams.set('needId', params.needId);
  if (params.offerId && params.postType !== 'open_need') queryParams.set('offerId', params.offerId);
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
        preservedParams: { postType: resolvedSearchParams.postType, offerId: resolvedSearchParams.postType === 'open_need' ? undefined : resolvedSearchParams.offerId },
      }}
    />
  );
}
