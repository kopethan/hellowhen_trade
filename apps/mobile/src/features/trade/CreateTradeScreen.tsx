// apps/mobile/src/features/trade/CreateTradeScreen.tsx

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TradeExchangeMode } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, MoneyPill, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { modeLabel } from './components/InventoryFormFields';
import type { NeedItem, OfferItem, TradeDeckItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTrade'>;
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };
type CreateTradeResponse = { trade: TradeDeckItem };

type InventoryKind = 'need' | 'offer';

const expiryOptions = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: 'No expiry', days: null },
] as const;

function isNeedAvailable(need: NeedItem) {
  return !['fulfilled', 'closed', 'expired'].includes(need.status);
}

function isOfferAvailable(offer: OfferItem) {
  return !['accepted', 'closed', 'expired'].includes(offer.status);
}

function optionalModeLabel(mode?: TradeExchangeMode | null) {
  return mode ? modeLabel(mode) : undefined;
}

function needMeta(need?: NeedItem | null) {
  if (!need) return '';
  return [need.category, need.timing, optionalModeLabel(need.mode), need.locationLabel].filter(Boolean).join(' · ');
}

function offerMeta(offer?: OfferItem | null) {
  if (!offer) return '';
  return [offer.category, offer.availability, optionalModeLabel(offer.mode), offer.locationLabel].filter(Boolean).join(' · ');
}

function imageSummary(item: { media?: unknown[] }) {
  const count = item.media?.length ?? 0;
  if (count === 0) return 'No images yet';
  return `${count} image${count === 1 ? '' : 's'}`;
}

function buildExpiresAt(days: number | null) {
  if (!days) return undefined;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
}

function parseMoneyAmount(value: string) {
  const normalized = value.trim().replace(',', '.');
  const amount = normalized.length === 0 ? 0 : Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount < 0) return Number.NaN;
  return Math.round(amount * 100);
}

