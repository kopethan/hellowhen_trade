import Link from 'next/link';
import type { TradeDto } from '@hellowhen/contracts';
import { truncateText } from '@hellowhen/shared';
import { getDeckImages, getExchangeLabel, getNeedSide, getOfferSide, getOwnerName, getTradeHeadline, getTradePostType, getTradeProposalCopy } from './tradePresentation';

export function TradeDeck({ trade }: { trade: TradeDto }) {
  const need = getNeedSide(trade);
  const offer = getOfferSide(trade);
  const images = getDeckImages(trade);
  const ownerName = getOwnerName(trade);
  const exchange = getExchangeLabel(trade);
  const postType = getTradePostType(trade);
  const proposalCopy = getTradeProposalCopy(trade);

  return (
    <section className="trade-deck" aria-label={trade.title}>
      <div className="trade-deck__rail">
        <Link href={`/trades/${trade.id}`} className="trade-deck-card trade-deck-card--summary" aria-label={`Open ${trade.title}`}>
          <div className="trade-deck-card__top">
            <span className="semantic-badge trade">{trade.status}</span>
            <span className="meta">{ownerName}</span>
          </div>
          <div className="trade-deck-card__body">
            {postType === 'need_offer' ? (
              <>
                <p className="eyebrow">I need</p>
                <h2>{need.title}</h2>
                <p className="eyebrow">I offer</p>
                <h2>{offer.title}</h2>
              </>
            ) : (
              <>
                <p className="eyebrow">{exchange}</p>
                <h2>{getTradeHeadline(trade)}</h2>
                <p className="meta">{proposalCopy.inviteTitle}</p>
              </>
            )}
            <p>{truncateText(trade.description, 126)}</p>
          </div>
          <div className="trade-deck-card__footer">
            <span className="semantic-badge money">{exchange}</span>
            <strong>Open</strong>
          </div>
        </Link>

        {images.map((image) => (
          <Link key={image.id} href={`/trades/${trade.id}`} className="trade-deck-card trade-deck-card--image" aria-label={`Open ${trade.title}`}>
            <img src={image.url} alt={image.alt} loading="lazy" />
            <span className={image.badge === 'Need reference' ? 'semantic-badge need' : 'semantic-badge offer'}>{image.badge}</span>
          </Link>
        ))}
      </div>
      <div className="trade-deck__dots" aria-hidden="true">
        {Array.from({ length: Math.max(1, images.length + 1) }).map((_, index) => <span key={index} />)}
      </div>
    </section>
  );
}
