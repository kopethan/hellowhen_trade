'use client';

import { useEffect, useState } from 'react';
import type { MediaAssetDto } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { mediaSrc } from './inventoryPresentation';

type InventoryMediaOrderPanelProps = {
  media: MediaAssetDto[];
  disabled?: boolean;
  label: string;
  onMove: (mediaId: string, direction: 'up' | 'down') => void;
  onSetCover: (mediaId: string) => void;
  onRemove: (mediaId: string) => void;
};

export function InventoryMediaOrderPanel({ media, disabled, label, onMove, onSetCover, onRemove }: InventoryMediaOrderPanelProps) {
  const [canCustomize, setCanCustomize] = useState(false);

  useEffect(() => {
    if (!betaFeatures.plusSubscriptionFeatures.customizationEnabled) {
      setCanCustomize(false);
      return;
    }
    let mounted = true;
    async function loadPlusSnapshot() {
      try {
        const response = await api.plus.me();
        if (mounted) setCanCustomize(Boolean(response.access.entitlements.customization));
      } catch {
        if (mounted) setCanCustomize(false);
      }
    }
    void loadPlusSnapshot();
    return () => { mounted = false; };
  }, []);

  if (!media.length) return null;

  const controlsDisabled = disabled || !canCustomize;
  return (
    <div className="inventory-media-order-panel">
      <div className="inventory-form__helper-copy">
        <strong>Cover image and order</strong>
        <span>{canCustomize ? 'Choose the first preview image and reorder the gallery for this saved item.' : 'Cover image and order controls are a hidden Plus customization preview.'}</span>
      </div>
      <div className="inventory-media-grid inventory-media-grid--managed">
        {media.map((item, index) => {
          const isCover = item.isCover || (!media.some((candidate) => candidate.isCover) && index === 0);
          return (
            <figure key={item.id} className={isCover ? 'is-cover' : undefined}>
              <img src={mediaSrc(item)} alt={item.filename ?? `${label} image`} />
              <figcaption>
                <span className={`semantic-badge ${isCover ? 'instruction' : 'muted'}`}>{isCover ? 'Cover' : `Image ${index + 1}`}</span>
                <button type="button" className="secondary" onClick={() => onRemove(item.id)} disabled={disabled}>Remove</button>
              </figcaption>
              <div className="inventory-media-controls" aria-label="Image order controls">
                <button type="button" className="secondary" onClick={() => onMove(item.id, 'up')} disabled={controlsDisabled || index === 0}>↑</button>
                <button type="button" className="secondary" onClick={() => onMove(item.id, 'down')} disabled={controlsDisabled || index === media.length - 1}>↓</button>
                <button type="button" className="secondary" onClick={() => onSetCover(item.id)} disabled={controlsDisabled || isCover}>Set cover</button>
              </div>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
