'use client';

import type { TradeActionStatus, TradeDto } from '@hellowhen/contracts';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockTrades } from '../../lib/mockData';
import { TradeImageGrid } from './TradeImageGrid';
import { TradeProposalPanel } from './TradeProposalPanel';
import { formatDateLabel, formatRelativeExpiry, getExchangeLabel, getNeedSide, getOfferSide, getOwnerName, getTradeMode } from './tradePresentation';

function normalizeTradeResponse(value: unknown): TradeDto | null {
  if (!value || typeof value !== 'object') return null;
  if ('id' in value && 'title' in value) return value as TradeDto;
  if ('trade' in value && value.trade && typeof value.trade === 'object') return value.trade as TradeDto;
  return null;
}


function participantLabel(trade: TradeDto, userId?: string | null) {
  if (!userId) return 'member';
  if (trade.ownerId === userId) return 'creator';
  if (trade.providerId === userId) return 'accepted trader';
  return 'member';
}

function completionHint(trade: TradeDto, _userId?: string | null) {
  if (trade.status === 'in_progress') return 'One party should mark delivered, then the other confirms completion.';
  if (trade.status === 'submitted') return 'Waiting for the other party to confirm completion.';
  if (trade.status === 'disputed') return 'Support will review this trade and help the members resolve it.';
  if (trade.status === 'completed') return 'This exchange has been completed.';
  if (trade.status === 'cancelled') return 'This trade is no longer active.';
  return 'Accepted trades use delivery confirmation before the exchange is closed.';
}


