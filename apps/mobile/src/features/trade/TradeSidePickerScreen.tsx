import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InventoryTemplateDto, TradeExchangeMode } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useAuth } from '../../providers/AuthProvider';
import { itemTypeLabel, modeLabel } from './components/InventoryFormFields';
import { StarterInventoryLibrary } from './components/StarterInventoryLibrary';
import type { NeedItem, OfferItem } from './types';
import type { TradeCreateSide, TradeCreateSideSelection } from './CreateTradeScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'TradeSidePicker'>;
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };
type TemplatesResponse = { templates: InventoryTemplateDto[] };
type CloneResponse = { need?: NeedItem; offer?: OfferItem };
type SourceMode = 'mine' | 'starter' | null;

type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;
function optionalModeLabel(mode: TradeExchangeMode | null | undefined, t: TFunction) { return mode ? modeLabel(mode, t) : undefined; }
function needMeta(need: NeedItem, t: TFunction) { return [itemTypeLabel(need.itemType ?? 'service', t), need.category, need.timing, optionalModeLabel(need.mode, t), need.locationLabel].filter(Boolean).join(' · ') || t('trade.labels.needDetails'); }
function offerMeta(offer: OfferItem, t: TFunction) { return [itemTypeLabel(offer.itemType ?? 'service', t), offer.category, offer.availability, optionalModeLabel(offer.mode, t), offer.locationLabel].filter(Boolean).join(' · ') || t('trade.labels.offerDetails'); }
function isNeedAvailable(need: NeedItem) { return !['fulfilled', 'closed', 'expired'].includes(need.status); }
function isOfferAvailable(offer: OfferItem) { return !['accepted', 'closed', 'expired'].includes(offer.status); }
function itemSearchText(item: NeedItem | OfferItem) { return [item.title, item.description, item.category, 'timing' in item ? item.timing : undefined, 'availability' in item ? item.availability : undefined, item.locationLabel, ...(item.tags ?? [])].filter(Boolean).join(' ').toLowerCase(); }

