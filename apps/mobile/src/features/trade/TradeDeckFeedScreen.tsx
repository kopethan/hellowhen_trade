import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { TradeDeckCard } from './components/TradeDeckCard';
import type { TradeDeckItem } from './types';

const now = () => new Date().toISOString();
const mockTrades: TradeDeckItem[] = [
  { id: 'mock-trade-1', ownerId: 'mock-owner-1', needId: 'mock-need-video', offerId: null, title: 'Need help editing a short launch video', description: 'Polish a 45-second launch video for social. I have the clips and copy, but need pacing, captions, and a clean export.', creditAmount: 25, status: 'active', isPublic: true, createdAt: now(), updatedAt: now(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(), closedAt: null, owner: { id: 'mock-owner-1', profile: { displayName: 'Mina' } } },
  { id: 'mock-trade-2', ownerId: 'mock-owner-2', needId: null, offerId: 'mock-offer-copy', title: 'Offer: landing page copy review', description: 'I can review your hero section, headline, CTA, and first fold. You will get quick notes and 3 rewrite directions.', creditAmount: 15, status: 'active', isPublic: true, createdAt: now(), updatedAt: now(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(), closedAt: null, owner: { id: 'mock-owner-2', profile: { displayName: 'Noah' } } },
  { id: 'mock-trade-3', ownerId: 'mock-owner-3', needId: null, offerId: null, title: 'Trade: database cleanup for brand feedback', description: 'Looking for someone to clean a small Airtable base. In return I can do brand naming feedback or pay fake test credits.', creditAmount: 40, status: 'active', isPublic: true, createdAt: now(), updatedAt: now(), expiresAt: null, closedAt: null, owner: { id: 'mock-owner-3', profile: { displayName: 'Ari' } } },
];

type FeedResponse = { trades: TradeDeckItem[] };

export function TradeDeckFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [trades, setTrades] = useState<TradeDeckItem[]>(mockTrades);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passedIds, setPassedIds] = useState<Set<string>>(() => new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.feed() as FeedResponse;
      const apiTrades = Array.isArray(result.trades) ? result.trades : [];
      if (apiTrades.length > 0) {
        setTrades(apiTrades);
        setSource('api');
        setPassedIds(new Set());
      } else {
        setTrades(mockTrades);
        setSource('mock');
        setError('No active public trades yet. Showing mock trades so the deck stays usable.');
      }
    } catch (caughtError) {
      setTrades(mockTrades);
      setSource('mock');
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadFeed(); }, [loadFeed]));

  useEffect(() => {
    if (trades.length > 0 && passedIds.size >= trades.length) setPassedIds(new Set());
  }, [passedIds.size, trades.length]);

  const visibleTrades = useMemo(() => trades.filter((trade) => !passedIds.has(trade.id)), [passedIds, trades]);
  const activeTrade = visibleTrades[0];
  const activeIndex = activeTrade ? trades.findIndex((trade) => trade.id === activeTrade.id) : 0;

  const openTrade = useCallback((trade: TradeDeckItem) => {
    navigation.navigate('TradeDetail', { tradeId: trade.id, title: trade.title, description: trade.description, creditAmount: trade.creditAmount, status: trade.status, expiresAt: trade.expiresAt ?? null });
  }, [navigation]);
  const passTrade = useCallback((tradeId: string) => setPassedIds((current) => new Set(current).add(tradeId)), []);
  const saveTrade = useCallback((tradeId: string) => setSavedIds((current) => { const next = new Set(current); next.has(tradeId) ? next.delete(tradeId) : next.add(tradeId); return next; }), []);

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadFeed(); }} />}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <SemanticBadge label="Patch 6 semantic colors" tone="instruction" />
            <AppText style={styles.title}>Trades</AppText>
            <AppText style={styles.subtitle}>Browse public active trades with semantic colors: purple for trades, blue for needs, green for offers, gold for credits, and orange for time.</AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateTrade')} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}><AppText style={styles.createButtonText}>Create</AppText></Pressable>
        </View>
        {error ? <InfoNotice tone="warning" title="Feed fallback" body={error} /> : null}
        <AppText style={styles.sourceLabel}>{source === 'api' ? 'Live API feed' : 'Mock fallback feed'}{loading ? ' · refreshing' : ''}</AppText>
        <View style={styles.deckStage}>
          {visibleTrades.slice(1, 4).reverse().map((trade, layerIndex) => <View key={trade.id} pointerEvents="none" style={[styles.backCard, { top: 24 - layerIndex * 8, left: 18 - layerIndex * 6, right: 18 - layerIndex * 6, opacity: 0.36 + layerIndex * 0.14, transform: [{ scale: 0.93 + layerIndex * 0.025 }] }]} />)}
          {activeTrade ? <TradeDeckCard trade={activeTrade} index={Math.max(0, activeIndex)} total={trades.length} saved={savedIds.has(activeTrade.id)} onOpen={() => openTrade(activeTrade)} onPass={() => passTrade(activeTrade.id)} onSave={() => saveTrade(activeTrade.id)} /> : <View style={styles.emptyCard}><AppText style={styles.emptyTitle}>All caught up</AppText><AppText style={styles.emptyText}>You passed every trade in this local deck.</AppText><Button title="Reset passed trades" onPress={() => setPassedIds(new Set())} /></View>}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  headerCopy: { flex: 1 },
  kicker: { color: '#0F766E', fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { marginTop: 4, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { marginTop: 8, color: '#64748B', lineHeight: 20, fontWeight: '600' },
  createButton: { borderRadius: 18, backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 12 },
  createButtonText: { color: '#FFFFFF', fontWeight: '900' },
  notice: { color: '#92400E', backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1, borderRadius: 16, padding: 12, fontWeight: '700' },
  sourceLabel: { color: '#64748B', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  deckStage: { position: 'relative', minHeight: 520, justifyContent: 'center' },
  backCard: { position: 'absolute', height: 444, borderRadius: 34, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  emptyCard: { minHeight: 420, borderRadius: 34, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 26, fontWeight: '900' },
  emptyText: { color: '#64748B', textAlign: 'center', marginBottom: 10 },
  pressed: { opacity: 0.78 },
});
