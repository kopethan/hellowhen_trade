import { InventoryCreateWizardClient } from '../../../../../features/inventory/InventoryCreateWizardClient';

type NewOfferFromTradePageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string; postType?: string; returnTo?: string }>;
};

function chooseOfferHref(params: { needId?: string; offerId?: string; postType?: string; returnTo?: string }) {
  const queryParams = new URLSearchParams();
  if (params.postType) queryParams.set('postType', params.postType);
  if (params.needId && params.postType !== 'open_offer') queryParams.set('needId', params.needId);
  if (params.offerId && params.postType !== 'open_need') queryParams.set('offerId', params.offerId);
  if (params.returnTo === 'full') queryParams.set('returnTo', 'full');
  const query = queryParams.toString();
  return `/trades/create/choose-offer${query ? `?${query}` : ''}`;
}

export default async function NewOfferFromTradePage({ searchParams }: NewOfferFromTradePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <InventoryCreateWizardClient
      kind="offer"
      cancelHref={chooseOfferHref(resolvedSearchParams)}
      afterCreateRedirect={{
        pathname: resolvedSearchParams.returnTo === 'full' ? '/trades/create/full' : '/trades/create',
        selectedParam: 'offerId',
        preservedParams: { postType: resolvedSearchParams.postType, needId: resolvedSearchParams.postType === 'open_offer' ? undefined : resolvedSearchParams.needId },
      }}
    />
  );
}
