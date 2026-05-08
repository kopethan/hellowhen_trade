import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ListTradesFeedQuery, TradeExchangeMode } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { ContinuousSquareStackDeck } from './deck';
import { buildTradeSquareDeckCards, renderTradeSquareDeckCard } from './components/TradeSquareDeckCards';
import type { TradeDeckItem } from './types';

type FeedResponse = { trades: TradeDeckItem[] };
type ModeFilter = 'all' | TradeExchangeMode;

const modeOptions: Array<{ label: string; value: ModeFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Remote', value: 'remote' },
  { label: 'Local', value: 'local' },
  { label: 'Hybrid', value: 'hybrid' },
];

function hasApprovedImages(trade: TradeDeckItem) {
  return (trade.need?.media?.length ?? 0) + (trade.offer?.media?.length ?? 0) > 0;
}

function hasWalletAmount(trade: TradeDeckItem) {
  return (trade.amountCents ?? 0) > 0;
}

function buildFeedQuery(query: string, modeFilter: ModeFilter, category: string, imagesOnly: boolean, moneyOnly: boolean): ListTradesFeedQuery {
  return {
    q: query.trim() || undefined,
    mode: modeFilter === 'all' ? undefined : modeFilter,
    category: category.trim() || undefined,
    hasImages: imagesOnly || undefined,
    hasMoney: moneyOnly || undefined,
    take: 50,
  };
}

export function TradeDeckFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [trades, setTrades] = useState<TradeDeckItem[]>([]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [category, setCategory] = useState('');
  const [imagesOnly, setImagesOnly] = useState(false);
  const [moneyOnly, setMoneyOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const feedQuery = useMemo(() => buildFeedQuery(query, modeFilter, category, imagesOnly, moneyOnly), [category, imagesOnly, modeFilter, moneyOnly, query]);
  const activeFilterCount = useMemo(() => [feedQuery.q, feedQuery.mode, feedQuery.category, feedQuery.hasImages, feedQuery.hasMoney].filter(Boolean).length, [feedQuery]);

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

  useFocusEffect(useCallback(() => { void loadFeed(); }, [loadFeed]));

  useEffect(() => {
    const handle = setTimeout(() => { void loadFeed(); }, 275);
    return () => clearTimeout(handle);
  }, [loadFeed]);

  const visibleTrades = useMemo(() => trades.filter((trade) => {
    if (imagesOnly && !hasApprovedImages(trade)) return false;
    if (moneyOnly && !hasWalletAmount(trade)) return false;
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

  const createTrade = useCallback(() => navigation.navigate('CreateTrade'), [navigation]);
  const clearFilters = useCallback(() => {
    setQuery('');
    setModeFilter('all');
    setCategory('');
    setImagesOnly(false);
    setMoneyOnly(false);
  }, []);

  const hasTrades = trades.length > 0;
  const hasVisibleTrades = visibleTrades.length > 0;
  const hasFilters = activeFilterCount > 0;

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadFeed(); }} />}>
        <View style={styles.headerRow}>
          <AppText style={styles.title}>Trades</AppText>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Search trades" onPress={() => setSearchOpen((current) => !current)} style={({ pressed }) => [styles.iconButton, searchOpen && styles.iconButtonSelected, pressed && styles.pressed]}>
              <AppText style={styles.iconButtonText}>S</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Filter trades" onPress={() => setFiltersOpen((current) => !current)} style={({ pressed }) => [styles.iconButton, (filtersOpen || hasFilters) && styles.iconButtonSelected, pressed && styles.pressed]}>
              <AppText style={styles.iconButtonText}>F</AppText>
              {hasFilters ? <View style={styles.filterDot}><AppText style={styles.filterDotText}>{activeFilterCount}</AppText></View> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Create trade" onPress={createTrade} style={({ pressed }) => [styles.iconButton, styles.createIconButton, pressed && styles.pressed]}>
              <AppText style={[styles.iconButtonText, styles.createIconButtonText]}>+</AppText>
            </Pressable>
          </View>
        </View>

        {searchOpen ? (
          <TextInput value={query} onChangeText={setQuery} placeholder="Search trades, needs, offers" placeholderTextColor="#94A3B8" autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => { void loadFeed(); }} style={styles.searchInput} />
        ) : null}

        {filtersOpen ? (
          <AppCard>
            <View style={styles.filterPanel}>
              <View style={styles.filterHeaderRow}>
                <AppText style={styles.filterTitle}>Filters</AppText>
                {hasFilters ? <Pressable accessibilityRole="button" onPress={clearFilters} style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}><AppText style={styles.clearButtonText}>Clear</AppText></Pressable> : null}
              </View>
              <View style={styles.filterGroup}>
                <AppText style={styles.filterLabel}>Mode</AppText>
                <View style={styles.chipRow}>{modeOptions.map((option) => { const selected = modeFilter === option.value; return <Pressable key={option.value} onPress={() => setModeFilter(option.value)} style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}><AppText style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{option.label}</AppText></Pressable>; })}</View>
              </View>
              <View style={styles.filterGroup}>
                <AppText style={styles.filterLabel}>Category</AppText>
                <TextInput value={category} onChangeText={setCategory} placeholder="Design, writing, photography..." placeholderTextColor="#94A3B8" autoCapitalize="none" autoCorrect={false} style={styles.categoryInput} />
              </View>
              <View style={styles.chipRow}>
                <Pressable onPress={() => setImagesOnly((current) => !current)} style={({ pressed }) => [styles.filterChip, imagesOnly && styles.filterChipSelected, pressed && styles.pressed]}><AppText style={[styles.filterChipText, imagesOnly && styles.filterChipTextSelected]}>Has images</AppText></Pressable>
                <Pressable onPress={() => setMoneyOnly((current) => !current)} style={({ pressed }) => [styles.filterChip, moneyOnly && styles.filterChipSelected, pressed && styles.pressed]}><AppText style={[styles.filterChipText, moneyOnly && styles.filterChipTextSelected]}>Wallet amount</AppText></Pressable>
              </View>
            </View>
          </AppCard>
        ) : null}

        {error ? <InfoNotice tone="danger" title="Could not load trades" body={error} /> : null}
        {hasVisibleTrades ? (
          <View style={styles.feedList}>
            {visibleTrades.map((trade, index) => <TradeDeckSection key={trade.id} trade={trade} index={index} total={visibleTrades.length} onOpen={() => openTrade(trade)} />)}
          </View>
        ) : (
          <EmptyTradesState loading={loading} hasTrades={hasTrades} hasFilters={hasFilters} onCreate={createTrade} onRefresh={loadFeed} onClear={clearFilters} />
        )}
      </ScrollView>
    </AppScreen>
  );
}

