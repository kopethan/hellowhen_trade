'use client';

import type { AdPlacement } from '@hellowhen/shared';
import { adPlacementLabel, isAdPlacement } from '@hellowhen/shared';
import { betaFeatures } from '../lib/betaFeatures';

type WebAdSlotProps = {
  placement: AdPlacement;
  className?: string;
  label?: string;
};

export function WebAdSlot({ placement, className, label = 'Sponsored' }: WebAdSlotProps) {
  if (!isAdPlacement(placement)) return null;
  if (!betaFeatures.adsEnabled || !betaFeatures.webAdsEnabled || !betaFeatures.adsDebugPlaceholders) return null;

  return (
    <aside className={['web-ad-slot', className].filter(Boolean).join(' ')} aria-label={label} data-ad-placement={placement}>
      <span className="web-ad-slot__label">{label}</span>
      <strong>Ad placeholder</strong>
      <small>{adPlacementLabel(placement)}</small>
    </aside>
  );
}
