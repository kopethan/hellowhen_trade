'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { createFeedIdeaTradeHref, feedTradeIdeaHasNeed, feedTradeIdeaHasOffer, feedTradeIdeaKeys, feedTradeIdeas, getFeedTradeIdeaPostType, parseFeedTradeIdeaKey, type FeedTradeIdeaKey } from './tradeFeedIdeas';

type IdeaExpirySelection = 'default' | 'none' | '1' | '3' | '7' | '14';

type TradeIdeaDetailClientProps = {
  ideaId: string;
};

const maxRelatedIdeas = 3;

const expiryOptions: Array<{ value: IdeaExpirySelection; labelKey: string; helperKey?: string }> = [
  { value: 'default', labelKey: 'trade.ideaDetail.expiryDefault', helperKey: 'trade.ideaDetail.expiryDefaultHelper' },
  { value: 'none', labelKey: 'trade.expiry.noExpiry' },
  { value: '1', labelKey: 'trade.ideaDetail.expiry1Day' },
  { value: '3', labelKey: 'trade.ideaDetail.expiry3Days' },
  { value: '7', labelKey: 'trade.create.expiry7Days' },
  { value: '14', labelKey: 'trade.create.expiry14Days' },
];

function createIdeaActionHref(pathname: '/trades/create' | '/trades/create/full', ideaKey: FeedTradeIdeaKey, expiry: IdeaExpirySelection, isAuthenticated: boolean, nextParam?: string) {
  const idea = feedTradeIdeas[ideaKey];
  const params = new URLSearchParams({ idea: ideaKey, postType: getFeedTradeIdeaPostType(idea) });
  if (expiry !== 'default') params.set('expiryDays', expiry);
  const href = `${pathname}?${params.toString()}`;
  if (!isAuthenticated) return `/auth?next=${encodeURIComponent(nextParam ?? href)}`;
  return href;
}

function getIdeaTitle(t: ReturnType<typeof useWebTranslation>['t'], ideaKey: FeedTradeIdeaKey) {
  const idea = feedTradeIdeas[ideaKey];
  if (idea.type === 'open_need') return t(`trade.feedIdeas.items.${ideaKey}.need`);
  if (idea.type === 'open_offer') return t(`trade.feedIdeas.items.${ideaKey}.offer`);
  return `${t(`trade.feedIdeas.items.${ideaKey}.need`)} ↔ ${t(`trade.feedIdeas.items.${ideaKey}.offer`)}`;
}

function getRelatedIdeaKeys(ideaKey: FeedTradeIdeaKey) {
  return feedTradeIdeaKeys.filter((candidate) => candidate !== ideaKey).slice(0, maxRelatedIdeas);
}

function getIdeaTypeLabelKey(ideaKey: FeedTradeIdeaKey) {
  const idea = feedTradeIdeas[ideaKey];
  return idea.type === 'open_need' ? 'trade.feedIdeas.typeLabels.openNeed' : idea.type === 'open_offer' ? 'trade.feedIdeas.typeLabels.openOffer' : 'trade.feedIdeas.typeLabels.trade';
}

function getIdeaActionKey(ideaKey: FeedTradeIdeaKey) {
  const idea = feedTradeIdeas[ideaKey];
  return idea.type === 'open_need' ? 'trade.feedIdeas.actionOpenNeed' : idea.type === 'open_offer' ? 'trade.feedIdeas.actionOpenOffer' : 'trade.feedIdeas.action';
}

function IdeaSideSection({ kind, ideaKey }: { kind: 'need' | 'offer'; ideaKey: FeedTradeIdeaKey }) {
  const { t } = useWebTranslation();
  const label = kind === 'need' ? t('trade.labels.iNeed') : t('trade.labels.iOffer');
  const iconName = kind === 'need' ? 'need' : 'offer';
  const badgeClass = kind === 'need' ? 'need' : 'offer';
  const title = t(`trade.feedIdeas.items.${ideaKey}.${kind}`);
  const meta = t(`trade.feedIdeas.items.${ideaKey}.${kind}Meta`);

  return (
    <section className="trade-social-section trade-idea-detail-side">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">{label}</p>
          <h2>{title}</h2>
        </div>
        <span className={`semantic-badge ${badgeClass}`}><WebIcon name={iconName} size={14} decorative />{label}</span>
      </div>
      <p>{title}</p>
      <p className="meta">{meta}</p>
    </section>
  );
}

function IdeaNextSteps() {
  const { t } = useWebTranslation();
  return (
    <section className="trade-social-section trade-idea-detail-next" aria-labelledby="trade-idea-next-title">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">{t('trade.ideaDetail.nextEyebrow')}</p>
          <h2 id="trade-idea-next-title">{t('trade.ideaDetail.nextTitle')}</h2>
        </div>
        <span className="semantic-badge instruction">{t('trade.ideaDetail.noAutoPublishBadge')}</span>
      </div>
      <ol>
        <li>{t('trade.ideaDetail.nextReview')}</li>
        <li>{t('trade.ideaDetail.nextCustomize')}</li>
        <li>{t('trade.ideaDetail.nextPublish')}</li>
      </ol>
    </section>
  );
}

