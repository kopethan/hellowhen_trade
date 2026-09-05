import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ListTradesFeedQuery, TradeExchangeMode, TradePostType, TradeSearchKeywordSource, TradeSearchSuggestion } from '@hellowhen/contracts';
import { formatLocalizedShortDate, type SupportedLanguage } from '@hellowhen/i18n';
import { getTradeOwnerVisibilityState, isTradeOwnerCloseAllowed, isTradeOwnerRenewAllowed } from '@hellowhen/shared';
import type { RootStackParamList, TradeFilterRouteParams } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { betaFeatures } from '../../lib/betaFeatures';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { PRIMARY_HEADER_TITLE_STYLE } from '../../components/headerTypography';
import { AccountHeaderActionButton } from '../../components/AccountHeaderActionButton';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { type AppCollapsibleHeaderScrollProps } from '../../components/AppCollapsibleHeaderScreen';
import { AppSmartHeaderScreen } from '../../components/AppSmartHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { DECK_CARD_TYPOGRAPHY } from '../../components/PosterCardGeometry';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { TradeSquareDeck } from './components/TradeSquareDeck';
import { TradeExchangeIcon } from './components/TradeExchangeIcon';
import { TradePosterCard } from './components/TradePosterCard';
import { getMobileTradeDeckCardSize, MOBILE_DECK_FEED_GAP, shouldUseCompactTradeDeckContent } from './components/tradeDeckGeometry';
import { emptyFeedStarterIdeaPlacement, feedTradeIdeaHasNeed, feedTradeIdeaHasOffer, feedTradeIdeas, getFeedStarterIdeaPlacement, getFeedTradeIdeaMedia, getInlineFeedIdeaKey, getRandomizedFeedIdeaKeys, type FeedTradeIdeaKey, type FeedTradeIdeaVisualKey } from './tradeFeedIdeas';
import { FeatureGuidePromptCard } from '../onboarding-guide/FeatureGuidePromptCard';
import { useFeatureGuidePrompt } from '../onboarding-guide/onboardingGuideStorage';
import type { TradeDeckItem } from './types';

type FeedResponse = { trades: TradeDeckItem[] };
type TradeFeedListItem =
  | { type: 'trade'; key: string; trade: TradeDeckItem; index: number; total: number }
  | { type: 'idea'; key: string; ideaKey: FeedTradeIdeaKey }
  | { type: 'ideaGroup'; key: string; ideaKeys: readonly FeedTradeIdeaKey[] };
type TradeActivityTab = 'mine' | 'involved';
type TradeWithCounts = TradeDeckItem & { _count?: { proposals?: number } };
type TradeWithViewerProposal = TradeWithCounts & { viewerProposal?: { id: string; status: string; createdAt?: string; respondedAt?: string | null } | null; viewerInvolvement?: 'owner' | 'provider' | 'applicant' };
type MineResponse = { trades: TradeWithCounts[] };
type ModeFilter = 'all' | TradeExchangeMode;
type PostTypeFilter = 'all' | TradePostType;

const modeOptions: Array<{ labelKey: string; value: ModeFilter }> = [
  { labelKey: 'inventory.itemTypes.all', value: 'all' },
  { labelKey: 'trade.modes.remote', value: 'remote' },
  { labelKey: 'trade.modes.local', value: 'local' },
  { labelKey: 'trade.modes.hybrid', value: 'hybrid' },
];
const minSearchSuggestionLength = 2;

const postTypeOptions: Array<{ labelKey: string; value: PostTypeFilter }> = [
  { labelKey: 'trade.filters.anyPostType', value: 'all' },
  { labelKey: 'trade.postTypes.needOffer', value: 'need_offer' },
  { labelKey: 'trade.postTypes.openNeed', value: 'open_need' },
  { labelKey: 'trade.postTypes.openOffer', value: 'open_offer' },
];

function hasApprovedImages(trade: TradeDeckItem) {
  return (trade.need?.media?.length ?? 0) + (trade.need?.mediaAccess?.hiddenCount ?? 0) + (trade.offer?.media?.length ?? 0) + (trade.offer?.mediaAccess?.hiddenCount ?? 0) > 0;
}

function hasWalletAmount(trade: TradeDeckItem) {
  return (trade.amountCents ?? 0) > 0;
}

function createFeedRefreshSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function compactSeenTradeIds(ids: string[]) {
  return Array.from(new Set(ids)).slice(-80);
}

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function canUseSearchSuggestions(value: string) {
  return normalizeSearchText(value).length >= minSearchSuggestionLength;
}

function buildFeedQuery(query: string, modeFilter: ModeFilter, postTypeFilter: PostTypeFilter, category: string, imagesOnly: boolean, moneyOnly: boolean, refreshSeed: string, seenTradeIds: string[], language: 'en' | 'fr' | 'es', countryCode?: string | null): ListTradesFeedQuery {
  return {
    q: normalizeSearchText(query) || undefined,
    mode: modeFilter === 'all' ? undefined : modeFilter,
    postType: postTypeFilter === 'all' ? undefined : postTypeFilter,
    category: category.trim() || undefined,
    hasImages: imagesOnly || undefined,
    hasMoney: betaFeatures.moneyTradesEnabled ? (moneyOnly || undefined) : undefined,
    language,
    countryCode: countryCode ?? undefined,
    refreshSeed,
    seenTradeIds: seenTradeIds.length ? seenTradeIds : undefined,
    take: 50,
  };
}

