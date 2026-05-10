'use client';

import type { MediaAssetDto } from '@hellowhen/contracts';
import { useState } from 'react';
import { resolveTradeMediaUrl } from './tradePresentation';

type TradeImageGridProps = {
  images: MediaAssetDto[];
  title: string;
  badge?: 'Need reference' | 'Offer sample';
};

function statusLabel(status?: MediaAssetDto['status']) {
  if (status === 'flagged') return 'Unavailable';
  return null;
}

function fallbackTitle(status?: MediaAssetDto['status']) {
  if (status === 'flagged') return 'Image unavailable';
  return 'Image unavailable';
}

function fallbackBody(status?: MediaAssetDto['status']) {
  if (status === 'flagged') return 'This image was removed after a content report.';
  return 'The image could not be loaded.';
}

function TradeImageGridItem({ image, index, title, badge, extra }: { image: MediaAssetDto; index: number; title: string; badge?: 'Need reference' | 'Offer sample'; extra: number }) {
  const src = resolveTradeMediaUrl(image.url, image.storageKey);
  const [hasError, setHasError] = useState(!src);
  const imageStatusLabel = statusLabel(image.status);

  return (
    <figure className={`trade-image-grid__item${hasError ? ' is-broken' : ''}`}>
      {!hasError ? <img src={src} alt={`${title} image ${index + 1}`} loading="lazy" onError={() => setHasError(true)} /> : <div className="trade-image-grid__fallback"><strong>{fallbackTitle(image.status)}</strong><span>{fallbackBody(image.status)}</span></div>}
      {badge ? <span className={badge === 'Need reference' ? 'semantic-badge need trade-image-grid__badge' : 'semantic-badge offer trade-image-grid__badge'}>{badge}</span> : null}
      {imageStatusLabel ? <span className="trade-image-grid__status">{imageStatusLabel}</span> : null}
      {extra > 0 ? <figcaption>+{extra}</figcaption> : null}
    </figure>
  );
}

export function TradeImageGrid({ images, title, badge }: TradeImageGridProps) {
  const visibleImages = images.filter((image) => image.status === 'active');

  if (!visibleImages.length) {
    return (
      <div className="trade-image-empty-state">
        <strong>No images yet</strong>
        <span>Images attached to this side will appear here.</span>
      </div>
    );
  }

  const visible = visibleImages.slice(0, 4);
  const extra = Math.max(0, visibleImages.length - visible.length);

  return (
    <div className={`trade-image-grid trade-image-grid--${visible.length}`}>
      {visible.map((image, index) => (
        <TradeImageGridItem key={image.id} image={image} index={index} title={title} badge={badge} extra={index === visible.length - 1 ? extra : 0} />
      ))}
    </div>
  );
}
