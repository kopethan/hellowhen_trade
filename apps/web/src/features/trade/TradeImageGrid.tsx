'use client';

import type { MediaAssetDto, PublicMediaAccessDto } from '@hellowhen/contracts';
import { useState } from 'react';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { resolveTradeMediaVariantUrl } from './tradePresentation';

type TradeImageGridProps = {
  images: MediaAssetDto[];
  title: string;
  badge?: string;
  kind?: 'need' | 'offer';
  mediaAccess?: PublicMediaAccessDto;
};

function statusLabel(status: MediaAssetDto['status'] | undefined, t: (key: string) => string) {
  if (status === 'flagged') return t('trade.labels.unavailable');
  return null;
}

function fallbackTitle(_status: MediaAssetDto['status'] | undefined, t: (key: string) => string) {
  return t('trade.labels.imageUnavailable');
}

function fallbackBody(status: MediaAssetDto['status'] | undefined, t: (key: string) => string) {
  if (status === 'flagged') return t('media.errors.removedAfterReport');
  return t('media.errors.couldNotLoad');
}

function TradeImageGridItem({ image, index, title, badge, kind = 'offer', extra }: { image: MediaAssetDto; index: number; title: string; badge?: string; kind?: 'need' | 'offer'; extra: number }) {
  const { t } = useWebTranslation();
  const src = resolveTradeMediaVariantUrl(image, 'full');
  const [hasError, setHasError] = useState(!src);
  const imageStatusLabel = statusLabel(image.status, t);

  return (
    <figure className={`trade-image-grid__item${hasError ? ' is-broken' : ''}`}>
      {!hasError ? <img src={src} alt={`${title} ${t('media.labels.image')} ${index + 1}`} loading="lazy" onError={() => setHasError(true)} /> : <div className="trade-image-grid__fallback"><strong>{fallbackTitle(image.status, t)}</strong><span>{fallbackBody(image.status, t)}</span></div>}
      {badge ? <span className={`semantic-badge ${kind} trade-image-grid__badge`}>{badge}</span> : null}
      {imageStatusLabel ? <span className="trade-image-grid__status">{imageStatusLabel}</span> : null}
      {extra > 0 ? <figcaption>+{extra}</figcaption> : null}
    </figure>
  );
}

export function TradeImageGrid({ images, title, badge, kind, mediaAccess }: TradeImageGridProps) {
  const { t } = useWebTranslation();
  const visibleImages = images.filter((image) => image.status === 'active');
  const hiddenCount = mediaAccess?.requiresAuth ? mediaAccess.hiddenCount : 0;

  if (!visibleImages.length) {
    return (
      <div className="trade-image-empty-state">
        <strong>{hiddenCount > 0 ? t('media.authRequired.title') : t('media.empty.noImagesYet')}</strong>
        <span>{hiddenCount > 0 ? t('media.authRequired.body', { count: hiddenCount }) : t('media.empty.sideImagesAppearHere')}</span>
      </div>
    );
  }

  const visible = visibleImages.slice(0, 4);
  const extra = Math.max(0, visibleImages.length - visible.length);

  return (
    <div className={`trade-image-grid trade-image-grid--${visible.length}`}>
      {visible.map((image, index) => (
        <TradeImageGridItem key={image.id} image={image} index={index} title={title} badge={badge} kind={kind} extra={index === visible.length - 1 ? extra : 0} />
      ))}
    </div>
  );
}
