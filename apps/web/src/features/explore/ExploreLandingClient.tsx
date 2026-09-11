'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { InventoryTemplateDto, PlaceDto } from '@hellowhen/contracts';
import { buildBalancedExploreDiscoveryFeed, createExploreDiscoverySeed, starterPlanIdeaKeys, starterPlanIdeas, starterPlanIdeaMode, type StarterPlanIdea } from '@hellowhen/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { WebAccountHeaderAction } from '../../components/WebAccountHeaderAction';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { PlanPreviewDeck } from '../plans/PlanPreviewDeck';
import { resolvePlaceVisual, useResolvedPlaceVisualTheme } from '../plans/placeVisuals';
import { inventoryCategoryLabel, itemTypeLabel, mediaSrc, modeLabel } from '../inventory/inventoryPresentation';
import { TradeFeedIdeaCard } from '../trade/TradeFeedClient';
import { TradePosterCard } from '../trade/TradePosterCard';
import { createFeedIdeaTradeHref, feedTradeIdeaHasNeed, feedTradeIdeaHasOffer, feedTradeIdeaKeys, feedTradeIdeas, type FeedTradeIdeaKey } from '../trade/tradeFeedIdeas';

const EXPLORE_DISCOVERY_LIMIT = 12;

function withExploreReturnContext(href: string) {
  return `${href}${href.includes('?') ? '&' : '?'}from=explore`;
}
const tradeExploreIdeaKeys = feedTradeIdeaKeys.filter((ideaKey) => feedTradeIdeas[ideaKey].type === 'trade') as readonly FeedTradeIdeaKey[];

type ExploreConceptKind = 'trade' | 'plan' | 'need' | 'offer' | 'place';
type ExploreTypeFilter = 'all' | ExploreConceptKind;
type InventoryTemplatesResponse = { templates?: InventoryTemplateDto[] };
type PlacesResponse = { places?: PlaceDto[] };
type TFunction = ReturnType<typeof useWebTranslation>['t'];

type ExploreFeedItem =
  | { kind: 'trade'; key: string; ideaKey: FeedTradeIdeaKey }
  | { kind: 'plan'; key: string; ideaKey: (typeof starterPlanIdeaKeys)[number]; idea: StarterPlanIdea }
  | { kind: 'need'; key: string; template: InventoryTemplateDto }
  | { kind: 'offer'; key: string; template: InventoryTemplateDto }
  | { kind: 'place'; key: string; place: PlaceDto };

