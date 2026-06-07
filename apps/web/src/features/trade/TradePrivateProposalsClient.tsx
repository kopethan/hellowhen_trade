'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { TradeDto } from '@hellowhen/contracts';
import { useEffect, useState } from 'react';
import { ReportContentButton } from '../../components/ReportContentButton';
import { WebIcon } from '../../components/WebIcon';
import { WebOptionPickerCard, WebOptionPickerDangerCard, WebOptionPickerPanel } from '../../components/WebOptionPicker';
import { api } from '../../lib/api';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { TradeProposalPanel } from './TradeProposalPanel';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}


function proposalAttachHref(tradeId: string, side: 'need' | 'offer', currentNeedId?: string, currentOfferId?: string) {
  const params = new URLSearchParams();
  if (currentNeedId) params.set('proposalNeedId', currentNeedId);
  if (currentOfferId) params.set('proposalOfferId', currentOfferId);
  const query = params.toString();
  return `/trades/${tradeId}/propose/choose-${side}${query ? `?${query}` : ''}`;
}

type PrivateProposalEntryView = 'thread' | 'menu' | 'guide' | 'report-thread';

function normalizeTrade(value: unknown): TradeDto | null {
  if (isRecord(value) && typeof value.id === 'string') return value as TradeDto;
  if (isRecord(value) && isRecord(value.trade) && typeof value.trade.id === 'string') return value.trade as TradeDto;
  return null;
}

