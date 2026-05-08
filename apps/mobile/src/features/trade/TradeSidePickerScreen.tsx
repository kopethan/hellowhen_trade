import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WalletDto } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, MoneyPill, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { modeLabel } from './components/InventoryFormFields';
import type { TradeCreateSideSelection } from './CreateTradeScreen';
import type { NeedItem, OfferItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'TradeSidePicker'>;
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };
type WalletResponse = { wallet: WalletDto | null };

function parseMoneyCents(value: string) {
  const amount = Number(value.replace(',', '.').trim());
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

function isNeedAvailable(need: NeedItem) { return !['fulfilled', 'closed', 'expired'].includes(need.status); }
function isOfferAvailable(offer: OfferItem) { return !['accepted', 'closed', 'expired'].includes(offer.status); }
function optionalModeLabel(mode?: string | null) { return mode === 'remote' || mode === 'local' || mode === 'hybrid' ? modeLabel(mode) : undefined; }
function needMeta(need: NeedItem) { return [need.category, need.timing, optionalModeLabel(need.mode), need.locationLabel].filter(Boolean).join(' · '); }
function offerMeta(offer: OfferItem) { return [offer.category, offer.availability, optionalModeLabel(offer.mode), offer.locationLabel].filter(Boolean).join(' · '); }

export function TradeSidePickerScreen({ route, navigation }: Props) {
  const side = route.params.side;
  const [needs, setNeeds] = useState<NeedItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [amount, setAmount] = useState(route.params.selection?.kind === 'money' ? (route.params.selection.amountCents / 100).toFixed(2) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = wallet?.currency ?? (route.params.selection?.kind === 'money' ? route.params.selection.currency : 'eur');
  const amountCents = parseMoneyCents(amount);
  const resources = useMemo(() => side === 'need' ? needs.filter(isNeedAvailable) : offers.filter(isOfferAvailable), [needs, offers, side]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [needsResult, offersResult, walletResult] = await Promise.all([
        side === 'need' ? api.needs.mine() as Promise<NeedsResponse> : Promise.resolve({ needs: [] }),
        side === 'offer' ? api.offers.mine() as Promise<OffersResponse> : Promise.resolve({ offers: [] }),
        api.wallet.me() as Promise<WalletResponse>,
      ]);
      setNeeds(Array.isArray(needsResult.needs) ? needsResult.needs : []);
      setOffers(Array.isArray(offersResult.offers) ? offersResult.offers : []);
      setWallet(walletResult.wallet ?? null);
    } catch (caughtError) {
      setNeeds([]); setOffers([]); setWallet(null); setError(getFriendlyApiErrorMessage(caughtError));
    } finally { setLoading(false); }
  }, [side]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function choose(selection: TradeCreateSideSelection) {
    navigation.navigate('CreateTrade', { selectedTradeSide: selection });
  }

  const moneyDisabled = amountCents <= 0 || (side === 'offer' && amountCents > (wallet?.availableBalanceCents ?? 0));
  const moneyHint = side === 'offer' ? `Available: ${formatMoney(wallet?.availableBalanceCents ?? 0, currency)}` : 'The accepted applicant pays this from wallet balance.';

  return <AppScreen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}><View style={styles.header}><SemanticBadge label={side === 'need' ? 'Need side' : 'Offer side'} tone={side === 'need' ? 'need' : 'offer'} /><AppText style={styles.title}>{side === 'need' ? 'Choose Need' : 'Choose Offer'}</AppText><AppText style={styles.subtitle}>{side === 'need' ? 'Select a saved need or request wallet money.' : 'Select a saved offer or offer wallet money.'}</AppText></View>{error ? <InfoNotice tone="danger" title="Could not load choices" body={error} /> : null}<AppCard><View style={styles.moneyHeader}><View style={styles.moneyCopy}><AppText style={styles.sectionTitle}>Wallet money</AppText><AppText style={styles.cardText}>{moneyHint}</AppText></View>{amountCents > 0 ? <MoneyPill amountCents={amountCents} currency={currency} label={side === 'need' ? 'needed' : 'offered'} /> : null}</View><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94A3B8" style={styles.input} /><Pressable accessibilityRole="button" disabled={moneyDisabled} onPress={() => choose(side === 'need' ? { side, kind: 'money', amountCents, currency } : { side, kind: 'money', amountCents, currency })} style={({ pressed }) => [styles.primaryButton, moneyDisabled && styles.disabled, pressed && !moneyDisabled && styles.pressed]}><AppText style={styles.primaryButtonText}>{side === 'need' ? 'Request money' : 'Offer money'}</AppText></Pressable></AppCard><View style={styles.listHeader}><AppText style={styles.sectionTitle}>{side === 'need' ? 'Saved needs' : 'Saved offers'}</AppText></View>{resources.length === 0 ? <AppCard><AppText style={styles.cardText}>{loading ? 'Loading choices...' : side === 'need' ? 'No available saved needs.' : 'No available saved offers.'}</AppText></AppCard> : resources.map((item) => side === 'need' ? <NeedChoice key={item.id} item={item as NeedItem} onPress={() => choose({ side, kind: 'need', id: item.id })} /> : <OfferChoice key={item.id} item={item as OfferItem} onPress={() => choose({ side, kind: 'offer', id: item.id })} />)}<Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><AppText style={styles.backButtonText}>Back</AppText></Pressable></ScrollView></AppScreen>;
}

function NeedChoice({ item, onPress }: { item: NeedItem; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}><AppCard><View style={styles.cardHeader}><AppText style={styles.choiceTitle}>{item.title}</AppText><StatusBadge status={item.status} size="sm" /></View><AppText style={styles.cardText}>{needMeta(item) || 'Need details'}</AppText><AppText style={styles.bodyText} numberOfLines={2}>{item.description}</AppText></AppCard></Pressable>; }
function OfferChoice({ item, onPress }: { item: OfferItem; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}><AppCard><View style={styles.cardHeader}><AppText style={styles.choiceTitle}>{item.title}</AppText><StatusBadge status={item.status} size="sm" /></View><AppText style={styles.cardText}>{offerMeta(item) || 'Offer details'}</AppText><AppText style={styles.bodyText} numberOfLines={2}>{item.description}</AppText></AppCard></Pressable>; }

const styles = StyleSheet.create({ content: { paddingBottom: 56, gap: 14 }, header: { gap: 8 }, title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { color: '#64748B', lineHeight: 21, fontWeight: '700' }, sectionTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900' }, cardText: { color: '#64748B', lineHeight: 20, fontWeight: '700' }, bodyText: { color: '#475569', lineHeight: 20, fontWeight: '600' }, moneyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, moneyCopy: { flex: 1, gap: 5 }, input: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 14, color: '#0F172A', fontSize: 18, fontWeight: '900' }, primaryButton: { borderRadius: 18, backgroundColor: '#0F766E', paddingVertical: 14, alignItems: 'center' }, primaryButtonText: { color: '#FFFFFF', fontWeight: '900' }, listHeader: { paddingTop: 2 }, cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, choiceTitle: { flex: 1, color: '#0F172A', fontSize: 20, fontWeight: '900' }, backButton: { borderRadius: 18, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingVertical: 14, alignItems: 'center' }, backButtonText: { color: '#334155', fontWeight: '900' }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.78 } });
