import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { InventoryTemplateDto, PlaceDto, PlanDto } from '@hellowhen/contracts';
import { starterPlanIdeaKeys, starterPlanIdeas, starterPlanIdeaMode, type StarterPlanIdea } from '@hellowhen/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppSmartHeaderScreen } from '../../components/AppSmartHeaderScreen';
import { AppHeaderActionButton } from '../../components/AppHeaderActionButton';
import { PRIMARY_HEADER_TITLE_STYLE } from '../../components/headerTypography';
import { LibraryFilterGroup, LibraryFilterOption, LibraryFilterScreen, LibraryInlineSearch } from '../../components/library';
import { AccountHeaderActionButton } from '../../components/AccountHeaderActionButton';
import { AppText } from '../../components/AppText';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { PlanSquareDeck } from '../plans/components/PlanSquareDeck';
import { TradeFeedIdeaCard } from '../trade/TradeDeckFeedScreen';
import { feedTradeIdeaHasNeed, feedTradeIdeaHasOffer, feedTradeIdeaKeys, feedTradeIdeas, type FeedTradeIdeaKey } from '../trade/tradeFeedIdeas';
import { getMobileTradeDeckCardSize, MOBILE_DECK_FEED_GAP } from '../trade/components/tradeDeckGeometry';
import { SQUARE_STACK_DEPTH_ALLOWANCE_Y } from '../trade/deck/squareStackDeck.model';
import { categoryLabel, itemTypeLabel, modeLabel } from '../trade/components/InventoryFormFields';
import { ExploreConceptSquareDeck } from './ExploreConceptSquareDeck';

const EXPLORE_DISCOVERY_LIMIT = 12;
const tradeExploreIdeaKeys = feedTradeIdeaKeys.filter((ideaKey) => feedTradeIdeas[ideaKey].type === 'trade') as readonly FeedTradeIdeaKey[];

type ExploreConceptKind = 'trade' | 'plan' | 'need' | 'offer' | 'place';
type ExploreTypeFilter = 'all' | ExploreConceptKind;
type InventoryTemplatesResponse = { templates?: InventoryTemplateDto[] };
type PlacesResponse = { places?: PlaceDto[] };
type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

type ExploreFeedItem =
  | { kind: 'trade'; key: string; ideaKey: FeedTradeIdeaKey }
  | { kind: 'plan'; key: string; ideaKey: (typeof starterPlanIdeaKeys)[number]; idea: StarterPlanIdea; preview: PlanDto }
  | { kind: 'need'; key: string; template: InventoryTemplateDto }
  | { kind: 'offer'; key: string; template: InventoryTemplateDto }
  | { kind: 'place'; key: string; place: PlaceDto };

const EXPLORE_MIX_KIND_ORDER: readonly ExploreConceptKind[] = ['trade', 'place', 'need', 'plan', 'offer'];

function createExploreMixSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function hashExploreMixValue(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function orderExploreQueue(items: readonly ExploreFeedItem[], kind: ExploreConceptKind, seed: number) {
  return [...items].sort((left, right) => {
    const rankDelta = hashExploreMixValue(`${seed}:${kind}:${left.key}`) - hashExploreMixValue(`${seed}:${kind}:${right.key}`);
    return rankDelta || left.key.localeCompare(right.key);
  });
}

function buildBalancedMixedFeed(groups: Record<ExploreConceptKind, ExploreFeedItem[]>, seed: number) {
  const queues = Object.fromEntries(EXPLORE_MIX_KIND_ORDER.map((kind) => (
    [kind, orderExploreQueue(groups[kind], kind, seed)]
  ))) as Record<ExploreConceptKind, ExploreFeedItem[]>;
  const mixed: ExploreFeedItem[] = [];
  let cycle = 0;
  let previousKind: ExploreConceptKind | null = null;

  while (EXPLORE_MIX_KIND_ORDER.some((kind) => queues[kind].length > 0)) {
    const availableKinds = EXPLORE_MIX_KIND_ORDER.filter((kind) => queues[kind].length > 0);
    const cycleKinds = [...availableKinds].sort((left, right) => (
      hashExploreMixValue(`${seed}:${cycle}:${left}`) - hashExploreMixValue(`${seed}:${cycle}:${right}`)
    ));

    if (previousKind && cycleKinds.length > 1 && cycleKinds[0] === previousKind) {
      const alternateIndex = cycleKinds.findIndex((kind) => kind !== previousKind);
      if (alternateIndex > 0) {
        const [alternate] = cycleKinds.splice(alternateIndex, 1);
        if (alternate) cycleKinds.unshift(alternate);
      }
    }

    for (const kind of cycleKinds) {
      const item = queues[kind].shift();
      if (!item) continue;
      mixed.push(item);
      previousKind = kind;
    }
    cycle += 1;
  }

  return mixed;
}


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
      t('plans.workspace.planIdeas.title'),
      item.idea.pack,
      item.idea.title,
      item.idea.description,
      item.idea.category,
      item.idea.tags,
      item.idea.stops.flatMap((stop) => [stop.title, stop.onlineLabel, stop.onlineUrl]),
    ]);
  }

  if (item.kind === 'need' || item.kind === 'offer') {
    const template = item.template;
    return joinExploreSearchValues([
      t(item.kind === 'need' ? 'common.exploreDiscovery.needSection' : 'common.exploreDiscovery.offerSection'),
      template.title,
      template.description,
      template.itemType,
      template.category,
      template.tags,
      template.kind === 'need' ? template.timing : template.availability,
      template.mode,
      template.locationLabel,
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

function planIdeaPreviewPlan(idea: StarterPlanIdea): PlanDto {
  const createdAt = new Date().toISOString();
  return {
    id: `starter-plan-idea-${idea.id}`,
    ownerId: 'starter-plan-idea',
    title: idea.title,
    description: idea.description,
    category: idea.category,
    tags: idea.tags,
    mode: starterPlanIdeaMode(idea),
    locationLabel: `${idea.stops.length} starter stops`,
    startsAt: createdAt,
    endsAt: null,
    maxParticipants: null,
    joinApprovalMode: 'automatic',
    status: 'open',
    createdAt,
    updatedAt: createdAt,
    participantCount: 0,
    places: idea.stops.map((stop, index) => ({
      id: `starter-plan-idea-${idea.id}-place-${index}`,
      planId: `starter-plan-idea-${idea.id}`,
      placeId: null,
      source: 'custom',
      order: index,
      mode: stop.mode,
      title: stop.title,
      note: null,
      addressPublicText: null,
      addressPrivateText: null,
      onlineLabel: stop.mode === 'remote' ? stop.onlineLabel ?? null : null,
      onlineUrl: stop.mode === 'remote' ? stop.onlineUrl ?? null : null,
      startsAt: null,
      endsAt: null,
      createdAt,
      updatedAt: createdAt,
      media: [],
    })),
  } as PlanDto;
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

function inventoryMeta(template: InventoryTemplateDto, t: TFunction) {
  return [
    itemTypeLabel(template.itemType ?? 'service', t),
    categoryLabel(template.category, t),
    template.kind === 'need' ? template.timing : template.availability,
    template.mode ? modeLabel(template.mode, t) : null,
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

export function ExploreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const [needTemplates, setNeedTemplates] = useState<InventoryTemplateDto[]>([]);
  const [offerTemplates, setOfferTemplates] = useState<InventoryTemplateDto[]>([]);
  const [hellowhenPlaces, setHellowhenPlaces] = useState<PlaceDto[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryRefreshing, setDiscoveryRefreshing] = useState(false);
  const [discoveryLoaded, setDiscoveryLoaded] = useState(false);
  const [discoveryHasError, setDiscoveryHasError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ExploreTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftTypeFilter, setDraftTypeFilter] = useState<ExploreTypeFilter>('all');
  const [draftSearchQuery, setDraftSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const discoveryRequestSequence = useRef(0);
  const [discoveryMixSeed, setDiscoveryMixSeed] = useState(createExploreMixSeed);

  const loadDiscovery = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    const requestId = ++discoveryRequestSequence.current;
    if (showLoading) setDiscoveryLoading(true);
    setDiscoveryHasError(false);
    const placeRequest = betaFeatures.plansEnabled && betaFeatures.plansVisible
      ? api.places.library({ take: EXPLORE_DISCOVERY_LIMIT })
      : Promise.resolve({ places: [] });
    const [needsResult, offersResult, placesResult] = await Promise.allSettled([
      api.inventoryTemplates.list({ kind: 'need', sourceType: 'hellowhen', language, take: EXPLORE_DISCOVERY_LIMIT }),
      api.inventoryTemplates.list({ kind: 'offer', sourceType: 'hellowhen', language, take: EXPLORE_DISCOVERY_LIMIT }),
      placeRequest,
    ]);

    if (requestId !== discoveryRequestSequence.current) return;
    if (needsResult.status === 'fulfilled') setNeedTemplates(normalizeTemplates(needsResult.value, 'need'));
    if (offersResult.status === 'fulfilled') setOfferTemplates(normalizeTemplates(offersResult.value, 'offer'));
    if (placesResult.status === 'fulfilled') setHellowhenPlaces(normalizePlaces(placesResult.value));
    setDiscoveryHasError([needsResult, offersResult, placesResult].some((result) => result.status === 'rejected'));
    setDiscoveryLoaded(true);
    setDiscoveryLoading(false);
  }, [language]);

  const refreshDiscovery = useCallback(async () => {
    setDiscoveryRefreshing(true);
    try {
      await loadDiscovery({ showLoading: false });
      setDiscoveryMixSeed(createExploreMixSeed());
    } finally {
      setDiscoveryRefreshing(false);
    }
  }, [loadDiscovery]);

  useEffect(() => {
    void loadDiscovery();
    return () => { discoveryRequestSequence.current += 1; };
  }, [loadDiscovery]);

  const staticConceptGroups = useMemo(() => {
    const tradeItems: ExploreFeedItem[] = tradeExploreIdeaKeys.map((ideaKey) => ({
      kind: 'trade',
      key: `trade-idea-${ideaKey}`,
      ideaKey,
    }));
    const planItems: ExploreFeedItem[] = [];

    if (betaFeatures.plansEnabled && betaFeatures.plansVisible) {
      starterPlanIdeaKeys.forEach((ideaKey) => {
        const idea = starterPlanIdeas[ideaKey];
        if (!idea) return;
        planItems.push({
          kind: 'plan',
          key: `plan-idea-${ideaKey}`,
          ideaKey,
          idea,
          preview: planIdeaPreviewPlan(idea),
        });
      });
    }

    return { trade: tradeItems, plan: planItems };
  }, []);

  const mixedFeedItems = useMemo<ExploreFeedItem[]>(() => buildBalancedMixedFeed({
    trade: staticConceptGroups.trade,
    plan: staticConceptGroups.plan,
    need: needTemplates.map((template) => ({ kind: 'need' as const, key: `need-idea-${template.id}`, template })),
    offer: offerTemplates.map((template) => ({ kind: 'offer' as const, key: `offer-idea-${template.id}`, template })),
    place: betaFeatures.plansEnabled && betaFeatures.plansVisible
      ? hellowhenPlaces.map((place) => ({ kind: 'place' as const, key: `hellowhen-place-${place.id}`, place }))
      : [],
  }, discoveryMixSeed), [discoveryMixSeed, hellowhenPlaces, needTemplates, offerTemplates, staticConceptGroups]);
  const feedItems = discoveryLoaded ? mixedFeedItems : [];
  const filteredFeedItems = useMemo(
    () => filterExploreItems(feedItems, typeFilter, searchQuery, t),
    [feedItems, searchQuery, t, typeFilter],
  );
  const draftFilteredCount = useMemo(
    () => filterExploreItems(feedItems, draftTypeFilter, draftSearchQuery, t).length,
    [draftSearchQuery, draftTypeFilter, feedItems, t],
  );
  const activeExploreFilterCount = Number(typeFilter !== 'all') + Number(Boolean(normalizeExploreSearchQuery(searchQuery)));
  const conceptStageHeight = getMobileTradeDeckCardSize(width) + SQUARE_STACK_DEPTH_ALLOWANCE_Y;

  const discoveryItemCount = needTemplates.length + offerTemplates.length + hellowhenPlaces.length;
  const openTypeFilters = () => {
    setDraftTypeFilter(typeFilter);
    setDraftSearchQuery(searchQuery);
    setFilterVisible(true);
  };
  const resetTypeFilters = () => {
    setDraftTypeFilter('all');
    setDraftSearchQuery('');
  };
  const applyTypeFilters = () => {
    const nextSearchQuery = normalizeExploreSearchQuery(draftSearchQuery);
    setDraftSearchQuery(nextSearchQuery);
    setSearchQuery(nextSearchQuery);
    setTypeFilter(draftTypeFilter);
    setFilterVisible(false);
  };

  const filterOptions: Array<{ value: ExploreTypeFilter; label: string }> = [
    { value: 'all', label: t('inventory.itemTypes.all') },
    { value: 'trade', label: t('trade.feedIdeas.badge') },
    { value: 'plan', label: t('plans.workspace.planIdeas.title') },
    { value: 'need', label: t('common.exploreDiscovery.needSection') },
    { value: 'offer', label: t('common.exploreDiscovery.offerSection') },
    { value: 'place', label: t('common.exploreDiscovery.placeSection') },
  ];

  const header = (
    <View style={styles.headerRow}>
      <AppText accessibilityRole="header" style={styles.title}>{t('navigation.tabs.explore')}</AppText>
      <View style={styles.headerActions}>
        <AppHeaderActionButton
          icon="filter"
          accessibilityLabel={t('common.exploreDiscovery.filterOpen')}
          onPress={openTypeFilters}
          badgeCount={activeExploreFilterCount}
        />
        <AccountHeaderActionButton onPress={() => navigation.navigate('Account')} />
      </View>
    </View>
  );

  const footer = discoveryLoading ? (
    <View style={styles.discoveryState}>
      <ActivityIndicator />
      <AppText style={[styles.discoveryStateText, { color: theme.color.muted }]}>{t('common.exploreDiscovery.loading')}</AppText>
    </View>
  ) : discoveryHasError ? (
    <View style={styles.discoveryState}>
      <AppText style={[styles.discoveryStateText, { color: theme.color.muted }]}>{t('common.exploreDiscovery.partialError')}</AppText>
      <Pressable
        accessibilityRole="button"
        onPress={() => void loadDiscovery()}
        style={({ pressed }) => [styles.retryButton, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, pressed && styles.pressed]}
      >
        <AppText style={styles.retryButtonText}>{t('common.actions.tryAgain')}</AppText>
      </Pressable>
    </View>
  ) : discoveryLoaded && discoveryItemCount === 0 ? (
    <View style={styles.discoveryState}>
      <AppText style={[styles.discoveryStateText, { color: theme.color.muted }]}>{t('common.exploreDiscovery.empty')}</AppText>
    </View>
  ) : null;

  return (
    <>
      <AppSmartHeaderScreen header={header} resetKey={typeFilter}>
        {(scrollProps) => (
          <FlatList
            {...scrollProps.scrollViewProps}
            key={`${typeFilter}:${searchQuery}`}
            data={filteredFeedItems}
            keyExtractor={(item) => item.key}
            contentContainerStyle={[styles.content, scrollProps.contentInsetStyle]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={discoveryRefreshing} onRefresh={() => { void refreshDiscovery(); }} />}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews={false}
            ListEmptyComponent={discoveryLoaded && !discoveryLoading ? (
              <View style={styles.discoveryState}>
                <AppText style={[styles.discoveryStateText, { color: theme.color.muted }]}>{t(activeExploreFilterCount > 0 ? 'common.exploreDiscovery.noResults' : 'common.exploreDiscovery.empty')}</AppText>
              </View>
            ) : null}
            ListFooterComponent={footer}
            renderItem={({ item, index: feedIndex }) => {
          if (item.kind === 'trade') {
            return (
              <View style={[styles.conceptDeck, { minHeight: conceptStageHeight }, feedIndex === 0 ? styles.firstConceptDeck : styles.nextConceptDeck]}>
                <TradeFeedIdeaCard
                  ideaKey={item.ideaKey}
                  onOpenIdea={(ideaKey) => navigation.navigate('TradeIdeaDetail', { ideaId: ideaKey })}
                />
              </View>
            );
          }

          if (item.kind === 'plan') {
            return (
              <View style={[styles.conceptDeck, { minHeight: conceptStageHeight }, feedIndex === 0 ? styles.firstConceptDeck : styles.nextConceptDeck]}>
                <PlanSquareDeck
                  plan={item.preview}
                  index={0}
                  total={1}
                  onOpen={() => navigation.navigate('PlanIdeaDetail', { ideaId: item.ideaKey })}
                  topBadgeLabel={t('plans.deck.ideaBadge', { pack: item.idea.pack })}
                  topBadgeTone="plan"
                  showModeBadge={false}
                />
              </View>
            );
          }

          if (item.kind === 'need' || item.kind === 'offer') {
            const isNeed = item.kind === 'need';
            const template = item.template;
            const badgeLabel = t(isNeed ? 'common.exploreDiscovery.needBadge' : 'common.exploreDiscovery.offerBadge');
            return (
              <View style={[styles.conceptDeck, { minHeight: conceptStageHeight }, feedIndex === 0 ? styles.firstConceptDeck : styles.nextConceptDeck]}>
                <ExploreConceptSquareDeck
                  conceptId={`inventory-template-${template.id}`}
                  title={template.title}
                  description={template.description}
                  meta={inventoryMeta(template, t)}
                  badgeLabel={badgeLabel}
                  tone={isNeed ? 'need' : 'offer'}
                  media={template.media}
                  accessibilityLabel={`${badgeLabel}: ${template.title}`}
                  onOpen={() => navigation.navigate(isNeed ? 'NeedIdeaDetail' : 'OfferIdeaDetail', { templateId: template.id, title: template.title })}
                />
              </View>
            );
          }

          const badgeLabel = t('common.exploreDiscovery.placeBadge');
          return (
            <View style={[styles.conceptDeck, { minHeight: conceptStageHeight }, feedIndex === 0 ? styles.firstConceptDeck : styles.nextConceptDeck]}>
              <ExploreConceptSquareDeck
                conceptId={`hellowhen-place-${item.place.id}`}
                title={item.place.title}
                description={item.place.description}
                meta={placeMeta(item.place, t)}
                badgeLabel={badgeLabel}
                tone="place"
                media={item.place.media}
                staticMap={item.place.staticMap}
                accessibilityLabel={`${badgeLabel}: ${item.place.title}`}
                onOpen={() => navigation.navigate('HellowhenPlaceDetail', { placeId: item.place.id, title: item.place.title })}
              />
            </View>
          );
            }}
          />
        )}
      </AppSmartHeaderScreen>

      <LibraryFilterScreen
        visible={filterVisible}
        title={t('inventory.libraryFilters.title')}
        body={t('common.exploreDiscovery.filterBody')}
        closeAccessibilityLabel={t('inventory.libraryFilters.closeFilters')}
        resetLabel={t('inventory.libraryFilters.reset')}
        applyLabel={t('inventory.libraryFilters.showResults', { count: draftFilteredCount })}
        onClose={() => setFilterVisible(false)}
        onReset={resetTypeFilters}
        onApply={applyTypeFilters}
        resetDisabled={draftTypeFilter === 'all' && !normalizeExploreSearchQuery(draftSearchQuery)}
      >
        <LibraryInlineSearch
          query={draftSearchQuery}
          onQueryChange={setDraftSearchQuery}
          placeholder={t('common.exploreDiscovery.searchPlaceholder')}
          accessibilityLabel={t('common.exploreDiscovery.searchPlaceholder')}
          clearAccessibilityLabel={t('common.exploreDiscovery.clearSearch')}
          autoFocus={false}
        />
        <LibraryFilterGroup title={t('inventory.libraryFilters.type')}>
          {filterOptions.map((option) => (
            <LibraryFilterOption
              key={option.value}
              label={option.label}
              selected={draftTypeFilter === option.value}
              onPress={() => setDraftTypeFilter(option.value)}
            />
          ))}
        </LibraryFilterGroup>
      </LibraryFilterScreen>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, minWidth: 0, ...PRIMARY_HEADER_TITLE_STYLE },
  content: { paddingTop: 8, paddingBottom: 44 },
  conceptDeck: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  firstConceptDeck: { marginTop: 14 },
  nextConceptDeck: { marginTop: MOBILE_DECK_FEED_GAP },
  discoveryState: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 28 },
  discoveryStateText: { textAlign: 'center', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  retryButton: { minHeight: 40, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  retryButtonText: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  pressed: { opacity: 0.88 },
});
