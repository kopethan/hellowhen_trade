'use client';

import { useMemo } from 'react';
import type { TradeDto } from '@hellowhen/contracts';
import { SquareStackDeck, type SquareStackDeckItem } from '../deck/SquareStackDeck';
import { getDeckImages } from './tradePresentation';

export function TradeDetailReferenceDeck({ trade }: { trade: TradeDto }) {
  const images = getDeckImages(trade);
  const items = useMemo<SquareStackDeckItem[]>(() => images.map((image) => ({
    id: image.id,
    ariaLabel: `${image.badge}: ${image.alt}`,
    content: (
      <figure className="trade-stack-card trade-stack-card--image trade-detail-reference-card">
        <img src={image.url} alt={image.alt} loading="lazy" />
        <figcaption className={image.badge === 'Need reference' ? 'semantic-badge need' : 'semantic-badge offer'}>{image.badge}</figcaption>
      </figure>
    ),
  })), [images]);

  if (!items.length) return null;

  return (
    <section className="trade-social-section trade-reference-deck-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">Reference cards</p>
          <h2>Need and Offer images</h2>
        </div>
        <span className="semantic-badge instruction">{items.length} card{items.length === 1 ? '' : 's'}</span>
      </div>
      <SquareStackDeck className="trade-detail-reference-deck" items={items} label="Trade reference images" />
      <p className="meta">Use the corner buttons, touchpad, or swipe to move through the image cards.</p>
    </section>
  );
}
