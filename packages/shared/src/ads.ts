export const adPlacements = ['trades_feed', 'public_discussion', 'needs_list', 'offers_list'] as const;
export type AdPlacement = (typeof adPlacements)[number];

export const adProviders = ['none', 'adsense', 'admob'] as const;
export type AdProvider = (typeof adProviders)[number];

export function isAdPlacement(value: string): value is AdPlacement {
  return (adPlacements as readonly string[]).includes(value);
}

export function isAdProvider(value: string): value is AdProvider {
  return (adProviders as readonly string[]).includes(value);
}

export function adPlacementLabel(placement: AdPlacement): string {
  switch (placement) {
    case 'trades_feed':
      return 'Trades feed';
    case 'public_discussion':
      return 'Public discussion';
    case 'needs_list':
      return 'Needs list';
    case 'offers_list':
      return 'Offers list';
    default:
      return placement;
  }
}
