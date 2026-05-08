import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { ContinuousSquareStackDeck } from './deck';
import { buildTradeSquareDeckCards, renderTradeSquareDeckCard, TradeDeckMiniMeta } from './components/TradeSquareDeckCards';
import type { TradeDeckItem } from './types';

type FeedResponse = { trades: TradeDeckItem[] };

export function TradeDeckFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [trades, setTrades] = useState<TradeDeckItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.feed() as FeedResponse;
      setTrades(Array.isArray(result.trades) ? result.trades : []);
    } catch (caughtError) {
      setTrades([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadFeed(); }, [loadFeed]));

  const hasTrades = trades.length > 0;
  const openTrade = useCallback((trade: TradeDeckItem) => {
    navigation.navigate('TradeDetail', { tradeId: trade.id, title: trade.title, description: trade.description, creditAmount: trade.creditAmount, status: trade.status, expiresAt: trade.expiresAt ?? null });
  }, [navigation]);
  const createTrade = useCallback(() => navigation.navigate('CreateTrade'), [navigation]);

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadFeed(); }} />}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <SemanticBadge label="Trades" tone="trade" />
            <AppText style={styles.title}>Trades</AppText>
            <AppText style={styles.subtitle}>Browse one trade at a time. Swipe inside a square deck to see the need, offer, and approved images.</AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={createTrade} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}><AppText style={styles.createButtonText}>Create</AppText></Pressable>
        </View>
        {error ? <InfoNotice tone="danger" title="Could not load trades" body={error} /> : null}
        {hasTrades ? <View style={styles.feedList}>{trades.map((trade, index) => <TradeDeckSection key={trade.id} trade={trade} index={index} total={trades.length} onOpen={() => openTrade(trade)} />)}</View> : <EmptyTradesState loading={loading} onCreate={createTrade} onRefresh={loadFeed} />}
      </ScrollView>
    </AppScreen>
  );
}

function TradeDeckSection({ trade, index, total, onOpen }: { trade: TradeDeckItem; index: number; total: number; onOpen: () => void }) {
  const cards = useMemo(() => buildTradeSquareDeckCards(trade), [trade]);
  return (
    <View style={styles.tradeSection}>
      <View style={styles.sectionTopRow}>
        <View style={styles.sectionCopy}>
          <AppText style={styles.sectionEyebrow}>Trade {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</AppText>
          <AppText style={styles.sectionTitle} numberOfLines={1}>{trade.title}</AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.sectionOpenButton, pressed && styles.pressed]}><AppText style={styles.sectionOpenButtonText}>Open</AppText></Pressable>
      </View>
      <TradeDeckMiniMeta trade={trade} />
      <View style={styles.deckWrap}>
        <ContinuousSquareStackDeck cards={cards} renderCard={({ card, index: cardIndex, total: cardTotal }) => renderTradeSquareDeckCard(card, cardIndex, cardTotal, onOpen)} renderWindow="all" showDebugBadge={false} depthEffect="motionOnly" availableHeight={456} maxCardSize={374} />
      </View>
    </View>
  );
}

function EmptyTradesState({ loading, onCreate, onRefresh }: { loading: boolean; onCreate: () => void; onRefresh: () => void }) {
  return (
    <AppCard>
      <View style={styles.emptyBox}>
        <SemanticBadge label="No active trades" tone="info" />
        <AppText style={styles.emptyTitle}>{loading ? 'Loading trades...' : 'No trades yet'}</AppText>
        <AppText style={styles.emptyText}>Publish a trade from one saved Need and one saved Offer. Approved Need and Offer images will appear as extra cards in the deck.</AppText>
        <View style={styles.emptyActions}>
          <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.emptyPrimaryButton, pressed && styles.pressed]}><AppText style={styles.emptyPrimaryButtonText}>Create Trade</AppText></Pressable>
          <Pressable accessibilityRole="button" onPress={onRefresh} style={({ pressed }) => [styles.emptySecondaryButton, pressed && styles.pressed]}><AppText style={styles.emptySecondaryButtonText}>Refresh</AppText></Pressable>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  headerCopy: { flex: 1, gap: 8 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: '#64748B', lineHeight: 20, fontWeight: '600' },
  createButton: { borderRadius: 18, backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 12 },
  createButtonText: { color: '#FFFFFF', fontWeight: '900' },
  feedList: { gap: 24 },
  tradeSection: { gap: 12 },
  sectionTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionCopy: { flex: 1, gap: 4 },
  sectionEyebrow: { color: '#64748B', fontSize: 11, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' },
  sectionTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  sectionOpenButton: { borderRadius: 999, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 13, paddingVertical: 9 },
  sectionOpenButtonText: { color: '#334155', fontWeight: '900' },
  deckWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 456 },
  emptyBox: { minHeight: 380, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18 },
  emptyTitle: { color: '#0F172A', fontSize: 28, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center' },
  emptyText: { color: '#64748B', lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  emptyPrimaryButton: { borderRadius: 16, backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 12 },
  emptyPrimaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  emptySecondaryButton: { borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 12 },
  emptySecondaryButtonText: { color: '#334155', fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
