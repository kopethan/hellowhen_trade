import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ListTradesFeedQuery, TradeExchangeMode, TradePostType, TradeSearchKeywordSource, TradeSearchSuggestion } from '@hellowhen/contracts';
import { getTradeOwnerVisibilityState, isTradeOwnerCloseAllowed, isTradeOwnerRenewAllowed } from '@hellowhen/shared';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { betaFeatures } from '../../lib/betaFeatures';
import { AppCard } from '../../components/AppCard';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { AppCollapsibleHeaderScreen, type AppCollapsibleHeaderScrollProps } from '../../components/AppCollapsibleHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { TradeSquareDeck } from './components/TradeSquareDeck';
import type { TradeDeckItem } from './types';

type FeedResponse = { trades: TradeDeckItem[] };
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
  return (trade.need?.media?.length ?? 0) + (trade.offer?.media?.length ?? 0) > 0;
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

function buildFeedQuery(query: string, modeFilter: ModeFilter, postTypeFilter: PostTypeFilter, category: string, imagesOnly: boolean, moneyOnly: boolean, refreshSeed: string, seenTradeIds: string[], language: 'en' | 'fr', countryCode?: string | null): ListTradesFeedQuery {
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
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<TradeSearchSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [toolsModal, setToolsModal] = useState<'filters' | null>(null);
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [postTypeFilter, setPostTypeFilter] = useState<PostTypeFilter>('all');
  const [category, setCategory] = useState('');
  const [imagesOnly, setImagesOnly] = useState(false);
  const [moneyOnly, setMoneyOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(() => createFeedRefreshSeed());
  const [seenTradeIds, setSeenTradeIds] = useState<string[]>([]);
  const loadRequestIdRef = useRef(0);
  const pendingSearchRecordRef = useRef<{ q: string; source: TradeSearchKeywordSource } | null>(null);

  const feedQuery = useMemo(() => buildFeedQuery(query, modeFilter, postTypeFilter, category, imagesOnly, moneyOnly, refreshSeed, seenTradeIds, language, auth.user?.profile?.countryCode), [auth.user?.profile?.countryCode, category, imagesOnly, language, modeFilter, moneyOnly, postTypeFilter, query, refreshSeed, seenTradeIds]);
  const activeFilterCount = useMemo(() => [feedQuery.q, feedQuery.mode, feedQuery.postType, feedQuery.category, feedQuery.hasImages, betaFeatures.moneyTradesEnabled ? feedQuery.hasMoney : undefined].filter(Boolean).length, [feedQuery]);

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

  const loadFeed = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.feed(feedQuery) as FeedResponse;
      if (requestId !== loadRequestIdRef.current) return;
      const nextTrades = Array.isArray(result.trades) ? result.trades : [];
      setTrades(nextTrades);
      const pendingRecord = pendingSearchRecordRef.current;
      if (pendingRecord && normalizeSearchText(pendingRecord.q) === normalizeSearchText(feedQuery.q ?? '')) {
        pendingSearchRecordRef.current = null;
        void recordSearchKeyword(pendingRecord, nextTrades.length);
      }
    } catch (caughtError) {
      if (requestId !== loadRequestIdRef.current) return;
      setTrades([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, [feedQuery, recordSearchKeyword]);

  useFocusEffect(useCallback(() => { void loadFeed(); }, [loadFeed]));

  useEffect(() => {
    const handle = setTimeout(() => { void loadFeed(); }, 275);
    return () => clearTimeout(handle);
  }, [loadFeed]);

  useEffect(() => {
    const draft = normalizeSearchText(draftQuery);
    if (toolsModal === null || !canUseSearchSuggestions(draft)) {
      setSearchSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await api.tradeSearch.suggestions({ q: draft, language, countryCode: auth.user?.profile?.countryCode ?? undefined, take: 8 }) as { suggestions?: TradeSearchSuggestion[] };
        if (!cancelled) setSearchSuggestions(response.suggestions ?? []);
      } catch {
        if (!cancelled) setSearchSuggestions([]);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [auth.user?.profile?.countryCode, draftQuery, language, toolsModal]);

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
  const clearFilters = useCallback(() => {
    setQuery('');
    setDraftQuery('');
    setSearchSuggestions([]);
    pendingSearchRecordRef.current = null;
    setModeFilter('all');
    setPostTypeFilter('all');
    setCategory('');
    setImagesOnly(false);
    setMoneyOnly(false);
    setSeenTradeIds([]);
    setRefreshSeed(createFeedRefreshSeed());
  }, []);

  const applyDiscoveryTools = useCallback((source?: TradeSearchKeywordSource) => {
    const normalized = normalizeSearchText(draftQuery);
    if (source) queueSearchKeywordRecord(normalized, source);
    setQuery(normalized);
    setDraftQuery(normalized);
    setSeenTradeIds([]);
    setRefreshSeed(createFeedRefreshSeed());
    setToolsModal(null);
  }, [draftQuery, queueSearchKeywordRecord]);

  const applySuggestionSearch = useCallback((suggestionQuery: string) => {
    const normalized = normalizeSearchText(suggestionQuery);
    setDraftQuery(normalized);
    queueSearchKeywordRecord(normalized, 'suggestion_clicked');
    setQuery(normalized);
    setSeenTradeIds([]);
    setRefreshSeed(createFeedRefreshSeed());
    setToolsModal(null);
  }, [queueSearchKeywordRecord]);

  const hasTrades = trades.length > 0;
  const hasVisibleTrades = visibleTrades.length > 0;
  const hasFilters = activeFilterCount > 0;

  const header = (
    <View style={styles.fixedHeaderStack}>
      <View style={styles.headerRow}>
        <AppText style={styles.title}>{t('navigation.tabs.trades')}</AppText>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('trade.filters.searchAndFilters')} onPress={() => { setDraftQuery(query); setToolsModal('filters'); }} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, (toolsModal === 'filters' || hasFilters) && { backgroundColor: theme.semantic.info.softBg, borderColor: theme.semantic.info.border }, pressed && styles.pressed]}>
            <MobileIcon name="filter" size={18} color={(toolsModal === 'filters' || hasFilters) ? theme.semantic.info.text : theme.color.text} />
            {hasFilters ? <View style={styles.filterDot}><AppText style={styles.filterDotText}>{activeFilterCount}</AppText></View> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('trade.activity.open')} onPress={() => setActivityModalVisible(true)} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
            <MobileIcon name="activity" size={19} color={theme.color.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('trade.create.title')} onPress={createTrade} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}>
            <MobileIcon name="add" size={23} color={theme.color.background} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <AppCollapsibleHeaderScreen header={header} resetKey="discover">
      {(scrollProps) => (
        <>
          <ScrollView {...scrollProps.scrollViewProps} contentContainerStyle={[scrollProps.contentInsetStyle, styles.content]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshDiscoveryOrder} />}>
            {error ? <InfoNotice tone="danger" title={t('trade.filters.couldNotLoadTrades')} body={error} /> : null}
            {hasVisibleTrades ? (
              <View style={styles.feedList}>
                {visibleTrades.map((trade, index) => <TradeDeckSection key={trade.id} trade={trade} index={index} total={visibleTrades.length} onOpen={() => openTrade(trade)} />)}
              </View>
            ) : (
              <EmptyTradesState loading={loading} hasTrades={hasTrades} hasFilters={hasFilters} onCreate={createTrade} onRefresh={refreshDiscoveryOrder} onClear={clearFilters} />
            )}
          </ScrollView>
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
          <TradeDiscoveryToolsModal
            visible={toolsModal !== null}
            initialFocus={toolsModal ?? 'filters'}
            query={draftQuery}
            modeFilter={modeFilter}
            postTypeFilter={postTypeFilter}
            category={category}
            imagesOnly={imagesOnly}
            moneyOnly={moneyOnly}
            hasFilters={hasFilters}
            activeFilterCount={activeFilterCount}
            suggestions={searchSuggestions}
            suggestionsLoading={suggestionsLoading}
            onChangeQuery={setDraftQuery}
            onSelectSuggestion={applySuggestionSearch}
            onChangeMode={setModeFilter}
            onChangePostType={setPostTypeFilter}
            onChangeCategory={setCategory}
            onToggleImagesOnly={() => setImagesOnly((current) => !current)}
            onToggleMoneyOnly={() => setMoneyOnly((current) => !current)}
            onClear={clearFilters}
            onApply={() => applyDiscoveryTools('submitted')}
            onSubmitSearch={() => applyDiscoveryTools('submitted')}
            onClose={() => setToolsModal(null)}
          />
        </>
      )}
    </AppCollapsibleHeaderScreen>
  );
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
              <Pressable key={tab} accessibilityRole="button" onPress={() => onChangeTab(tab)} style={({ pressed }) => [styles.activityTab, selected && { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
                <AppText style={[styles.activityTabText, { color: selected ? theme.color.background : theme.color.muted }]}>{tab === 'mine' ? t('trade.mine.myTradesTab') : t('trade.involved.tab')}</AppText>
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


type TradeDiscoveryToolsModalProps = {
  visible: boolean;
  initialFocus: 'search' | 'filters';
  query: string;
  modeFilter: ModeFilter;
  postTypeFilter: PostTypeFilter;
  category: string;
  imagesOnly: boolean;
  moneyOnly: boolean;
  hasFilters: boolean;
  activeFilterCount: number;
  suggestions: TradeSearchSuggestion[];
  suggestionsLoading: boolean;
  onChangeQuery: (value: string) => void;
  onSelectSuggestion: (value: string) => void;
  onChangeMode: (value: ModeFilter) => void;
  onChangePostType: (value: PostTypeFilter) => void;
  onChangeCategory: (value: string) => void;
  onToggleImagesOnly: () => void;
  onToggleMoneyOnly: () => void;
  onClear: () => void;
  onApply: () => void;
  onSubmitSearch: () => void;
  onClose: () => void;
};

function TradeDiscoveryToolsModal({ visible, initialFocus, query, modeFilter, postTypeFilter, category, imagesOnly, moneyOnly, hasFilters, activeFilterCount, suggestions, suggestionsLoading, onChangeQuery, onSelectSuggestion, onChangeMode, onChangePostType, onChangeCategory, onToggleImagesOnly, onToggleMoneyOnly, onClear, onApply, onSubmitSearch, onClose }: TradeDiscoveryToolsModalProps) {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 720;
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType={isWideLayout ? "fade" : "slide"} onRequestClose={onClose} presentationStyle={isWideLayout ? "overFullScreen" : "fullScreen"} transparent={isWideLayout}>
      <KeyboardAvoidingView style={[styles.toolsKeyboardRoot, { backgroundColor: isWideLayout ? 'transparent' : theme.color.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={isWideLayout ? styles.modalDesktopBackdrop : styles.modalPlainRoot}>
          <View style={[styles.toolsModalScreen, { backgroundColor: theme.color.background, paddingTop: isWideLayout ? 18 : insets.top + 18, paddingBottom: isWideLayout ? 18 : Math.max(insets.bottom, 10) }, isWideLayout && [styles.toolsModalSheet, { borderColor: theme.color.border }]]}>
            <View style={styles.toolsHeaderRow}>
            <View style={styles.toolsTitleWrap}>
              <AppText style={styles.toolsTitle}>{t('trade.filters.controls')}</AppText>
              <AppText style={[styles.toolsSubtitle, { color: theme.color.muted }]}>{hasFilters ? `${activeFilterCount} · ${t('trade.filters.filters')}` : t('trade.filters.searchTrades')}</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.actions.close')} onPress={onClose} style={({ pressed }) => [styles.toolsCloseButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
              <MobileIcon name="close" size={18} color={theme.color.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.toolsContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.toolsSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }] }>
              <View style={styles.toolsSectionHeader}>
                <MobileIcon name="search" size={18} color={theme.color.text} />
                <AppText style={styles.filterTitle}>{t('trade.filters.searchTrades')}</AppText>
              </View>
              <TextInput
                value={query}
                onChangeText={onChangeQuery}
                placeholder={t('trade.filters.searchPlaceholder')}
                placeholderTextColor={theme.color.muted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={initialFocus === 'search'}
                returnKeyType="search"
                onSubmitEditing={onSubmitSearch}
                style={[styles.searchInput, { backgroundColor: theme.color.background, borderColor: theme.color.border, color: theme.color.text }]}
              />
              <TradeSearchSuggestionList query={query} suggestions={suggestions} loading={suggestionsLoading} onSelect={onSelectSuggestion} />
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
                        <Pressable key={option.value} onPress={() => onChangeMode(option.value)} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.background, borderColor: theme.color.border }, selected && { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}>
                          <AppText style={[styles.filterChipText, { color: selected ? theme.color.background : theme.color.muted }]}>{t(option.labelKey)}</AppText>
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
                        <Pressable key={option.value} onPress={() => onChangePostType(option.value)} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.background, borderColor: theme.color.border }, selected && { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}>
                          <AppText style={[styles.filterChipText, { color: selected ? theme.color.background : theme.color.muted }]}>{t(option.labelKey)}</AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.filterGroup}>
                  <AppText style={[styles.filterLabel, { color: theme.color.muted }]}>{t('trade.filters.category')}</AppText>
                  <TextInput
                    value={category}
                    onChangeText={onChangeCategory}
                    placeholder={t('inventory.form.categoryNeedPlaceholder')}
                    placeholderTextColor={theme.color.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.categoryInput, { backgroundColor: theme.color.background, borderColor: theme.color.border, color: theme.color.text }]}
                  />
                </View>

                <View style={styles.chipRow}>
                  <Pressable onPress={onToggleImagesOnly} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.background, borderColor: theme.color.border }, imagesOnly && { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}>
                    <AppText style={[styles.filterChipText, { color: imagesOnly ? theme.color.background : theme.color.muted }]}>{t('trade.filters.hasImages')}</AppText>
                  </Pressable>
                  {betaFeatures.moneyTradesEnabled ? (
                    <Pressable onPress={onToggleMoneyOnly} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.background, borderColor: theme.color.border }, moneyOnly && { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}>
                      <AppText style={[styles.filterChipText, { color: moneyOnly ? theme.color.background : theme.color.muted }]}>{t('trade.filters.walletAmount')}</AppText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          </ScrollView>

            <View style={[styles.toolsBottomBar, { borderTopColor: theme.color.border }] }>
              <Pressable accessibilityRole="button" onPress={onClear} style={({ pressed }) => [styles.toolsSecondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                <AppText style={[styles.toolsSecondaryButtonText, { color: theme.color.text }]}>{hasFilters ? t('trade.filters.clearFilters') : t('trade.filters.reset')}</AppText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onApply} style={({ pressed }) => [styles.toolsPrimaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
                <AppText style={[styles.toolsPrimaryButtonText, { color: theme.color.background }]}>{t('trade.filters.apply')}</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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

function formatMineDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  } catch {
    return value;
  }
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
      setTrades([]);
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
          <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.mineCreateButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
            <MobileIcon name="add" size={18} color={theme.color.background} />
            <AppText style={[styles.mineCreateButtonText, { color: theme.color.background }]}>{t('trade.create.title')}</AppText>
          </Pressable>
        </AppCard>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mineFilterRow}>
          {['all', 'active', 'with_proposals', 'in_progress', 'expired', 'closed'].map((status) => {
            const selected = statusFilter === status;
            const label = status === 'all' ? t('trade.mine.filterAll') : status === 'with_proposals' ? t('trade.mine.filterWithProposals') : t(`trade.statuses.${status}`);
            return (
              <Pressable key={status} accessibilityRole="button" onPress={() => setStatusFilter(status)} style={({ pressed }) => [styles.mineFilterChip, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}>
                <AppText style={[styles.mineFilterChipText, { color: selected ? theme.color.background : theme.color.muted }]}>{label}</AppText>
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
  const { t } = useTranslation();
  const proposalCount = trade._count?.proposals ?? 0;
  const expiresLabel = formatMineDate(trade.expiresAt) ?? t('trade.mine.noExpiry');
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
          {canRenew ? <Pressable accessibilityRole="button" disabled={busy} onPress={onRenew} style={({ pressed }) => [styles.mineActionButton, { backgroundColor: theme.color.text, borderColor: theme.color.text }, (pressed || busy) && styles.pressed]}><AppText style={[styles.mineActionButtonText, { color: theme.color.background }]}>{busy ? t('common.states.saving') : t('trade.mine.renew')}</AppText></Pressable> : null}
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
        <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.emptyPrimaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}><AppText style={[styles.emptyPrimaryButtonText, { color: theme.color.background }]}>{t('trade.create.title')}</AppText></Pressable>
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
      setTrades([]);
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
            <Pressable key={status} accessibilityRole="button" onPress={() => setStatusFilter(status)} style={({ pressed }) => [styles.mineFilterChip, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}>
              <AppText style={[styles.mineFilterChipText, { color: selected ? theme.color.background : theme.color.muted }]}>{label}</AppText>
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
  const { t } = useTranslation();
  const proposal = trade.viewerProposal;
  const proposalStatus = proposal?.status ?? (trade.viewerInvolvement === 'provider' ? 'accepted' : 'pending');
  const proposalDate = formatMineDate(proposal?.createdAt) ?? t('trade.involved.unknownDate');

  return (
    <View style={[styles.mineRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={[styles.mineRowIcon, { backgroundColor: theme.color.subtleSurface }]}><MobileIcon name="trade" size={18} color={theme.color.text} /></View>
      <View style={styles.mineRowBody}>
        <View style={styles.mineRowBadges}>
          <SemanticBadge label={getMineTradeTypeLabel(trade, t)} tone="trade" />
          <SemanticBadge label={formatTradeStatusLabel(trade.status, t)} tone="muted" />
          <SemanticBadge label={t(`trade.proposals.status.${proposalStatus}`)} tone="info" />
        </View>
        <AppText numberOfLines={2} style={styles.mineRowTitle}>{getMineTradeTitle(trade)}</AppText>
        <AppText style={[styles.mineRowMeta, { color: theme.color.muted }]}>{t('trade.involved.rowMeta', { status: t(`trade.proposals.status.${proposalStatus}`), date: proposalDate })}</AppText>
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

function TradeDeckSection({ trade, index, total, onOpen }: { trade: TradeDeckItem; index: number; total: number; onOpen: () => void }) {
  return <TradeSquareDeck trade={trade} index={index} total={total} onOpen={onOpen} />;
}

function EmptyTradesState({ loading, hasTrades, hasFilters, onCreate, onRefresh, onClear }: { loading: boolean; hasTrades: boolean; hasFilters: boolean; onCreate: () => void; onRefresh: () => void; onClear: () => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const title = loading ? t('trade.filters.loadingTrades') : hasFilters ? t('trade.filters.noMatches') : t('trade.filters.noTradesYet');
  const body = hasFilters ? t('trade.filters.noTradesBody') : t('trade.filters.emptyBody');

  return (
    <AppCard>
      <View style={styles.emptyBox}>
        <SemanticBadge label={hasTrades ? t('common.actions.search') : t('trade.filters.noActiveTrades')} tone="info" />
        <AppText style={styles.emptyTitle}>{title}</AppText>
        <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{body}</AppText>
        <View style={styles.emptyActions}>
          {hasFilters ? <Pressable accessibilityRole="button" onPress={onClear} style={({ pressed }) => [styles.emptyPrimaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}><AppText style={[styles.emptyPrimaryButtonText, { color: theme.color.background }]}>{t('trade.filters.clearFilters')}</AppText></Pressable> : <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.emptyPrimaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}><AppText style={[styles.emptyPrimaryButtonText, { color: theme.color.background }]}>{t('trade.create.title')}</AppText></Pressable>}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  iconButtonText: { fontSize: 16, fontWeight: '900', lineHeight: 20 },
  createIconButtonText: { fontSize: 22, lineHeight: 24 },
  filterDot: { position: 'absolute', right: -3, top: -3, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', paddingHorizontal: 4 },
  filterDotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
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
  feedList: { gap: 20 },
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
  toolsModalScreen: { flex: 1, paddingHorizontal: 18 },
  toolsModalSheet: { width: '100%', maxWidth: 560, maxHeight: '88%', borderRadius: 32, borderWidth: 1, paddingHorizontal: 18 },
  toolsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingBottom: 16 },
  toolsTitleWrap: { flex: 1, minWidth: 0, gap: 4 },
  toolsTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  toolsSubtitle: { fontSize: 13, fontWeight: '800' },
  toolsCloseButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  toolsContent: { gap: 14, paddingBottom: 18 },
  toolsSection: { borderRadius: 24, borderWidth: 1, padding: 14, gap: 12 },
  toolsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolsBottomBar: { borderTopWidth: 1, flexDirection: 'row', gap: 10, paddingTop: 12 },
  toolsPrimaryButton: { flex: 1, minHeight: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  toolsPrimaryButtonText: { fontSize: 15, fontWeight: '900' },
  toolsSecondaryButton: { flex: 1, minHeight: 50, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  toolsSecondaryButtonText: { fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