function normalizeExploreSearchQuery(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function joinExploreSearchValues(values: unknown[]) {
  return values.flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .join(' ');
}

function exploreSearchText(item: ExploreFeedItem, t: TFunction) {
  if (item.kind === 'trade') {
    const idea = feedTradeIdeas[item.ideaKey];
    return joinExploreSearchValues([
      t('trade.feedIdeas.badge'),
      t(`trade.feedIdeas.items.${item.ideaKey}.pack`),
      feedTradeIdeaHasNeed(idea) ? t(`trade.feedIdeas.items.${item.ideaKey}.need`) : null,
      feedTradeIdeaHasNeed(idea) ? t(`trade.feedIdeas.items.${item.ideaKey}.needMeta`) : null,
      feedTradeIdeaHasOffer(idea) ? t(`trade.feedIdeas.items.${item.ideaKey}.offer`) : null,
      feedTradeIdeaHasOffer(idea) ? t(`trade.feedIdeas.items.${item.ideaKey}.offerMeta`) : null,
    ]);
  }
  if (item.kind === 'plan') {
    return joinExploreSearchValues([
      t('common.exploreDiscovery.planSection'),
      item.idea.pack,
      item.idea.title,
      item.idea.description,
      item.idea.category,
      item.idea.tags,
      item.idea.stops.flatMap((stop) => [stop.title, stop.onlineLabel, stop.onlineUrl]),
    ]);
  }
  if (item.kind === 'need' || item.kind === 'offer') {
    return joinExploreSearchValues([
      t(item.kind === 'need' ? 'common.exploreDiscovery.needSection' : 'common.exploreDiscovery.offerSection'),
      item.template.title,
      item.template.description,
      item.template.itemType,
      item.template.category,
      item.template.tags,
      item.template.kind === 'need' ? item.template.timing : item.template.availability,
      item.template.mode,
      item.template.locationLabel,
    ]);
  }
  return joinExploreSearchValues([
    t('common.exploreDiscovery.placeSection'),
    item.place.title,
    item.place.description,
    item.place.category,
    item.place.mode,
    item.place.areaLabel,
    item.place.addressPublicText,
    item.place.formattedAddress,
    item.place.onlineLabel,
    item.place.onlineUrl,
  ]);
}

function filterExploreItems(items: ExploreFeedItem[], typeFilter: ExploreTypeFilter, query: string, t: TFunction) {
  const normalizedQuery = normalizeExploreSearchQuery(query).toLocaleLowerCase();
  return items.filter((item) => {
    if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
    if (!normalizedQuery) return true;
    return exploreSearchText(item, t).toLocaleLowerCase().includes(normalizedQuery);
  });
}

function normalizeTemplates(value: unknown, kind: 'need' | 'offer') {
  const templates = value && typeof value === 'object' && Array.isArray((value as InventoryTemplatesResponse).templates)
    ? (value as InventoryTemplatesResponse).templates ?? []
    : [];
  return templates.filter((template) => template.kind === kind && template.sourceType === 'hellowhen' && template.status === 'active');
}

function normalizePlaces(value: unknown) {
  const places = value && typeof value === 'object' && Array.isArray((value as PlacesResponse).places)
    ? (value as PlacesResponse).places ?? []
    : [];
  return places.filter((place) => place.source === 'hellowhen_library' && place.visibility === 'library' && place.status === 'active');
}

function inventoryMeta(template: InventoryTemplateDto, t: TFunction, language: 'en' | 'fr' | 'es') {
  const i18n = { t, language };
  return [
    itemTypeLabel(template.itemType ?? 'service', i18n),
    inventoryCategoryLabel(template.category, i18n),
    template.kind === 'need' ? template.timing : template.availability,
    template.mode ? modeLabel(template.mode, i18n) : null,
    template.locationLabel,
  ].filter(Boolean).join(' · ');
}

function placeMeta(place: PlaceDto, t: TFunction) {
  const mode = place.mode === 'remote' ? t('plans.deck.online') : t('plans.deck.offline');
  const location = place.mode === 'remote'
    ? place.onlineLabel || place.onlineUrl
    : place.areaLabel || place.addressPublicText || place.formattedAddress;
  return [mode, place.category, location].filter(Boolean).join(' · ');
}

function planIdeaPlaces(idea: StarterPlanIdea) {
  return idea.stops.map((stop, index) => ({
    id: `${idea.id}-${index}`,
    mode: stop.mode,
    title: stop.title,
    location: stop.mode === 'remote' ? (stop.onlineLabel ?? stop.onlineUrl ?? '') : '',
    time: stop.time,
  }));
}

function ExploreInventoryCard({ item, language, t }: { item: Extract<ExploreFeedItem, { kind: 'need' | 'offer' }>; language: 'en' | 'fr' | 'es'; t: TFunction }) {
  const template = item.template;
  const isNeed = item.kind === 'need';
  const badge = t(isNeed ? 'common.exploreDiscovery.needBadge' : 'common.exploreDiscovery.offerBadge');
  const href = `/explore/${isNeed ? 'needs' : 'offers'}/${template.id}`;
  return (
    <article className="explore-concept-card">
      <Link href={href} className="explore-concept-card__link" aria-label={`${badge}: ${template.title}`}>
        <TradePosterCard
          id={`explore-${item.kind}-${template.id}`}
          imageUrl={template.media?.[0] ? mediaSrc(template.media[0]) : ''}
          imageAlt={template.title}
          badge={badge}
          eyebrow={isNeed ? t('trade.labels.iNeed') : t('trade.labels.iOffer')}
          title={template.title}
          subtitle={template.description ?? undefined}
          topMeta={t('common.librarySegments.explore')}
          chips={inventoryMeta(template, t, language).split(' · ').filter(Boolean).slice(0, 3)}
          footer={<span className="trade-feed-idea-card__poster-action">{t('common.actions.open')}</span>}
          variant={isNeed ? 'need' : 'offer'}
        />
      </Link>
    </article>
  );
}

function ExplorePlaceCard({ place, t }: { place: PlaceDto; t: TFunction }) {
  const themeMode = useResolvedPlaceVisualTheme();
  const visual = resolvePlaceVisual({ media: place.media?.[0] ?? null, staticMap: place.staticMap, themeMode });
  const badge = t('common.exploreDiscovery.placeBadge');
  return (
    <article className="explore-concept-card">
      <Link href={`/explore/places/${place.id}`} className="explore-concept-card__link" aria-label={`${badge}: ${place.title}`}>
        <TradePosterCard
          id={`explore-place-${place.id}`}
          imageUrl={visual.url}
          imageAlt={place.title}
          badge={badge}
          eyebrow={place.mode === 'remote' ? t('plans.deck.online') : t('plans.deck.offline')}
          title={place.title}
          subtitle={place.description ?? undefined}
          topMeta={t('common.librarySegments.explore')}
          chips={placeMeta(place, t).split(' · ').filter(Boolean).slice(0, 3)}
          footer={<span className="trade-feed-idea-card__poster-action">{t('common.actions.open')}</span>}
          variant="trade"
          previewTheme="green"
        />
      </Link>
    </article>
  );
}

export function ExploreLandingClient() {
  const router = useRouter();
  const { t, language } = useWebTranslation();
  const [needTemplates, setNeedTemplates] = useState<InventoryTemplateDto[]>([]);
  const [offerTemplates, setOfferTemplates] = useState<InventoryTemplateDto[]>([]);
  const [places, setPlaces] = useState<PlaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [partialError, setPartialError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ExploreTypeFilter>('all');
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mixSeed, setMixSeed] = useState(createExploreDiscoverySeed);
  const requestSequence = useRef(0);

  const loadDiscovery = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    const requestId = ++requestSequence.current;
    if (showLoading) setLoading(true);
    setPartialError(false);
    const placeRequest = betaFeatures.plansEnabled && betaFeatures.plansVisible
      ? api.places.library({ take: EXPLORE_DISCOVERY_LIMIT })
      : Promise.resolve({ places: [] });
    const [needsResult, offersResult, placesResult] = await Promise.allSettled([
      api.inventoryTemplates.list({ kind: 'need', sourceType: 'hellowhen', language, take: EXPLORE_DISCOVERY_LIMIT }),
      api.inventoryTemplates.list({ kind: 'offer', sourceType: 'hellowhen', language, take: EXPLORE_DISCOVERY_LIMIT }),
      placeRequest,
    ]);
    if (requestId !== requestSequence.current) return;
    if (needsResult.status === 'fulfilled') setNeedTemplates(normalizeTemplates(needsResult.value, 'need'));
    if (offersResult.status === 'fulfilled') setOfferTemplates(normalizeTemplates(offersResult.value, 'offer'));
    if (placesResult.status === 'fulfilled') setPlaces(normalizePlaces(placesResult.value));
    setPartialError([needsResult, offersResult, placesResult].some((result) => result.status === 'rejected'));
    setLoaded(true);
    setLoading(false);
  }, [language]);

  useEffect(() => {
    void loadDiscovery();
    return () => { requestSequence.current += 1; };
  }, [loadDiscovery]);

  const staticGroups = useMemo(() => {
    const tradeItems: ExploreFeedItem[] = tradeExploreIdeaKeys.map((ideaKey) => ({ kind: 'trade', key: `trade-idea-${ideaKey}`, ideaKey }));
    const planItems: ExploreFeedItem[] = betaFeatures.plansEnabled && betaFeatures.plansVisible
      ? starterPlanIdeaKeys.map((ideaKey) => ({ kind: 'plan', key: `plan-idea-${ideaKey}`, ideaKey, idea: starterPlanIdeas[ideaKey] }))
      : [];
    return { trade: tradeItems, plan: planItems };
  }, []);

  const mixedItems = useMemo<ExploreFeedItem[]>(() => buildBalancedExploreDiscoveryFeed({
    trade: staticGroups.trade,
    plan: staticGroups.plan,
    need: needTemplates.map((template) => ({ kind: 'need' as const, key: `need-${template.id}`, template })),
    offer: offerTemplates.map((template) => ({ kind: 'offer' as const, key: `offer-${template.id}`, template })),
    place: places.map((place) => ({ kind: 'place' as const, key: `place-${place.id}`, place })),
  }, mixSeed), [mixSeed, needTemplates, offerTemplates, places, staticGroups]);

  const visibleItems = useMemo(() => loaded ? filterExploreItems(mixedItems, typeFilter, query, t) : [], [loaded, mixedItems, query, t, typeFilter]);
  const activeFilterCount = Number(typeFilter !== 'all') + Number(Boolean(normalizeExploreSearchQuery(query)));
  const filterOptions: Array<{ value: ExploreTypeFilter; label: string }> = [
    { value: 'all', label: t('inventory.itemTypes.all') },
    { value: 'trade', label: t('common.exploreDiscovery.tradeSection') },
    { value: 'plan', label: t('common.exploreDiscovery.planSection') },
    { value: 'need', label: t('common.exploreDiscovery.needSection') },
    { value: 'offer', label: t('common.exploreDiscovery.offerSection') },
    { value: 'place', label: t('common.exploreDiscovery.placeSection') },
  ];

  async function refresh() {
    setRefreshing(true);
    try {
      await loadDiscovery({ showLoading: false });
      setMixSeed(createExploreDiscoverySeed());
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="mobile-page web-app-page explore-discovery-page">
      <header className="feed-world-header explore-feed-header">
        <div className="feed-world-header__copy">
          <h1>{t('navigation.tabs.explore')}</h1>
        </div>
        <div className="feed-world-header__actions explore-feed-header__actions">
          <button
            type="button"
            className={activeFilterCount ? 'feed-world-action explore-filter-pill is-active' : 'feed-world-action explore-filter-pill'}
            aria-expanded={filtersOpen}
            aria-label={activeFilterCount ? `${t('common.exploreDiscovery.filterOpen')}, ${activeFilterCount}` : t('common.exploreDiscovery.filterOpen')}
            title={t('common.exploreDiscovery.filterOpen')}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <WebIcon name="filter" size={18} decorative />
            {activeFilterCount ? <span className="plans-feed-icon-button__badge">{activeFilterCount}</span> : null}
          </button>
          <WebAccountHeaderAction local />
        </div>
      </header>

      <section className={filtersOpen ? 'explore-discovery-toolbar is-open' : 'explore-discovery-toolbar'} aria-label={t('common.exploreDiscovery.filterOpen')}>
        <div className="explore-discovery-actions">
          <label className="explore-discovery-search">
            <WebIcon name="search" size={18} decorative />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('common.exploreDiscovery.searchPlaceholder')} aria-label={t('common.exploreDiscovery.searchPlaceholder')} />
            {query ? <button type="button" onClick={() => setQuery('')} aria-label={t('common.exploreDiscovery.clearSearch')}>×</button> : null}
          </label>
          <button type="button" className="button secondary explore-discovery-refresh" onClick={() => { void refresh(); }} disabled={refreshing}>
            {refreshing ? t('common.states.loading') : t('common.exploreDiscovery.refresh')}
          </button>
        </div>
        <div className="explore-discovery-filters" role="group" aria-label={t('common.exploreDiscovery.filterOpen')}>
          {filterOptions.map((option) => (
            <button key={option.value} type="button" className={typeFilter === option.value ? 'is-active' : ''} onClick={() => setTypeFilter(option.value)}>{option.label}</button>
          ))}
        </div>
      </section>

      {loading ? <div className="explore-discovery-state"><span className="semantic-badge instruction">{t('common.exploreDiscovery.loading')}</span></div> : null}
      {!loading && partialError ? (
        <div className="explore-discovery-state explore-discovery-state--warning">
          <p>{t('common.exploreDiscovery.partialError')}</p>
          <button type="button" className="button secondary" onClick={() => { void loadDiscovery(); }}>{t('common.actions.tryAgain')}</button>
        </div>
      ) : null}
      {!loading && loaded && !visibleItems.length ? (
        <div className="explore-discovery-state"><p>{t(activeFilterCount ? 'common.exploreDiscovery.noResults' : 'common.exploreDiscovery.empty')}</p></div>
      ) : null}

      <section className="explore-discovery-feed" aria-live="polite">
        {visibleItems.map((item) => {
          if (item.kind === 'trade') {
            return <TradeFeedIdeaCard key={item.key} ideaKey={item.ideaKey} createIdeaHref={(ideaKey) => withExploreReturnContext(createFeedIdeaTradeHref(ideaKey))} />;
          }
          if (item.kind === 'plan') {
            return (
              <article key={item.key} className="plan-deck-link explore-plan-idea-card" aria-label={`${t('common.exploreDiscovery.planSection')}: ${item.idea.title}`}>
                <PlanPreviewDeck
                  title={item.idea.title}
                  description={item.idea.description}
                  rangeLabel={t('common.exploreDiscovery.planSection')}
                  badgeLabel={`${t('common.exploreDiscovery.planSection')} · ${item.idea.pack}`}
                  places={planIdeaPlaces(item.idea)}
                  onOpen={() => router.push(withExploreReturnContext(`/plans/ideas/${item.ideaKey}`))}
                  actionLabel={t('common.actions.open')}
                />
                <Link href={withExploreReturnContext(`/plans/ideas/${item.ideaKey}`)} className="plan-deck-link__meta">{starterPlanIdeaMode(item.idea) === 'remote' ? t('plans.deck.online') : t('plans.deck.offline')} · {item.idea.stops.length} {t('common.exploreDiscovery.stops')}</Link>
              </article>
            );
          }
          if (item.kind === 'need' || item.kind === 'offer') {
            return <ExploreInventoryCard key={item.key} item={item} language={language} t={t} />;
          }
          return <ExplorePlaceCard key={item.key} place={item.place} t={t} />;
        })}
      </section>
    </main>
  );
}