export function CreateTradeScreen({ navigation }: Props) {
  const [needs, setNeeds] = useState<NeedItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [selectedNeedId, setSelectedNeedId] = useState<string | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [walletAmount, setWalletAmount] = useState('0');
  const [expiryDays, setExpiryDays] = useState<number | null>(14);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usableNeeds = useMemo(() => needs.filter(isNeedAvailable), [needs]);
  const usableOffers = useMemo(() => offers.filter(isOfferAvailable), [offers]);
  const selectedNeed = useMemo(() => usableNeeds.find((need) => need.id === selectedNeedId) ?? null, [selectedNeedId, usableNeeds]);
  const selectedOffer = useMemo(() => usableOffers.find((offer) => offer.id === selectedOfferId) ?? null, [selectedOfferId, usableOffers]);
  const previewAmountCents = parseMoneyAmount(walletAmount);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [needsResult, offersResult] = await Promise.all([
        api.needs.mine() as Promise<NeedsResponse>,
        api.offers.mine() as Promise<OffersResponse>,
      ]);

      const nextNeeds = Array.isArray(needsResult.needs) ? needsResult.needs : [];
      const nextOffers = Array.isArray(offersResult.offers) ? offersResult.offers : [];
      const nextUsableNeeds = nextNeeds.filter(isNeedAvailable);
      const nextUsableOffers = nextOffers.filter(isOfferAvailable);

      setNeeds(nextNeeds);
      setOffers(nextOffers);
      setSelectedNeedId((current) => nextUsableNeeds.some((need) => need.id === current) ? current : nextUsableNeeds[0]?.id ?? null);
      setSelectedOfferId((current) => nextUsableOffers.some((offer) => offer.id === current) ? current : nextUsableOffers[0]?.id ?? null);
    } catch (caughtError) {
      setNeeds([]);
      setOffers([]);
      setSelectedNeedId(null);
      setSelectedOfferId(null);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadInventory();
  }, [loadInventory]));

  async function handlePublish() {
    const amountCents = parseMoneyAmount(walletAmount);

    if (!selectedNeed) {
      setError('Choose one saved need before publishing.');
      return;
    }
    if (!selectedOffer) {
      setError('Choose one saved offer before publishing.');
      return;
    }
    if (!Number.isFinite(amountCents)) {
      setError('Wallet amount must be zero or a valid money amount.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await api.trades.create({
        needId: selectedNeed.id,
        offerId: selectedOffer.id,
        creditAmount: 0,
        amountCents,
        currency: 'eur',
        expiresAt: buildExpiresAt(expiryDays),
      }) as CreateTradeResponse;

      navigation.replace('TradeDetail', {
        tradeId: result.trade.id,
        title: result.trade.title,
        description: result.trade.description,
        amountCents: result.trade.amountCents ?? 0,
        currency: result.trade.currency ?? 'eur',
        creditAmount: result.trade.creditAmount ?? 0,
        status: result.trade.status,
        expiresAt: result.trade.expiresAt ?? null,
      });
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadInventory(); }} />}
      >
        <View style={styles.header}>
          <SemanticBadge label="Trade" tone="trade" />
          <AppText style={styles.title}>Publish Trade</AppText>
          <AppText style={styles.subtitle}>Pair one saved Need with one saved Offer. The public deck will use images from those two items.</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title="Could not publish" body={error} /> : null}

        <InventorySection
          title="Choose Need"
          kind="need"
          items={usableNeeds}
          selectedId={selectedNeedId}
          onSelect={setSelectedNeedId}
          emptyTitle="No needs ready"
          emptyBody="Save a need first, then come back to publish it in a trade."
          createLabel="Save Need"
          onCreate={() => navigation.navigate('CreateNeed')}
        />

        <InventorySection
          title="Choose Offer"
          kind="offer"
          items={usableOffers}
          selectedId={selectedOfferId}
          onSelect={setSelectedOfferId}
          emptyTitle="No offers ready"
          emptyBody="Save an offer first, then pair it with a need."
          createLabel="Save Offer"
          onCreate={() => navigation.navigate('CreateOffer')}
        />

        <AppCard>
          <AppText style={styles.sectionTitle}>Wallet and expiry</AppText>
          <View style={styles.field}>
            <AppText style={styles.label}>Optional wallet amount</AppText>
            <TextInput
              value={walletAmount}
              onChangeText={setWalletAmount}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              editable={!submitting}
              style={styles.input}
            />
          </View>
          {Number.isFinite(previewAmountCents) && previewAmountCents > 0 ? <MoneyPill amountCents={previewAmountCents} currency="eur" label="optional" /> : null}

          <View style={styles.field}>
            <AppText style={styles.label}>Expiry</AppText>
            <View style={styles.expiryRow}>
              {expiryOptions.map((option) => {
                const selected = expiryDays === option.days;
                return (
                  <Pressable
                    key={option.label}
                    disabled={submitting}
                    onPress={() => setExpiryDays(option.days)}
                    style={({ pressed }) => [styles.expiryButton, selected && styles.expiryButtonSelected, submitting && styles.disabled, pressed && styles.pressed]}
                  >
                    <AppText style={[styles.expiryButtonText, selected && styles.expiryButtonTextSelected]}>{option.label}</AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Deck preview</AppText>
          <TradeSummaryPreview need={selectedNeed} offer={selectedOffer} amountCents={previewAmountCents} />
          <InfoNotice tone="info" body="Only approved Need and Offer images appear in public decks. Pending images stay visible to you while admin reviews them." />
        </AppCard>

        <View style={styles.actions}>
          <Pressable disabled={submitting || loading} onPress={handlePublish} style={({ pressed }) => [styles.primaryButton, (submitting || loading) && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{submitting ? 'Publishing...' : 'Publish Trade'}</AppText>
          </Pressable>
          <Pressable disabled={submitting} onPress={() => navigation.goBack()} style={({ pressed }) => [styles.secondaryButton, submitting && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.secondaryButtonText}>Cancel</AppText>
          </Pressable>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function InventorySection({
  title,
  kind,
  items,
  selectedId,
  onSelect,
  emptyTitle,
  emptyBody,
  createLabel,
  onCreate,
}: {
  title: string;
  kind: InventoryKind;
  items: Array<NeedItem | OfferItem>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyTitle: string;
  emptyBody: string;
  createLabel: string;
  onCreate: () => void;
}) {
  return (
    <AppCard>
      <View style={styles.sectionHeaderRow}>
        <AppText style={styles.sectionTitle}>{title}</AppText>
        <Pressable onPress={onCreate} style={({ pressed }) => [styles.smallCreateButton, pressed && styles.pressed]}>
          <AppText style={styles.smallCreateButtonText}>{createLabel}</AppText>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyBox}>
          <AppText style={styles.emptyTitle}>{emptyTitle}</AppText>
          <AppText style={styles.emptyBody}>{emptyBody}</AppText>
        </View>
      ) : (
        <View style={styles.optionList}>
          {items.map((item) => {
            const selected = selectedId === item.id;
            const meta = kind === 'need' ? needMeta(item as NeedItem) : offerMeta(item as OfferItem);
            return (
              <Pressable key={item.id} onPress={() => onSelect(item.id)} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
                <View style={styles.optionTopRow}>
                  <View style={styles.optionTitleWrap}>
                    <AppText style={styles.optionEyebrow}>{kind === 'need' ? 'I need' : 'I offer'}</AppText>
                    <AppText style={styles.optionTitle}>{item.title}</AppText>
                  </View>
                  <View style={styles.optionBadges}>
                    <StatusBadge status={item.status} size="sm" />
                    {selected ? <SemanticBadge label="Selected" tone="trade" size="sm" /> : null}
                  </View>
                </View>
                {meta ? <AppText style={styles.optionMeta}>{meta}</AppText> : null}
                <AppText style={styles.optionDescription} numberOfLines={2}>{item.description}</AppText>
                <AppText style={styles.optionImages}>{imageSummary(item)}</AppText>
              </Pressable>
            );
          })}
        </View>
      )}
    </AppCard>
  );
}

function TradeSummaryPreview({ need, offer, amountCents }: { need: NeedItem | null; offer: OfferItem | null; amountCents: number }) {
  return (
    <View style={styles.previewCard}>
      <View style={styles.previewHeaderRow}>
        <AppText style={styles.previewHeader}>TRADE · PREVIEW</AppText>
        <AppText style={styles.previewStatus}>OPEN</AppText>
      </View>

      <View style={styles.previewBlock}>
        <AppText style={styles.previewEyebrow}>I need</AppText>
        <AppText style={styles.previewTitle}>{need?.title || 'Choose a need'}</AppText>
        <AppText style={styles.previewMeta}>{need ? needMeta(need) || 'Need details' : 'Category · Timing · Mode'}</AppText>
      </View>

      <View style={styles.swapRow}>
        <View style={styles.swapLine} />
        <View style={styles.swapCircle}><AppText style={styles.swapIcon}>↔</AppText></View>
        <View style={styles.swapLine} />
      </View>

      <View style={styles.previewBlock}>
        <AppText style={styles.previewEyebrow}>I offer</AppText>
        <AppText style={styles.previewTitle}>{offer?.title || 'Choose an offer'}</AppText>
        <AppText style={styles.previewMeta}>{offer ? offerMeta(offer) || 'Offer details' : 'Category · Availability · Mode'}</AppText>
      </View>

      {Number.isFinite(amountCents) && amountCents > 0 ? <MoneyPill amountCents={amountCents} currency="eur" label="optional" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
    gap: 14,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    color: '#64748B',
    lineHeight: 21,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  smallCreateButton: {
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallCreateButtonText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    padding: 14,
    gap: 5,
  },
  emptyTitle: {
    color: '#0F172A',
    fontWeight: '900',
  },
  emptyBody: {
    color: '#64748B',
    lineHeight: 20,
    fontWeight: '600',
  },
  optionList: {
    gap: 10,
  },
  option: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 14,
    gap: 7,
  },
  optionSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  optionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  optionTitleWrap: {
    flex: 1,
    gap: 3,
  },
  optionEyebrow: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  optionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  optionBadges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  optionMeta: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  optionDescription: {
    color: '#64748B',
    lineHeight: 19,
    fontWeight: '600',
  },
  optionImages: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  field: {
    gap: 8,
  },
  label: {
    color: '#0F172A',
    fontWeight: '900',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  expiryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expiryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  expiryButtonSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  expiryButtonText: {
    color: '#475569',
    fontWeight: '900',
  },
  expiryButtonTextSelected: {
    color: '#6D28D9',
  },
  previewCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 14,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewHeader: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  previewStatus: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  previewBlock: {
    gap: 5,
  },
  previewEyebrow: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  previewTitle: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  previewMeta: {
    color: '#475569',
    fontWeight: '800',
    lineHeight: 20,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  swapCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  swapIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  previewCredits: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontWeight: '900',
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: '#7C3AED',
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.78,
  },
});
