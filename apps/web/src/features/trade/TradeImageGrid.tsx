import type { MediaAssetDto } from '@hellowhen/contracts';

export function TradeImageGrid({ images, title }: { images: MediaAssetDto[]; title: string }) {
  if (!images.length) return null;
  const visible = images.slice(0, 4);
  const extra = Math.max(0, images.length - visible.length);

  return (
    <div className={`trade-image-grid trade-image-grid--${visible.length}`}>
      {visible.map((image, index) => (
        <figure key={image.id} className="trade-image-grid__item">
          <img src={image.url} alt={`${title} image ${index + 1}`} loading="lazy" />
          {extra > 0 && index === visible.length - 1 ? <figcaption>+{extra}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}
