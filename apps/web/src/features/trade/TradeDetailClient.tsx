'use client';

import type { TradeDto } from '@hellowhen/contracts';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
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
      <TradeImageGrid images={side.media} title={side.title} />
    </section>
  );
}

export function TradeDetailClient({ tradeId, initialTrade }: { tradeId: string; initialTrade?: TradeDto | null }) {
  const [trade, setTrade] = useState<TradeDto | null>(initialTrade ?? mockTrades.find((item) => item.id === tradeId) ?? null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(Boolean(initialTrade));

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

      <TradeProposalPanel trade={trade} />
    </article>
  );
}
