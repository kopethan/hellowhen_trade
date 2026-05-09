import type { MediaAssetDto } from '@hellowhen/contracts';

type TradeImageGridProps = {
  images: MediaAssetDto[];
  title: string;
  badge?: 'Need reference' | 'Offer sample';
};

export function TradeImageGrid({ images, title, badge }: TradeImageGridProps) {
  if (!images.length) {
    return (
      <div className="trade-image-empty-state">
        <strong>No images yet</strong>
        <span>When images are attached, they become full-bleed cards in the feed deck.</span>
      </div>
    );
  }

  const visible = images.slice(0, 4);
  const extra = Math.max(0, images.length - visible.length);

  return (
    <div className={`trade-image-grid trade-image-grid--${visible.length}`}>
      {visible.map((image, index) => (
        <figure key={image.id} className="trade-image-grid__item">
          <img src={image.url} alt={`${title} image ${index + 1}`} loading="lazy" />
          {badge ? <span className={badge === 'Need reference' ? 'semantic-badge need trade-image-grid__badge' : 'semantic-badge offer trade-image-grid__badge'}>{badge}</span> : null}
          {extra > 0 && index === visible.length - 1 ? <figcaption>+{extra}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}
