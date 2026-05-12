'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import type { TradeDto, TradePostType } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { WebIcon } from '../../components/WebIcon';
import { betaFeatures } from '../../lib/betaFeatures';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockTrades } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { TradeDeckGrid } from './TradeDeckGrid';

type FeedFilters = {
  q: string;
  mode: string;
  hasImages: boolean;
  hasMoney: boolean;
  postType: '' | TradePostType;
};

const initialFilters: FeedFilters = { q: '', mode: '', hasImages: false, hasMoney: false, postType: '' };

function normalizeFeedResponse(value: unknown): TradeDto[] {
  if (Array.isArray(value)) return value as TradeDto[];
  if (value && typeof value === 'object' && Array.isArray((value as { trades?: unknown[] }).trades)) return (value as { trades: TradeDto[] }).trades;
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) return (value as { items: TradeDto[] }).items;
  return [];
}

function localFilter(trades: TradeDto[], filters: FeedFilters) {
  const query = filters.q.trim().toLowerCase();
  return trades.filter((trade) => {
    const haystack = [trade.title, trade.description, trade.need?.title, trade.need?.description, trade.offer?.title, trade.offer?.description].filter(Boolean).join(' ').toLowerCase();
    const mode = trade.need?.mode ?? trade.offer?.mode ?? '';
    const hasImages = Boolean((trade.need?.media?.length ?? 0) + (trade.offer?.media?.length ?? 0));
    const hasMoney = (trade.amountCents ?? 0) > 0;
    if (query && !haystack.includes(query)) return false;
    if (filters.mode && mode !== filters.mode) return false;
    if (filters.postType && (trade.postType ?? 'need_offer') !== filters.postType) return false;
    if (filters.hasImages && !hasImages) return false;
    if (filters.hasMoney && !hasMoney) return false;
    return true;
  });
}

