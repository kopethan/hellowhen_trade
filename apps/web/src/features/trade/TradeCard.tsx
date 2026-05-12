'use client';

import Link from 'next/link';
import type { TradeDto } from '@hellowhen/contracts';
import { truncateText } from '@hellowhen/shared';
import { formatWebMoney } from '../../lib/webFormat';
import { getExchangeLabel, getTradeHeadline, getTradePostType, getTradeProposalCopy } from './tradePresentation';
import { UserIdentityLink } from '../users/UserIdentityLink';
import { useWebTranslation } from '../../providers/WebI18nProvider';

function formatTradeExchange(trade: TradeDto, i18n: ReturnType<typeof useWebTranslation>) {
  if ((trade.amountCents ?? 0) > 0) return formatWebMoney(trade.amountCents ?? 0, trade.currency, i18n.language);
  return getExchangeLabel(trade, i18n);
}

export function TradeCard({ trade }: { trade: TradeDto }) {
  const i18n = useWebTranslation();
  const { t } = i18n;
  const postType = getTradePostType(trade);
  const proposalCopy = getTradeProposalCopy(trade, i18n);
  const needTitle = trade.need?.title ?? t('trade.labels.needDetails');
  const offerTitle = trade.offer?.title ?? t('trade.labels.offerDetails');

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
          ariaLabel={t('profile.actions.openApplicantProfile')}
        />
      </div>
      <Link href={`/trades/${trade.id}`} className="trade-card__open-link" aria-label={`${t('common.actions.open')} ${trade.title}`}>
        <div className="trade-card__body">
          {postType === 'need_offer' ? (
            <>
              <p className="eyebrow">{t('trade.labels.iNeed')}</p>
              <h2 className="trade-card__title">{needTitle}</h2>
              <p className="eyebrow">{t('trade.labels.iOffer')}</p>
              <h2 className="trade-card__title">{offerTitle}</h2>
            </>
          ) : (
            <>
              <p className="eyebrow">{getExchangeLabel(trade, i18n)}</p>
              <h2 className="trade-card__title">{getTradeHeadline(trade, i18n)}</h2>
              <p className="meta">{proposalCopy.inviteTitle}</p>
            </>
          )}
          <p>{truncateText(trade.description, 120)}</p>
        </div>
        <div className="trade-card__footer">
          <span className="semantic-badge money">{formatTradeExchange(trade, i18n)}</span>
          <span className="trade-card__open">{t('common.actions.open')}</span>
        </div>
      </Link>
    </article>
  );
}
