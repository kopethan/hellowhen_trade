'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { TradeDto } from '@hellowhen/contracts';
import { WebIcon } from '../../components/WebIcon';
import { SquareStackDeck, type SquareStackDeckItem } from '../deck/SquareStackDeck';
import { getDeckImages, getExchangeLabel, getNeedSide, getOfferSide } from './tradePresentation';

function cardCountLabel(totalCards: number) {
  return `01/${String(Math.max(totalCards, 1)).padStart(2, '0')}`;
}

function compactSideMeta(metadata: string, fallback: string) {
  return metadata || fallback;
}

export function TradeStackDeck({ trade }: { trade: TradeDto }) {
  const router = useRouter();
  const need = getNeedSide(trade);
  const offer = getOfferSide(trade);
  const images = getDeckImages(trade);
  const exchange = getExchangeLabel(trade);

  const items = useMemo<SquareStackDeckItem[]>(() => {
    const totalCards = images.length + 1;
    const summary: SquareStackDeckItem = {
      id: `${trade.id}-summary`,
      ariaLabel: `Open ${trade.title}`,
      content: (
        <div className="trade-stack-card trade-stack-card--summary trade-stack-card--mobile-parity">
          <div className="trade-stack-card__mobile-top">
            <span>TRADE · {cardCountLabel(totalCards)}</span>
            <strong>{trade.status}</strong>
          </div>

          <div className="trade-stack-card__mobile-section trade-stack-card__mobile-section--need">
            <p>I need</p>
            <h2>{need.title}</h2>
            {compactSideMeta(need.metadata, need.description) ? <span>{compactSideMeta(need.metadata, need.description)}</span> : null}
          </div>

          <div className="trade-stack-card__mobile-divider" aria-hidden="true">
            <span><WebIcon name="trade" size={17} decorative /></span>
          </div>

          <div className="trade-stack-card__mobile-section trade-stack-card__mobile-section--offer">
            <p>I offer</p>
            <h2>{offer.title}</h2>
            {compactSideMeta(offer.metadata, offer.description) ? <span>{compactSideMeta(offer.metadata, offer.description)}</span> : null}
          </div>

          {exchange !== 'Need + Offer exchange' ? <div className="trade-stack-card__mobile-money">{exchange}</div> : null}
        </div>
      ),
    };

    const imageItems: SquareStackDeckItem[] = images.map((image) => ({
      id: image.id,
      ariaLabel: `Open ${trade.title}`,
      content: (
        <figure className="trade-stack-card trade-stack-card--image">
          <img src={image.url} alt={image.alt} loading="lazy" />
          <figcaption className={image.badge === 'Need reference' ? 'semantic-badge need' : 'semantic-badge offer'}>{image.badge}</figcaption>
        </figure>
      ),
    }));

    return [summary, ...imageItems];
  }, [exchange, images, need.description, need.metadata, need.title, offer.description, offer.metadata, offer.title, trade.id, trade.status, trade.title]);

  return (
    <SquareStackDeck
      className="trade-stack-deck"
      items={items}
      label={trade.title}
      onOpen={() => router.push(`/trades/${trade.id}`)}
    />
  );
}
