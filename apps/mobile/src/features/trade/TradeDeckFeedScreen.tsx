import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ListTradesFeedQuery, TradeExchangeMode, TradePostType } from '@hellowhen/contracts';
import { getTradeOwnerVisibilityState, isTradeOwnerCloseAllowed, isTradeOwnerRenewAllowed } from '@hellowhen/shared';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { betaFeatures } from '../../lib/betaFeatures';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { TradeSquareDeck } from './components/TradeSquareDeck';
import type { TradeDeckItem } from './types';

type FeedResponse = { trades: TradeDeckItem[] };
type TradeFeedTab = 'discover' | 'mine' | 'involved';
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

function buildFeedQuery(query: string, modeFilter: ModeFilter, postTypeFilter: PostTypeFilter, category: string, imagesOnly: boolean, moneyOnly: boolean, refreshSeed: string, seenTradeIds: string[], language: 'en' | 'fr', countryCode?: string | null): ListTradesFeedQuery {
  return {
    q: query.trim() || undefined,
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
  const [activeTab, setActiveTab] = useState<TradeFeedTab>('discover');
  const [trades, setTrades] = useState<TradeDeckItem[]>([]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [postTypeFilter, setPostTypeFilter] = useState<PostTypeFilter>('all');
  const [category, setCategory] = useState('');
  const [imagesOnly, setImagesOnly] = useState(false);
  const [moneyOnly, setMoneyOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(() => createFeedRefreshSeed());
  const [seenTradeIds, setSeenTradeIds] = useState<string[]>([]);

  const feedQuery = useMemo(() => buildFeedQuery(query, modeFilter, postTypeFilter, category, imagesOnly, moneyOnly, refreshSeed, seenTradeIds, language, auth.user?.profile?.countryCode), [auth.user?.profile?.countryCode, category, imagesOnly, language, modeFilter, moneyOnly, postTypeFilter, query, refreshSeed, seenTradeIds]);
  const activeFilterCount = useMemo(() => [feedQuery.q, feedQuery.mode, feedQuery.postType, feedQuery.category, feedQuery.hasImages, betaFeatures.moneyTradesEnabled ? feedQuery.hasMoney : undefined].filter(Boolean).length, [feedQuery]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.feed(feedQuery) as FeedResponse;
      setTrades(Array.isArray(result.trades) ? result.trades : []);
    } catch (caughtError) {
      setTrades([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [feedQuery]);

  useFocusEffect(useCallback(() => { if (activeTab === 'discover') void loadFeed(); }, [activeTab, loadFeed]));

  useEffect(() => {
    if (activeTab !== 'discover') return undefined;
    const handle = setTimeout(() => { void loadFeed(); }, 275);
    return () => clearTimeout(handle);
  }, [activeTab, loadFeed]);

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
    setModeFilter('all');
    setPostTypeFilter('all');
    setCategory('');
    setImagesOnly(false);
    setMoneyOnly(false);
    setSeenTradeIds([]);
    setRefreshSeed(createFeedRefreshSeed());
  }, []);

  const hasTrades = trades.length > 0;
  const hasVisibleTrades = visibleTrades.length > 0;
  const hasFilters = activeFilterCount > 0;

  const header = (
    <View style={styles.fixedHeaderStack}>
      <View style={styles.headerRow}>
        <AppText style={styles.title}>{t('navigation.tabs.trades')}</AppText>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('trade.create.title')} onPress={createTrade} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}>
            <MobileIcon name="add" size={23} color={theme.color.background} />
          </Pressable>
          {activeTab === 'discover' ? (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel={t('trade.filters.searchTrades')} onPress={() => setSearchOpen((current) => !current)} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, searchOpen && { backgroundColor: theme.semantic.info.softBg, borderColor: theme.semantic.info.border }, pressed && styles.pressed]}>
                <MobileIcon name="search" size={18} color={searchOpen ? theme.semantic.info.text : theme.color.text} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('trade.filters.filter')} onPress={() => setFiltersOpen((current) => !current)} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, (filtersOpen || hasFilters) && { backgroundColor: theme.semantic.info.softBg, borderColor: theme.semantic.info.border }, pressed && styles.pressed]}>
                <MobileIcon name="filter" size={18} color={(filtersOpen || hasFilters) ? theme.semantic.info.text : theme.color.text} />
                {hasFilters ? <View style={styles.filterDot}><AppText style={styles.filterDotText}>{activeFilterCount}</AppText></View> : null}
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
      <View style={[styles.segmentedTabs, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        {(['discover', 'mine', 'involved'] as const).map((tab) => {
          const selected = activeTab === tab;
          return (
            <Pressable key={tab} accessibilityRole="button" onPress={() => setActiveTab(tab)} style={({ pressed }) => [styles.segmentedTab, selected && { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
              <AppText style={[styles.segmentedTabText, { color: selected ? theme.color.background : theme.color.muted }]}>{tab === 'discover' ? t('trade.mine.discoverTab') : tab === 'mine' ? t('trade.mine.myTradesTab') : t('trade.involved.tab')}</AppText>
            </Pressable>
          );
        })}
      </View>
      {activeTab === 'discover' && searchOpen ? <TextInput value={query} onChangeText={setQuery} placeholder={t('trade.filters.searchPlaceholder')} placeholderTextColor={theme.color.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => refreshDiscoveryOrder()} style={[styles.searchInput, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} /> : null}
      {activeTab === 'discover' && filtersOpen ? <AppCard style={styles.filterCard}><View style={styles.filterPanel}><View style={styles.filterHeaderRow}><AppText style={styles.filterTitle}>{t('trade.filters.filters')}</AppText>{hasFilters ? <Pressable accessibilityRole="button" onPress={clearFilters} style={({ pressed }) => [styles.clearButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.clearButtonText, { color: theme.color.muted }]}>{t('trade.filters.clear')}</AppText></Pressable> : null}</View><View style={styles.filterGroup}><AppText style={[styles.filterLabel, { color: theme.color.muted }]}>{t('trade.filters.mode')}</AppText><View style={styles.chipRow}>{modeOptions.map((option) => { const selected = modeFilter === option.value; return <Pressable key={option.value} onPress={() => setModeFilter(option.value)} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}><AppText style={[styles.filterChipText, { color: selected ? theme.color.background : theme.color.muted }]}>{t(option.labelKey)}</AppText></Pressable>; })}</View></View><View style={styles.filterGroup}><AppText style={[styles.filterLabel, { color: theme.color.muted }]}>{t('trade.filters.postType')}</AppText><View style={styles.chipRow}>{postTypeOptions.map((option) => { const selected = postTypeFilter === option.value; return <Pressable key={option.value} onPress={() => setPostTypeFilter(option.value)} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}><AppText style={[styles.filterChipText, { color: selected ? theme.color.background : theme.color.muted }]}>{t(option.labelKey)}</AppText></Pressable>; })}</View></View><View style={styles.filterGroup}><AppText style={[styles.filterLabel, { color: theme.color.muted }]}>{t('trade.filters.category')}</AppText><TextInput value={category} onChangeText={setCategory} placeholder={t('inventory.form.categoryNeedPlaceholder')} placeholderTextColor={theme.color.muted} autoCapitalize="none" autoCorrect={false} style={[styles.categoryInput, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} /></View><View style={styles.chipRow}><Pressable onPress={() => setImagesOnly((current) => !current)} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, imagesOnly && { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}><AppText style={[styles.filterChipText, { color: imagesOnly ? theme.color.background : theme.color.muted }]}>{t('trade.filters.hasImages')}</AppText></Pressable>{betaFeatures.moneyTradesEnabled ? <Pressable onPress={() => setMoneyOnly((current) => !current)} style={({ pressed }) => [styles.filterChip, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, moneyOnly && { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}><AppText style={[styles.filterChipText, { color: moneyOnly ? theme.color.background : theme.color.muted }]}>{t('trade.filters.walletAmount')}</AppText></Pressable> : null}</View></View></AppCard> : null}
    </View>
  );

  return (
    <AppFixedHeaderScreen header={header}>
      {activeTab === 'discover' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshDiscoveryOrder} />}>
          {error ? <InfoNotice tone="danger" title={t('trade.filters.couldNotLoadTrades')} body={error} /> : null}
          {hasVisibleTrades ? (
            <View style={styles.feedList}>
              {visibleTrades.map((trade, index) => <TradeDeckSection key={trade.id} trade={trade} index={index} total={visibleTrades.length} onOpen={() => openTrade(trade)} />)}
            </View>
          ) : (
            <EmptyTradesState loading={loading} hasTrades={hasTrades} hasFilters={hasFilters} onCreate={createTrade} onRefresh={refreshDiscoveryOrder} onClear={clearFilters} />
          )}
        </ScrollView>
      ) : activeTab === 'mine' ? <MyCreatedTradesPanel onCreate={createTrade} onOpenTrade={openTrade} onOpenProposals={(trade) => navigation.navigate('TradePrivateProposals', { tradeId: trade.id, title: getMineTradeTitle(trade), status: trade.status })} /> : <InvolvedTradesPanel onOpenTrade={openTrade} onOpenProposal={(proposalId) => navigation.navigate('ProposalDetail', { proposalId })} />}
    </AppFixedHeaderScreen>
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

function MyCreatedTradesPanel({ onCreate, onOpenTrade, onOpenProposals }: { onCreate: () => void; onOpenTrade: (trade: TradeWithCounts) => void; onOpenProposals: (trade: TradeWithCounts) => void }) {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t } = useTranslation();
  const [trades, setTrades] = useState<TradeWithCounts[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    Alert.alert(t('trade.mine.close'), t('trade.mine.closeConfirm'), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('trade.mine.close'),
        style: 'destructive',
        onPress: async () => {
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
        }
      }
    ]);
  }, [replaceTrade, t]);

  useFocusEffect(useCallback(() => { void loadMine(); }, [loadMine]));

  const visibleTrades = useMemo(() => {
    if (statusFilter === 'all') return trades;
    if (statusFilter === 'with_proposals') return trades.filter((trade) => (trade._count?.proposals ?? 0) > 0);
    return trades.filter((trade) => trade.status === statusFilter);
  }, [statusFilter, trades]);

  if (!auth.isAuthenticated) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppCard style={styles.authMineCard}>
          <SemanticBadge label={t('trade.mine.myTradesTab')} tone="trade" />
          <AppText style={styles.emptyTitle}>{t('trade.mine.loginTitle')}</AppText>
          <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{t('trade.mine.loginBody')}</AppText>
        </AppCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMine} />}>
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

function InvolvedTradesPanel({ onOpenTrade, onOpenProposal }: { onOpenTrade: (trade: TradeWithViewerProposal) => void; onOpenProposal: (proposalId: string) => void }) {
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppCard style={styles.authMineCard}>
          <SemanticBadge label={t('trade.involved.tab')} tone="trade" />
          <AppText style={styles.emptyTitle}>{t('trade.involved.loginTitle')}</AppText>
          <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{t('trade.involved.loginBody')}</AppText>
        </AppCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadInvolved} />}>
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
  const { t, language } = useTranslation();
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
  fixedHeaderStack: { gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  segmentedTabs: { flexDirection: 'row', gap: 6, borderRadius: 999, borderWidth: 1, padding: 5 },
  segmentedTab: { flex: 1, minHeight: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  segmentedTabText: { fontSize: 13, fontWeight: '900' },
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
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
