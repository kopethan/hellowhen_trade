import Link from 'next/link';
import type { TradeDto } from '@hellowhen/contracts';
import { truncateText } from '@hellowhen/shared';
import { formatWebMoney } from '../../lib/webFormat';
import { getExchangeLabel, getTradeHeadline, getTradePostType, getTradeProposalCopy } from './tradePresentation';
import { UserIdentityLink } from '../users/UserIdentityLink';

function formatTradeExchange(trade: TradeDto) {
  if ((trade.amountCents ?? 0) > 0) return formatWebMoney(trade.amountCents ?? 0, trade.currency);
  return getExchangeLabel(trade);
}

export function TradeCard({ trade }: { trade: TradeDto }) {
  const postType = getTradePostType(trade);
  const proposalCopy = getTradeProposalCopy(trade);
  const needTitle = trade.need?.title ?? 'Need details';
  const offerTitle = trade.offer?.title ?? 'Offer details';

  return (
    <article className="trade-card" aria-label={trade.title}>
      <div className="trade-card__top">
        <span className="semantic-badge trade">{trade.status}</span>
        <UserIdentityLink
          user={trade.owner}
          userId={trade.ownerId}
          variant="compact"
          avatarSize="xs"
          showHandle={false}
          ariaLabel="Open owner public profile"
        />
      </div>
      <Link href={`/trades/${trade.id}`} className="trade-card__open-link" aria-label={`Open ${trade.title}`}>
        <div className="trade-card__body">
          {postType === 'need_offer' ? (
            <>
              <p className="eyebrow">I need</p>
              <h2 className="trade-card__title">{needTitle}</h2>
              <p className="eyebrow">I offer</p>
              <h2 className="trade-card__title">{offerTitle}</h2>
            </>
          ) : (
            <>
              <p className="eyebrow">{getExchangeLabel(trade)}</p>
              <h2 className="trade-card__title">{getTradeHeadline(trade)}</h2>
              <p className="meta">{proposalCopy.inviteTitle}</p>
            </>
          )}
          <p>{truncateText(trade.description, 120)}</p>
        </div>
        <div className="trade-card__footer">
          <span className="semantic-badge money">{formatTradeExchange(trade)}</span>
          <span className="trade-card__open">Open</span>
        </div>
      </Link>
    </article>
  );
}