function SideSection({ side }: { side: ReturnType<typeof getNeedSide> }) {
  const badgeClass = side.kind === 'need' ? 'need' : side.kind === 'offer' ? 'offer' : 'instruction';

  return (
    <section className="trade-social-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">{side.label}</p>
          <h2>{side.title}</h2>
        </div>
        <span className={`semantic-badge ${badgeClass}`}>{side.kind === 'need' ? <WebIcon name="need" size={14} decorative /> : side.kind === 'offer' ? <WebIcon name="offer" size={14} decorative /> : null}{side.label}</span>
      </div>
      <p>{side.description}</p>
      {side.metadata ? <p className="meta">{side.metadata}</p> : null}
      {side.tags.length ? (
        <div className="tag-row">
          {side.tags.slice(0, 8).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      ) : null}
      <TradeImageGrid images={side.media} title={side.title} badge={side.kind === 'need' ? 'Need reference' : side.kind === 'offer' ? 'Offer sample' : undefined} />
    </section>
  );
}

export function TradeDetailClient({ tradeId, initialTrade }: { tradeId: string; initialTrade?: TradeDto | null }) {
  const auth = useWebAuth();
  const router = useRouter();
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
    return (
      <article className="trade-detail-page">
        <section className="trade-hero-section">
          <span className="semantic-badge instruction">Loading</span>
          <h2>Loading trade...</h2>
        </section>
      </article>
    );
  }

  if (!trade) {
    return (
      <article className="trade-detail-page">
        <section className="trade-hero-section">
          <span className="semantic-badge danger">Not found</span>
          <h2>This trade could not be loaded.</h2>
          <p>Check that the API is running or open a trade from the feed.</p>
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
      setActionNotice(status === 'submitted' ? 'Delivery marked. The other party can now confirm completion.' : status === 'completed' ? 'Trade confirmed.' : status === 'disputed' ? 'Trade reported for support review.' : 'Trade updated.');
      await loadLiveTrade();
    } catch {
      setActionNotice('Could not update the trade yet. Check the current status and try again.');
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
      setActionNotice('Report sent. Support will review this trade.');
      await loadLiveTrade();
    } catch {
      setActionNotice('Could not send the report yet. Try again from Account > Support.');
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
      setActionNotice(getFriendlyApiErrorMessage(cause, 'Could not delete this trade yet. Check its status and try again.'));
    } finally {
      setActionLoading(null);
    }
  }

  const needSide = getNeedSide(currentTrade);
  const offerSide = getOfferSide(currentTrade);
  const ownerName = getOwnerName(currentTrade);
  const exchange = getExchangeLabel(currentTrade);
  const mode = getTradeMode(currentTrade);

  return (
    <article className="trade-detail-page">
      <section className="trade-hero-section">
        <div className="status-row">
          <span className="semantic-badge trade"><WebIcon name="trade" size={14} decorative /> {currentTrade.status}</span>
          <span className="semantic-badge trade">{exchange}</span>
          {usingFallback ? <span className="semantic-badge instruction">Demo detail</span> : null}
        </div>
        <h2>{currentTrade.title}</h2>
        <p>{currentTrade.description}</p>
        <p className="meta">Posted by {ownerName} · {formatRelativeExpiry(currentTrade.expiresAt)}</p>
      </section>

      <SideSection side={needSide} />
      <SideSection side={offerSide} />

      <section className="trade-social-section trade-social-section--compact">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Trade details</p>
            <h2 className="icon-heading"><WebIcon name="trade" size={21} decorative /> How this trade works</h2>
          </div>
        </div>
        <dl className="trade-detail-list">
          <div><dt>Status</dt><dd>{currentTrade.status}</dd></div>
          <div><dt>Exchange</dt><dd>{exchange}</dd></div>
          <div><dt>Mode</dt><dd>{mode ?? 'Not specified'}</dd></div>
          <div><dt>Created</dt><dd>{formatDateLabel(currentTrade.createdAt)}</dd></div>
          <div><dt>Expires</dt><dd>{formatRelativeExpiry(currentTrade.expiresAt)}</dd></div>
        </dl>
      </section>

      <section className="trade-social-section trade-social-section--compact">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Confirmation</p>
            <h2 className="icon-heading"><WebIcon name={currentTrade.status === 'disputed' ? 'dispute' : 'proposal-accepted'} size={21} decorative /> Delivery confirmation</h2>
          </div>
          {actionLoading ? <span className="semantic-badge instruction">Updating</span> : null}
        </div>
        <p>{completionHint(currentTrade, actorId)}</p>
        <p className="meta">You are viewing as {participantLabel(currentTrade, actorId)}.</p>
        {actionNotice ? <p className="notice-box info">{actionNotice}</p> : null}
        <div className="trade-action-row">
          {canSubmitDelivery ? <button type="button" onClick={() => void updateTradeStatus('submitted')} disabled={Boolean(actionLoading)}>Mark delivered</button> : null}
          {canConfirmCompletion ? <button type="button" className="success" onClick={() => setConfirmCompletionOpen(true)} disabled={Boolean(actionLoading)}>Confirm completed</button> : null}
          {canReportProblem ? <button type="button" className="secondary danger-text" onClick={() => setReportOpen((open) => !open)} disabled={Boolean(actionLoading)}><WebIcon name="dispute" size={16} decorative /> Report problem</button> : null}
        </div>
        {reportOpen ? (
          <form className="proposal-composer" onSubmit={submitReport}>
            <label className="field-label">
              What happened?
              <textarea value={reportMessage} onChange={(event) => setReportMessage(event.target.value)} placeholder="Explain what went wrong so support can review the trade." rows={4} />
            </label>
            <button type="submit" disabled={actionLoading === 'report' || reportMessage.trim().length < 10}>Send report</button>
          </form>
        ) : null}
      </section>

      <TradeProposalPanel trade={currentTrade} onTradeChange={setTrade} />

      {isOwner ? (
        <section className="trade-social-section trade-social-section--compact trade-danger-zone">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">Owner controls</p>
              <h2 className="icon-heading"><WebIcon name="warning" size={21} decorative /> Delete trade</h2>
            </div>
            <span className={canDeleteTrade ? 'semantic-badge danger' : 'semantic-badge instruction'}>{canDeleteTrade ? 'Available' : 'Protected'}</span>
          </div>
          <p>{canDeleteTrade ? 'Remove this trade from the public feed. Your saved Need and Offer will stay in your inventory.' : 'This trade cannot be deleted while it is in progress, submitted, completed, or disputed.'}</p>
          <div className="trade-action-row">
            <button type="button" className="secondary danger-text" onClick={() => setDeleteTradeOpen(true)} disabled={!canDeleteTrade || Boolean(actionLoading)}>Delete trade</button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmCompletionOpen}
        eyebrow="Confirmation"
        title="Confirm completed?"
        body="Confirm only when your trade is complete. This will close the exchange and update the trade status."
        variant="warning"
        confirmLabel="Confirm completed"
        loading={actionLoading === 'completed'}
        onCancel={() => setConfirmCompletionOpen(false)}
        onConfirm={async () => {
          await updateTradeStatus('completed');
          setConfirmCompletionOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteTradeOpen}
        eyebrow="Owner action"
        title="Delete trade?"
        body="This will remove the trade from the public feed and close pending proposals. Your saved Need and Offer will not be deleted."
        variant="danger"
        confirmLabel="Delete trade"
        loading={actionLoading === 'delete'}
        onCancel={() => setDeleteTradeOpen(false)}
        onConfirm={deleteTrade}
      />
    </article>
  );
}
