'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TradeDto } from '@hellowhen/contracts';
import { normalizePreviewCardTheme, previewCardThemeClassName } from '@hellowhen/shared';
import { WebIcon } from '../../components/WebIcon';
import { SquareStackDeck, type SquareStackDeckItem } from '../deck/SquareStackDeck';
import { getDeckImages, getExchangeLabel, getExpiryUrgencyBadge, getNeedSide, getOfferSide, getStatusLabel, getTradePostType, getTradeTimingBadge, type TradeI18n } from './tradePresentation';
import { TradePosterCard } from './TradePosterCard';
import { useWebTranslation } from '../../providers/WebI18nProvider';



function previewThemeForTrade(trade: TradeDto) {
  const tradeTheme = normalizePreviewCardTheme(trade.previewTheme);
  if (tradeTheme !== 'default') return tradeTheme;
  const needTheme = normalizePreviewCardTheme(trade.need?.previewTheme);
  if (needTheme !== 'default') return needTheme;
  return normalizePreviewCardTheme(trade.offer?.previewTheme);
}

function TradeStackImageCard({ image, i18n }: { image: ReturnType<typeof getDeckImages>[number]; i18n?: TradeI18n }) {
  const [failed, setFailed] = useState(!image.url);

  return (
    <figure className={`trade-stack-card trade-stack-card--image${failed ? ' is-broken' : ''}`}>
      {!failed ? (
        <img src={image.url} alt={image.alt} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="trade-stack-card__image-fallback">
          <strong>{i18n?.t?.('trade.labels.imageUnavailable') ?? 'Image unavailable'}</strong>
          <span>{i18n?.t?.('trade.labels.savedFileUnavailable') ?? 'This saved file could not be loaded from storage.'}</span>
        </div>
      )}
      <figcaption className={image.kind === 'need' ? 'semantic-badge need' : 'semantic-badge offer'}>{image.badge}</figcaption>
    </figure>
  );
}

function cardCountLabel(totalCards: number) {
  return `01/${String(Math.max(totalCards, 1)).padStart(2, '0')}`;
}

function compactSideMeta(metadata: string, fallback: string) {
  return metadata || fallback;
}

function compactCardMeta(metadata: string, fallback: string, maxParts = 2) {
  const value = compactSideMeta(metadata, fallback);
  return value
    .split('·')
    .map((part) => part.trim().replace(/[•·\s]+$/g, ''))
    .filter(Boolean)
    .slice(0, maxParts)
    .join(' · ');
}