export function TradePrivateProposalsClient({ tradeId }: { tradeId: string }) {
  const auth = useWebAuth();
  const searchParams = useSearchParams();
  const { t } = useWebTranslation();
  const [trade, setTrade] = useState<TradeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<PrivateProposalEntryView>('thread');

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

  const currentProposalNeedId = searchParams.get('proposalNeedId') ?? '';
  const currentProposalOfferId = searchParams.get('proposalOfferId') ?? '';

  function closeSubpage() {
    setView('thread');
  }

  function openThreadMenu() {
    setView('menu');
  }

  if (!auth.hydrated || loading) {
    return (
      <article className="trade-detail-page private-proposals-page private-proposals-page--messages-only" aria-busy="true">
        <section className="web-thread-header web-thread-header--loading">
          <span className="semantic-badge instruction">{t('common.states.loading')}</span>
          <h2>{t('trade.threadSplit.privateTitle')}</h2>
        </section>
        <section className="web-thread-loading-list" aria-hidden="true">
          <span />
          <span />
          <span />
        </section>
      </article>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <article className="trade-detail-page private-proposals-page private-proposals-page--messages-only">
        <section className="web-thread-header">
          <Link href={`/trades/${tradeId}`} className="web-thread-header__back" aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></Link>
          <h2>{t('trade.threadSplit.privateTitle')}</h2>
          <span aria-hidden="true" />
        </section>
        <section className="web-thread-info-page web-thread-state">
          <span className="semantic-badge proposal"><WebIcon name="proposal" size={14} decorative /> {t('trade.threadSplit.privateTitle')}</span>
          <h3>{t('trade.threadSplit.privateSignedOutTitle')}</h3>
          <p>{t('trade.threadSplit.privateSignedOutBody')}</p>
          <Link href={`/auth?next=${encodeURIComponent(`/trades/${tradeId}/proposals`)}`} className="button primary full">{t('trade.proposals.signInToSend')}</Link>
        </section>
      </article>
    );
  }

  if (!trade) {
    return (
      <article className="trade-detail-page private-proposals-page private-proposals-page--messages-only">
        <section className="web-thread-header">
          <Link href={`/trades/${tradeId}`} className="web-thread-header__back" aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></Link>
          <h2>{t('trade.threadSplit.privateTitle')}</h2>
          <span aria-hidden="true" />
        </section>
        <section className="web-thread-info-page web-thread-state">
          <span className="semantic-badge danger">{t('trade.labels.notFound')}</span>
          <h3>{t('trade.detail.couldNotLoad')}</h3>
          {notice ? <p className="notice-box warning">{notice}</p> : null}
        </section>
      </article>
    );
  }

  if (view === 'menu') {
    return (
      <article className="trade-detail-page private-proposals-page private-proposals-page--messages-only">
        <section className="web-thread-header">
          <button type="button" className="web-thread-header__back" onClick={closeSubpage} aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></button>
          <h2>{t('trade.proposals.privateMenuTitle')}</h2>
        </section>
        <WebOptionPickerPanel className="web-thread-options-picker">
          <WebOptionPickerCard
            href={`/trades/${trade.id}`}
            iconName="trade"
            title={t('trade.proposals.privateMenuSeeDetails')}
            description={t('trade.proposals.privateMenuSeeDetailsBody')}
          />
          <WebOptionPickerCard
            iconName="help"
            title={t('trade.proposals.privateMenuSeeGuide')}
            description={t('trade.proposals.privateMenuSeeGuideBody')}
            onClick={() => setView('guide')}
          />
          {!auth.user || auth.user.id === trade.ownerId ? null : (
            <>
              <WebOptionPickerCard
                href={proposalAttachHref(trade.id, 'offer', currentProposalNeedId, currentProposalOfferId)}
                iconName="offer"
                title={t(currentProposalOfferId ? 'trade.proposals.privateMenuChangeOffer' : 'trade.proposals.privateMenuAttachOffer')}
                description={t('trade.proposals.privateMenuAttachOfferBody')}
              />
              <WebOptionPickerCard
                href={proposalAttachHref(trade.id, 'need', currentProposalNeedId, currentProposalOfferId)}
                iconName="need"
                title={t(currentProposalNeedId ? 'trade.proposals.privateMenuChangeNeed' : 'trade.proposals.privateMenuAttachNeed')}
                description={t('trade.proposals.privateMenuAttachNeedBody')}
              />
            </>
          )}
          <WebOptionPickerDangerCard
            iconName="report-flag"
            title={t('trade.proposals.privateMenuReportThread')}
            description={t('trade.proposals.privateMenuReportThreadBody')}
            onClick={() => setView('report-thread')}
          />
        </WebOptionPickerPanel>
      </article>
    );
  }

  if (view === 'guide') {
    return (
      <article className="trade-detail-page private-proposals-page private-proposals-page--messages-only">
        <section className="web-thread-header">
          <button type="button" className="web-thread-header__back" onClick={() => setView('menu')} aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></button>
          <h2>{t('trade.proposals.privateGuideTitle')}</h2>
        </section>
        <section className="web-thread-info-page web-thread-guide-page">
          <ul className="web-thread-guide-list web-thread-guide-list--cards">
            <li>
              <span className="web-thread-guide-card__icon" aria-hidden="true"><WebIcon name="proposal" size={20} decorative /></span>
              <p>{t('trade.proposals.privateGuideBody')}</p>
            </li>
            <li>
              <span className="web-thread-guide-card__icon" aria-hidden="true"><WebIcon name="offer" size={20} decorative /></span>
              <p>{t('trade.proposals.privateGuideProposal')}</p>
            </li>
            <li>
              <span className="web-thread-guide-card__icon" aria-hidden="true"><WebIcon name="trade" size={20} decorative /></span>
              <p>{t('trade.proposals.privateGuideDetails')}</p>
            </li>
            <li className="web-thread-guide-card--warning">
              <span className="web-thread-guide-card__icon" aria-hidden="true"><WebIcon name="warning" size={20} decorative /></span>
              <p>{t('trade.proposals.privateGuideSafety')}</p>
            </li>
          </ul>
        </section>
      </article>
    );
  }

  if (view === 'report-thread') {
    return (
      <article className="trade-detail-page private-proposals-page private-proposals-page--messages-only">
        <section className="web-thread-header">
          <button type="button" className="web-thread-header__back" onClick={() => setView('menu')} aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></button>
          <h2>{t('trade.proposals.privateMenuReportThread')}</h2>
        </section>
        <section className="web-thread-info-page">
          <ReportContentButton targetType="trade" targetId={trade.id} labelKey="trade.proposals.privateMenuReportThread" helperKey="report.helper.trade" initialOpen />
        </section>
      </article>
    );
  }

  return (
    <article className="trade-detail-page private-proposals-page private-proposals-page--messages-only">
      <section className="web-thread-header">
        <Link href={`/trades/${trade.id}`} className="web-thread-header__back" aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></Link>
        <h2>{t('trade.threadSplit.privateTitle')}</h2>
        <button type="button" className="web-thread-header__menu" onClick={openThreadMenu} aria-label={t('trade.proposals.privateMenuTitle')}>
          <WebIcon name="more" size={21} decorative />
        </button>
      </section>
      <TradeProposalPanel trade={trade} variant="page" />
    </article>
  );
}
