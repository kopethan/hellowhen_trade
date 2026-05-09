import Link from 'next/link';
import type { TradeDto } from '@hellowhen/contracts';
import { formatMoney, truncateText } from '@hellowhen/shared';

function formatTradeExchange(trade: TradeDto) {
  if (trade.amountCents > 0) return formatMoney(trade.amountCents, trade.currency);
  return 'Service-for-service';
}

export function TradeCard({ trade }: { trade: TradeDto }) {
  const needTitle = trade.need?.title ?? 'I need';
  const offerTitle = trade.offer?.title ?? (trade.amountCents > 0 ? 'Wallet money' : 'I offer');
  const ownerName = trade.owner?.profile?.displayName ?? trade.owner?.profile?.handle ?? 'Someone nearby';

  return (
    <Link href={`/trades/${trade.id}`} className="trade-card" aria-label={`Open ${trade.title}`}>
      <div className="trade-card__top">
        <span className="semantic-badge trade">{trade.status}</span>
        <span className="meta">{ownerName}</span>
      </div>
      <div className="trade-card__body">
        <p className="eyebrow">I need</p>
        <h2 className="trade-card__title">{needTitle}</h2>
        <p className="eyebrow">I offer</p>
        <h2 className="trade-card__title">{offerTitle}</h2>
        <p>{truncateText(trade.description, 120)}</p>
      </div>
      <div className="trade-card__footer">
        <span className="semantic-badge money">{formatTradeExchange(trade)}</span>
        <span className="trade-card__open">Open</span>
      </div>
    </Link>
  );
}