export function TradeSidePickerScreen({ route, navigation }: Props) {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const auth = useAuth();
  const side = route.params.side;
  const existing = route.params.selection;
  const [sourceMode, setSourceMode] = useState<SourceMode>(null);
  const [query, setQuery] = useState('');
  const [needs, setNeeds] = useState<NeedItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [templates, setTemplates] = useState<InventoryTemplateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);

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

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const result = await api.inventoryTemplates.list({ kind: side, language, countryCode: auth.user?.profile?.countryCode ?? undefined, take: 100 }) as TemplatesResponse;
      setTemplates(Array.isArray(result.templates) ? result.templates : []);
    } catch (caughtError) {
      setTemplates([]);
      setTemplateError(getFriendlyApiErrorMessage(caughtError, t('trade.sidePicker.starterLibraryCouldNotLoad')));
    } finally {
      setTemplateLoading(false);
    }
  }, [auth.user?.profile?.countryCode, language, side]);

  useFocusEffect(useCallback(() => { void loadResources(); void loadTemplates(); }, [loadResources, loadTemplates]));

  const usableNeeds = useMemo(() => needs.filter(isNeedAvailable), [needs]);
  const usableOffers = useMemo(() => offers.filter(isOfferAvailable), [offers]);
  const label = side === 'need' ? t('inventory.labels.need') : t('inventory.labels.offer');
  const lowerLabel = label.toLowerCase();
  const pluralLabel = side === 'need' ? t('inventory.labels.needs') : t('inventory.labels.offers');
  const pluralLowerLabel = pluralLabel.toLowerCase();
  const title = sourceMode === 'mine' ? t('trade.sidePicker.chooseMineTitle', { items: pluralLowerLabel }) : sourceMode === 'starter' ? t('trade.sidePicker.chooseStarterTitle', { item: lowerLabel }) : t('trade.sidePicker.chooseSourceTitle', { item: lowerLabel });
  const activeLoading = sourceMode === 'starter' ? templateLoading : loading;
  const hasSavedItems = side === 'need' ? usableNeeds.length > 0 : usableOffers.length > 0;

  const filteredNeeds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return usableNeeds;
    return usableNeeds.filter((need) => itemSearchText(need).includes(needle));
  }, [query, usableNeeds]);
  const filteredOffers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return usableOffers;
    return usableOffers.filter((offer) => itemSearchText(offer).includes(needle));
  }, [query, usableOffers]);

  function createNewItem() {
    const returnTo = route.params.returnTo ?? 'createTrade';
    const params = { returnTo, tradeId: route.params.tradeId, tradeTitle: route.params.tradeTitle, proposalId: route.params.proposalId, proposalNeedId: route.params.proposalNeedId, proposalOfferId: route.params.proposalOfferId };
    if (side === 'need') {
      navigation.navigate('CreateNeed', params);
      return;
    }
    navigation.navigate('CreateOffer', params);
  }

  function choose(selection: TradeCreateSideSelection) {
    const selectedProposalNeedId = selection.kind === 'need' ? selection.id : route.params.proposalNeedId;
    const selectedProposalOfferId = selection.kind === 'offer' ? selection.id : route.params.proposalOfferId;
    if (route.params.returnTo === 'proposalDetail' && route.params.proposalId) {
      navigation.navigate('ProposalDetail', {
        proposalId: route.params.proposalId,
        selectedProposalSide: selection,
        selectedProposalNeedId,
        selectedProposalOfferId,
      });
      return;
    }
    if (route.params.returnTo === 'tradeProposal' && route.params.tradeId) {
      navigation.navigate('TradeDetail', {
        tradeId: route.params.tradeId,
        title: route.params.tradeTitle,
        selectedProposalSide: selection,
        selectedProposalNeedId,
        selectedProposalOfferId,
      });
      return;
    }
    navigation.navigate('CreateTrade', { selectedTradeSide: selection });
  }

  async function cloneTemplate(template: InventoryTemplateDto) {
    setTemplateError(null);
    try {
      setCloningTemplateId(template.id);
      const response = await api.inventoryTemplates.clone(template.id, { status: 'active' }) as CloneResponse;
      if (side === 'need') {
        if (!response.need) throw new Error(t('inventory.errors.starterSavedUnreadableNeed'));
        choose({ side: 'need', kind: 'need', id: response.need.id });
        return;
      }
      if (!response.offer) throw new Error(t('inventory.errors.starterSavedUnreadableOffer'));
      choose({ side: 'offer', kind: 'offer', id: response.offer.id });
    } catch (caughtError) {
      setTemplateError(getFriendlyApiErrorMessage(caughtError, t('trade.sidePicker.couldNotSaveStarter', { item: label })));
      setCloningTemplateId(null);
    }
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title={title} onBack={() => sourceMode ? setSourceMode(null) : navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={activeLoading} onRefresh={() => { void loadResources(); void loadTemplates(); }} />}>
        {!sourceMode ? (
          <SourceChoice side={side} theme={theme} onMine={() => { setSourceMode('mine'); setQuery(''); }} onStarter={() => { setSourceMode('starter'); setQuery(''); }} />
        ) : sourceMode === 'starter' ? (
          <View style={styles.modeContent}>
            <InfoNotice tone="instruction" title={t('inventory.labels.starterLibrary')} body={t('trade.sidePicker.chooseStarterBody', { item: lowerLabel })} />
            <StarterInventoryLibrary kind={side} templates={templates} loading={templateLoading} error={templateError} cloningTemplateId={cloningTemplateId} actionLabel={t('trade.sidePicker.useThis', { item: label })} onUseTemplate={(template) => { void cloneTemplate(template); }} />
          </View>
        ) : (
          <View style={styles.modeContent}>
            {error ? <InfoNotice tone="warning" title={t('inventory.errors.itemCouldNotLoad')} body={error} /> : null}
            {hasSavedItems ? <CreateNewInventoryAction side={side} theme={theme} onCreate={createNewItem} /> : null}
            <View style={[styles.searchBox, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}><MobileIcon name="search" size={18} color={theme.color.muted} /><TextInput value={query} onChangeText={setQuery} placeholder={t('trade.sidePicker.searchSaved', { items: pluralLowerLabel })} placeholderTextColor={theme.color.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={[styles.searchInput, { color: theme.color.text }]} /></View>
            <AppCard>
              <View style={styles.sectionHeader}><SemanticBadge label={label} tone={side === 'need' ? 'need' : 'offer'} /><AppText style={styles.sectionTitle}>{t('trade.sidePicker.myItems', { items: pluralLowerLabel })}</AppText></View>
              {side === 'need' ? (
                filteredNeeds.length === 0 ? <EmptyInventory side={side} theme={theme} hasSavedItems={hasSavedItems} onCreate={createNewItem} /> : filteredNeeds.map((need) => <InventoryRow key={need.id} title={need.title} description={need.description} meta={needMeta(need, t)} status={need.status} selected={existing?.kind === 'need' && existing.id === need.id} tone="need" theme={theme} onPress={() => choose({ side: 'need', kind: 'need', id: need.id })} />)
              ) : (
                filteredOffers.length === 0 ? <EmptyInventory side={side} theme={theme} hasSavedItems={hasSavedItems} onCreate={createNewItem} /> : filteredOffers.map((offer) => <InventoryRow key={offer.id} title={offer.title} description={offer.description} meta={offerMeta(offer, t)} status={offer.status} selected={existing?.kind === 'offer' && existing.id === offer.id} tone="offer" theme={theme} onPress={() => choose({ side: 'offer', kind: 'offer', id: offer.id })} />)
              )}
            </AppCard>
          </View>
        )}
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function SourceChoice({ side, theme, onMine, onStarter }: { side: TradeCreateSide; theme: ThemeTokens; onMine: () => void; onStarter: () => void }) {
  const { t } = useTranslation();
  const label = side === 'need' ? t('inventory.labels.need') : t('inventory.labels.offer');
  const pluralLabel = side === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase();
  const tone = side === 'need' ? 'need' : 'offer';
  return <View style={styles.modeContent}><InfoNotice tone="instruction" title={t('trade.sidePicker.chooseSourceTitle', { item: label.toLowerCase() })} body={t('trade.sidePicker.chooseSourceBody', { items: pluralLabel, item: label.toLowerCase() })} /><Pressable accessibilityRole="button" onPress={onMine} style={({ pressed }) => [styles.sourceChoiceCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><View style={[styles.sourceIcon, { backgroundColor: theme.semantic[tone].softBg, borderColor: theme.semantic[tone].border }]}><MobileIcon name={side} size={24} color={theme.semantic[tone].text} /></View><View style={styles.sourceCopy}><AppText style={styles.sourceTitle}>{t('trade.sidePicker.useMine')}</AppText><AppText style={[styles.sourceBody, { color: theme.color.muted }]}>{t('trade.sidePicker.useMineBody', { items: pluralLabel })}</AppText></View><MobileIcon name="chevron-right" size={20} color={theme.color.muted} /></Pressable><Pressable accessibilityRole="button" onPress={onStarter} style={({ pressed }) => [styles.sourceChoiceCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><View style={[styles.sourceIcon, { backgroundColor: theme.semantic.instruction.softBg, borderColor: theme.semantic.instruction.border }]}><MobileIcon name="search" size={24} color={theme.semantic.instruction.text} /></View><View style={styles.sourceCopy}><AppText style={styles.sourceTitle}>{t('trade.sidePicker.useStarter')}</AppText><AppText style={[styles.sourceBody, { color: theme.color.muted }]}>{t('trade.sidePicker.useStarterBody')}</AppText></View><MobileIcon name="chevron-right" size={20} color={theme.color.muted} /></Pressable></View>;
}

function CreateNewInventoryAction({ side, theme, onCreate }: { side: TradeCreateSide; theme: ThemeTokens; onCreate: () => void }) {
  const { t } = useTranslation();
  const label = side === 'need' ? t('inventory.labels.need') : t('inventory.labels.offer');
  const tone = side === 'need' ? 'need' : 'offer';
  return <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.createNewCard, { backgroundColor: theme.semantic[tone].softBg, borderColor: theme.semantic[tone].border }, pressed && styles.pressed]}><View style={[styles.createNewIcon, { backgroundColor: theme.color.surface, borderColor: theme.semantic[tone].border }]}><MobileIcon name={side} size={22} color={theme.semantic[tone].text} /></View><View style={styles.sourceCopy}><AppText style={[styles.sourceTitle, { color: theme.semantic[tone].text }]}>{t('trade.sidePicker.createNew', { item: label })}</AppText><AppText style={[styles.sourceBody, { color: theme.semantic[tone].text }]}>{t('trade.sidePicker.createNewBody')}</AppText></View><MobileIcon name="chevron-right" size={20} color={theme.semantic[tone].text} /></Pressable>;
}

function EmptyInventory({ side, theme, hasSavedItems, onCreate }: { side: TradeCreateSide; theme: ThemeTokens; hasSavedItems: boolean; onCreate: () => void }) {
  const { t } = useTranslation();
  const label = side === 'need' ? t('inventory.labels.need') : t('inventory.labels.offer');
  const pluralLabel = side === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase();
  return <View style={[styles.emptyBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><AppText style={styles.emptyTitle}>{hasSavedItems ? t('trade.sidePicker.noMatches') : t('trade.sidePicker.noSavedYet', { items: pluralLabel })}</AppText><AppText style={[styles.body, { color: theme.color.muted }]}>{hasSavedItems ? t('trade.sidePicker.noMatchesBody') : t('trade.sidePicker.noSavedBody', { item: label.toLowerCase() })}</AppText><Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={styles.secondaryButtonText}>{t('common.actions.create')} {label}</AppText></Pressable></View>;
}

function InventoryRow({ title, description, meta, status, selected, tone, theme, onPress }: { title: string; description: string; meta: string; status: string; selected: boolean; tone: 'need' | 'offer'; theme: ThemeTokens; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.inventoryRow, { borderColor: selected ? theme.semantic[tone].border : theme.color.border, backgroundColor: selected ? theme.semantic[tone].softBg : theme.color.subtleSurface }, pressed && styles.pressed]}><View style={styles.inventoryHeader}><AppText style={styles.inventoryTitle} numberOfLines={2}>{title}</AppText><StatusBadge status={status} size="sm" /></View><AppText style={[styles.inventoryMeta, { color: selected ? theme.semantic[tone].text : theme.color.muted }]} numberOfLines={1}>{meta}</AppText><AppText style={[styles.inventoryDescription, { color: selected ? theme.semantic[tone].text : theme.color.muted }]} numberOfLines={2}>{description}</AppText></Pressable>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 56, gap: 14 }, modeContent: { gap: 14 }, sectionHeader: { gap: 8 }, sectionTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.35 }, body: { lineHeight: 20, fontWeight: '700' }, sourceChoiceCard: { borderRadius: 24, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 }, createNewCard: { borderRadius: 24, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 }, createNewIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, sourceIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, sourceCopy: { flex: 1, gap: 4 }, sourceTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 }, sourceBody: { lineHeight: 20, fontWeight: '700' }, searchBox: { minHeight: 48, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, searchInput: { flex: 1, fontSize: 15, fontWeight: '800', paddingVertical: 0 }, inventoryRow: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 6 }, inventoryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, inventoryTitle: { flex: 1, fontSize: 18, fontWeight: '900' }, inventoryMeta: { fontSize: 13, lineHeight: 18, fontWeight: '900' }, inventoryDescription: { lineHeight: 20, fontWeight: '600' }, emptyBox: { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', padding: 14, gap: 10 }, emptyTitle: { fontSize: 17, fontWeight: '900' }, secondaryButton: { alignSelf: 'flex-start', borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 }, secondaryButtonText: { fontWeight: '900' }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] } });
