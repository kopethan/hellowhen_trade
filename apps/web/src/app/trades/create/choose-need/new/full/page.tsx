import { InventoryFormClient } from '../../../../../../features/inventory/InventoryFormClient';

type NewNeedFromTradeFullPageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string; postType?: string; returnTo?: string }>;
};

function chooseNeedHref(params: { needId?: string; offerId?: string; postType?: string; returnTo?: string }) {
  const queryParams = new URLSearchParams();
  if (params.postType) queryParams.set('postType', params.postType);
  if (params.needId && params.postType !== 'open_offer') queryParams.set('needId', params.needId);
  if (params.offerId && params.postType !== 'open_need') queryParams.set('offerId', params.offerId);
  if (params.returnTo === 'full') queryParams.set('returnTo', 'full');
  const query = queryParams.toString();
  return `/trades/create/choose-need/new${query ? `?${query}` : ''}`;
}

export default async function NewNeedFromTradeFullPage({ searchParams }: NewNeedFromTradeFullPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <InventoryFormClient
      kind="need"
      mode="create"
      cancelHref={chooseNeedHref(resolvedSearchParams)}
      afterCreateRedirect={{
        pathname: resolvedSearchParams.returnTo === 'full' ? '/trades/create/full' : '/trades/create',
        selectedParam: 'needId',
        preservedParams: { postType: resolvedSearchParams.postType, offerId: resolvedSearchParams.postType === 'open_need' ? undefined : resolvedSearchParams.offerId },
      }}
    />
  );
}
