'use client';

import Link from 'next/link';
import type { TradeDto } from '@hellowhen/contracts';
import { truncateText } from '@hellowhen/shared';
import { getDeckImages, getExchangeLabel, getNeedSide, getOfferSide, getStatusLabel, getTradeHeadline, getTradePostType, getTradeProposalCopy, getTradeTimingBadge } from './tradePresentation';
import { UserIdentityLink } from '../users/UserIdentityLink';
import { useWebTranslation } from '../../providers/WebI18nProvider';

export function TradeDeck({ trade }: { trade: TradeDto }) {
  const i18n = useWebTranslation();
  const { t } = i18n;
  const need = getNeedSide(trade, i18n);
  const offer = getOfferSide(trade, i18n);
  const images = getDeckImages(trade, i18n);
  const exchange = getExchangeLabel(trade, i18n);
  const postType = getTradePostType(trade);
  const proposalCopy = getTradeProposalCopy(trade, i18n);
  const timingBadge = getTradeTimingBadge(trade, i18n);
  const statusBadge = trade.status === 'active' ? '' : getStatusLabel(trade.status, i18n);
  const topBadge = timingBadge || statusBadge;

  return (
    <section className="trade-deck" aria-label={trade.title}>
      <div className="trade-deck__rail">
        <article className="trade-deck-card trade-deck-card--summary" aria-label={trade.title}>
          <div className="trade-deck-card__top">
            <span className="semantic-badge trade">{topBadge || getExchangeLabel(trade, i18n)}</span>
            <UserIdentityLink
              user={trade.owner}
              userId={trade.ownerId}
              variant="compact"
              avatarSize="xs"
              showHandle={false}
              ariaLabel={t('profile.actions.openApplicantProfile')}
            />
          </div>
          <Link href={`/trades/${trade.id}`} className="trade-deck-card__open-link" aria-label={`${t('common.actions.open')} ${trade.title}`}>
            <div className="trade-deck-card__body">
              {postType === 'need_offer' ? (
                <>
                  <p className="eyebrow">{t('trade.labels.iNeed')}</p>
                  <h2>{need.title}</h2>
                  <p className="eyebrow">{t('trade.labels.iOffer')}</p>
                  <h2>{offer.title}</h2>
                </>
              ) : (
                <>
                  <p className="eyebrow">{exchange}</p>
                  <h2>{getTradeHeadline(trade, i18n)}</h2>
                  <p className="meta">{proposalCopy.inviteTitle}</p>
                </>
              )}
              <p>{truncateText(trade.description, 126)}</p>
            </div>
            <div className="trade-deck-card__footer">
              <span className="semantic-badge money">{exchange}</span>
              <strong>{t('common.actions.open')}</strong>
            </div>
          </Link>
        </article>

        {images.map((image) => (
          <Link key={image.id} href={`/trades/${trade.id}`} className={`trade-deck-card trade-deck-card--image${image.isAuthPlaceholder ? ' is-broken' : ''}`} aria-label={`${t('common.actions.open')} ${trade.title}`}>
            {image.isAuthPlaceholder ? (
              <div className="trade-stack-card__image-fallback">
                <strong>{t('media.authRequired.title')}</strong>
                <span>{t('media.authRequired.body', { count: image.hiddenCount ?? 1 })}</span>
              </div>
            ) : (
              <img src={image.url} alt={image.alt} loading="lazy" />
            )}
            <span className={image.kind === 'need' ? 'semantic-badge need' : 'semantic-badge offer'}>{image.badge}</span>
          </Link>
        ))}
      </div>
      <div className="trade-deck__dots" aria-hidden="true">
        {Array.from({ length: Math.max(1, images.length + 1) }).map((_, index) => <span key={index} />)}
      </div>
    </section>
  );
}