function formatExpiryCountdown(value?: string | null, now = Date.now(), i18n?: TradeI18n) {
  if (!value) return null;
  const expiresMs = new Date(value).getTime();
  if (!Number.isFinite(expiresMs)) return null;

  const secondsLeft = Math.floor((expiresMs - now) / 1000);
  if (secondsLeft <= 0) {
    return { value: i18n?.t?.('trade.countdown.expired') ?? 'EXPIRED', tone: 'expired' as const };
  }

  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const tone = days <= 0 ? 'urgent' : days <= 2 ? 'soon' : 'normal';

  return {
    value: `${String(Math.min(days, 999)).padStart(3, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    tone,
  };
}

function TradeCountdown({ expiresAt, variant = 'mobile', i18n }: { expiresAt?: string | null; variant?: 'mobile' | 'poster'; i18n?: TradeI18n }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return undefined;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) {
    return (
      <span className={`${variant === 'poster' ? 'trade-poster-card__expiry' : 'trade-stack-card__mobile-expiry'} is-none`} aria-label={i18n?.t?.('trade.countdown.noExpiryLabel') ?? 'No expiry date set'}>
        {i18n?.t?.('trade.countdown.noExpiry') ?? 'NO EXPIRY'}
      </span>
    );
  }

  const countdown = formatExpiryCountdown(expiresAt, now, i18n);
  if (!countdown) {
    return (
      <span className={`${variant === 'poster' ? 'trade-poster-card__expiry' : 'trade-stack-card__mobile-expiry'} is-none`} aria-label={i18n?.t?.('trade.countdown.noExpiryLabel') ?? 'No expiry date set'}>
        {i18n?.t?.('trade.countdown.noExpiry') ?? 'NO EXPIRY'}
      </span>
    );
  }

  if (countdown.tone === 'expired') {
    return (
      <span className={`${variant === 'poster' ? 'trade-poster-card__expiry' : 'trade-stack-card__mobile-expiry'} is-expired`} aria-label={i18n?.t?.('trade.countdown.expiredLabel') ?? 'Trade expired'}>
        {i18n?.t?.('trade.countdown.expired') ?? 'EXPIRED'}
      </span>
    );
  }

  return (
    <span
      className={`${variant === 'poster' ? 'trade-poster-card__countdown' : 'trade-stack-card__mobile-countdown'} is-${countdown.tone}`}
      aria-label={i18n?.t?.('trade.countdown.expiresIn', { value: countdown.value }) ?? `Expires in ${countdown.value}`}
    >
      <strong>{countdown.value}</strong>
    </span>
  );
}

function compactJoin(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

function compactTradeTitle(trade: TradeDto, needTitle: string, offerTitle: string) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') return needTitle;
  if (postType === 'open_offer') return offerTitle;
  return `${needTitle} ↔ ${offerTitle}`;
}

function summarySubtitleForTrade(trade: TradeDto, need: ReturnType<typeof getNeedSide>, offer: ReturnType<typeof getOfferSide>, i18n?: TradeI18n) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') return compactJoin([compactSideMeta(need.metadata, need.description), i18n?.t?.('trade.proposals.openForOffers') ?? 'Others can propose offers']);
  if (postType === 'open_offer') return compactJoin([compactSideMeta(offer.metadata, offer.description), i18n?.t?.('trade.proposals.openForNeeds') ?? 'Others can propose needs']);
  return compactJoin([compactSideMeta(need.metadata, need.description), compactSideMeta(offer.metadata, offer.description)]);
}

function summaryChipsForTrade(trade: TradeDto, need: ReturnType<typeof getNeedSide>, offer: ReturnType<typeof getOfferSide>, i18n?: TradeI18n) {
  const urgencyChip = getExpiryUrgencyBadge(trade.expiresAt, i18n);
  const postType = getTradePostType(trade);
  const baseChips = postType === 'open_need'
    ? need.tags
    : postType === 'open_offer'
      ? offer.tags
      : [...need.tags, ...offer.tags];
  return [urgencyChip, ...baseChips].filter((chip): chip is string => Boolean(chip)).slice(0, 3);
}

function summaryBadgeForTrade(trade: TradeDto, totalCards: number, i18n?: TradeI18n) {
  const count = cardCountLabel(totalCards);
  const postType = getTradePostType(trade);
  if (postType === 'open_need') return `${i18n?.t?.('trade.labels.openNeed') ?? 'Open Need'} · ${count}`;
  if (postType === 'open_offer') return `${i18n?.t?.('trade.labels.openOffer') ?? 'Open Offer'} · ${count}`;
  return `${i18n?.t?.('trade.labels.trade') ?? 'Trade'} · ${count}`;
}

export function buildTradeStackDeckItems(trade: TradeDto, actionLabel = 'Open', i18n?: TradeI18n): SquareStackDeckItem[] {
  const postType = getTradePostType(trade);
  const need = getNeedSide(trade, i18n);
  const offer = getOfferSide(trade, i18n);
  const images = getDeckImages(trade, i18n);
  const exchange = getExchangeLabel(trade, i18n);
  const previewTheme = previewThemeForTrade(trade);
  const totalCards = images.length + 1;
  const coverImage = images[0];
  const summarySubtitle = summarySubtitleForTrade(trade, need, offer, i18n);
  const summaryChips = summaryChipsForTrade(trade, need, offer, i18n);
  const timingBadge = getTradeTimingBadge(trade, i18n);
  const statusBadge = trade.status === 'active' ? '' : getStatusLabel(trade.status, i18n);
  const topRightBadge = timingBadge || statusBadge;

  const needCardMeta = compactCardMeta(need.metadata, need.description);
  const offerCardMeta = compactCardMeta(offer.metadata, offer.description);
  const showTradeFooter = true;

  const summaryContent = postType === 'need_offer' ? (
    <div className={`trade-stack-card trade-stack-card--summary trade-stack-card--mobile-parity ${previewCardThemeClassName(previewTheme)}`}>
      <div className="trade-stack-card__mobile-top">
        <span>{(i18n?.t?.('trade.labels.trade') ?? 'TRADE').toUpperCase()} · {cardCountLabel(totalCards)}</span>
        {topRightBadge ? <strong title={topRightBadge}>{topRightBadge}</strong> : null}
      </div>

      <div className="trade-stack-card__mobile-section trade-stack-card__mobile-section--need">
        <p>{i18n?.t?.('trade.labels.iNeed') ?? 'I need'}</p>
        <h2 title={need.title}>{need.title}</h2>
        {needCardMeta ? <span title={compactSideMeta(need.metadata, need.description)}>{needCardMeta}</span> : null}
      </div>

      <div className="trade-stack-card__mobile-divider" aria-hidden="true">
        <i />
        <span><WebIcon name="trade" size={17} decorative /></span>
        <i />
      </div>

      <div className="trade-stack-card__mobile-section trade-stack-card__mobile-section--offer">
        <p>{i18n?.t?.('trade.labels.iOffer') ?? 'I offer'}</p>
        <h2 title={offer.title}>{offer.title}</h2>
        {offerCardMeta ? <span title={compactSideMeta(offer.metadata, offer.description)}>{offerCardMeta}</span> : null}
      </div>

      {showTradeFooter ? (
        <div className="trade-stack-card__mobile-footer">
          {exchange !== (i18n?.t?.('trade.postTypes.needOfferExchange') ?? 'Need + Offer exchange') ? <span className="trade-stack-card__mobile-money">{exchange}</span> : null}
          <TradeCountdown expiresAt={trade.expiresAt} i18n={i18n} />
        </div>
      ) : null}
    </div>
  ) : (
    <TradePosterCard
      id={`${trade.id}-summary`}
      imageUrl={coverImage?.url}
      imageAlt={coverImage?.alt ?? trade.title}
      badge={summaryBadgeForTrade(trade, totalCards, i18n)}
      eyebrow={postType === 'open_need' ? i18n?.t?.('trade.proposals.openForOffers') ?? 'Others can propose offers' : postType === 'open_offer' ? i18n?.t?.('trade.proposals.openForNeeds') ?? 'Others can propose needs' : exchange}
      title={compactTradeTitle(trade, need.title, offer.title)}
      subtitle={summarySubtitle}
      chips={summaryChips}
      topMeta={timingBadge}
      footer={<TradeCountdown expiresAt={trade.expiresAt} variant="poster" i18n={i18n} />}
      variant="trade"
      previewTheme={previewTheme}
    />
  );

  const summary: SquareStackDeckItem = {
    id: `${trade.id}-summary`,
    ariaLabel: `${actionLabel} ${trade.title}`,
    content: summaryContent,
  };

  const imageItems: SquareStackDeckItem[] = images.map((image) => {
    if (postType === 'need_offer') {
      return {
        id: image.id,
        ariaLabel: `${actionLabel} ${trade.title}`,
        content: <TradeStackImageCard image={image} i18n={i18n} />,
      };
    }

    const side = image.kind === 'need' ? need : offer;
    const variant = image.kind;
    const sideMeta = compactSideMeta(side.metadata, side.description);

    return {
      id: image.id,
      ariaLabel: `${actionLabel} ${trade.title}`,
      content: (
        <TradePosterCard
          id={`${trade.id}-${image.id}`}
          imageUrl={image.url}
          imageAlt={image.alt}
          badge={image.badge}
          eyebrow={side.label}
          title={side.title}
          subtitle={sideMeta}
          chips={side.tags.slice(0, 3)}
          variant={variant}
          previewTheme={previewTheme}
        />
      ),
    };
  });

  return [summary, ...imageItems];
}

type TradeStackDeckProps = {
  trade: TradeDto;
  className?: string;
  preview?: boolean;
  onOpen?: () => void;
};

export function TradeStackDeck({ trade, className, preview = false, onOpen }: TradeStackDeckProps) {
  const router = useRouter();
  const { t, language } = useWebTranslation();
  const i18n = useMemo(() => ({ t, language }), [language, t]);
  const items = useMemo(() => buildTradeStackDeckItems(trade, preview ? t('common.actions.preview') : t('common.actions.open'), i18n), [i18n, preview, t, trade]);
  const deckClassName = ['trade-stack-deck', preview ? 'trade-stack-deck--preview' : null, className].filter(Boolean).join(' ');

  return (
    <SquareStackDeck
      className={deckClassName}
      items={items}
      label={trade.title}
      onOpen={preview ? undefined : onOpen ?? (() => router.push(`/trades/${trade.id}`))}
      lockScrollWithinDeck={preview}
    />
  );
}