function TradeDeckSection({ trade, index, total, onOpen }: { trade: TradeDeckItem; index: number; total: number; onOpen: () => void }) {
  const cards = useMemo(() => buildTradeSquareDeckCards(trade, index, total), [index, total, trade]);
  return (
    <View style={styles.tradeSection}>
      <ContinuousSquareStackDeck cards={cards} renderCard={({ card, index: cardIndex, total: cardTotal }) => renderTradeSquareDeckCard(card, cardIndex, cardTotal, onOpen)} renderWindow="all" showDebugBadge={false} depthEffect="motionOnly" availableHeight={404} maxCardSize={348} />
    </View>
  );
}

function EmptyTradesState({ loading, hasTrades, hasFilters, onCreate, onRefresh, onClear }: { loading: boolean; hasTrades: boolean; hasFilters: boolean; onCreate: () => void; onRefresh: () => void; onClear: () => void }) {
  const title = loading ? 'Loading trades...' : hasFilters ? 'No matches' : 'No trades yet';
  const body = hasFilters ? 'Try a different search or clear the filters.' : 'Publish a trade from one saved Need and one saved Offer. Approved images will appear as extra cards in the deck.';

  return (
    <AppCard>
      <View style={styles.emptyBox}>
        <SemanticBadge label={hasTrades ? 'Search' : 'No active trades'} tone="info" />
        <AppText style={styles.emptyTitle}>{title}</AppText>
        <AppText style={styles.emptyText}>{body}</AppText>
        <View style={styles.emptyActions}>
          {hasFilters ? <Pressable accessibilityRole="button" onPress={onClear} style={({ pressed }) => [styles.emptyPrimaryButton, pressed && styles.pressed]}><AppText style={styles.emptyPrimaryButtonText}>Clear filters</AppText></Pressable> : <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.emptyPrimaryButton, pressed && styles.pressed]}><AppText style={styles.emptyPrimaryButtonText}>Create Trade</AppText></Pressable>}
          <Pressable accessibilityRole="button" onPress={onRefresh} style={({ pressed }) => [styles.emptySecondaryButton, pressed && styles.pressed]}><AppText style={styles.emptySecondaryButtonText}>Refresh</AppText></Pressable>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  title: { color: '#0F172A', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  iconButtonSelected: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  iconButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900', lineHeight: 20 },
  createIconButton: { backgroundColor: '#111827', borderColor: '#111827' },
  createIconButtonText: { color: '#FFFFFF', fontSize: 22, lineHeight: 24 },
  filterDot: { position: 'absolute', right: -3, top: -3, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', paddingHorizontal: 4 },
  filterDotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  searchInput: { borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 12, color: '#0F172A', fontSize: 16, fontWeight: '700' },
  filterPanel: { gap: 14 },
  filterHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  filterTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  clearButton: { borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 7 },
  clearButtonText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  filterGroup: { gap: 8 },
  filterLabel: { color: '#475569', fontSize: 12, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 9 },
  filterChipSelected: { borderColor: '#0F172A', backgroundColor: '#111827' },
  filterChipText: { color: '#475569', fontSize: 13, fontWeight: '900' },
  filterChipTextSelected: { color: '#FFFFFF' },
  categoryInput: { borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 13, paddingVertical: 11, color: '#0F172A', fontSize: 15, fontWeight: '700' },
  feedList: { gap: 20 },
  tradeSection: { alignItems: 'center', justifyContent: 'center' },
  emptyBox: { minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18 },
  emptyTitle: { color: '#0F172A', fontSize: 28, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center' },
  emptyText: { color: '#64748B', lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  emptyPrimaryButton: { borderRadius: 16, backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 12 },
  emptyPrimaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  emptySecondaryButton: { borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 12 },
  emptySecondaryButtonText: { color: '#334155', fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
