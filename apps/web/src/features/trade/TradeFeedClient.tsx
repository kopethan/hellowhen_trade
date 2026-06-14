'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import type { TradeDto, TradePostType, TradeSearchKeywordSource, TradeSearchSuggestion } from '@hellowhen/contracts';
import { getTradeOwnerVisibilityState, isTradeOwnerCloseAllowed, isTradeOwnerRenewAllowed } from '@hellowhen/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { WebIcon } from '../../components/WebIcon';
import { betaFeatures } from '../../lib/betaFeatures';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockTrades } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { formatWebShortDate } from '../../lib/webFormat';
import { TradeDeckGrid } from './TradeDeckGrid';
import { getExchangeLabel, getStatusLabel, getTradeHeadline } from './tradePresentation';

type FeedFilters = {
  q: string;
  mode: string;
  hasImages: boolean;
  hasMoney: boolean;
  postType: '' | TradePostType;
};

type TradeActivityTab = 'mine' | 'involved';
type TradeWithCounts = TradeDto & { _count?: { proposals?: number } };
type TradeWithViewerProposal = TradeWithCounts & { viewerProposal?: { id: string; status: string; createdAt?: string; respondedAt?: string | null } | null; viewerInvolvement?: 'owner' | 'provider' | 'applicant' };

const initialFilters: FeedFilters = { q: '', mode: '', hasImages: false, hasMoney: false, postType: '' };
const minSearchSuggestionLength = 2;
const homeTradeIntroSeenKey = 'hellowhen.trade.homeIntro.seen.v1';

function createFeedRefreshSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function compactSeenTradeIds(ids: string[]) {
  return Array.from(new Set(ids)).slice(-80);
}

function normalizeFeedResponse(value: unknown): TradeDto[] {
  if (Array.isArray(value)) return value as TradeDto[];
  if (value && typeof value === 'object' && Array.isArray((value as { trades?: unknown[] }).trades)) return (value as { trades: TradeDto[] }).trades;
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) return (value as { items: TradeDto[] }).items;
  return [];
}