export function TradeDeckFeedScreen() {
  const theme = useThemeTokens();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const { t, language } = useTranslation();
  const [activityTab, setActivityTab] = useState<TradeActivityTab>('mine');
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [trades, setTrades] = useState<TradeDeckItem[]>([]);
  const route = useRoute<RouteProp<{ TradeTab: TradeFilterRouteParams | undefined }, 'TradeTab'>>();
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [postTypeFilter, setPostTypeFilter] = useState<PostTypeFilter>('all');
  const [category, setCategory] = useState('');
  const [imagesOnly, setImagesOnly] = useState(false);
  const [moneyOnly, setMoneyOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoadedFeed, setHasLoadedFeed] = useState(false);
  const [hasSuccessfulFeed, setHasSuccessfulFeed] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(() => createFeedRefreshSeed());
  const [seenTradeIds, setSeenTradeIds] = useState<string[]>([]);
  const guidePrompt = useFeatureGuidePrompt('trade');
  const loadRequestIdRef = useRef(0);
  const feedQueryRef = useRef<ListTradesFeedQuery | null>(null);
  const feedQueryKeyRef = useRef('');
  const lastRequestedFeedKeyRef = useRef<string | null>(null);
  const feedFocusedRef = useRef(false);
  const immediateQueryLoadRef = useRef(false);
  const pendingSearchRecordRef = useRef<{ q: string; source: TradeSearchKeywordSource } | null>(null);
  const appliedFilterRouteKeyRef = useRef<number | null>(null);
  const appliedAccountActivityKeyRef = useRef<number | null>(null);

  const feedQuery = useMemo(() => buildFeedQuery(query, modeFilter, postTypeFilter, category, imagesOnly, moneyOnly, refreshSeed, seenTradeIds, language, auth.user?.profile?.countryCode), [auth.user?.profile?.countryCode, category, imagesOnly, language, modeFilter, moneyOnly, postTypeFilter, query, refreshSeed, seenTradeIds]);
  const activeFilterCount = useMemo(() => [feedQuery.q, feedQuery.mode, feedQuery.postType, feedQuery.category, feedQuery.hasImages, betaFeatures.moneyTradesEnabled ? feedQuery.hasMoney : undefined].filter(Boolean).length, [feedQuery]);

  const queueSearchKeywordRecord = useCallback((q: string, source: TradeSearchKeywordSource) => {
    const normalized = normalizeSearchText(q);
    if (!canUseSearchSuggestions(normalized)) return;
    pendingSearchRecordRef.current = { q: normalized, source };
  }, []);

  useEffect(() => {
    const params = route.params;
    if (!params?.accountActivity || !params.accountActivityKey || appliedAccountActivityKeyRef.current === params.accountActivityKey) return;
    appliedAccountActivityKeyRef.current = params.accountActivityKey;
    setActivityTab(params.accountActivity);
    setActivityModalVisible(true);
  }, [route.params?.accountActivity, route.params?.accountActivityKey]);

  useEffect(() => {
    const params = route.params;
    if (!params?.applyKey || appliedFilterRouteKeyRef.current === params.applyKey) return;
    appliedFilterRouteKeyRef.current = params.applyKey;

    const nextQuery = normalizeSearchText(params.q ?? '');
    if (params.searchSource) queueSearchKeywordRecord(nextQuery, params.searchSource);
    else pendingSearchRecordRef.current = null;

    setQuery(nextQuery);
    setModeFilter(params.mode ?? 'all');
    setPostTypeFilter(params.postType ?? 'all');
    setCategory(params.category ?? '');
    setImagesOnly(Boolean(params.hasImages));
    setMoneyOnly(betaFeatures.moneyTradesEnabled && Boolean(params.hasMoney));
    setSeenTradeIds([]);
    setRefreshSeed(createFeedRefreshSeed());
  }, [queueSearchKeywordRecord, route.params?.applyKey, route.params?.category, route.params?.hasImages, route.params?.hasMoney, route.params?.mode, route.params?.postType, route.params?.q, route.params?.searchSource]);

  const recordSearchKeyword = useCallback(async (pending: { q: string; source: TradeSearchKeywordSource }, resultCount: number) => {
    const normalized = normalizeSearchText(pending.q);
    if (!canUseSearchSuggestions(normalized)) return;
    try {
      await api.tradeSearch.recordKeyword({ q: normalized, source: pending.source, resultCount, language, countryCode: auth.user?.profile?.countryCode ?? undefined });
    } catch {
      // Search logging is best-effort and must never block discovery.
    }
  }, [auth.user?.profile?.countryCode, language]);

  const feedQueryKey = useMemo(() => JSON.stringify(feedQuery), [feedQuery]);
  feedQueryRef.current = feedQuery;
  feedQueryKeyRef.current = feedQueryKey;

  const loadFeed = useCallback(async (nextFeedQuery: ListTradesFeedQuery, requestKey: string) => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    lastRequestedFeedKeyRef.current = requestKey;
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.feed(nextFeedQuery) as FeedResponse;
      if (requestId !== loadRequestIdRef.current) return;
      const nextTrades = Array.isArray(result.trades) ? result.trades : [];
      setTrades(nextTrades);
      setHasSuccessfulFeed(true);
      const pendingRecord = pendingSearchRecordRef.current;
      if (pendingRecord && normalizeSearchText(pendingRecord.q) === normalizeSearchText(nextFeedQuery.q ?? '')) {
        pendingSearchRecordRef.current = null;
        void recordSearchKeyword(pendingRecord, nextTrades.length);
      }
    } catch (caughtError) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setHasLoadedFeed(true);
        setLoading(false);
      }
    }
  }, [recordSearchKeyword]);

  useFocusEffect(useCallback(() => {
    feedFocusedRef.current = true;
    immediateQueryLoadRef.current = false;
    const currentQuery = feedQueryRef.current;
    if (currentQuery) void loadFeed(currentQuery, feedQueryKeyRef.current);
    return () => {
      feedFocusedRef.current = false;
    };
  }, [loadFeed]));

  useEffect(() => {
    if (!feedFocusedRef.current || lastRequestedFeedKeyRef.current === feedQueryKey) return undefined;

    if (immediateQueryLoadRef.current) {
      immediateQueryLoadRef.current = false;
      void loadFeed(feedQuery, feedQueryKey);
      return undefined;
    }

    const handle = setTimeout(() => {
      if (!feedFocusedRef.current || lastRequestedFeedKeyRef.current === feedQueryKey) return;
      void loadFeed(feedQuery, feedQueryKey);
    }, 275);
    return () => clearTimeout(handle);
  }, [feedQuery, feedQueryKey, loadFeed]);

  const visibleTrades = useMemo(() => trades.filter((trade) => {
    if (imagesOnly && !hasApprovedImages(trade)) return false;
    if (betaFeatures.moneyTradesEnabled && moneyOnly && !hasWalletAmount(trade)) return false;
    return true;
  }), [imagesOnly, moneyOnly, trades]);

  const openTrade = useCallback((trade: TradeDeckItem) => {
    navigation.navigate('TradeDetail', {
      tradeId: trade.id,
      title: trade.title,
      description: trade.description,
      amountCents: trade.amountCents ?? 0,
      currency: trade.currency ?? 'eur',
      creditAmount: trade.creditAmount,
      status: trade.status,
      expiresAt: trade.expiresAt ?? null,
    });
  }, [navigation]);

  const refreshDiscoveryOrder = useCallback(() => {
    immediateQueryLoadRef.current = true;
    setSeenTradeIds((current) => compactSeenTradeIds([...current, ...trades.map((trade) => trade.id)]));
    setRefreshSeed(createFeedRefreshSeed());
  }, [trades]);

  const createTrade = useCallback(() => {
    if (!auth.isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('CreateTrade');
  }, [auth.isAuthenticated, navigation]);


  const openTradeIdea = useCallback((ideaKey: FeedTradeIdeaKey) => {
    navigation.navigate('TradeIdeaDetail', { ideaId: ideaKey });
  }, [navigation]);
  const clearFilters = useCallback(() => {
    pendingSearchRecordRef.current = null;
    setQuery('');
    setModeFilter('all');
    setPostTypeFilter('all');
    setCategory('');
    setImagesOnly(false);
    setMoneyOnly(false);
    setSeenTradeIds([]);
    setRefreshSeed(createFeedRefreshSeed());
    navigation.navigate('TradeTabs', { screen: 'TradeTab', params: { applyKey: Date.now() } });
  }, [navigation]);

  const hasTrades = trades.length > 0;
  const hasFilters = activeFilterCount > 0;
  // Hellowhen starter concepts now live exclusively in Explore. Keep the Trade feed real-activity only.
  const feedItems = useMemo<TradeFeedListItem[]>(() => (
    visibleTrades.map((trade, index) => ({
      type: 'trade',
      key: `trade-${trade.id}`,
      trade,
      index,
      total: visibleTrades.length,
    }))
  ), [visibleTrades]);

  const renderFeedItem = useCallback(({ item }: { item: TradeFeedListItem }) => {
    if (item.type === 'trade') return <TradeDeckSection trade={item.trade} index={item.index} total={item.total} onOpenTrade={openTrade} />;
    if (item.type === 'idea') return <TradeFeedInlineIdeaCard ideaKey={item.ideaKey} onOpenIdea={openTradeIdea} />;
    return <TradeFeedIdeaGroup ideaKeys={item.ideaKeys} onOpenIdea={openTradeIdea} />;
  }, [openTrade, openTradeIdea]);

  const listHeader = guidePrompt.visible || error ? (
    <View style={styles.feedIntroStack}>
      {guidePrompt.visible ? (
        <FeatureGuidePromptCard
          body={t('onboarding.prompt.tradeBody')}
          icon="trade"
          onDismiss={() => { void guidePrompt.dismiss(); }}
          onStart={() => navigation.navigate('OnboardingGuide', { guide: 'trade', replay: true })}
          title={t('onboarding.prompt.tradeTitle')}
          tone="trade"
        />
      ) : null}
      {error ? <InfoNotice tone="danger" title={t('trade.filters.couldNotLoadTrades')} body={error} /> : null}
    </View>
  ) : null;

  const header = (
    <View style={styles.fixedHeaderStack}>
      <View style={styles.headerRow}>
        <AppText accessibilityRole="header" style={styles.title}>{t('navigation.tabs.trade')}</AppText>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('trade.filters.searchAndFilters')} onPress={() => navigation.navigate('TradeFilters', { q: query || undefined, mode: modeFilter === 'all' ? undefined : modeFilter, postType: postTypeFilter === 'all' ? undefined : postTypeFilter, category: category.trim() || undefined, hasImages: imagesOnly || undefined, hasMoney: betaFeatures.moneyTradesEnabled ? (moneyOnly || undefined) : undefined })} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, hasFilters && { backgroundColor: theme.semantic.trade.softBg, borderColor: theme.semantic.trade.border }, pressed && styles.pressed]}>
            <MobileIcon name="filter" size={18} color={hasFilters ? theme.semantic.trade.text : theme.color.text} />
            {hasFilters ? <View style={[styles.filterDot, { backgroundColor: theme.semantic.trade.bg }]}><AppText style={[styles.filterDotText, { color: theme.semantic.trade.onBg }]}>{activeFilterCount}</AppText></View> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('trade.create.title')} onPress={() => createTrade()} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.semantic.trade.bg, borderColor: theme.semantic.trade.bg }, pressed && styles.pressed]}>
            <MobileIcon name="add" size={23} color={theme.semantic.trade.onBg} />
          </Pressable>
          <AccountHeaderActionButton onPress={() => navigation.navigate('Account')} />
        </View>
      </View>
    </View>
  );

  return (
    <AppSmartHeaderScreen header={header} resetKey="discover">
      {(scrollProps) => (
        <>
          <FlatList
            {...scrollProps.scrollViewProps}
            data={feedItems}
            keyExtractor={(item) => item.key}
            renderItem={renderFeedItem}
            contentContainerStyle={[scrollProps.contentInsetStyle, styles.content, styles.feedList]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={loading && hasLoadedFeed && feedItems.length > 0} onRefresh={refreshDiscoveryOrder} />}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={!error ? (loading ? <TradeFeedLoadingState /> : <EmptyTradesState hasTrades={hasTrades} hasFilters={hasFilters} onCreate={createTrade} onRefresh={refreshDiscoveryOrder} onClear={clearFilters} />) : null}
            // Deck cards intentionally travel diagonally left during swipe;
            // clipped FlatList cells create the visible "invisible wall" on Android.
            removeClippedSubviews={false}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            updateCellsBatchingPeriod={60}
          />
          <TradeActivityModal
            activeTab={activityTab}
            visible={activityModalVisible}
            onChangeTab={setActivityTab}
            onClose={() => setActivityModalVisible(false)}
            onCreate={createTrade}
            onOpenTrade={(trade) => { setActivityModalVisible(false); openTrade(trade); }}
            onOpenProposals={(trade) => { setActivityModalVisible(false); navigation.navigate('TradePrivateProposals', { tradeId: trade.id, title: getMineTradeTitle(trade), status: trade.status }); }}
            onOpenProposal={(proposalId) => { setActivityModalVisible(false); navigation.navigate('ProposalDetail', { proposalId }); }}
          />
        </>
      )}
    </AppSmartHeaderScreen>
  );
}




