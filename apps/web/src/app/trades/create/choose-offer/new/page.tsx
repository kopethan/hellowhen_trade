import { InventoryFormClient } from '../../../../../features/inventory/InventoryFormClient';

type NewOfferFromTradePageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string; postType?: string }>;
};

function chooseOfferHref(params: { needId?: string; offerId?: string; postType?: string }) {
  const queryParams = new URLSearchParams();
  if (params.postType) queryParams.set('postType', params.postType);
  if (params.needId && params.postType !== 'open_offer') queryParams.set('needId', params.needId);
  if (params.offerId && params.postType !== 'open_need') queryParams.set('offerId', params.offerId);
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
        preservedParams: { postType: resolvedSearchParams.postType, needId: resolvedSearchParams.postType === 'open_offer' ? undefined : resolvedSearchParams.needId },
      }}
    />
  );
}
