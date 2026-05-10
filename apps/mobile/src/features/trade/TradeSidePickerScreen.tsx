import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TradeExchangeMode } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { itemTypeLabel, modeLabel } from './components/InventoryFormFields';
import type { NeedItem, OfferItem } from './types';
import type { TradeCreateSide, TradeCreateSideSelection } from './CreateTradeScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'TradeSidePicker'>;
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };

function optionalModeLabel(mode?: TradeExchangeMode | null) { return mode ? modeLabel(mode) : undefined; }
function needMeta(need: NeedItem) { return [itemTypeLabel(need.itemType ?? 'service'), need.category, need.timing, optionalModeLabel(need.mode), need.locationLabel].filter(Boolean).join(' · ') || 'Need details'; }
function offerMeta(offer: OfferItem) { return [itemTypeLabel(offer.itemType ?? 'service'), offer.category, offer.availability, optionalModeLabel(offer.mode), offer.locationLabel].filter(Boolean).join(' · ') || 'Offer details'; }
function isNeedAvailable(need: NeedItem) { return !['fulfilled', 'closed', 'expired'].includes(need.status); }
function isOfferAvailable(offer: OfferItem) { return !['accepted', 'closed', 'expired'].includes(offer.status); }

export function TradeSidePickerScreen({ route, navigation }: Props) {
  const theme = useThemeTokens();
  const side = route.params.side;
  const existing = route.params.selection;
  const [needs, setNeeds] = useState<NeedItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [needsResult, offersResult] = await Promise.all([
        api.needs.mine() as Promise<NeedsResponse>,
        api.offers.mine() as Promise<OffersResponse>,
      ]);
      setNeeds(Array.isArray(needsResult.needs) ? needsResult.needs : []);
      setOffers(Array.isArray(offersResult.offers) ? offersResult.offers : []);
    } catch (caughtError) {
      setNeeds([]);
      setOffers([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadResources(); }, [loadResources]));

  const usableNeeds = useMemo(() => needs.filter(isNeedAvailable), [needs]);
  const usableOffers = useMemo(() => offers.filter(isOfferAvailable), [offers]);
  const title = side === 'need' ? 'Select what you need' : 'Select what you offer';
  const inventoryTitle = side === 'need' ? 'My Needs' : 'My Offers';

  function choose(selection: TradeCreateSideSelection) {
    navigation.navigate('CreateTrade', { selectedTradeSide: selection });
  }


  return (
    <AppFixedHeaderScreen header={<AppHeader title={title} onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadResources(); }} />}>
        {error ? <InfoNotice tone="warning" title="Could not load resources" body={error} /> : null}

        <AppCard>
          <View style={styles.sectionHeader}><SemanticBadge label={side === 'need' ? 'Need' : 'Offer'} tone={side === 'need' ? 'need' : 'offer'} /><AppText style={styles.sectionTitle}>{inventoryTitle}</AppText></View>
          {side === 'need' ? (
            usableNeeds.length === 0 ? <EmptyInventory side={side} theme={theme} onCreate={() => navigation.navigate('CreateNeed')} /> : usableNeeds.map((need) => <InventoryRow key={need.id} title={need.title} description={need.description} meta={needMeta(need)} status={need.status} selected={existing?.kind === 'need' && existing.id === need.id} tone="need" theme={theme} onPress={() => choose({ side: 'need', kind: 'need', id: need.id })} />)
          ) : (
            usableOffers.length === 0 ? <EmptyInventory side={side} theme={theme} onCreate={() => navigation.navigate('CreateOffer')} /> : usableOffers.map((offer) => <InventoryRow key={offer.id} title={offer.title} description={offer.description} meta={offerMeta(offer)} status={offer.status} selected={existing?.kind === 'offer' && existing.id === offer.id} tone="offer" theme={theme} onPress={() => choose({ side: 'offer', kind: 'offer', id: offer.id })} />)
          )}
        </AppCard>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function EmptyInventory({ side, theme, onCreate }: { side: TradeCreateSide; theme: ThemeTokens; onCreate: () => void }) {
  return <View style={[styles.emptyBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><AppText style={styles.emptyTitle}>No saved {side === 'need' ? 'needs' : 'offers'} yet</AppText><AppText style={[styles.body, { color: theme.color.muted }]}>Create one now, then use it in a service or goods exchange.</AppText><Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={styles.secondaryButtonText}>Create {side === 'need' ? 'Need' : 'Offer'}</AppText></Pressable></View>;
}

function InventoryRow({ title, description, meta, status, selected, tone, theme, onPress }: { title: string; description: string; meta: string; status: string; selected: boolean; tone: 'need' | 'offer'; theme: ThemeTokens; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.inventoryRow, { borderColor: selected ? theme.semantic[tone].border : theme.color.border, backgroundColor: selected ? theme.semantic[tone].softBg : theme.color.subtleSurface }, pressed && styles.pressed]}><View style={styles.inventoryHeader}><AppText style={styles.inventoryTitle}>{title}</AppText><StatusBadge status={status} size="sm" /></View><AppText style={[styles.inventoryMeta, { color: selected ? theme.semantic[tone].text : theme.color.muted }]}>{meta}</AppText><AppText style={[styles.inventoryDescription, { color: selected ? theme.semantic[tone].text : theme.color.muted }]} numberOfLines={2}>{description}</AppText></Pressable>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 56, gap: 14 }, sectionHeader: { gap: 8 }, sectionTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.35 }, body: { lineHeight: 20, fontWeight: '700' }, inventoryRow: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 6 }, inventoryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, inventoryTitle: { flex: 1, fontSize: 18, fontWeight: '900' }, inventoryMeta: { fontSize: 13, lineHeight: 18, fontWeight: '900' }, inventoryDescription: { lineHeight: 20, fontWeight: '600' }, emptyBox: { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', padding: 14, gap: 10 }, emptyTitle: { fontSize: 17, fontWeight: '900' }, secondaryButton: { alignSelf: 'flex-start', borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 }, secondaryButtonText: { fontWeight: '900' }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] } });
