'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import type { TradeDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { WebIcon } from '../../components/WebIcon';
import { betaFeatures } from '../../lib/betaFeatures';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockTrades } from '../../lib/mockData';
import { TradeDeckGrid } from './TradeDeckGrid';

type FeedFilters = {
  q: string;
  mode: string;
  hasImages: boolean;
  hasMoney: boolean;
};

const initialFilters: FeedFilters = { q: '', mode: '', hasImages: false, hasMoney: false };

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
  const demoDataEnabled = isWebDemoDataEnabled();

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
          setLoadError('Trades could not be loaded. Check your connection and try again.');
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
      <form className="trade-feed-controls" aria-label="Trade feed controls" onSubmit={applySearch}>
        <label className="trade-search-field">
          <span className="sr-only">Search trades</span>
          <WebIcon name="search" size={17} decorative className="trade-search-field__icon" />
          <input
            value={filters.q}
            onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
            placeholder="Search trades"
            type="search"
          />
        </label>
        <button type="button" className="trade-filter-pill" onClick={() => setShowFilters((value) => !value)}>
          <WebIcon name="filter" size={17} decorative />
          <span>Filter</span>
        </button>
        <Link href="/trades/create" className="trade-create-pill" aria-label="Create trade">
          <WebIcon name="add" size={21} decorative />
        </Link>
        {showFilters ? (
          <div className="trade-filter-panel">
            <label>
              <span>Mode</span>
              <select value={filters.mode} onChange={(event) => setFilters((current) => ({ ...current, mode: event.target.value }))}>
                <option value="">Any mode</option>
                <option value="remote">Remote</option>
                <option value="local">Local</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={filters.hasImages} onChange={(event) => setFilters((current) => ({ ...current, hasImages: event.target.checked }))} />
              Has images
            </label>
            {betaFeatures.moneyTradesEnabled ? (
              <label className="checkbox-row">
                <input type="checkbox" checked={filters.hasMoney} onChange={(event) => setFilters((current) => ({ ...current, hasMoney: event.target.checked }))} />
                Includes wallet money
              </label>
            ) : null}
            <div className="trade-filter-actions">
              <button type="submit">Apply</button>
              <button type="button" className="secondary" onClick={resetFilters}>Reset</button>
            </div>
          </div>
        ) : null}
      </form>

      <section className="feed-status-row" aria-live="polite">
        <p>{loading ? 'Loading trades...' : `${filteredTrades.length} active trade${filteredTrades.length === 1 ? '' : 's'}`}</p>
        {loading ? <span className="semantic-badge instruction">Loading</span> : loadError ? <span className="semantic-badge danger">Error</span> : usingFallback ? <span className="semantic-badge instruction">Demo feed</span> : <span className="semantic-badge success">Live feed</span>}
      </section>

      {loadError ? (
        <section className="mobile-card mobile-card--soft">
          <h3>Could not load trades</h3>
          <p>{loadError}</p>
        </section>
      ) : loading ? <TradeFeedSkeleton /> : <TradeDeckGrid trades={filteredTrades} />}

      {!loading && !loadError && !filteredTrades.length ? (
        <section className="mobile-card mobile-card--soft">
          <h3>No trades found</h3>
          <p>Try a different search or clear the filters.</p>
          <button type="button" className="secondary" onClick={resetFilters}>Clear filters</button>
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