function TradeFeedIdeaGroup({ ideaKeys, onOpenIdea }: { ideaKeys: readonly FeedTradeIdeaKey[]; onOpenIdea: (ideaKey: FeedTradeIdeaKey) => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();

  return (
    <View style={styles.feedIdeasCard}>
      <View style={styles.feedIdeasHeader}>
        <SemanticBadge label={t('trade.feedIdeas.badge')} tone="instruction" />
        <AppText style={styles.feedIdeasTitle}>{t('trade.feedIdeas.title')}</AppText>
        <AppText style={[styles.feedIdeasBody, { color: theme.color.muted }]}>{t('trade.feedIdeas.body')}</AppText>
      </View>
      <View style={styles.feedIdeasList}>
        {ideaKeys.map((key, index) => <TradeFeedIdeaCard key={`starter-appended-${index}-${key}`} ideaKey={key} onOpenIdea={onOpenIdea} />)}
      </View>
    </View>
  );
}

function getFeedIdeaTypeLabelKey(ideaKey: FeedTradeIdeaKey) {
  const idea = feedTradeIdeas[ideaKey];
  return idea.type === 'open_need' ? 'trade.feedIdeas.typeLabels.openNeed' : idea.type === 'open_offer' ? 'trade.feedIdeas.typeLabels.openOffer' : 'trade.feedIdeas.typeLabels.trade';
}

function getFeedIdeaActionKey(ideaKey: FeedTradeIdeaKey) {
  const idea = feedTradeIdeas[ideaKey];
  return idea.type === 'open_need' ? 'trade.feedIdeas.actionOpenNeed' : idea.type === 'open_offer' ? 'trade.feedIdeas.actionOpenOffer' : 'trade.feedIdeas.action';
}

function getFeedIdeaAriaSummary(t: ReturnType<typeof useTranslation>['t'], ideaKey: FeedTradeIdeaKey) {
  const idea = feedTradeIdeas[ideaKey];
  const need = feedTradeIdeaHasNeed(idea) ? t(`trade.feedIdeas.items.${ideaKey}.need`) : '';
  const offer = feedTradeIdeaHasOffer(idea) ? t(`trade.feedIdeas.items.${ideaKey}.offer`) : '';
  return idea.type === 'open_need' ? need : idea.type === 'open_offer' ? offer : `${need} ↔ ${offer}`;
}

const starterIdeaPreviewThemeByVisualKey: Record<FeedTradeIdeaVisualKey, 'blue' | 'green' | 'purple' | 'amber' | 'rose'> = {
  startup: 'purple',
  language: 'green',
  local: 'amber',
  objects: 'blue',
  creative: 'rose',
  feedback: 'purple',
  social: 'amber',
  admin: 'blue',
  video: 'blue',
  remote: 'green',
};

function splitFeedIdeaChips(value: string) {
  return value.split('·').map((part) => part.trim()).filter(Boolean).slice(0, 3);
}

export function TradeFeedIdeaCard({ ideaKey, onOpenIdea, inline = false }: { ideaKey: FeedTradeIdeaKey; onOpenIdea: (ideaKey: FeedTradeIdeaKey) => void; inline?: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const cardSize = getMobileTradeDeckCardSize(width);
  const compactLayout = shouldUseCompactTradeDeckContent(width);
  const idea = feedTradeIdeas[ideaKey];
  const pack = t(`trade.feedIdeas.items.${ideaKey}.pack`);
  const need = feedTradeIdeaHasNeed(idea) ? t(`trade.feedIdeas.items.${ideaKey}.need`) : '';
  const offer = feedTradeIdeaHasOffer(idea) ? t(`trade.feedIdeas.items.${ideaKey}.offer`) : '';
  const typeLabel = t(getFeedIdeaTypeLabelKey(ideaKey));
  const actionLabel = t(getFeedIdeaActionKey(ideaKey));
  const summary = getFeedIdeaAriaSummary(t, ideaKey);

  if (idea.type !== 'trade') {
    const isOpenNeed = idea.type === 'open_need';
    const media = getFeedTradeIdeaMedia(ideaKey);
    const title = isOpenNeed ? need : offer;
    const meta = t(`trade.feedIdeas.items.${ideaKey}.${isOpenNeed ? 'needMeta' : 'offerMeta'}`);

    return (
      <View
        accessibilityLabel={`${typeLabel} · ${pack}: ${summary}. ${actionLabel}`}
        style={[styles.feedIdeaPosterFrame, { width: cardSize, height: cardSize }, inline && styles.feedIdeaCardInline]}
      >
        <TradePosterCard
          id={`starter-${ideaKey}`}
          accessibilityLabel={`${typeLabel} · ${pack}: ${summary}. ${actionLabel}`}
          imageUrl={media.imageUrl}
          badge={`${typeLabel} · 01/01`}
          eyebrow={isOpenNeed ? t('trade.proposals.openForOffers') : t('trade.proposals.openForNeeds')}
          title={title}
          subtitle={meta}
          topMeta={t('trade.feedIdeas.ideaLabel')}
          chips={[pack, ...splitFeedIdeaChips(meta)]}
          footerLabel={actionLabel}
          variant={isOpenNeed ? 'need' : 'offer'}
          onPress={() => onOpenIdea(ideaKey)}
          previewTheme={starterIdeaPreviewThemeByVisualKey[media.fallbackVisualKey]}
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel} · ${pack}: ${summary}. ${actionLabel}`}
      onPress={() => onOpenIdea(ideaKey)}
      style={({ pressed }) => [styles.feedIdeaCard, compactLayout && styles.feedIdeaCardCompact, { width: cardSize, height: cardSize, backgroundColor: theme.color.surface, borderColor: theme.color.border }, inline && styles.feedIdeaCardInline, pressed && styles.pressed]}
    >
      <View style={[styles.feedIdeaTopline, compactLayout && styles.feedIdeaToplineCompact]}>
        <AppText numberOfLines={1} style={[styles.feedIdeaToplineText, compactLayout && styles.feedIdeaToplineTextCompact, { color: theme.color.muted }]}>{typeLabel} · {pack}</AppText>
        <AppText numberOfLines={1} style={[styles.feedIdeaToplineRight, compactLayout && styles.feedIdeaToplineRightCompact, { color: theme.color.text }]}>{t('trade.feedIdeas.ideaLabel')}</AppText>
      </View>

      <View style={[styles.feedIdeaSideBlock, compactLayout && styles.feedIdeaSideBlockCompact]}>
        <AppText style={[styles.feedIdeaSideEyebrow, compactLayout && styles.feedIdeaSideEyebrowCompact, { color: '#60A5FA' }]}>{t('trade.labels.iNeed')}</AppText>
        <AppText numberOfLines={2} style={[styles.feedIdeaSideTitle, compactLayout && styles.feedIdeaSideTitleCompact, { color: theme.color.text }]}>{need}</AppText>
        <AppText numberOfLines={1} style={[styles.feedIdeaSideMeta, compactLayout && styles.feedIdeaSideMetaCompact, { color: theme.color.muted }]}>{t(`trade.feedIdeas.items.${ideaKey}.needMeta`)}</AppText>
      </View>

      <View style={[styles.feedIdeaExchangeRow, compactLayout && styles.feedIdeaExchangeRowCompact]} accessibilityLabel={t('trade.feedIdeas.sidesLabel')}>
        <View style={[styles.feedIdeaExchangeLine, { backgroundColor: theme.color.border }]} />
        <TradeExchangeIcon color={theme.color.muted} size={compactLayout ? 14 : 16} strokeWidth={2.2} />
        <View style={[styles.feedIdeaExchangeLine, { backgroundColor: theme.color.border }]} />
      </View>

      <View style={[styles.feedIdeaSideBlock, compactLayout && styles.feedIdeaSideBlockCompact]}>
        <AppText style={[styles.feedIdeaSideEyebrow, compactLayout && styles.feedIdeaSideEyebrowCompact, { color: '#34D399' }]}>{t('trade.labels.iOffer')}</AppText>
        <AppText numberOfLines={2} style={[styles.feedIdeaSideTitle, compactLayout && styles.feedIdeaSideTitleCompact, { color: theme.color.text }]}>{offer}</AppText>
        <AppText numberOfLines={1} style={[styles.feedIdeaSideMeta, compactLayout && styles.feedIdeaSideMetaCompact, { color: theme.color.muted }]}>{t(`trade.feedIdeas.items.${ideaKey}.offerMeta`)}</AppText>
      </View>

      <View style={[styles.feedIdeaFooter, compactLayout && styles.feedIdeaFooterCompact]}>
        <AppText numberOfLines={1} style={[styles.feedIdeaActionText, compactLayout && styles.feedIdeaActionTextCompact, { color: theme.color.text }]}>{actionLabel}</AppText>
      </View>
    </Pressable>
  );
}


function TradeFeedInlineIdeaCard({ ideaKey, onOpenIdea }: { ideaKey: FeedTradeIdeaKey; onOpenIdea: (ideaKey: FeedTradeIdeaKey) => void }) {
  return <TradeFeedIdeaCard ideaKey={ideaKey} onOpenIdea={onOpenIdea} inline />;
}


type TradeActivityModalProps = {
  activeTab: TradeActivityTab;
  visible: boolean;
  onChangeTab: (tab: TradeActivityTab) => void;
  onClose: () => void;
  onCreate: () => void;
  onOpenTrade: (trade: TradeWithCounts) => void;
  onOpenProposals: (trade: TradeWithCounts) => void;
  onOpenProposal: (proposalId: string) => void;
};

function TradeActivityModal({ activeTab, visible, onChangeTab, onClose, onCreate, onOpenTrade, onOpenProposals, onOpenProposal }: TradeActivityModalProps) {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 720;
  const { t } = useTranslation();
  const scrollProps = useMemo<AppCollapsibleHeaderScrollProps>(() => ({
    scrollViewProps: {
      onScroll: () => undefined,
      scrollEventThrottle: 16,
    },
    contentInsetStyle: styles.activityContentInset,
    contentTopInset: 0,
  }), []);

  return (
    <Modal visible={visible} animationType={isWideLayout ? "fade" : "slide"} onRequestClose={onClose} presentationStyle={isWideLayout ? "overFullScreen" : "fullScreen"} transparent={isWideLayout}>
      <View style={isWideLayout ? styles.modalDesktopBackdrop : styles.modalPlainRoot}>
        <View style={[styles.activityModalScreen, { backgroundColor: theme.color.background, paddingTop: isWideLayout ? 18 : insets.top + 18, paddingBottom: isWideLayout ? 18 : Math.max(insets.bottom, 10) }, isWideLayout && [styles.activityModalSheet, { borderColor: theme.color.border }]] }>
          <View style={styles.activityHeaderRow}>
          <View style={styles.activityHeaderCopy}>
            <AppText style={styles.activityTitle}>{t('trade.activity.title')}</AppText>
            <AppText style={[styles.activityBody, { color: theme.color.muted }]}>{t('trade.activity.body')}</AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('trade.activity.close')} onPress={onClose} style={({ pressed }) => [styles.toolsCloseButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
            <MobileIcon name="close" size={18} color={theme.color.text} />
          </Pressable>
        </View>
        <View style={[styles.activityTabs, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          {(['mine', 'involved'] as const).map((tab) => {
            const selected = activeTab === tab;
            return (
              <Pressable key={tab} accessibilityRole="button" onPress={() => onChangeTab(tab)} style={({ pressed }) => [styles.activityTab, selected && { backgroundColor: theme.semantic.trade.bg }, pressed && styles.pressed]}>
                <AppText style={[styles.activityTabText, { color: selected ? theme.semantic.trade.onBg : theme.color.muted }]}>{tab === 'mine' ? t('trade.mine.myTradesTab') : t('trade.involved.tab')}</AppText>
              </Pressable>
            );
          })}
        </View>
          <View style={styles.activityBodyWrap}>
            {activeTab === 'mine' ? (
              <MyCreatedTradesPanel scrollProps={scrollProps} onCreate={onCreate} onOpenTrade={onOpenTrade} onOpenProposals={onOpenProposals} />
            ) : (
              <InvolvedTradesPanel scrollProps={scrollProps} onOpenTrade={onOpenTrade} onOpenProposal={onOpenProposal} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}


export function TradeFiltersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TradeFilters'>>();
  const auth = useAuth();
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const incoming = route.params;
  const [query, setQuery] = useState(() => normalizeSearchText(incoming?.q ?? ''));
  const [modeFilter, setModeFilter] = useState<ModeFilter>(incoming?.mode ?? 'all');
  const [postTypeFilter, setPostTypeFilter] = useState<PostTypeFilter>(incoming?.postType ?? 'all');
  const [category, setCategory] = useState(incoming?.category ?? '');
  const [imagesOnly, setImagesOnly] = useState(Boolean(incoming?.hasImages));
  const [moneyOnly, setMoneyOnly] = useState(betaFeatures.moneyTradesEnabled && Boolean(incoming?.hasMoney));
  const [suggestions, setSuggestions] = useState<TradeSearchSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const normalizedQuery = normalizeSearchText(query);
  const activeFilterCount = [
    normalizedQuery || undefined,
    modeFilter === 'all' ? undefined : modeFilter,
    postTypeFilter === 'all' ? undefined : postTypeFilter,
    category.trim() || undefined,
    imagesOnly || undefined,
    betaFeatures.moneyTradesEnabled ? (moneyOnly || undefined) : undefined,
  ].filter(Boolean).length;

  useEffect(() => {
    if (!canUseSearchSuggestions(normalizedQuery)) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await api.tradeSearch.suggestions({ q: normalizedQuery, language, countryCode: auth.user?.profile?.countryCode ?? undefined, take: 8 }) as { suggestions?: TradeSearchSuggestion[] };
        if (!cancelled) setSuggestions(response.suggestions ?? []);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [auth.user?.profile?.countryCode, language, normalizedQuery]);

  function reset() {
    setQuery('');
    setModeFilter('all');
    setPostTypeFilter('all');
    setCategory('');
    setImagesOnly(false);
    setMoneyOnly(false);
    setSuggestions([]);
  }

  function apply(source: TradeSearchKeywordSource = 'submitted', queryOverride?: string) {
    const nextQuery = normalizeSearchText(queryOverride ?? query);
    navigation.navigate('TradeTabs', {
      screen: 'TradeTab',
      params: {
        q: nextQuery || undefined,
        mode: modeFilter === 'all' ? undefined : modeFilter,
        postType: postTypeFilter === 'all' ? undefined : postTypeFilter,
        category: category.trim() || undefined,
        hasImages: imagesOnly || undefined,
        hasMoney: betaFeatures.moneyTradesEnabled ? (moneyOnly || undefined) : undefined,
        applyKey: Date.now(),
        searchSource: canUseSearchSuggestions(nextQuery) ? source : undefined,
      },
    });
  }

  function selectSuggestion(value: string) {
    const normalized = normalizeSearchText(value);
    setQuery(normalized);
    apply('suggestion_clicked', normalized);
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('trade.filters.filters')} onBack={() => navigation.goBack()} />}>
      <KeyboardAvoidingView style={styles.tradeFilterScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.tradeFilterPageContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.toolsSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }] }>
            <View style={styles.toolsSectionHeader}>
              <MobileIcon name="search" size={18} color={theme.color.text} />
              <AppText style={styles.filterTitle}>{t('trade.filters.searchTrades')}</AppText>
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('trade.filters.searchPlaceholder')}
              placeholderTextColor={theme.color.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => apply('submitted')}
              style={[styles.searchInput, { backgroundColor: theme.color.background, borderColor: theme.color.border, color: theme.color.text }]}
            />
            <TradeSearchSuggestionList query={query} suggestions={suggestions} loading={suggestionsLoading} onSelect={selectSuggestion} />
          </View>

          <View style={[styles.toolsSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }] }>
            <View style={styles.toolsSectionHeader}>
              <MobileIcon name="filter" size={18} color={theme.color.text} />
              <AppText style={styles.filterTitle}>{t('trade.filters.filters')}</AppText>
            </View>

            <View style={styles.filterPanel}>
              <View style={styles.filterGroup}>
                <AppText style={[styles.filterLabel, { color: theme.color.muted }]}>{t('trade.filters.mode')}</AppText>
                <View style={styles.chipRow}>
                  {modeOptions.map((option) => {
                    const selected = modeFilter === option.value;
                    return (
                      <Pressable key={option.value} onPress={() => setModeFilter(option.value)} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.background, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.trade.bg, borderColor: theme.semantic.trade.bg }, pressed && styles.pressed]}>
                        <AppText style={[styles.filterChipText, { color: selected ? theme.semantic.trade.onBg : theme.color.muted }]}>{t(option.labelKey)}</AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <AppText style={[styles.filterLabel, { color: theme.color.muted }]}>{t('trade.filters.postType')}</AppText>
                <View style={styles.chipRow}>
                  {postTypeOptions.map((option) => {
                    const selected = postTypeFilter === option.value;
                    return (
                      <Pressable key={option.value} onPress={() => setPostTypeFilter(option.value)} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.background, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.trade.bg, borderColor: theme.semantic.trade.bg }, pressed && styles.pressed]}>
                        <AppText style={[styles.filterChipText, { color: selected ? theme.semantic.trade.onBg : theme.color.muted }]}>{t(option.labelKey)}</AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <AppText style={[styles.filterLabel, { color: theme.color.muted }]}>{t('trade.filters.category')}</AppText>
                <TextInput
                  value={category}
                  onChangeText={setCategory}
                  placeholder={t('inventory.form.categoryNeedPlaceholder')}
                  placeholderTextColor={theme.color.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.categoryInput, { backgroundColor: theme.color.background, borderColor: theme.color.border, color: theme.color.text }]}
                />
              </View>

              <View style={styles.chipRow}>
                <Pressable onPress={() => setImagesOnly((current) => !current)} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.background, borderColor: theme.color.border }, imagesOnly && { backgroundColor: theme.semantic.trade.bg, borderColor: theme.semantic.trade.bg }, pressed && styles.pressed]}>
                  <AppText style={[styles.filterChipText, { color: imagesOnly ? theme.semantic.trade.onBg : theme.color.muted }]}>{t('trade.filters.hasImages')}</AppText>
                </Pressable>
                {betaFeatures.moneyTradesEnabled ? (
                  <Pressable onPress={() => setMoneyOnly((current) => !current)} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.background, borderColor: theme.color.border }, moneyOnly && { backgroundColor: theme.semantic.trade.bg, borderColor: theme.semantic.trade.bg }, pressed && styles.pressed]}>
                    <AppText style={[styles.filterChipText, { color: moneyOnly ? theme.semantic.trade.onBg : theme.color.muted }]}>{t('trade.filters.walletAmount')}</AppText>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.toolsBottomBar, { backgroundColor: theme.color.background, borderTopColor: theme.color.border, paddingBottom: Math.max(10, insets.bottom + 8) }] }>
          <Pressable accessibilityRole="button" disabled={activeFilterCount === 0} onPress={reset} style={({ pressed }) => [styles.toolsSecondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border, opacity: activeFilterCount === 0 ? 0.5 : 1 }, pressed && activeFilterCount > 0 && styles.pressed]}>
            <AppText style={[styles.toolsSecondaryButtonText, { color: theme.color.text }]}>{t('trade.filters.reset')}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => apply('submitted')} style={({ pressed }) => [styles.toolsPrimaryButton, { backgroundColor: theme.semantic.trade.bg }, pressed && styles.pressed]}>
            <AppText style={[styles.toolsPrimaryButtonText, { color: theme.semantic.trade.onBg }]}>{t('trade.filters.apply')}</AppText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AppFixedHeaderScreen>
  );
}


function getSuggestionSourceLabel(source: TradeSearchSuggestion['source'], t: ReturnType<typeof useTranslation>['t']) {
  if (source === 'category') return t('trade.filters.suggestionSourceCategory');
  if (source === 'tag') return t('trade.filters.suggestionSourceTag');
  return t('trade.filters.suggestionSourcePopular');
}

function TradeSearchSuggestionList({ query, suggestions, loading, onSelect }: { query: string; suggestions: TradeSearchSuggestion[]; loading: boolean; onSelect: (query: string) => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  if (!canUseSearchSuggestions(query)) return null;

  return (
    <View style={[styles.suggestionsBox, { backgroundColor: theme.color.background, borderColor: theme.color.border }]}>
      <AppText style={[styles.suggestionsTitle, { color: theme.color.muted }]}>{t('trade.filters.suggestions')}</AppText>
      {loading && suggestions.length === 0 ? <AppText style={[styles.suggestionsEmpty, { color: theme.color.muted }]}>{t('common.states.loading')}</AppText> : null}
      {!loading && suggestions.length === 0 ? <AppText style={[styles.suggestionsEmpty, { color: theme.color.muted }]}>{t('trade.filters.noSuggestions')}</AppText> : null}
      {suggestions.map((suggestion) => (
        <Pressable key={`${suggestion.source}:${suggestion.query}`} accessibilityRole="button" onPress={() => onSelect(suggestion.query)} style={({ pressed }) => [styles.suggestionRow, { backgroundColor: theme.color.surface }, pressed && styles.pressed]}>
          <AppText numberOfLines={1} style={[styles.suggestionText, { color: theme.color.text }]}>{suggestion.query}</AppText>
          <AppText style={[styles.suggestionSource, { color: theme.color.muted }]}>{getSuggestionSourceLabel(suggestion.source, t)}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function formatMineDate(value: string | null | undefined, language: SupportedLanguage) {
  if (!value) return null;
  const formatted = formatLocalizedShortDate(value, language, '');
  return formatted || null;
}

function formatTradeStatusLabel(status: string | undefined, t: ReturnType<typeof useTranslation>['t']) {
  const normalized = status || 'active';
  const label = t(`trade.statuses.${normalized}`);
  return label === `trade.statuses.${normalized}` ? normalized.replace(/_/g, ' ') : label;
}

function getMineTradeTitle(trade: TradeWithCounts) {
  if ((trade.postType === 'open_need' || (!trade.offer && trade.need)) && trade.need?.title) return trade.need.title;
  if ((trade.postType === 'open_offer' || (!trade.need && trade.offer)) && trade.offer?.title) return trade.offer.title;
  if (trade.need?.title && trade.offer?.title) return `${trade.need.title} ↔ ${trade.offer.title}`;
  return trade.title;
}

function getMineTradeTypeLabel(trade: TradeWithCounts, t: ReturnType<typeof useTranslation>['t']) {
  if (trade.postType === 'open_need' || (!trade.offer && trade.need)) return t('trade.postTypes.openNeed');
  if (trade.postType === 'open_offer' || (!trade.need && trade.offer)) return t('trade.postTypes.openOffer');
  return t('trade.postTypes.needOfferExchange');
}

function normalizeMineResponse(value: unknown): TradeWithCounts[] {
  if (Array.isArray(value)) return value as TradeWithCounts[];
  if (value && typeof value === 'object' && Array.isArray((value as { trades?: unknown[] }).trades)) return (value as { trades: TradeWithCounts[] }).trades;
  return [];
}

function MyCreatedTradesPanel({ scrollProps, onCreate, onOpenTrade, onOpenProposals }: { scrollProps: AppCollapsibleHeaderScrollProps; onCreate: () => void; onOpenTrade: (trade: TradeWithCounts) => void; onOpenProposals: (trade: TradeWithCounts) => void }) {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t } = useTranslation();
  const [trades, setTrades] = useState<TradeWithCounts[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tradeToClose, setTradeToClose] = useState<TradeWithCounts | null>(null);

  const loadMine = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.mine({ scope: 'created' }) as MineResponse;
      setTrades(normalizeMineResponse(result));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [auth.isAuthenticated]);

  const replaceTrade = useCallback((updatedTrade: TradeWithCounts) => {
    setTrades((current) => current.map((trade) => trade.id === updatedTrade.id ? { ...trade, ...updatedTrade, _count: trade._count ?? updatedTrade._count } : trade));
  }, []);

  const renewTrade = useCallback(async (trade: TradeWithCounts) => {
    if (!isTradeOwnerRenewAllowed(trade)) return;
    setBusyTradeId(trade.id);
    setNotice(null);
    try {
      const result = await api.trades.renew(trade.id) as { trade?: TradeWithCounts };
      if (result.trade) replaceTrade(result.trade);
      setNotice(t('trade.mine.renewedNotice'));
    } catch (caughtError) {
      setNotice(getFriendlyApiErrorMessage(caughtError) || t('trade.mine.renewError'));
    } finally {
      setBusyTradeId(null);
    }
  }, [replaceTrade, t]);

  const closeTrade = useCallback((trade: TradeWithCounts) => {
    if (!isTradeOwnerCloseAllowed(trade)) return;
    setTradeToClose(trade);
  }, []);

  const confirmCloseTrade = useCallback(async () => {
    const trade = tradeToClose;
    if (!trade) return;
    setTradeToClose(null);
    setBusyTradeId(trade.id);
    setNotice(null);
    try {
      const result = await api.trades.close(trade.id) as { trade?: TradeWithCounts };
      if (result.trade) replaceTrade(result.trade);
      setNotice(t('trade.mine.closedNotice'));
    } catch (caughtError) {
      setNotice(getFriendlyApiErrorMessage(caughtError) || t('trade.mine.closeError'));
    } finally {
      setBusyTradeId(null);
    }
  }, [replaceTrade, t, tradeToClose]);

  useFocusEffect(useCallback(() => { void loadMine(); }, [loadMine]));

  const visibleTrades = useMemo(() => {
    if (statusFilter === 'all') return trades;
    if (statusFilter === 'with_proposals') return trades.filter((trade) => (trade._count?.proposals ?? 0) > 0);
    return trades.filter((trade) => trade.status === statusFilter);
  }, [statusFilter, trades]);

  if (!auth.isAuthenticated) {
    return (
      <ScrollView {...scrollProps.scrollViewProps} contentContainerStyle={[scrollProps.contentInsetStyle, styles.content]} showsVerticalScrollIndicator={false}>
        <AppCard style={styles.authMineCard}>
          <SemanticBadge label={t('trade.mine.myTradesTab')} tone="trade" />
          <AppText style={styles.emptyTitle}>{t('trade.mine.loginTitle')}</AppText>
          <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{t('trade.mine.loginBody')}</AppText>
        </AppCard>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView {...scrollProps.scrollViewProps} contentContainerStyle={[scrollProps.contentInsetStyle, styles.content]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMine} />}>
        <AppCard style={styles.mineHeaderCard}>
          <View style={styles.mineHeaderCopy}>
            <SemanticBadge label={t('trade.mine.ownerArea')} tone="trade" />
            <AppText style={styles.mineTitle}>{t('trade.mine.title')}</AppText>
            <AppText style={[styles.mineBody, { color: theme.color.muted }]}>{t('trade.mine.body')}</AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.mineCreateButton, { backgroundColor: theme.semantic.trade.bg }, pressed && styles.pressed]}>
            <MobileIcon name="add" size={18} color={theme.semantic.trade.onBg} />
            <AppText style={[styles.mineCreateButtonText, { color: theme.semantic.trade.onBg }]}>{t('trade.create.title')}</AppText>
          </Pressable>
        </AppCard>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mineFilterRow}>
          {['all', 'active', 'with_proposals', 'in_progress', 'expired', 'closed'].map((status) => {
            const selected = statusFilter === status;
            const label = status === 'all' ? t('trade.mine.filterAll') : status === 'with_proposals' ? t('trade.mine.filterWithProposals') : t(`trade.statuses.${status}`);
            return (
              <Pressable key={status} accessibilityRole="button" onPress={() => setStatusFilter(status)} style={({ pressed }) => [styles.mineFilterChip, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.trade.bg, borderColor: theme.semantic.trade.bg }, pressed && styles.pressed]}>
                <AppText style={[styles.mineFilterChipText, { color: selected ? theme.semantic.trade.onBg : theme.color.muted }]}>{label}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {notice ? <InfoNotice tone="info" title={t('trade.mine.ownerArea')} body={notice} /> : null}
        {error ? <InfoNotice tone="danger" title={t('trade.mine.couldNotLoad')} body={error} /> : null}
        {!error && !loading && visibleTrades.length === 0 ? <MyCreatedTradesEmpty hasFilter={statusFilter !== 'all'} onCreate={onCreate} /> : null}
        {visibleTrades.length ? <View style={styles.mineList}>{visibleTrades.map((trade) => <MyCreatedTradeRow key={trade.id} trade={trade} busy={busyTradeId === trade.id} onOpen={() => onOpenTrade(trade)} onOpenProposals={() => onOpenProposals(trade)} onRenew={() => renewTrade(trade)} onClose={() => closeTrade(trade)} />)}</View> : null}
      </ScrollView>
      <AppConfirmSheet
        visible={Boolean(tradeToClose)}
        title={t('trade.mine.close')}
        body={t('trade.mine.closeConfirm')}
        cancelLabel={t('common.actions.cancel')}
        confirmLabel={t('trade.mine.close')}
        tone="danger"
        confirmDisabled={Boolean(busyTradeId)}
        onCancel={() => setTradeToClose(null)}
        onConfirm={() => { void confirmCloseTrade(); }}
      />
    </>
  );
}

function MyCreatedTradeRow({ trade, busy, onOpen, onOpenProposals, onRenew, onClose }: { trade: TradeWithCounts; busy: boolean; onOpen: () => void; onOpenProposals: () => void; onRenew: () => void; onClose: () => void }) {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const proposalCount = trade._count?.proposals ?? 0;
  const expiresLabel = formatMineDate(trade.expiresAt, language) ?? t('trade.mine.noExpiry');
  const visibilityState = getTradeOwnerVisibilityState(trade);
  const canRenew = isTradeOwnerRenewAllowed(trade);
  const canClose = isTradeOwnerCloseAllowed(trade);

  return (
    <View style={[styles.mineRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={[styles.mineRowIcon, { backgroundColor: theme.color.subtleSurface }]}><MobileIcon name="trade" size={18} color={theme.color.text} /></View>
      <View style={styles.mineRowBody}>
        <View style={styles.mineRowBadges}>
          <SemanticBadge label={getMineTradeTypeLabel(trade, t)} tone="trade" />
          <SemanticBadge label={formatTradeStatusLabel(trade.status, t)} tone="muted" />
          <SemanticBadge label={t(`trade.mine.visibility.${visibilityState}`)} tone={visibilityState === 'review_or_hidden' ? 'warning' : visibilityState === 'public' ? 'success' : 'info'} />
        </View>
        <AppText numberOfLines={2} style={styles.mineRowTitle}>{getMineTradeTitle(trade)}</AppText>
        <AppText style={[styles.mineRowMeta, { color: theme.color.muted }]}>{t('trade.mine.rowMeta', { proposals: proposalCount, expiry: expiresLabel })}</AppText>
        <View style={styles.mineRowActions}>
          <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.mineActionButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.mineActionButtonText, { color: theme.color.text }]}>{t('trade.mine.openDetail')}</AppText></Pressable>
          {proposalCount > 0 ? <Pressable accessibilityRole="button" onPress={onOpenProposals} style={({ pressed }) => [styles.mineActionButton, { backgroundColor: theme.semantic.info.softBg, borderColor: theme.semantic.info.border }, pressed && styles.pressed]}><AppText style={[styles.mineActionButtonText, { color: theme.semantic.info.text }]}>{t('trade.mine.openProposals')}</AppText></Pressable> : null}
          {canRenew ? <Pressable accessibilityRole="button" disabled={busy} onPress={onRenew} style={({ pressed }) => [styles.mineActionButton, { backgroundColor: theme.semantic.trade.bg, borderColor: theme.semantic.trade.bg }, (pressed || busy) && styles.pressed]}><AppText style={[styles.mineActionButtonText, { color: theme.semantic.trade.onBg }]}>{busy ? t('common.states.saving') : t('trade.mine.renew')}</AppText></Pressable> : null}
          {canClose ? <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={({ pressed }) => [styles.mineActionButton, { backgroundColor: theme.semantic.danger.softBg, borderColor: theme.semantic.danger.border }, (pressed || busy) && styles.pressed]}><AppText style={[styles.mineActionButtonText, { color: theme.semantic.danger.text }]}>{busy ? t('common.states.saving') : t('trade.mine.close')}</AppText></Pressable> : null}
        </View>
      </View>
    </View>
  );
}

function MyCreatedTradesEmpty({ hasFilter, onCreate }: { hasFilter: boolean; onCreate: () => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <AppCard>
      <View style={styles.emptyBox}>
        <SemanticBadge label={t('trade.mine.myTradesTab')} tone="trade" />
        <AppText style={styles.emptyTitle}>{hasFilter ? t('trade.mine.emptyFilteredTitle') : t('trade.mine.emptyTitle')}</AppText>
        <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{hasFilter ? t('trade.mine.emptyFilteredBody') : t('trade.mine.emptyBody')}</AppText>
        <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.emptyPrimaryButton, { backgroundColor: theme.semantic.trade.bg }, pressed && styles.pressed]}><AppText style={[styles.emptyPrimaryButtonText, { color: theme.semantic.trade.onBg }]}>{t('trade.create.title')}</AppText></Pressable>
      </View>
    </AppCard>
  );
}

function InvolvedTradesPanel({ scrollProps, onOpenTrade, onOpenProposal }: { scrollProps: AppCollapsibleHeaderScrollProps; onOpenTrade: (trade: TradeWithViewerProposal) => void; onOpenProposal: (proposalId: string) => void }) {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t } = useTranslation();
  const [trades, setTrades] = useState<TradeWithViewerProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadInvolved = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.mine({ scope: 'involved' }) as { trades?: TradeWithViewerProposal[] };
      setTrades(Array.isArray(result.trades) ? result.trades : []);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.involved.loadError')));
    } finally {
      setLoading(false);
    }
  }, [auth.isAuthenticated, t]);

  useFocusEffect(useCallback(() => { if (auth.isAuthenticated) void loadInvolved(); }, [auth.isAuthenticated, loadInvolved]));

  const visibleTrades = useMemo(() => {
    if (statusFilter === 'all') return trades;
    if (['pending', 'accepted', 'declined', 'withdrawn'].includes(statusFilter)) return trades.filter((trade) => trade.viewerProposal?.status === statusFilter);
    return trades.filter((trade) => trade.status === statusFilter);
  }, [statusFilter, trades]);

  if (!auth.isAuthenticated) {
    return (
      <ScrollView {...scrollProps.scrollViewProps} contentContainerStyle={[scrollProps.contentInsetStyle, styles.content]} showsVerticalScrollIndicator={false}>
        <AppCard style={styles.authMineCard}>
          <SemanticBadge label={t('trade.involved.tab')} tone="trade" />
          <AppText style={styles.emptyTitle}>{t('trade.involved.loginTitle')}</AppText>
          <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{t('trade.involved.loginBody')}</AppText>
        </AppCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView {...scrollProps.scrollViewProps} contentContainerStyle={[scrollProps.contentInsetStyle, styles.content]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadInvolved} />}>
      <AppCard style={styles.mineHeaderCard}>
        <View style={styles.mineHeaderCopy}>
          <SemanticBadge label={t('trade.involved.badge')} tone="trade" />
          <AppText style={styles.mineTitle}>{t('trade.involved.title')}</AppText>
          <AppText style={[styles.mineBody, { color: theme.color.muted }]}>{t('trade.involved.body')}</AppText>
        </View>
      </AppCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mineFilterRow}>
        {['all', 'pending', 'accepted', 'declined', 'withdrawn', 'in_progress', 'completed'].map((status) => {
          const selected = statusFilter === status;
          const label = status === 'all' ? t('trade.mine.filterAll') : ['pending', 'accepted', 'declined', 'withdrawn'].includes(status) ? t(`trade.proposals.status.${status}`) : t(`trade.statuses.${status}`);
          return (
            <Pressable key={status} accessibilityRole="button" onPress={() => setStatusFilter(status)} style={({ pressed }) => [styles.mineFilterChip, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.trade.bg, borderColor: theme.semantic.trade.bg }, pressed && styles.pressed]}>
              <AppText style={[styles.mineFilterChipText, { color: selected ? theme.semantic.trade.onBg : theme.color.muted }]}>{label}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <InfoNotice tone="danger" title={t('trade.involved.couldNotLoad')} body={error} /> : null}
      {!error && !loading && visibleTrades.length === 0 ? <InvolvedTradesEmpty hasFilter={statusFilter !== 'all'} /> : null}
      {visibleTrades.length ? <View style={styles.mineList}>{visibleTrades.map((trade) => <InvolvedTradeRow key={trade.id} trade={trade} onOpen={() => onOpenTrade(trade)} onOpenProposal={() => trade.viewerProposal?.id ? onOpenProposal(trade.viewerProposal.id) : undefined} />)}</View> : null}
    </ScrollView>
  );
}

function InvolvedTradeRow({ trade, onOpen, onOpenProposal }: { trade: TradeWithViewerProposal; onOpen: () => void; onOpenProposal: () => void }) {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const proposal = trade.viewerProposal;
  const proposalStatus = proposal?.status ?? (trade.viewerInvolvement === 'provider' ? 'accepted' : 'pending');
  const proposalDate = formatMineDate(proposal?.createdAt, language) ?? t('trade.involved.unknownDate');
  const proposalStatusLabel = t(`trade.proposals.status.${proposalStatus}`);
  const proposalStatusMetaLabel = language === 'fr' ? proposalStatusLabel.toLocaleLowerCase('fr-FR') : proposalStatusLabel;

  return (
    <View style={[styles.mineRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={[styles.mineRowIcon, { backgroundColor: theme.color.subtleSurface }]}><MobileIcon name="trade" size={18} color={theme.color.text} /></View>
      <View style={styles.mineRowBody}>
        <View style={styles.mineRowBadges}>
          <SemanticBadge label={getMineTradeTypeLabel(trade, t)} tone="trade" />
          <SemanticBadge label={formatTradeStatusLabel(trade.status, t)} tone="muted" />
          <SemanticBadge label={proposalStatusLabel} tone="info" />
        </View>
        <AppText numberOfLines={2} style={styles.mineRowTitle}>{getMineTradeTitle(trade)}</AppText>
        <AppText style={[styles.mineRowMeta, { color: theme.color.muted }]}>{t('trade.involved.rowMeta', { status: proposalStatusMetaLabel, date: proposalDate })}</AppText>
        <View style={styles.mineRowActions}>
          <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.mineActionButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.mineActionButtonText, { color: theme.color.text }]}>{t('trade.mine.openDetail')}</AppText></Pressable>
          {proposal?.id ? <Pressable accessibilityRole="button" onPress={onOpenProposal} style={({ pressed }) => [styles.mineActionButton, { backgroundColor: theme.semantic.info.softBg, borderColor: theme.semantic.info.border }, pressed && styles.pressed]}><AppText style={[styles.mineActionButtonText, { color: theme.semantic.info.text }]}>{t('trade.involved.openThread')}</AppText></Pressable> : null}
        </View>
      </View>
    </View>
  );
}

function InvolvedTradesEmpty({ hasFilter }: { hasFilter: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <AppCard>
      <View style={styles.emptyBox}>
        <SemanticBadge label={t('trade.involved.tab')} tone="trade" />
        <AppText style={styles.emptyTitle}>{hasFilter ? t('trade.involved.emptyFilteredTitle') : t('trade.involved.emptyTitle')}</AppText>
        <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{hasFilter ? t('trade.involved.emptyFilteredBody') : t('trade.involved.emptyBody')}</AppText>
      </View>
    </AppCard>
  );
}

const TradeDeckSection = React.memo(function TradeDeckSection({ trade, index, total, onOpenTrade }: { trade: TradeDeckItem; index: number; total: number; onOpenTrade: (trade: TradeDeckItem) => void }) {
  const handleOpen = useCallback(() => onOpenTrade(trade), [onOpenTrade, trade]);
  return <TradeSquareDeck trade={trade} index={index} total={total} onOpen={handleOpen} />;
});

function TradeFeedLoadingState() {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={styles.feedLoadingState}>
      <ActivityIndicator color={theme.color.text} />
      <AppText style={[styles.feedLoadingText, { color: theme.color.muted }]}>{t('trade.filters.loadingTrades')}</AppText>
    </View>
  );
}

function EmptyTradesState({ hasTrades, hasFilters, onCreate, onRefresh, onClear }: { hasTrades: boolean; hasFilters: boolean; onCreate: () => void; onRefresh: () => void; onClear: () => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const title = hasFilters ? t('trade.filters.noMatches') : t('trade.filters.noTradesYet');
  const body = hasFilters ? t('trade.filters.noTradesBody') : t('trade.filters.emptyBody');

  return (
    <AppCard>
      <View style={styles.emptyBox}>
        <SemanticBadge label={hasTrades ? t('common.actions.search') : t('trade.filters.noActiveTrades')} tone="info" />
        <AppText style={styles.emptyTitle}>{title}</AppText>
        <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{body}</AppText>
        <View style={styles.emptyActions}>
          {hasFilters ? <Pressable accessibilityRole="button" onPress={onClear} style={({ pressed }) => [styles.emptyPrimaryButton, { backgroundColor: theme.semantic.trade.bg }, pressed && styles.pressed]}><AppText style={[styles.emptyPrimaryButtonText, { color: theme.semantic.trade.onBg }]}>{t('trade.filters.clearFilters')}</AppText></Pressable> : <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.emptyPrimaryButton, { backgroundColor: theme.semantic.trade.bg }, pressed && styles.pressed]}><AppText style={[styles.emptyPrimaryButtonText, { color: theme.semantic.trade.onBg }]}>{t('trade.create.title')}</AppText></Pressable>}
          <Pressable accessibilityRole="button" onPress={onRefresh} style={({ pressed }) => [styles.emptySecondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.emptySecondaryButtonText, { color: theme.color.text }]}>{t('trade.filters.refresh')}</AppText></Pressable>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30, gap: 16 },
  modalPlainRoot: { flex: 1 },
  modalDesktopBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.28)', padding: 24 },
  fixedHeaderStack: { gap: 12 },
  activityContentInset: { paddingTop: 0 },
  activityModalScreen: { flex: 1, paddingHorizontal: 18 },
  activityModalSheet: { width: '100%', maxWidth: 620, height: '86%', borderRadius: 32, borderWidth: 1, paddingHorizontal: 18 },
  activityHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingBottom: 12 },
  activityHeaderCopy: { flex: 1, minWidth: 0, gap: 4 },
  activityTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  activityBody: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  activityTabs: { flexDirection: 'row', gap: 6, borderRadius: 999, borderWidth: 1, padding: 5, marginBottom: 12 },
  activityTab: { flex: 1, minHeight: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  activityTabText: { fontSize: 13, fontWeight: '900' },
  activityBodyWrap: { flex: 1, minHeight: 0 },
  feedIntroStack: { gap: 10, marginBottom: 4 },
  feedLoadingState: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  feedLoadingText: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  title: { ...PRIMARY_HEADER_TITLE_STYLE },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
  iconButtonText: { fontSize: 16, fontWeight: '900', lineHeight: 20 },
  createIconButtonText: { fontSize: 22, lineHeight: 24 },
  filterDot: { position: 'absolute', right: -3, top: -3, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterDotText: { fontSize: 10, fontWeight: '900' },
  searchInput: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontWeight: '700' },
  filterPanel: { gap: 14 },
  filterHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  filterTitle: { fontSize: 18, fontWeight: '900' },
  clearButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  clearButtonText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  filterGroup: { gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterCard: { padding: 14, borderRadius: 22 },
  filterChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  filterChipText: { fontSize: 13, fontWeight: '900' },
  categoryInput: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, fontWeight: '700' },
  suggestionsBox: { borderRadius: 18, borderWidth: 1, padding: 8, gap: 6 },
  suggestionsTitle: { paddingHorizontal: 4, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  suggestionsEmpty: { paddingHorizontal: 4, paddingVertical: 8, fontSize: 13, fontWeight: '800' },
  suggestionRow: { minHeight: 42, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  suggestionText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '900' },
  suggestionSource: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  feedList: { gap: MOBILE_DECK_FEED_GAP },
  feedIdeasCard: { gap: 16, paddingTop: 10 },
  feedIdeasHeader: { gap: 7, paddingHorizontal: 6, paddingBottom: 4 },
  feedIdeasTitle: { fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -0.5 },
  feedIdeasBody: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  feedIdeasList: { alignItems: 'center', gap: 16, paddingBottom: 6 },
  feedIdeaCard: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingVertical: 22,
    gap: 0,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  feedIdeaCardCompact: { paddingHorizontal: 18, paddingVertical: 15 },
  feedIdeaCardInline: { alignSelf: 'center' },
  feedIdeaPosterFrame: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  feedIdeaTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  feedIdeaToplineCompact: { gap: 8 },
  feedIdeaToplineText: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.95, textTransform: 'uppercase' },
  feedIdeaToplineTextCompact: { fontSize: 10, lineHeight: 12, letterSpacing: 0.65 },
  feedIdeaToplineRight: { maxWidth: '34%', flexShrink: 0, fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.65, textAlign: 'right', textTransform: 'uppercase' },
  feedIdeaToplineRightCompact: { maxWidth: '32%', fontSize: 10, lineHeight: 12, letterSpacing: 0.45 },
  feedIdeaSideBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 3, minHeight: 0 },
  feedIdeaSideBlockCompact: { gap: 2, paddingVertical: 0 },
  feedIdeaSideEyebrow: { ...DECK_CARD_TYPOGRAPHY.eyebrow },
  feedIdeaSideEyebrowCompact: { fontSize: 11, lineHeight: 14 },
  feedIdeaSideTitle: { textAlign: 'center', ...DECK_CARD_TYPOGRAPHY.title, paddingBottom: 1 },
  feedIdeaSideTitleCompact: { fontSize: 17, lineHeight: 20, letterSpacing: -0.35, paddingBottom: 0 },
  feedIdeaSideMeta: { textAlign: 'center', ...DECK_CARD_TYPOGRAPHY.meta },
  feedIdeaSideMetaCompact: { fontSize: 10.5, lineHeight: 13 },
  feedIdeaExchangeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 1 },
  feedIdeaExchangeRowCompact: { gap: 10, marginVertical: 0 },
  feedIdeaExchangeLine: { flex: 1, height: StyleSheet.hairlineWidth },
  feedIdeaFooter: { minHeight: 20, alignItems: 'center', justifyContent: 'center' },
  feedIdeaFooterCompact: { minHeight: 14 },
  feedIdeaActionText: { fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: 0.2 },
  feedIdeaActionTextCompact: { fontSize: 11, lineHeight: 14 },
  mineHeaderCard: { gap: 14 },
  mineHeaderCopy: { gap: 8 },
  mineTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  mineBody: { lineHeight: 21, fontWeight: '600' },
  mineCreateButton: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  mineCreateButtonText: { fontWeight: '900' },
  mineFilterRow: { gap: 8, paddingRight: 18 },
  mineFilterChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  mineFilterChipText: { fontSize: 13, fontWeight: '900' },
  mineList: { gap: 10 },
  mineRow: { minHeight: 104, borderRadius: 22, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mineRowIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mineRowBody: { flex: 1, minWidth: 0, gap: 7 },
  mineRowBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mineRowTitle: { fontSize: 17, lineHeight: 21, fontWeight: '900' },
  mineRowMeta: { fontSize: 12, fontWeight: '800' },
  mineRowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  mineActionButton: { minHeight: 34, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 7 },
  mineActionButtonText: { fontSize: 12, fontWeight: '900' },
  authMineCard: { alignItems: 'center', gap: 12 },
  emptyBox: { minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18 },
  emptyTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center' },
  emptyText: { lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  emptyPrimaryButton: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  emptyPrimaryButtonText: { fontWeight: '900' },
  emptySecondaryButton: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  emptySecondaryButtonText: { fontWeight: '900' },
  toolsKeyboardRoot: { flex: 1 },
  tradeFilterScreen: { flex: 1 },
  tradeFilterPageContent: { gap: 14, paddingTop: 14, paddingBottom: 24 },
  toolsModalScreen: { flex: 1, paddingHorizontal: 18 },
  toolsModalSheet: { width: '100%', maxWidth: 560, maxHeight: '88%', borderRadius: 32, borderWidth: 1, paddingHorizontal: 18 },
  toolsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingBottom: 16 },
  toolsTitleWrap: { flex: 1, minWidth: 0, gap: 4 },
  toolsTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  toolsSubtitle: { fontSize: 13, fontWeight: '800' },
  toolsCloseButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  toolsContent: { gap: 14, paddingBottom: 18 },
  toolsSection: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 11 },
  toolsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolsBottomBar: { borderTopWidth: 1, flexDirection: 'row', alignItems: 'stretch', gap: 10, paddingTop: 10 },
  toolsPrimaryButton: { flex: 1, minHeight: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  toolsPrimaryButtonText: { fontSize: 15, fontWeight: '900' },
  toolsSecondaryButton: { minWidth: 104, minHeight: 50, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  toolsSecondaryButtonText: { fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
