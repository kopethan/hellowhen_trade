'use client';

import Link from 'next/link';
import type { TradeDto } from '@hellowhen/contracts';
import { useEffect, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { TradeProposalPanel } from './TradeProposalPanel';
import { getTradeHeadline } from './tradePresentation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function normalizeTrade(value: unknown): TradeDto | null {
  if (isRecord(value) && typeof value.id === 'string') return value as TradeDto;
  if (isRecord(value) && isRecord(value.trade) && typeof value.trade.id === 'string') return value.trade as TradeDto;
  return null;
}

export function TradePrivateProposalsClient({ tradeId }: { tradeId: string }) {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const i18n = { t, language };
  const [trade, setTrade] = useState<TradeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!auth.isAuthenticated) {
      setLoading(false);
      return;
    }
    let mounted = true;
    async function loadTrade() {
      setLoading(true);
      setNotice(null);
      try {
        const response = await api.trades.get(tradeId);
        const nextTrade = normalizeTrade(response);
        if (!mounted) return;
        setTrade(nextTrade);
        if (!nextTrade) setNotice(t('trade.detail.couldNotLoad'));
      } catch {
        if (mounted) setNotice(t('trade.detail.couldNotLoad'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadTrade();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated, t, tradeId]);

  if (!auth.hydrated || loading) {
    return (
      <article className="trade-detail-page private-proposals-page">
        <section className="trade-hero-section">
          <span className="semantic-badge instruction">{t('common.states.loading')}</span>
          <h2>{t('trade.threadSplit.privateTitle')}</h2>
        </section>
      </article>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <article className="trade-detail-page private-proposals-page">
        <section className="trade-hero-section">
          <Link href={`/trades/${tradeId}`} className="button secondary">← {t('common.actions.back')}</Link>
          <span className="semantic-badge proposal"><WebIcon name="proposal" size={14} decorative /> {t('trade.threadSplit.privateTitle')}</span>
          <h2>{t('trade.threadSplit.privateSignedOutTitle')}</h2>
          <p>{t('trade.threadSplit.privateSignedOutBody')}</p>
          <Link href={`/auth?next=${encodeURIComponent(`/trades/${tradeId}/proposals`)}`} className="button primary full">{t('trade.proposals.signInToSend')}</Link>
        </section>
      </article>
    );
  }

  if (!trade) {
    return (
      <article className="trade-detail-page private-proposals-page">
        <section className="trade-hero-section">
          <Link href={`/trades/${tradeId}`} className="button secondary">← {t('common.actions.back')}</Link>
          <span className="semantic-badge danger">{t('trade.labels.notFound')}</span>
          <h2>{t('trade.detail.couldNotLoad')}</h2>
          {notice ? <p className="notice-box warning">{notice}</p> : null}
        </section>
      </article>
    );
  }

  return (
    <article className="trade-detail-page private-proposals-page">
      <section className="trade-hero-section trade-thread-page-hero">
        <Link href={`/trades/${trade.id}`} className="button secondary">← {t('trade.labels.trade')}</Link>
        <span className="semantic-badge proposal"><WebIcon name="proposal" size={14} decorative /> {t('trade.threadSplit.privateTitle')}</span>
        <h2>{getTradeHeadline(trade, i18n)}</h2>
        <p>{t(auth.user?.id === trade.ownerId ? 'trade.threadSplit.privateOwnerBody' : 'trade.threadSplit.privateApplicantBody')}</p>
      </section>
      <TradeProposalPanel trade={trade} variant="page" />
    </article>
  );
}