function MoreIdeas({ ideaKey }: { ideaKey: FeedTradeIdeaKey }) {
  const { t } = useWebTranslation();
  const ideas = getRelatedIdeaKeys(ideaKey);
  if (ideas.length === 0) return null;

  return (
    <section className="trade-social-section trade-idea-detail-more" aria-labelledby="trade-idea-more-title">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">{t('trade.ideaDetail.moreEyebrow')}</p>
          <h2 id="trade-idea-more-title">{t('trade.ideaDetail.moreTitle')}</h2>
        </div>
      </div>
      <div className="trade-idea-detail-more-grid">
        {ideas.map((candidate) => (
          <Link key={candidate} href={createFeedIdeaTradeHref(candidate)} className="trade-idea-detail-more-card">
            <span>{t(`trade.feedIdeas.items.${candidate}.pack`)}</span>
            <strong>{getIdeaTitle(t, candidate)}</strong>
            <small>{t('trade.ideaDetail.openIdea')}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NotFoundIdea() {
  const { t } = useWebTranslation();
  return (
    <article className="mobile-page trade-idea-detail-page">
      <header className="trade-detail-toolbar" aria-label={t('trade.ideaDetail.header')}>
        <Link href="/trades" className="trade-detail-back-link"><WebIcon name="back" size={17} decorative /><span>{t('trade.ideaDetail.backToFeed')}</span></Link>
      </header>
      <section className="trade-hero-section trade-idea-detail-hero trade-idea-detail-not-found">
        <span className="semantic-badge warning">{t('trade.labels.notFound')}</span>
        <h1>{t('trade.ideaDetail.notFoundTitle')}</h1>
        <p>{t('trade.ideaDetail.notFoundBody')}</p>
        <div className="trade-idea-detail-not-found-actions">
          <Link href="/trades" className="button primary">{t('trade.ideaDetail.backToFeed')}</Link>
          <Link href="/trades/create" className="button secondary">{t('trade.ideaDetail.createFromScratch')}</Link>
        </div>
      </section>
    </article>
  );
}

export function TradeIdeaDetailClient({ ideaId }: TradeIdeaDetailClientProps) {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const ideaKey = parseFeedTradeIdeaKey(ideaId);
  const [expiry, setExpiry] = useState<IdeaExpirySelection>('default');
  const title = useMemo(() => ideaKey ? getIdeaTitle(t, ideaKey) : '', [ideaKey, t]);

  if (!ideaKey) return <NotFoundIdea />;

  const pack = t(`trade.feedIdeas.items.${ideaKey}.pack`);
  const createHref = createIdeaActionHref('/trades/create', ideaKey, expiry, auth.isAuthenticated);
  const fullFormHref = createIdeaActionHref('/trades/create/full', ideaKey, expiry, auth.isAuthenticated);

  return (
    <article className="mobile-page trade-idea-detail-page">
      <header className="trade-detail-toolbar" aria-label={t('trade.ideaDetail.header')}>
        <Link href="/trades" className="trade-detail-back-link"><WebIcon name="back" size={17} decorative /><span>{t('trade.ideaDetail.backToFeed')}</span></Link>
      </header>

      <section className="trade-hero-section trade-idea-detail-hero">
        <span className="semantic-badge instruction">{t(getIdeaTypeLabelKey(ideaKey))} · {pack}</span>
        <h1>{title}</h1>
        <p>{t(feedTradeIdeas[ideaKey].type === 'open_need' ? 'trade.ideaDetail.bodyOpenNeed' : feedTradeIdeas[ideaKey].type === 'open_offer' ? 'trade.ideaDetail.bodyOpenOffer' : 'trade.ideaDetail.body')}</p>
      </section>

      <IdeaNextSteps />

      {feedTradeIdeaHasNeed(feedTradeIdeas[ideaKey]) ? <IdeaSideSection kind="need" ideaKey={ideaKey} /> : null}

      {feedTradeIdeas[ideaKey].type === 'trade' ? (
        <div className="trade-idea-detail-exchange" aria-hidden="true">
          <span />
          <WebIcon name="trade" size={19} decorative />
          <span />
        </div>
      ) : null}

      {feedTradeIdeaHasOffer(feedTradeIdeas[ideaKey]) ? <IdeaSideSection kind="offer" ideaKey={ideaKey} /> : null}

      <section className="trade-social-section trade-idea-detail-expiry" aria-labelledby="trade-idea-expiry-title">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">{t('trade.ideaDetail.expiryEyebrow')}</p>
            <h2 id="trade-idea-expiry-title">{t('trade.ideaDetail.expiryTitle')}</h2>
          </div>
          <span className="semantic-badge instruction">{t('inventory.labels.optional')}</span>
        </div>
        <p>{t('trade.ideaDetail.expiryBody')}</p>
        <div className="trade-idea-detail-expiry-grid" role="radiogroup" aria-label={t('trade.ideaDetail.expiryTitle')}>
          {expiryOptions.map((option) => {
            const selected = expiry === option.value;
            return (
              <button key={option.value} type="button" role="radio" aria-checked={selected} className={selected ? 'is-selected' : ''} onClick={() => setExpiry(option.value)}>
                <span>{t(option.labelKey)}</span>
                {option.helperKey ? <small>{t(option.helperKey)}</small> : null}
              </button>
            );
          })}
        </div>
      </section>

      <MoreIdeas ideaKey={ideaKey} />

      <section className="trade-idea-detail-actions" aria-label={t('trade.ideaDetail.actionsLabel')}>
        <Link href="/trades" className="button ghost">{t('trade.ideaDetail.backToFeed')}</Link>
        <Link href={fullFormHref} className="button secondary">{t('trade.ideaDetail.editInFullForm')}</Link>
        <Link href={createHref} className="button primary">{t(getIdeaActionKey(ideaKey))}</Link>
      </section>
    </article>
  );
}
