'use client';

import type { TradeActionStatus, TradeDto } from '@hellowhen/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ReportContentButton } from '../../components/ReportContentButton';
import { AddToAgendaButton } from '../../components/AddToAgendaButton';
import { SavedToggleButton } from '../../components/SavedToggleButton';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { buildPublicTradeUrl, copyTextToClipboard } from '../../lib/publicUrls';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockTrades } from '../../lib/mockData';
import { TradeImageGrid } from './TradeImageGrid';
import { ContentLanguageDetailControls, useContentLanguageDetailSelection } from '../inventory/ContentLanguageDetailControls';
import { UserIdentityLink } from '../users/UserIdentityLink';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { formatDateLabel, formatRelativeExpiry, getExchangeLabel, getNeedSide, getOfferSide, getStatusLabel, getTradeHeadline, getTradeHowItWorks, getTradePostType, getTradeProposalCopy, type TradeI18n, type TradeSide } from './tradePresentation';

function normalizeTradeResponse(value: unknown): TradeDto | null {
  if (!value || typeof value !== 'object') return null;
  if ('id' in value && 'title' in value) return value as TradeDto;
  if ('trade' in value && value.trade && typeof value.trade === 'object') return value.trade as TradeDto;
  return null;
}


function participantLabel(trade: TradeDto, userId?: string | null, i18n?: TradeI18n) {
  if (!userId) return i18n?.t?.('trade.labels.member') ?? 'member';
  if (trade.ownerId === userId) return i18n?.t?.('trade.labels.creator') ?? 'creator';
  if (trade.providerId === userId) return i18n?.t?.('trade.labels.acceptedTrader') ?? 'accepted trader';
  return i18n?.t?.('trade.labels.member') ?? 'member';
}

function completionHint(trade: TradeDto, _userId?: string | null, i18n?: TradeI18n) {
  if (trade.status === 'in_progress') return i18n?.t?.('trade.detail.markDeliveredHint') ?? 'One party should mark delivered, then the other confirms completion.';
  if (trade.status === 'submitted') return i18n?.t?.('trade.detail.submittedHint') ?? 'Waiting for the other party to confirm completion.';
  if (trade.status === 'disputed') return i18n?.t?.('trade.detail.disputedHint') ?? 'Support will review this trade and help the members resolve it.';
  if (trade.status === 'completed') return i18n?.t?.('trade.detail.completedHint') ?? 'This exchange has been completed.';
  if (trade.status === 'cancelled') return i18n?.t?.('trade.detail.cancelledHint') ?? 'This trade is no longer active.';
  return i18n?.t?.('trade.detail.acceptedUsesConfirmation') ?? 'Accepted trades use delivery confirmation before the exchange is closed.';
}


function TradeDetailLoadingSkeleton({ label, title }: { label: string; title: string }) {
  return (
    <article className="trade-detail-page trade-detail-page--social trade-detail-page--loading" aria-busy="true">
      <header className="trade-detail-toolbar trade-detail-toolbar--loading" aria-label={label}>
        <span className="trade-detail-back-link trade-detail-back-link--loading" aria-hidden="true" />
        <span className="trade-detail-icon-button trade-detail-icon-button--loading" aria-hidden="true">
          <WebIcon name="share" size={17} decorative />
        </span>
      </header>
      <section className="trade-hero-section trade-detail-loading-hero">
        <span className="semantic-badge instruction">{label}</span>
        <h2>{title}</h2>
        <div className="trade-detail-skeleton-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
      <section className="trade-social-section trade-detail-skeleton-section" aria-hidden="true">
        <span />
        <span />
        <span />
      </section>
      <section className="trade-social-section trade-detail-skeleton-section" aria-hidden="true">
        <span />
        <span />
        <span />
      </section>
      <section className="trade-social-section trade-detail-skeleton-section" aria-hidden="true">
        <span />
        <span />
      </section>
    </article>
  );
}

