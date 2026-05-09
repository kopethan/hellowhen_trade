'use client';

import type { TradeActionStatus, TradeDto } from '@hellowhen/contracts';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { mockTrades } from '../../lib/mockData';
import { TradeDetailReferenceDeck } from './TradeDetailReferenceDeck';
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

function completionHint(trade: TradeDto, userId?: string | null) {
  const payment = trade.payment;
  if (trade.status === 'in_progress') {
    if (payment?.amountCents && payment.sellerId === userId) return 'Mark delivered when your side is done. The wallet-money payer must confirm before funds are released.';
    if (payment?.amountCents && payment.buyerId === userId) return 'Wait for delivery, then confirm only if everything is okay. Report a problem before releasing money.';
    return 'One party should mark delivered, then the other confirms completion.';
  }
  if (trade.status === 'submitted') {
    if (payment?.amountCents && payment.buyerId === userId) return 'Review the delivery. Confirming will release held wallet money into the other member’s pending payout balance.';
    return 'Waiting for the other party to confirm completion.';
  }
  if (trade.status === 'disputed') return 'Money flow is frozen while admin reviews the report.';
  return 'Accepted trades use delivery confirmation before money is released.';
}

function SideSection({ side }: { side: ReturnType<typeof getNeedSide> }) {
  const badgeClass = side.kind === 'need' ? 'need' : side.kind === 'offer' ? 'offer' : side.kind === 'money' ? 'money' : 'instruction';

  return (
    <section className="trade-social-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">{side.label}</p>
          <h2>{side.title}</h2>
        </div>
        <span className={`semantic-badge ${badgeClass}`}>{side.kind === 'money' ? 'Money' : side.label}</span>
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
  const [trade, setTrade] = useState<TradeDto | null>(initialTrade ?? mockTrades.find((item) => item.id === tradeId) ?? null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(Boolean(initialTrade));
  const [actionLoading, setActionLoading] = useState<TradeActionStatus | 'report' | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState('');

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
      const fallback = mockTrades.find((item) => item.id === tradeId) ?? initialTrade ?? null;
      setTrade(fallback);
      setUsingFallback(Boolean(fallback));
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
        const fallback = mockTrades.find((item) => item.id === tradeId) ?? initialTrade ?? null;
        setTrade(fallback);
        setUsingFallback(Boolean(fallback));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadTrade();
    return () => { mounted = false; };
  }, [initialTrade, tradeId]);

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

  const actorId = auth.user?.id ?? null;
  const isOwner = actorId === trade.ownerId;
  const isProvider = Boolean(actorId && trade.providerId === actorId);
  const payment = trade.payment;
  const canSubmitDelivery = auth.isAuthenticated && trade.status === 'in_progress' && (payment?.amountCents ? payment.sellerId === actorId : (isOwner || isProvider));
  const canConfirmCompletion = auth.isAuthenticated && trade.status === 'submitted' && (payment?.amountCents ? payment.buyerId === actorId : (isOwner || isProvider)) && trade.deliverySubmittedById !== actorId;
  const canReportProblem = auth.isAuthenticated && ['active', 'in_progress', 'submitted', 'completed'].includes(trade.status);
  const completionWarning = payment?.amountCents ? `This will release held wallet money to the other member's pending payout balance. Report a problem before confirming if anything is wrong.` : 'Confirm only when your trade is complete.';

  async function updateTradeStatus(status: TradeActionStatus) {
    if (status === 'completed' && !window.confirm(completionWarning)) return;
    setActionLoading(status);
    setActionNotice(null);
    try {
      const response = await api.trades.updateStatus(trade.id, { status });
      const nextTrade = normalizeTradeResponse(response);
      if (nextTrade) setTrade(nextTrade);
      setActionNotice(status === 'submitted' ? 'Delivery marked. The other party can now confirm completion.' : status === 'completed' ? 'Trade confirmed. Held wallet money was released when applicable.' : status === 'disputed' ? 'Trade reported. Money movement is frozen for admin review.' : 'Trade updated.');
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
      await api.support.createTicket({ category: 'trade_issue', priority: payment?.amountCents ? 'high' : 'normal', subject: `Problem with trade: ${trade.title}`.slice(0, 140), message, relatedTradeId: trade.id });
      setReportMessage('');
      setReportOpen(false);
      setActionNotice('Report sent. This trade is now frozen for admin review when money is involved.');
      await loadLiveTrade();
    } catch {
      setActionNotice('Could not send the report yet. Try again from Account > Support.');
    } finally {
      setActionLoading(null);
    }
  }

  const needSide = getNeedSide(trade);
  const offerSide = getOfferSide(trade);
  const ownerName = getOwnerName(trade);
  const exchange = getExchangeLabel(trade);
  const mode = getTradeMode(trade);

  return (
    <article className="trade-detail-page">
      <section className="trade-hero-section">
        <div className="status-row">
          <span className="semantic-badge trade">{trade.status}</span>
          <span className="semantic-badge money">{exchange}</span>
          {usingFallback ? <span className="semantic-badge instruction">Demo detail</span> : null}
        </div>
        <h2>{trade.title}</h2>
        <p>{trade.description}</p>
        <p className="meta">Posted by {ownerName} · {formatRelativeExpiry(trade.expiresAt)}</p>
      </section>

      <TradeDetailReferenceDeck trade={trade} />

      <SideSection side={needSide} />
      <SideSection side={offerSide} />

      <section className="trade-social-section trade-social-section--compact">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Trade details</p>
            <h2>How this trade works</h2>
          </div>
        </div>
        <dl className="trade-detail-list">
          <div><dt>Status</dt><dd>{trade.status}</dd></div>
          <div><dt>Exchange</dt><dd>{exchange}</dd></div>
          <div><dt>Mode</dt><dd>{mode ?? 'Not specified'}</dd></div>
          <div><dt>Created</dt><dd>{formatDateLabel(trade.createdAt)}</dd></div>
          <div><dt>Expires</dt><dd>{formatRelativeExpiry(trade.expiresAt)}</dd></div>
        </dl>
      </section>

      <section className="trade-social-section trade-social-section--compact">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Confirmation</p>
            <h2>Delivery and money release</h2>
          </div>
          {actionLoading ? <span className="semantic-badge instruction">Updating</span> : null}
        </div>
        <p>{completionHint(trade, actorId)}</p>
        <p className="meta">You are viewing as {participantLabel(trade, actorId)}.</p>
        {actionNotice ? <p className="notice-box info">{actionNotice}</p> : null}
        <div className="trade-action-row">
          {canSubmitDelivery ? <button type="button" onClick={() => void updateTradeStatus('submitted')} disabled={Boolean(actionLoading)}>Mark delivered</button> : null}
          {canConfirmCompletion ? <button type="button" className="success" onClick={() => void updateTradeStatus('completed')} disabled={Boolean(actionLoading)}>Confirm and release</button> : null}
          {canReportProblem ? <button type="button" className="secondary danger-text" onClick={() => setReportOpen((open) => !open)} disabled={Boolean(actionLoading)}>Report problem</button> : null}
        </div>
        {reportOpen ? (
          <form className="proposal-composer" onSubmit={submitReport}>
            <label className="field-label">
              What happened?
              <textarea value={reportMessage} onChange={(event) => setReportMessage(event.target.value)} placeholder="Explain what went wrong. Admin will use this to pause or review money movement." rows={4} />
            </label>
            <button type="submit" disabled={actionLoading === 'report' || reportMessage.trim().length < 10}>Send report and freeze trade</button>
          </form>
        ) : null}
      </section>

      <TradeProposalPanel trade={trade} />
    </article>
  );
}