function hashFeedValue(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function localDiscoverySort(trades: TradeDto[], refreshSeed: string, seenTradeIds: string[]) {
  const seen = new Set(seenTradeIds);
  return [...trades].sort((left, right) => {
    const leftSeenPenalty = seen.has(left.id) ? 1_000_000_000 : 0;
    const rightSeenPenalty = seen.has(right.id) ? 1_000_000_000 : 0;
    return (hashFeedValue(`${refreshSeed}:${left.id}`) + leftSeenPenalty) - (hashFeedValue(`${refreshSeed}:${right.id}`) + rightSeenPenalty);
  });
}

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function canUseSearchSuggestions(value: string) {
  return normalizeSearchText(value).length >= minSearchSuggestionLength;
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

type TradeFeedClientProps = { showHomeIntro?: boolean };

export function TradeFeedClient({ showHomeIntro = false }: TradeFeedClientProps = {}) {
  const [activityTab, setActivityTab] = useState<TradeActivityTab>('mine');
  const [filters, setFilters] = useState<FeedFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<FeedFilters>(initialFilters);
  const [trades, setTrades] = useState<TradeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<TradeSearchSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<'filter' | 'activity' | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(() => createFeedRefreshSeed());
  const [seenTradeIds, setSeenTradeIds] = useState<string[]>([]);
  const pendingSearchRecordRef = useRef<{ q: string; source: TradeSearchKeywordSource } | null>(null);
  const [homeIntroDismissed, setHomeIntroDismissed] = useState(false);
  const [homeIntroReady, setHomeIntroReady] = useState(false);
  const { t, language } = useWebTranslation();
  const demoDataEnabled = isWebDemoDataEnabled();
  const auth = useWebAuth();
  const createTradeHref = !auth.hydrated || !auth.isAuthenticated ? '/auth?next=/trades/create' : '/trades/create';
  const shouldShowHomeIntro = showHomeIntro && homeIntroReady && auth.hydrated && !auth.isAuthenticated && !homeIntroDismissed;

  const queueSearchKeywordRecord = useCallback((q: string, source: TradeSearchKeywordSource) => {
    const normalized = normalizeSearchText(q);
    if (!canUseSearchSuggestions(normalized)) return;
    pendingSearchRecordRef.current = { q: normalized, source };
  }, []);

  const recordSearchKeyword = useCallback(async (pending: { q: string; source: TradeSearchKeywordSource }, resultCount: number) => {
    const normalized = normalizeSearchText(pending.q);
    if (!canUseSearchSuggestions(normalized)) return;
    try {
      await api.tradeSearch.recordKeyword({ q: normalized, source: pending.source, resultCount, language, countryCode: auth.user?.profile?.countryCode ?? undefined });
    } catch {
      // Search logging is best-effort and must never block discovery.
    }
  }, [auth.user?.profile?.countryCode, language]);

  useEffect(() => {
    if (!showHomeIntro) {
      setHomeIntroReady(false);
      return;
    }

    try {
      setHomeIntroDismissed(window.localStorage.getItem(homeTradeIntroSeenKey) === '1');
    } catch {
      // Keep the intro eligible for logged-out visitors when storage is unavailable.
      setHomeIntroDismissed(false);
    } finally {
      setHomeIntroReady(true);
    }
  }, [showHomeIntro]);

  useEffect(() => {
    if (!showHomeIntro || !auth.hydrated || auth.isAuthenticated) return;
    try {
      window.localStorage.setItem(homeTradeIntroSeenKey, '1');
    } catch {
      // The dismiss button still works for this page view if storage is unavailable.
    }
  }, [auth.hydrated, auth.isAuthenticated, showHomeIntro]);

  function dismissHomeIntro() {
    setHomeIntroDismissed(true);
    try {
      window.localStorage.setItem(homeTradeIntroSeenKey, '1');
    } catch {
      // Ignore storage failures.
    }
  }

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
          language,
          countryCode: auth.user?.profile?.countryCode ?? undefined,
          refreshSeed,
          seenTradeIds: seenTradeIds.length ? seenTradeIds.join(',') : undefined,
          take: 30,
        });
        const nextTrades = normalizeFeedResponse(response);
        if (!mounted) return;
        setTrades(nextTrades);
        setUsingFallback(false);
        setLoadError('');
        const pendingRecord = pendingSearchRecordRef.current;
        if (pendingRecord && normalizeSearchText(pendingRecord.q) === normalizeSearchText(appliedFilters.q)) {
          pendingSearchRecordRef.current = null;
          void recordSearchKeyword(pendingRecord, nextTrades.length);
        }
      } catch {
        if (!mounted) return;
        if (demoDataEnabled) {
          setTrades(localDiscoverySort(localFilter(mockTrades, appliedFilters), refreshSeed, seenTradeIds));
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
  }, [appliedFilters, auth.user?.profile?.countryCode, demoDataEnabled, language, recordSearchKeyword, refreshSeed, seenTradeIds, t]);

  const filteredTrades = useMemo(() => usingFallback ? localFilter(trades, appliedFilters) : trades, [appliedFilters, trades, usingFallback]);
  const hasAppliedFilters = Boolean(appliedFilters.q.trim() || appliedFilters.mode || appliedFilters.hasImages || appliedFilters.hasMoney || appliedFilters.postType);
  const shouldShowSuggestions = canUseSearchSuggestions(filters.q) && activeToolPanel === 'filter';

  useEffect(() => {
    const q = normalizeSearchText(filters.q);
    if (!shouldShowSuggestions || !canUseSearchSuggestions(q)) {
      setSearchSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await api.tradeSearch.suggestions({ q, language, countryCode: auth.user?.profile?.countryCode ?? undefined, take: 8 });
        if (!cancelled) setSearchSuggestions(response.suggestions ?? []);
      } catch {
        if (!cancelled) setSearchSuggestions([]);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [activeToolPanel, auth.user?.profile?.countryCode, filters.q, language, shouldShowSuggestions]);

  function refreshDiscoveryOrder() {
    setSeenTradeIds((current) => compactSeenTradeIds([...current, ...trades.map((trade) => trade.id)]));
    setRefreshSeed(createFeedRefreshSeed());
  }

  function submitFilters(nextFilters: FeedFilters, source?: TradeSearchKeywordSource) {
    const normalizedFilters = { ...nextFilters, q: normalizeSearchText(nextFilters.q) };
    if (source) queueSearchKeywordRecord(normalizedFilters.q, source);
    setFilters(normalizedFilters);
    setSeenTradeIds([]);
    setRefreshSeed(createFeedRefreshSeed());
    setAppliedFilters(normalizedFilters);
    setActiveToolPanel(null);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitFilters(filters, 'submitted');
  }

  function applySuggestionSearch(query: string) {
    submitFilters({ ...filters, q: query }, 'suggestion_clicked');
  }

  function resetFilters() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSearchSuggestions([]);
    pendingSearchRecordRef.current = null;
    setSeenTradeIds([]);
    setRefreshSeed(createFeedRefreshSeed());
  }

  useEffect(() => {
    if (!activeToolPanel) return undefined;
    const root = document.documentElement;
    root.classList.add('trade-tools-open');
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setActiveToolPanel(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      root.classList.remove('trade-tools-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeToolPanel]);

  return (
    <section className="mobile-page trade-feed-page">
      {shouldShowHomeIntro ? <HomeTradeIntroBanner onDismiss={dismissHomeIntro} /> : null}

      <form className={`trade-feed-controls${activeToolPanel ? ' is-tools-open' : ''}`} aria-label={t('trade.filters.controls')} onSubmit={applySearch}>
        <button type="button" className="trade-filter-pill" onClick={() => setActiveToolPanel((value) => value === 'filter' ? null : 'filter')} aria-expanded={activeToolPanel === 'filter'} aria-label={t('trade.filters.searchAndFilters')} title={t('trade.filters.searchAndFilters')}>
          <WebIcon name="filter" size={17} decorative />
          <span className="trade-action-label">{t('trade.filters.searchAndFilters')}</span>
        </button>
        <button type="button" className="trade-activity-pill" onClick={() => setActiveToolPanel((value) => value === 'activity' ? null : 'activity')} aria-expanded={activeToolPanel === 'activity'} aria-label={t('trade.activity.open')} title={t('trade.activity.open')}>
          <WebIcon name="activity" size={18} decorative />
          <span className="trade-action-label">{t('trade.activity.title')}</span>
        </button>
        <Link href={createTradeHref} className="trade-create-pill" aria-label={t('trade.create.title')} title={t('trade.create.title')}>
          <WebIcon name="add" size={21} decorative />
          <span className="trade-action-label">{t('trade.create.title')}</span>
        </Link>
        {activeToolPanel === 'filter' ? (
          <div className="trade-filter-panel trade-filter-panel--filter" role="dialog" aria-modal="true" aria-labelledby="trade-filter-panel-title">
            <div className="trade-filter-panel__header">
              <div>
                <span className="eyebrow">{t('trade.filters.controls')}</span>
                <h2 id="trade-filter-panel-title">{t('trade.filters.searchAndFilters')}</h2>
              </div>
              <button type="button" className="trade-filter-panel__close" onClick={() => setActiveToolPanel(null)} aria-label={t('common.actions.close')}>×</button>
            </div>
            <div className="trade-filter-panel__search">
              <span>{t('trade.filters.searchTrades')}</span>
              <label className="trade-filter-panel__search-input">
                <span className="sr-only">{t('trade.filters.searchTrades')}</span>
                <WebIcon name="search" size={17} decorative className="trade-search-field__icon" />
                <input
                  value={filters.q}
                  onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                  placeholder={t('trade.filters.searchTrades')}
                  type="search"
                />
              </label>
              <TradeSearchSuggestionList visible={shouldShowSuggestions} suggestions={searchSuggestions} loading={suggestionsLoading} query={filters.q} onSelect={applySuggestionSearch} />
            </div>
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

      {activeToolPanel ? <button type="button" className="trade-tools-backdrop" aria-label={t('common.actions.close')} onClick={() => setActiveToolPanel(null)} /> : null}

      {activeToolPanel === 'activity' ? (
        <TradeActivityPanel
          activeTab={activityTab}
          createTradeHref={createTradeHref}
          onClose={() => setActiveToolPanel(null)}
          onSelectTab={setActivityTab}
        />
      ) : null}

      <section className="feed-status-row" aria-live="polite">
        <p>{loading ? t('trade.filters.loadingTrades') : filteredTrades.length === 1 ? t('trade.filters.activeTradeOne') : t('trade.filters.activeTrades', { count: filteredTrades.length })}</p>
        <div className="feed-status-actions">
          {!loading && !loadError ? <button type="button" className="semantic-badge instruction feed-refresh-button" onClick={refreshDiscoveryOrder}>{t('trade.filters.refresh')}</button> : null}
          {loading ? <span className="semantic-badge instruction">{t('common.states.loading')}</span> : loadError ? <span className="semantic-badge danger">{t('trade.filters.error')}</span> : usingFallback ? <span className="semantic-badge instruction">{t('trade.filters.demoFeed')}</span> : <span className="semantic-badge success">{t('trade.filters.liveFeed')}</span>}
        </div>
      </section>

      {loadError ? (
        <section className="mobile-card mobile-card--soft">
          <h3>{t('trade.filters.couldNotLoadTrades')}</h3>
          <p>{loadError}</p>
        </section>
      ) : loading ? <TradeFeedSkeleton /> : <TradeDeckGrid trades={filteredTrades} />}

      {!loading && !loadError && !filteredTrades.length ? (
        hasAppliedFilters ? (
          <section className="mobile-card mobile-card--soft">
            <h3>{t('trade.filters.noTradesFound')}</h3>
            <p>{t('trade.filters.noTradesBody')}</p>
            <button type="button" className="secondary" onClick={resetFilters}>{t('trade.filters.clearFilters')}</button>
          </section>
        ) : (
          <TradeEmptyFeedOnboarding
            createTradeHref={createTradeHref}
            needsHref={!auth.hydrated || !auth.isAuthenticated ? '/auth?next=/needs' : '/needs'}
            offersHref={!auth.hydrated || !auth.isAuthenticated ? '/auth?next=/offers' : '/offers'}
            starterNeedsHref={!auth.hydrated || !auth.isAuthenticated ? '/auth?next=/needs%3Fsource%3Dstarter' : '/needs?source=starter'}
            starterOffersHref={!auth.hydrated || !auth.isAuthenticated ? '/auth?next=/offers%3Fsource%3Dstarter' : '/offers?source=starter'}
            t={t}
          />
        )
      ) : null}
    </section>
  );
}



function getSuggestionSourceLabel(source: TradeSearchSuggestion['source'], t: ReturnType<typeof useWebTranslation>['t']) {
  if (source === 'category') return t('trade.filters.suggestionSourceCategory');
  if (source === 'tag') return t('trade.filters.suggestionSourceTag');
  return t('trade.filters.suggestionSourcePopular');
}

function TradeSearchSuggestionList({ visible, suggestions, loading, query, onSelect }: { visible: boolean; suggestions: TradeSearchSuggestion[]; loading: boolean; query: string; onSelect: (query: string) => void }) {
  const { t } = useWebTranslation();
  if (!visible || !canUseSearchSuggestions(query)) return null;

  return (
    <div className="trade-search-suggestions" role="listbox" aria-label={t('trade.filters.suggestions')}>
      <div className="trade-search-suggestions__title">{t('trade.filters.suggestions')}</div>
      {loading && !suggestions.length ? <div className="trade-search-suggestions__empty">{t('common.states.loading')}</div> : null}
      {!loading && !suggestions.length ? <div className="trade-search-suggestions__empty">{t('trade.filters.noSuggestions')}</div> : null}
      {suggestions.map((suggestion) => (
        <button key={`${suggestion.source}:${suggestion.query}`} type="button" className="trade-search-suggestion" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(suggestion.query)}>
          <span>{suggestion.query}</span>
          <small>{getSuggestionSourceLabel(suggestion.source, t)}</small>
        </button>
      ))}
    </div>
  );
}

type HomeTradeIntroBannerProps = {
  onDismiss: () => void;
};

function HomeTradeIntroBanner({ onDismiss }: HomeTradeIntroBannerProps) {
  const { t } = useWebTranslation();

  return (
    <section className="home-guide-entry" aria-labelledby="home-guide-entry-title">
      <div className="home-guide-entry__icon" aria-hidden="true">▶</div>
      <div className="home-guide-entry__copy">
        <span className="semantic-badge instruction">{t('trade.homeIntro.guideBadge')}</span>
        <h2 id="home-guide-entry-title">{t('trade.homeIntro.guideTitle')}</h2>
        <p>{t('trade.homeIntro.guideBody')}</p>
      </div>
      <div className="home-guide-entry__actions">
        <Link href="/onboarding-guide?replay=1&next=/trades" className="button primary">{t('trade.homeIntro.guideAction')}</Link>
        <button type="button" className="button secondary" onClick={onDismiss}>{t('trade.homeIntro.dismissShort')}</button>
      </div>
    </section>
  );
}


type TradeActivityPanelProps = {
  activeTab: TradeActivityTab;
  createTradeHref: string;
  onClose: () => void;
  onSelectTab: (tab: TradeActivityTab) => void;
};

function TradeActivityPanel({ activeTab, createTradeHref, onClose, onSelectTab }: TradeActivityPanelProps) {
  const { t } = useWebTranslation();

  return (
    <section className="trade-activity-panel" role="dialog" aria-modal="true" aria-labelledby="trade-activity-panel-title">
      <div className="trade-filter-panel__header trade-activity-panel__header">
        <div>
          <span className="eyebrow">{t('trade.activity.badge')}</span>
          <h2 id="trade-activity-panel-title">{t('trade.activity.title')}</h2>
          <p>{t('trade.activity.body')}</p>
        </div>
        <button type="button" className="trade-filter-panel__close" onClick={onClose} aria-label={t('trade.activity.close')}>×</button>
      </div>
      <div className="trade-activity-tabs" role="tablist" aria-label={t('trade.mine.tabsLabel')}>
        <button type="button" role="tab" aria-selected={activeTab === 'mine'} className={activeTab === 'mine' ? 'is-active' : ''} onClick={() => onSelectTab('mine')}>{t('trade.mine.myTradesTab')}</button>
        <button type="button" role="tab" aria-selected={activeTab === 'involved'} className={activeTab === 'involved' ? 'is-active' : ''} onClick={() => onSelectTab('involved')}>{t('trade.involved.tab')}</button>
      </div>
      <div className="trade-activity-panel__body">
        {activeTab === 'mine' ? <MyTradesPanel createTradeHref={createTradeHref} /> : <InvolvedTradesPanel />}
      </div>
    </section>
  );
}


type MyTradesPanelProps = { createTradeHref: string };

function MyTradesPanel({ createTradeHref }: MyTradesPanelProps) {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [trades, setTrades] = useState<TradeWithCounts[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const loadMyTrades = useCallback(async () => {
    if (!auth.hydrated || !auth.isAuthenticated) return;
    setLoading(true);
    setLoadError('');
    try {
      const response = await api.trades.mine({ scope: 'created' });
      const nextTrades = normalizeFeedResponse(response) as TradeWithCounts[];
      setTrades(nextTrades);
    } catch {
      setTrades([]);
      setLoadError(t('trade.mine.loadError'));
    } finally {
      setLoading(false);
    }
  }, [auth.hydrated, auth.isAuthenticated, t]);

  useEffect(() => { void loadMyTrades(); }, [loadMyTrades]);

  const replaceTrade = useCallback((updatedTrade: TradeWithCounts) => {
    setTrades((current) => current.map((trade) => trade.id === updatedTrade.id ? { ...trade, ...updatedTrade, _count: trade._count ?? updatedTrade._count } : trade));
  }, []);

  const handleCloseTrade = useCallback(async (trade: TradeWithCounts) => {
    if (!isTradeOwnerCloseAllowed(trade)) return;
    if (!window.confirm(t('trade.mine.closeConfirm'))) return;
    setBusyTradeId(trade.id);
    setNotice('');
    try {
      const response = await api.trades.close(trade.id) as { trade?: TradeWithCounts };
      if (response.trade) replaceTrade(response.trade);
      setNotice(t('trade.mine.closedNotice'));
    } catch {
      setNotice(t('trade.mine.closeError'));
    } finally {
      setBusyTradeId(null);
    }
  }, [replaceTrade, t]);

  const handleRenewTrade = useCallback(async (trade: TradeWithCounts) => {
    if (!isTradeOwnerRenewAllowed(trade)) return;
    setBusyTradeId(trade.id);
    setNotice('');
    try {
      const response = await api.trades.renew(trade.id) as { trade?: TradeWithCounts };
      if (response.trade) replaceTrade(response.trade);
      setNotice(t('trade.mine.renewedNotice'));
    } catch {
      setNotice(t('trade.mine.renewError'));
    } finally {
      setBusyTradeId(null);
    }
  }, [replaceTrade, t]);

  const visibleTrades = useMemo(() => {
    if (statusFilter === 'all') return trades;
    if (statusFilter === 'with_proposals') return trades.filter((trade) => (trade._count?.proposals ?? 0) > 0);
    return trades.filter((trade) => trade.status === statusFilter);
  }, [statusFilter, trades]);

  if (!auth.hydrated || !auth.isAuthenticated) {
    return (
      <section className="mobile-card trade-mine-auth-card">
        <span className="semantic-badge trade">{t('trade.mine.myTradesTab')}</span>
        <h2>{t('trade.mine.loginTitle')}</h2>
        <p>{t('trade.mine.loginBody')}</p>
        <Link href="/auth?next=/trades" className="button primary">{t('common.actions.loginOrRegister')}</Link>
      </section>
    );
  }

  return (
    <section className="trade-mine-panel" aria-live="polite">
      <div className="trade-mine-header">
        <div>
          <span className="semantic-badge trade">{t('trade.mine.ownerArea')}</span>
          <h2>{t('trade.mine.title')}</h2>
          <p>{t('trade.mine.body')}</p>
        </div>
        <Link href={createTradeHref} className="button primary"><WebIcon name="add" size={17} decorative /> {t('trade.create.title')}</Link>
      </div>

      <div className="trade-mine-filter-row" aria-label={t('trade.mine.filtersLabel')}>
        {['all', 'active', 'with_proposals', 'in_progress', 'expired', 'closed'].map((status) => (
          <button key={status} type="button" className={statusFilter === status ? 'is-active' : ''} onClick={() => setStatusFilter(status)}>
            {status === 'all' ? t('trade.mine.filterAll') : status === 'with_proposals' ? t('trade.mine.filterWithProposals') : t(`trade.statuses.${status}`)}
          </button>
        ))}
      </div>

      {notice ? <p className="trade-mine-notice">{notice}</p> : null}

      {loadError ? (
        <section className="mobile-card mobile-card--soft">
          <h3>{t('trade.mine.couldNotLoad')}</h3>
          <p>{loadError}</p>
        </section>
      ) : loading ? <MyTradesSkeleton /> : visibleTrades.length ? (
        <div className="trade-mine-list">
          {visibleTrades.map((trade) => <MyTradeRow key={trade.id} trade={trade} language={language} busy={busyTradeId === trade.id} onClose={handleCloseTrade} onRenew={handleRenewTrade} />)}
        </div>
      ) : (
        <MyTradesEmptyState hasFilter={statusFilter !== 'all'} createTradeHref={createTradeHref} />
      )}
    </section>
  );
}

function MyTradeRow({ trade, language, busy, onClose, onRenew }: { trade: TradeWithCounts; language: 'en' | 'fr' | 'es'; busy: boolean; onClose: (trade: TradeWithCounts) => void; onRenew: (trade: TradeWithCounts) => void }) {
  const { t } = useWebTranslation();
  const proposalCount = trade._count?.proposals ?? 0;
  const expiresLabel = trade.expiresAt ? formatWebShortDate(trade.expiresAt, t('trade.mine.noExpiry'), language) : t('trade.mine.noExpiry');
  const visibilityState = getTradeOwnerVisibilityState(trade);
  const canClose = isTradeOwnerCloseAllowed(trade);
  const canRenew = isTradeOwnerRenewAllowed(trade);

  return (
    <article className="trade-mine-row trade-mine-row--actions">
      <span className="trade-mine-row__icon" aria-hidden="true"><WebIcon name="trade" size={20} decorative /></span>
      <span className="trade-mine-row__body">
        <span className="trade-mine-row__badges">
          <span className="semantic-badge trade">{getExchangeLabel(trade, { t })}</span>
          <span className="semantic-badge neutral">{getStatusLabel(trade.status, { t })}</span>
          <span className={visibilityState === 'review_or_hidden' ? 'semantic-badge warning' : visibilityState === 'public' ? 'semantic-badge success' : 'semantic-badge instruction'}>{t(`trade.mine.visibility.${visibilityState}`)}</span>
        </span>
        <strong>{getTradeHeadline(trade, { t })}</strong>
        <small>{t('trade.mine.rowMeta', { proposals: proposalCount, expiry: expiresLabel })}</small>
        <span className="trade-mine-row__actions">
          <Link href={`/trades/${trade.id}`} className="button secondary">{t('trade.mine.openDetail')}</Link>
          {proposalCount > 0 ? <Link href={`/trades/${trade.id}/proposals`} className="button secondary">{t('trade.mine.openProposals')}</Link> : null}
          {canRenew ? <button type="button" className="secondary" disabled={busy} onClick={() => onRenew(trade)}>{busy ? t('common.states.saving') : t('trade.mine.renew')}</button> : null}
          {canClose ? <button type="button" className="secondary danger-soft" disabled={busy} onClick={() => onClose(trade)}>{busy ? t('common.states.saving') : t('trade.mine.close')}</button> : null}
        </span>
      </span>
    </article>
  );
}

function MyTradesEmptyState({ hasFilter, createTradeHref }: { hasFilter: boolean; createTradeHref: string }) {
  const { t } = useWebTranslation();
  return (
    <section className="trade-mine-empty">
      <WebIcon name="trade" size={34} decorative />
      <h3>{hasFilter ? t('trade.mine.emptyFilteredTitle') : t('trade.mine.emptyTitle')}</h3>
      <p>{hasFilter ? t('trade.mine.emptyFilteredBody') : t('trade.mine.emptyBody')}</p>
      <div className="trade-mine-empty__actions">
        <Link href={createTradeHref} className="button primary">{t('trade.create.title')}</Link>
        <Link href="/needs" className="button secondary">{t('trade.emptyFeed.createNeed')}</Link>
        <Link href="/offers" className="button secondary">{t('trade.emptyFeed.createOffer')}</Link>
      </div>
    </section>
  );
}

function InvolvedTradesPanel() {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [trades, setTrades] = useState<TradeWithViewerProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadInvolvedTrades = useCallback(async () => {
    if (!auth.hydrated || !auth.isAuthenticated) return;
    setLoading(true);
    setLoadError('');
    try {
      const response = await api.trades.mine({ scope: 'involved' });
      const nextTrades = normalizeFeedResponse(response) as TradeWithViewerProposal[];
      setTrades(nextTrades);
    } catch {
      setTrades([]);
      setLoadError(t('trade.involved.loadError'));
    } finally {
      setLoading(false);
    }
  }, [auth.hydrated, auth.isAuthenticated, t]);

  useEffect(() => { void loadInvolvedTrades(); }, [loadInvolvedTrades]);

  const visibleTrades = useMemo(() => {
    if (statusFilter === 'all') return trades;
    if (['pending', 'accepted', 'declined', 'withdrawn'].includes(statusFilter)) return trades.filter((trade) => trade.viewerProposal?.status === statusFilter);
    return trades.filter((trade) => trade.status === statusFilter);
  }, [statusFilter, trades]);

  if (!auth.hydrated || !auth.isAuthenticated) {
    return (
      <section className="mobile-card trade-mine-auth-card">
        <span className="semantic-badge trade">{t('trade.involved.tab')}</span>
        <h2>{t('trade.involved.loginTitle')}</h2>
        <p>{t('trade.involved.loginBody')}</p>
        <Link href="/auth?next=/trades" className="button primary">{t('common.actions.loginOrRegister')}</Link>
      </section>
    );
  }

  return (
    <section className="trade-mine-panel" aria-live="polite">
      <div className="trade-mine-header">
        <div>
          <span className="semantic-badge trade">{t('trade.involved.badge')}</span>
          <h2>{t('trade.involved.title')}</h2>
          <p>{t('trade.involved.body')}</p>
        </div>
      </div>

      <div className="trade-mine-filter-row" aria-label={t('trade.involved.filtersLabel')}>
        {['all', 'pending', 'accepted', 'declined', 'withdrawn', 'in_progress', 'completed'].map((status) => (
          <button key={status} type="button" className={statusFilter === status ? 'is-active' : ''} onClick={() => setStatusFilter(status)}>
            {status === 'all' ? t('trade.mine.filterAll') : ['pending', 'accepted', 'declined', 'withdrawn'].includes(status) ? t(`trade.proposals.status.${status}`) : t(`trade.statuses.${status}`)}
          </button>
        ))}
      </div>

      {loadError ? (
        <section className="mobile-card mobile-card--soft">
          <h3>{t('trade.involved.couldNotLoad')}</h3>
          <p>{loadError}</p>
        </section>
      ) : loading ? <MyTradesSkeleton /> : visibleTrades.length ? (
        <div className="trade-mine-list">
          {visibleTrades.map((trade) => <InvolvedTradeRow key={trade.id} trade={trade} language={language} />)}
        </div>
      ) : (
        <InvolvedTradesEmptyState hasFilter={statusFilter !== 'all'} />
      )}
    </section>
  );
}

function InvolvedTradeRow({ trade, language }: { trade: TradeWithViewerProposal; language: 'en' | 'fr' | 'es' }) {
  const { t } = useWebTranslation();
  const proposal = trade.viewerProposal;
  const proposalDate = proposal?.createdAt ? formatWebShortDate(proposal.createdAt, t('trade.involved.unknownDate'), language) : t('trade.involved.unknownDate');
  const proposalStatus = proposal?.status ?? (trade.viewerInvolvement === 'provider' ? 'accepted' : 'pending');

  return (
    <article className="trade-mine-row trade-mine-row--actions">
      <span className="trade-mine-row__icon" aria-hidden="true"><WebIcon name="trade" size={20} decorative /></span>
      <span className="trade-mine-row__body">
        <span className="trade-mine-row__badges">
          <span className="semantic-badge trade">{getExchangeLabel(trade, { t })}</span>
          <span className="semantic-badge neutral">{getStatusLabel(trade.status, { t })}</span>
          <span className="semantic-badge instruction">{t(`trade.proposals.status.${proposalStatus}`)}</span>
        </span>
        <strong>{getTradeHeadline(trade, { t })}</strong>
        <small>{t('trade.involved.rowMeta', { status: t(`trade.proposals.status.${proposalStatus}`), date: proposalDate })}</small>
        <span className="trade-mine-row__actions">
          <Link href={`/trades/${trade.id}`} className="button secondary">{t('trade.mine.openDetail')}</Link>
          {proposal?.id ? <Link href={`/trades/${trade.id}/proposals/${proposal.id}`} className="button secondary">{t('trade.involved.openThread')}</Link> : null}
        </span>
      </span>
    </article>
  );
}

function InvolvedTradesEmptyState({ hasFilter }: { hasFilter: boolean }) {
  const { t } = useWebTranslation();
  return (
    <section className="trade-mine-empty">
      <WebIcon name="trade" size={34} decorative />
      <h3>{hasFilter ? t('trade.involved.emptyFilteredTitle') : t('trade.involved.emptyTitle')}</h3>
      <p>{hasFilter ? t('trade.involved.emptyFilteredBody') : t('trade.involved.emptyBody')}</p>
      <div className="trade-mine-empty__actions">
        <Link href="/trades" className="button primary">{t('trade.involved.exploreTrades')}</Link>
      </div>
    </section>
  );
}

type TradeEmptyFeedOnboardingProps = {
  createTradeHref: string;
  needsHref: string;
  offersHref: string;
  starterNeedsHref: string;
  starterOffersHref: string;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function TradeEmptyFeedOnboarding({ createTradeHref, needsHref, offersHref, starterNeedsHref, starterOffersHref, t }: TradeEmptyFeedOnboardingProps) {
  const starterIdeas = [
    t('trade.emptyFeed.ideaPortfolioPhotosLandingReview'),
    t('trade.emptyFeed.ideaFrenchCorrectionCanva'),
    t('trade.emptyFeed.ideaVideoEditLinkedIn'),
  ];

  return (
    <section className="trade-empty-onboarding" aria-labelledby="trade-empty-onboarding-title">
      <div className="trade-empty-onboarding__hero">
        <span className="trade-empty-onboarding__icon" aria-hidden="true"><WebIcon name="trade" size={34} decorative /></span>
        <span className="semantic-badge instruction">{t('trade.emptyFeed.betaBadge')}</span>
        <h2 id="trade-empty-onboarding-title">{t('trade.emptyFeed.title')}</h2>
        <p>{t('trade.emptyFeed.body')}</p>
        <div className="trade-empty-onboarding__actions" aria-label={t('trade.emptyFeed.primaryActions')}>
          <Link href={createTradeHref} className="button">{t('trade.emptyFeed.createTrade')}</Link>
          <Link href={needsHref} className="button secondary">{t('trade.emptyFeed.createNeed')}</Link>
          <Link href={offersHref} className="button secondary">{t('trade.emptyFeed.createOffer')}</Link>
        </div>
      </div>

      <div className="trade-empty-onboarding__starter">
        <div className="trade-empty-onboarding__starter-copy">
          <span className="semantic-badge success">{t('trade.emptyFeed.starterBadge')}</span>
          <h3>{t('trade.emptyFeed.starterTitle')}</h3>
          <p>{t('trade.emptyFeed.starterBody')}</p>
        </div>
        <div className="trade-empty-onboarding__starter-actions">
          <Link href={starterNeedsHref} className="button secondary"><WebIcon name="need" size={17} decorative /> {t('trade.emptyFeed.browseStarterNeeds')}</Link>
          <Link href={starterOffersHref} className="button secondary"><WebIcon name="offer" size={17} decorative /> {t('trade.emptyFeed.browseStarterOffers')}</Link>
        </div>
      </div>

      <div className="trade-empty-onboarding__ideas" aria-label={t('trade.emptyFeed.ideaTitle')}>
        <strong>{t('trade.emptyFeed.ideaTitle')}</strong>
        <div>
          {starterIdeas.map((idea) => <span key={idea}>{idea}</span>)}
        </div>
      </div>
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

function MyTradesSkeleton() {
  return (
    <div className="trade-mine-list" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div className="trade-mine-row trade-mine-row--skeleton" key={item}>
          <span className="trade-mine-row__icon" />
          <span className="trade-mine-row__body">
            <span />
            <span />
            <span />
          </span>
        </div>
      ))}
    </div>
  );
}