function SideSection({ side, i18n }: { side: TradeSide; i18n?: TradeI18n }) {
  const badgeClass = side.kind === 'need' ? 'need' : side.kind === 'offer' ? 'offer' : 'instruction';
  const languageSelection = useContentLanguageDetailSelection({
    displayLanguage: side.displayLanguage,
    fallbackTitle: side.title,
    fallbackDescription: side.description,
  });

  return (
    <section className="trade-social-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">{side.label}</p>
          <h2>{languageSelection.title}</h2>
        </div>
        <span className={`semantic-badge ${badgeClass}`}>{side.kind === 'need' ? <WebIcon name="need" size={14} decorative /> : side.kind === 'offer' ? <WebIcon name="offer" size={14} decorative /> : null}{side.label}</span>
      </div>
      <ContentLanguageDetailControls displayLanguage={side.displayLanguage} selectedLanguage={languageSelection.selectedLanguage} onSelectLanguage={languageSelection.setSelectedLanguage} i18n={i18n} />
      <p>{languageSelection.description}</p>
      {side.metadata ? <p className="meta">{side.metadata}</p> : null}
      {side.tags.length ? (
        <div className="tag-row">
          {side.tags.slice(0, 8).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      ) : null}
      <TradeImageGrid images={side.media} mediaAccess={side.mediaAccess} title={side.title} kind={side.kind === 'need' ? 'need' : side.kind === 'offer' ? 'offer' : undefined} badge={side.kind === 'need' ? i18n?.t?.('trade.labels.needReference') ?? 'Need reference' : side.kind === 'offer' ? i18n?.t?.('trade.labels.offerSample') ?? 'Offer sample' : undefined} />
    </section>
  );
}

function OpenResponseSection({ trade, i18n }: { trade: TradeDto; i18n?: TradeI18n }) {
  const copy = getTradeProposalCopy(trade, i18n);
  const postType = getTradePostType(trade);
  const iconName = postType === 'open_need' ? 'offer' : 'need';
  const badgeClass = postType === 'open_need' ? 'offer' : 'need';

  return (
    <section className="trade-social-section trade-open-response-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">{i18n?.t?.('trade.labels.whatCanOthersPropose') ?? 'What can others propose?'}</p>
          <h2 className="icon-heading"><WebIcon name={iconName} size={21} decorative /> {copy.inviteTitle}</h2>
        </div>
        <span className={`semantic-badge ${badgeClass}`}>{copy.responseNeeded}</span>
      </div>
      <p>{copy.inviteBody}</p>
      <p className="meta">{i18n?.t?.('trade.proposals.usePrivateProposalArea') ?? 'Use the private proposal area below to respond to this post.'}</p>
    </section>
  );
}


function TradeThreadSplitSection({ trade, i18n }: { trade: TradeDto; i18n: TradeI18n }) {
  const t = i18n.t ?? ((key: string) => key);
  return (
    <section className="trade-social-section trade-thread-split-section trade-thread-split-section--clean" aria-labelledby="trade-conversations-title">
      <div className="trade-section-heading trade-thread-section-heading trade-thread-section-heading--clean">
        <div>
          <h2 id="trade-conversations-title">{t('trade.threadSplit.eyebrow')}</h2>
        </div>
      </div>
      <div className="trade-thread-action-grid trade-thread-action-grid--simple trade-thread-action-grid--clean">
        <Link href={`/trades/${trade.id}/discussion`} className="trade-thread-action-card trade-thread-action-card--public" aria-label={`${t('common.actions.open')} ${t('trade.publicDiscussion.title')}`}>
          <span className="trade-thread-action-card__icon trade-thread-action-card__icon--public"><WebIcon name="activity" size={20} decorative /></span>
          <span className="trade-thread-action-card__body">
            <strong>{t('trade.publicDiscussion.title')}</strong>
            <small>{t('trade.threadSplit.publicBody')}</small>
          </span>
          <span className="trade-thread-action-card__cta">{t('common.actions.open')}<WebIcon name="arrow-right" size={14} decorative /></span>
        </Link>
        <Link href={`/trades/${trade.id}/proposals`} className="trade-thread-action-card trade-thread-action-card--private" aria-label={`${t('common.actions.open')} ${t('trade.threadSplit.privateTitle')}`}>
          <span className="trade-thread-action-card__icon trade-thread-action-card__icon--private"><WebIcon name="proposal" size={20} decorative /></span>
          <span className="trade-thread-action-card__body">
            <strong>{t('trade.threadSplit.privateTitle')}</strong>
            <small>{t('trade.threadSplit.privateApplicantBody')}</small>
          </span>
          <span className="trade-thread-action-card__cta">{t('common.actions.open')}<WebIcon name="arrow-right" size={14} decorative /></span>
        </Link>
      </div>
    </section>
  );
}

export function TradeDetailClient({ tradeId, initialTrade }: { tradeId: string; initialTrade?: TradeDto | null }) {
  const auth = useWebAuth();
  const router = useRouter();
  const { t, language } = useWebTranslation();
  const i18n = { t, language };
  const demoDataEnabled = isWebDemoDataEnabled();
  const [trade, setTrade] = useState<TradeDto | null>(initialTrade ?? (demoDataEnabled ? mockTrades.find((item) => item.id === tradeId) ?? null : null));
  const [loading, setLoading] = useState(!initialTrade);
  const [usingFallback, setUsingFallback] = useState(demoDataEnabled && Boolean(initialTrade));
  const [actionLoading, setActionLoading] = useState<TradeActionStatus | 'report' | 'delete' | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [confirmCompletionOpen, setConfirmCompletionOpen] = useState(false);
  const [deleteTradeOpen, setDeleteTradeOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  async function loadLiveTrade() {
    setLoading(true);
    try {
      const response = await api.trades.get(tradeId);
      const liveTrade = normalizeTradeResponse(response);
      if (liveTrade) {
        setTrade(liveTrade);
        setUsingFallback(false);
      }
    } catch {
      const fallback = demoDataEnabled ? mockTrades.find((item) => item.id === tradeId) ?? initialTrade ?? null : initialTrade ?? null;
      setTrade(fallback);
      setUsingFallback(demoDataEnabled && Boolean(fallback));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function loadTrade() {
      setLoading(true);
      try {
        const response = await api.trades.get(tradeId);
        const liveTrade = normalizeTradeResponse(response);
        if (!mounted) return;
        if (liveTrade) {
          setTrade(liveTrade);
          setUsingFallback(false);
        }
      } catch {
        if (!mounted) return;
        const fallback = demoDataEnabled ? mockTrades.find((item) => item.id === tradeId) ?? initialTrade ?? null : initialTrade ?? null;
        setTrade(fallback);
        setUsingFallback(demoDataEnabled && Boolean(fallback));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadTrade();
    return () => { mounted = false; };
  }, [demoDataEnabled, initialTrade, tradeId]);

  if (!trade && loading) {
    return <TradeDetailLoadingSkeleton label={t('common.states.loading')} title={t('trade.detail.loadingTitle')} />;
  }

  if (!trade) {
    return (
      <article className="trade-detail-page trade-detail-page--social">
        <section className="trade-hero-section">
          <span className="semantic-badge danger">{t('trade.labels.notFound')}</span>
          <h2>{t('trade.detail.couldNotLoad')}</h2>
          <p>{t('trade.detail.checkApi')}</p>
        </section>
      </article>
    );
  }

  const currentTrade = trade;
  const actorId = auth.user?.id ?? null;
  const isOwner = actorId === currentTrade.ownerId;
  const isProvider = Boolean(actorId && currentTrade.providerId === actorId);
  const canSubmitDelivery = auth.isAuthenticated && currentTrade.status === 'in_progress' && (isOwner || isProvider);
  const canConfirmCompletion = auth.isAuthenticated && currentTrade.status === 'submitted' && (isOwner || isProvider) && currentTrade.deliverySubmittedById !== actorId;
  const canReportProblem = auth.isAuthenticated && ['active', 'in_progress', 'submitted', 'completed'].includes(currentTrade.status);
  const canDeleteTrade = auth.isAuthenticated && isOwner && ['draft', 'active', 'expired', 'cancelled', 'closed'].includes(currentTrade.status);

  async function updateTradeStatus(status: TradeActionStatus) {
    setActionLoading(status);
    setActionNotice(null);
    try {
      const response = await api.trades.updateStatus(currentTrade.id, { status });
      const nextTrade = normalizeTradeResponse(response);
      if (nextTrade) setTrade(nextTrade);
      setActionNotice(status === 'submitted' ? t('trade.detail.deliveryMarked') : status === 'completed' ? t('trade.detail.tradeConfirmed') : status === 'disputed' ? t('trade.detail.tradeReported') : t('trade.detail.tradeUpdated'));
      await loadLiveTrade();
    } catch {
      setActionNotice(t('trade.detail.couldNotUpdate'));
    } finally {
      setActionLoading(null);
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = reportMessage.trim();
    if (message.length < 10) return;
    setActionLoading('report');
    setActionNotice(null);
    try {
      await api.support.createTicket({ category: 'trade_issue', priority: 'normal', subject: `Problem with trade: ${currentTrade.title}`.slice(0, 140), message, relatedTradeId: currentTrade.id });
      setReportMessage('');
      setReportOpen(false);
      setActionNotice(t('trade.detail.reportSent'));
      await loadLiveTrade();
    } catch {
      setActionNotice(t('trade.detail.couldNotReport'));
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteTrade() {
    setActionLoading('delete');
    setActionNotice(null);
    try {
      await api.trades.remove(currentTrade.id);
      setDeleteTradeOpen(false);
      router.push('/trades');
      router.refresh();
    } catch (cause) {
      setActionNotice(getFriendlyApiErrorMessage(cause, t('trade.detail.couldNotDelete')));
    } finally {
      setActionLoading(null);
    }
  }

  async function shareTrade() {
    const url = buildPublicTradeUrl(currentTrade.id);
    const title = currentTrade.title || headline;
    const text = t('trade.detail.shareText', { title });
    const shareData = { title, text, url };
    const webNavigator = typeof navigator !== 'undefined' ? navigator as Navigator & { share?: (data: typeof shareData) => Promise<void> } : null;

    setShareLoading(true);
    setShareNotice(null);

    try {
      if (webNavigator?.share) {
        await webNavigator.share(shareData);
        setShareNotice(t('trade.detail.shareOpened'));
        return;
      }

      const copied = await copyTextToClipboard(url);
      setShareNotice(copied ? t('trade.detail.linkCopied') : t('trade.detail.couldNotCopyLink'));
    } catch (cause) {
      const aborted = typeof DOMException !== 'undefined' && cause instanceof DOMException && cause.name === 'AbortError';
      if (!aborted) {
        const copied = await copyTextToClipboard(url);
        setShareNotice(copied ? t('trade.detail.linkCopied') : t('trade.detail.couldNotCopyLink'));
      }
    } finally {
      setShareLoading(false);
    }
  }

  const needSide = getNeedSide(currentTrade, i18n);
  const offerSide = getOfferSide(currentTrade, i18n);
  const exchange = getExchangeLabel(currentTrade, i18n);
  const headline = getTradeHeadline(currentTrade, i18n);
  const howItWorks = getTradeHowItWorks(currentTrade, i18n);
  const postType = getTradePostType(currentTrade);
  const typeLabel = postType === 'open_need' ? t('trade.labels.openNeed') : postType === 'open_offer' ? t('trade.labels.openOffer') : t('trade.labels.needOffer');

  return (
    <article className="trade-detail-page trade-detail-page--social">
      <header className="trade-detail-toolbar" aria-label={t('trade.labels.trade')}>
        <Link href="/trades" className="trade-detail-back-link">
          <WebIcon name="back" size={17} decorative />
          <span>{t('trade.labels.trade')}</span>
        </Link>
        <div className="trade-detail-toolbar-actions">
          <SavedToggleButton
            itemType="trade"
            itemId={currentTrade.id}
            className="trade-detail-icon-button"
            showLabel={false}
            hidden={isOwner}
          />
          <AddToAgendaButton
            sourceType="trade"
            sourceId={currentTrade.id}
            itemType="trade"
            title={headline}
            note={currentTrade.description}
            className="trade-detail-icon-button"
            showLabel={false}
          />
          <button type="button" className="trade-detail-icon-button" onClick={() => void shareTrade()} disabled={shareLoading} aria-label={t('trade.detail.shareTrade')}>
            <WebIcon name="share" size={17} decorative />
            <span>{shareLoading ? t('trade.detail.sharing') : t('trade.detail.shareTrade')}</span>
          </button>
        </div>
      </header>

      <section className="trade-hero-section trade-detail-hero">
        <div className="trade-detail-hero-top">
          <div className="status-row trade-detail-status-row">
            <span className="semantic-badge trade"><WebIcon name="trade" size={14} decorative /> {getStatusLabel(currentTrade.status, i18n)}</span>
            <span className="semantic-badge trade">{postType === 'open_need' ? t('trade.labels.openNeed') : postType === 'open_offer' ? t('trade.labels.openOffer') : t('trade.labels.needOffer')}</span>
            <span className="semantic-badge proposal">{exchange}</span>
            {usingFallback ? <span className="semantic-badge instruction">{t('trade.labels.demoDetail')}</span> : null}
          </div>
        </div>
        <h2>{headline}</h2>
        {currentTrade.description ? <p className="trade-detail-hero-description">{currentTrade.description}</p> : null}
        <div className="trade-detail-owner-row">
          <span className="meta">{t('trade.labels.postedBy')}</span>
          <UserIdentityLink
            user={currentTrade.owner}
            userId={currentTrade.ownerId}
            variant="chip"
            avatarSize="sm"
            statusText={t('trade.labels.creator')}
            showHandle={false}
          />
          <span className="meta">· {formatRelativeExpiry(currentTrade.expiresAt, i18n)}</span>
        </div>
        {shareNotice ? <p className="trade-share-notice" role="status" aria-live="polite">{shareNotice}</p> : null}
        <div className="trade-detail-agenda-actions">
          <AddToAgendaButton
            sourceType="trade"
            sourceId={currentTrade.id}
            itemType="trade"
            title={headline}
            note={currentTrade.description}
          />
          {!isOwner ? <ReportContentButton targetType="trade" targetId={currentTrade.id} labelKey="report.trade" helperKey="report.helper.trade" buttonClassName="button secondary danger-text trade-detail-report-button" /> : null}
        </div>
      </section>

      {postType !== 'open_offer' ? <SideSection side={needSide} i18n={i18n} /> : null}
      {postType !== 'open_need' ? <SideSection side={offerSide} i18n={i18n} /> : null}
      {postType === 'open_need' || postType === 'open_offer' ? <OpenResponseSection trade={currentTrade} i18n={i18n} /> : null}

      <section className="trade-social-section trade-social-section--compact trade-details-modern-section">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">{t('trade.labels.tradeDetails')}</p>
            <h2 className="icon-heading"><WebIcon name="trade" size={21} decorative /> {t('trade.labels.nextStep')}</h2>
          </div>
          {actionLoading ? <span className="semantic-badge instruction">{t('trade.detail.updated')}</span> : null}
        </div>
        <p className="trade-next-step-copy">{howItWorks}</p>
        <dl className="trade-detail-list trade-detail-list--native">
          <div><dt>{t('trade.labels.type')}</dt><dd>{typeLabel}</dd></div>
          <div><dt>{t('trade.labels.status')}</dt><dd>{getStatusLabel(currentTrade.status, i18n)}</dd></div>
          <div><dt>{t('trade.labels.expiry')}</dt><dd>{formatRelativeExpiry(currentTrade.expiresAt, i18n)}</dd></div>
          <div><dt>{t('trade.labels.exchange')}</dt><dd>{exchange}</dd></div>
          <div><dt>{t('trade.labels.created')}</dt><dd>{formatDateLabel(currentTrade.createdAt, i18n)}</dd></div>
        </dl>

        <div className="trade-detail-people-row">
          <div className="trade-detail-person-pill">
            <span className="eyebrow">{t('trade.labels.owner')}</span>
            <UserIdentityLink
              user={currentTrade.owner}
              userId={currentTrade.ownerId}
              variant="chip"
              avatarSize="sm"
              statusText={t('trade.labels.creator')}
              showHandle={false}
            />
          </div>
          {currentTrade.provider ? (
            <div className="trade-detail-person-pill">
              <span className="eyebrow">{t('trade.labels.provider')}</span>
              <UserIdentityLink
                user={currentTrade.provider}
                userId={currentTrade.providerId}
                variant="chip"
                avatarSize="sm"
                statusText={t('trade.labels.acceptedTrader')}
                showHandle={false}
              />
            </div>
          ) : null}
        </div>

        <div className="trade-next-step-panel">
          <div>
            <p className="eyebrow">{t('trade.labels.confirmation')}</p>
            <h3 className="icon-heading"><WebIcon name={currentTrade.status === 'disputed' ? 'dispute' : 'proposal-accepted'} size={19} decorative /> {t('trade.labels.deliveryConfirmation')}</h3>
          </div>
          <p>{completionHint(currentTrade, actorId, i18n)}</p>
          <p className="meta">{t('trade.detail.viewingAs', { role: participantLabel(currentTrade, actorId, i18n) })}</p>
          {actionNotice ? <p className="notice-box info">{actionNotice}</p> : null}
          <div className="trade-action-row">
            {canSubmitDelivery ? <button type="button" onClick={() => void updateTradeStatus('submitted')} disabled={Boolean(actionLoading)}>{t('trade.detail.markDelivered')}</button> : null}
            {canConfirmCompletion ? <button type="button" className="success" onClick={() => setConfirmCompletionOpen(true)} disabled={Boolean(actionLoading)}>{t('trade.detail.confirmCompleted')}</button> : null}
            {canReportProblem ? <button type="button" className="secondary danger-text" onClick={() => setReportOpen((open) => !open)} disabled={Boolean(actionLoading)}><WebIcon name="dispute" size={16} decorative /> {t('trade.detail.reportProblem')}</button> : null}
            {canDeleteTrade ? <button type="button" className="secondary danger-text" onClick={() => setDeleteTradeOpen(true)} disabled={Boolean(actionLoading)}><WebIcon name="warning" size={16} decorative /> {t('trade.detail.cancelTrade')}</button> : null}
          </div>
          {reportOpen ? (
            <form className="proposal-composer" onSubmit={submitReport}>
              <label className="field-label">
                {t('trade.detail.whatHappened')}
                <textarea value={reportMessage} onChange={(event) => setReportMessage(event.target.value)} placeholder={t('trade.detail.reportPlaceholder')} rows={4} />
              </label>
              <button type="submit" disabled={actionLoading === 'report' || reportMessage.trim().length < 10}>{t('trade.detail.sendReport')}</button>
            </form>
          ) : null}
        </div>
      </section>

      <TradeThreadSplitSection trade={currentTrade} i18n={i18n} />
      <ConfirmDialog
        open={confirmCompletionOpen}
        eyebrow={t('trade.labels.confirmation')}
        title={t('trade.detail.confirmCompletedTitle')}
        body={t('trade.detail.confirmCompletedBody')}
        variant="warning"
        confirmLabel={t('trade.detail.confirmCompleted')}
        loading={actionLoading === 'completed'}
        onCancel={() => setConfirmCompletionOpen(false)}
        onConfirm={async () => {
          await updateTradeStatus('completed');
          setConfirmCompletionOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteTradeOpen}
        eyebrow={t('trade.detail.ownerAction')}
        title={t('trade.detail.cancelTrade')}
        body={t('trade.detail.deleteTradeBody')}
        variant="danger"
        confirmLabel={t('trade.detail.cancelTrade')}
        loading={actionLoading === 'delete'}
        onCancel={() => setDeleteTradeOpen(false)}
        onConfirm={deleteTrade}
      />
    </article>
  );
}
