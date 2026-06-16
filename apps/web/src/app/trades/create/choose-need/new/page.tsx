import { InventoryCreateWizardClient } from '../../../../../features/inventory/InventoryCreateWizardClient';

type NewNeedFromTradePageProps = {
  searchParams?: Promise<{ needId?: string; offerId?: string; postType?: string; returnTo?: string; idea?: string; expiryDays?: string; starterTemplateKey?: string }>;
};

function chooseNeedHref(params: { needId?: string; offerId?: string; postType?: string; returnTo?: string; idea?: string; expiryDays?: string }) {
  const queryParams = new URLSearchParams();
  if (params.postType) queryParams.set('postType', params.postType);
  if (params.needId && params.postType !== 'open_offer') queryParams.set('needId', params.needId);
  if (params.offerId && params.postType !== 'open_need') queryParams.set('offerId', params.offerId);
  if (params.returnTo === 'full') queryParams.set('returnTo', 'full');
  if (params.idea) queryParams.set('idea', params.idea);
  if (params.expiryDays) queryParams.set('expiryDays', params.expiryDays);
  const query = queryParams.toString();
  return `/trades/create/choose-need${query ? `?${query}` : ''}`;
}

export default async function NewNeedFromTradePage({ searchParams }: NewNeedFromTradePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <InventoryCreateWizardClient
      kind="need"
      cancelHref={chooseNeedHref(resolvedSearchParams)}
      initialTemplateKey={resolvedSearchParams.starterTemplateKey}
      afterCreateRedirect={{
        pathname: resolvedSearchParams.returnTo === 'full' ? '/trades/create/full' : '/trades/create',
        selectedParam: 'needId',
        preservedParams: {
          postType: resolvedSearchParams.postType,
          offerId: resolvedSearchParams.postType === 'open_need' ? undefined : resolvedSearchParams.offerId,
          idea: resolvedSearchParams.idea,
          expiryDays: resolvedSearchParams.expiryDays,
        },
      }}
    />
  );
}