export function TradeFeedClient() {
  const [filters, setFilters] = useState<FeedFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<FeedFilters>(initialFilters);
  const [trades, setTrades] = useState<TradeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const { t } = useWebTranslation();
  const demoDataEnabled = isWebDemoDataEnabled();
  const auth = useWebAuth();
  const createTradeHref = !auth.hydrated || !auth.isAuthenticated ? '/auth?next=/trades/create' : '/trades/create';

  useEffect(() => {
    let mounted = true;
    async function loadTrades() {
      setLoading(true);
      try {
        const response = await api.trades.feed({
          q: appliedFilters.q || undefined,
          mode: appliedFilters.mode || undefined,
          hasImages: appliedFilters.hasImages || undefined,
          hasMoney: betaFeatures.moneyTradesEnabled ? (appliedFilters.hasMoney || undefined) : undefined,
          postType: appliedFilters.postType || undefined,
          take: 30,
        });
        const nextTrades = normalizeFeedResponse(response);
        if (!mounted) return;
        setTrades(nextTrades);
        setUsingFallback(false);
        setLoadError('');
      } catch {
        if (!mounted) return;
        if (demoDataEnabled) {
          setTrades(localFilter(mockTrades, appliedFilters));
          setUsingFallback(true);
          setLoadError('');
        } else {
          setTrades([]);
          setUsingFallback(false);
          setLoadError(t('trade.filters.loadError'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadTrades();
    return () => { mounted = false; };
  }, [appliedFilters, demoDataEnabled]);

  const filteredTrades = useMemo(() => usingFallback ? localFilter(trades, appliedFilters) : trades, [appliedFilters, trades, usingFallback]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filters);
  }

  function resetFilters() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  }

  return (
    <section className="mobile-page trade-feed-page">
      <form className="trade-feed-controls" aria-label={t('trade.filters.controls')} onSubmit={applySearch}>
        <label className="trade-search-field">
          <span className="sr-only">{t('trade.filters.searchTrades')}</span>
          <WebIcon name="search" size={17} decorative className="trade-search-field__icon" />
          <input
            value={filters.q}
            onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
            placeholder={t('trade.filters.searchTrades')}
            type="search"
          />
        </label>
        <button type="button" className="trade-filter-pill" onClick={() => setShowFilters((value) => !value)}>
          <WebIcon name="filter" size={17} decorative />
          <span>{t('trade.filters.filter')}</span>
        </button>
        <Link href={createTradeHref} className="trade-create-pill" aria-label={t('trade.create.title')}>
          <WebIcon name="add" size={21} decorative />
        </Link>
        {showFilters ? (
          <div className="trade-filter-panel">
            <label>
              <span>{t('trade.filters.mode')}</span>
              <select value={filters.mode} onChange={(event) => setFilters((current) => ({ ...current, mode: event.target.value }))}>
                <option value="">{t('trade.filters.anyMode')}</option>
                <option value="remote">{t('trade.modes.remote')}</option>
                <option value="local">{t('trade.modes.local')}</option>
                <option value="hybrid">{t('trade.modes.hybrid')}</option>
              </select>
            </label>
            <label>
              <span>{t('trade.filters.postType')}</span>
              <select value={filters.postType} onChange={(event) => setFilters((current) => ({ ...current, postType: event.target.value as FeedFilters['postType'] }))}>
                <option value="">{t('trade.filters.anyPostType')}</option>
                <option value="need_offer">{t('trade.postTypes.needOffer')}</option>
                <option value="open_need">{t('trade.postTypes.openNeed')}</option>
                <option value="open_offer">{t('trade.postTypes.openOffer')}</option>
              </select>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={filters.hasImages} onChange={(event) => setFilters((current) => ({ ...current, hasImages: event.target.checked }))} />
              {t('trade.filters.hasImages')}
            </label>
            {betaFeatures.moneyTradesEnabled ? (
              <label className="checkbox-row">
                <input type="checkbox" checked={filters.hasMoney} onChange={(event) => setFilters((current) => ({ ...current, hasMoney: event.target.checked }))} />
                {t('trade.filters.includesWalletMoney')}
              </label>
            ) : null}
            <div className="trade-filter-actions">
              <button type="submit">{t('trade.filters.apply')}</button>
              <button type="button" className="secondary" onClick={resetFilters}>{t('trade.filters.reset')}</button>
            </div>
          </div>
        ) : null}
      </form>

      <section className="feed-status-row" aria-live="polite">
        <p>{loading ? t('trade.filters.loadingTrades') : filteredTrades.length === 1 ? t('trade.filters.activeTradeOne') : t('trade.filters.activeTrades', { count: filteredTrades.length })}</p>
        {loading ? <span className="semantic-badge instruction">{t('common.states.loading')}</span> : loadError ? <span className="semantic-badge danger">{t('trade.filters.error')}</span> : usingFallback ? <span className="semantic-badge instruction">{t('trade.filters.demoFeed')}</span> : <span className="semantic-badge success">{t('trade.filters.liveFeed')}</span>}
      </section>

      {loadError ? (
        <section className="mobile-card mobile-card--soft">
          <h3>{t('trade.filters.couldNotLoadTrades')}</h3>
          <p>{loadError}</p>
        </section>
      ) : loading ? <TradeFeedSkeleton /> : <TradeDeckGrid trades={filteredTrades} />}

      {!loading && !loadError && !filteredTrades.length ? (
        <section className="mobile-card mobile-card--soft">
          <h3>{t('trade.filters.noTradesFound')}</h3>
          <p>{t('trade.filters.noTradesBody')}</p>
          <button type="button" className="secondary" onClick={resetFilters}>{t('trade.filters.clearFilters')}</button>
        </section>
      ) : null}
    </section>
  );
}

function TradeFeedSkeleton() {
  return (
    <div className="trade-deck-grid trade-deck-grid--skeleton" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div className="trade-stack-deck trade-stack-deck--skeleton" key={item}>
          <div className="square-stack-deck__surface">
            <div className="trade-stack-card trade-stack-card--summary trade-stack-card--skeleton">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
