import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { InventoryTemplateDto } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCollapsibleHeaderScreen } from '../../components/AppCollapsibleHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { StarterInventoryLibrary } from './components/StarterInventoryLibrary';
import { InventoryCompactRow } from './components/InventoryCompactRow';
import type { OfferItem } from './types';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useAuth } from '../../providers/AuthProvider';

type ApiResponse = { offers: OfferItem[] };
type TemplatesResponse = { templates: InventoryTemplateDto[] };
type CloneResponse = { offer?: OfferItem };
type SourceTab = 'mine' | 'starter';

export function MyOffersScreen() {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [sourceTab, setSourceTab] = useState<SourceTab>('mine');
  const [items, setItems] = useState<OfferItem[]>([]);
  const [templates, setTemplates] = useState<InventoryTemplateDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdOffer, setCreatedOffer] = useState<OfferItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.offers.mine() as ApiResponse;
      setItems(Array.isArray(result.offers) ? result.offers : []);
    } catch (caughtError) {
      setItems([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const result = await api.inventoryTemplates.list({ kind: 'offer', language, countryCode: auth.user?.profile?.countryCode ?? undefined, take: 100 }) as TemplatesResponse;
      setTemplates(Array.isArray(result.templates) ? result.templates : []);
    } catch (caughtError) {
      setTemplates([]);
      setTemplateError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.starterOffersCouldNotLoad')));
    } finally {
      setTemplateLoading(false);
    }
  }, [auth.user?.profile?.countryCode, language, t]);

  useFocusEffect(useCallback(() => { void loadItems(); void loadTemplates(); }, [loadItems, loadTemplates]));

  const activeLoading = sourceTab === 'starter' ? templateLoading : loading;
  const header = <View style={styles.headerRow}><View style={styles.headerCopy}><SemanticBadge label={t('inventory.labels.offer')} tone="offer" /><AppText style={styles.title}>{t('inventory.labels.offers')}</AppText><AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('inventory.empty.offerNativeBody')}</AppText></View><Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateOffer')} style={({ pressed }) => [styles.createButton, { backgroundColor: theme.semantic.offer.bg }, pressed && styles.pressed]}><View style={styles.createButtonContent}><MobileIcon name="add" size={16} color={theme.color.background} /><AppText style={[styles.createButtonText, { color: theme.color.background }]}>{t('common.actions.create')}</AppText></View></Pressable></View>;

  const sortedItems = useMemo(() => items, [items]);

  async function cloneTemplate(template: InventoryTemplateDto) {
    setNotice(null);
    setCreatedOffer(null);
    setTemplateError(null);
    try {
      setCloningTemplateId(template.id);
      const result = await api.inventoryTemplates.clone(template.id, { status: 'active' }) as CloneResponse;
      if (!result.offer) throw new Error(t('inventory.errors.starterSavedUnreadableOffer'));
      setItems((current) => [result.offer!, ...current.filter((item) => item.id !== result.offer!.id)]);
      setCreatedOffer(result.offer);
      setNotice(t('inventory.messages.starterSavedToMine', { title: result.offer.title, collection: t('inventory.labels.myOffers') }));
      setSourceTab('mine');
    } catch (caughtError) {
      setTemplateError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.couldNotSaveStarterOffer')));
    } finally {
      setCloningTemplateId(null);
    }
  }

  return (
    <AppCollapsibleHeaderScreen header={header} resetKey={sourceTab}>
      {(scrollProps) => (
        <ScrollView {...scrollProps.scrollViewProps} contentContainerStyle={[scrollProps.contentInsetStyle, styles.content]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={activeLoading} onRefresh={() => { void loadItems(); void loadTemplates(); }} />}>
          <SourceTabs value={sourceTab} onChange={(nextTab) => { setSourceTab(nextTab); setNotice(null); setCreatedOffer(null); }} />
          {notice ? <InfoNotice tone="success" title={t('inventory.messages.starterSaved')} body={notice} /> : null}
          {createdOffer ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('OfferDetail', { offerId: createdOffer.id, title: createdOffer.title })} style={({ pressed }) => [styles.openCreatedButton, { backgroundColor: theme.semantic.offer.softBg, borderColor: theme.semantic.offer.border }, pressed && styles.pressed]}><AppText style={[styles.openCreatedText, { color: theme.semantic.offer.text }]}>{t('inventory.actions.openSavedOffer')}</AppText><MobileIcon name="chevron-right" size={18} color={theme.semantic.offer.text} /></Pressable> : null}
          {sourceTab === 'starter' ? <StarterInventoryLibrary kind="offer" templates={templates} loading={templateLoading} error={templateError} cloningTemplateId={cloningTemplateId} actionLabel={t('inventory.actions.useThisOffer')} onUseTemplate={(template) => { void cloneTemplate(template); }} /> : <>
            {error ? <InfoNotice tone="danger" title={t('inventory.errors.couldNotLoadOffer')} body={error} /> : null}
            {sortedItems.length === 0 ? <EmptyInventoryPlaceholder title={t('inventory.empty.createFirstOffer')} body={t('inventory.empty.offerNativeBody')} tone="offer" onPress={() => navigation.navigate('CreateOffer')} /> : sortedItems.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => navigation.navigate('OfferDetail', { offerId: item.id, title: item.title })} style={({ pressed }) => [pressed && styles.pressed]}><InventoryCompactRow kind="offer" item={item} /></Pressable>)}
          </>}
        </ScrollView>
      )}
    </AppCollapsibleHeaderScreen>
  );
}

function SourceTabs({ value, onChange }: { value: SourceTab; onChange: (value: SourceTab) => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return <View style={[styles.sourceTabs, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><SourceTabButton label={t('inventory.labels.myOffers')} active={value === 'mine'} onPress={() => onChange('mine')} /><SourceTabButton label={t('inventory.labels.starterOffers')} active={value === 'starter'} onPress={() => onChange('starter')} /></View>;
}

function SourceTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useThemeTokens();
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.sourceTabButton, active && { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.sourceTabText, { color: active ? theme.color.text : theme.color.muted }]}>{label}</AppText></Pressable>;
}

function EmptyInventoryPlaceholder({ title, body, tone, onPress }: { title: string; body: string; tone: 'need' | 'offer'; onPress: () => void }) {
  const theme = useThemeTokens();
  const semantic = tone === 'need' ? theme.semantic.need : theme.semantic.offer;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.emptyPlaceholder, { borderColor: semantic.border, backgroundColor: theme.color.subtleSurface }, pressed && styles.pressed]}>
      <View style={[styles.emptyIcon, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}><MobileIcon name={tone} size={22} color={semantic.text} /></View>
      <AppText style={styles.emptyTitle}>{title}</AppText>
      <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{body}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({ content: { paddingBottom: 28, gap: 14 }, headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }, headerCopy: { flex: 1, gap: 8 }, title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 }, subtitle: { lineHeight: 20, fontWeight: '600' }, createButton: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 }, createButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 7 }, createButtonText: { color: '#FFFFFF', fontWeight: '900' }, sourceTabs: { flexDirection: 'row', borderRadius: 22, borderWidth: 1, padding: 4, gap: 4 }, sourceTabButton: { flex: 1, minHeight: 44, borderRadius: 18, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, sourceTabText: { fontSize: 13, fontWeight: '900' }, openCreatedButton: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, openCreatedText: { fontWeight: '900' }, emptyPlaceholder: { minHeight: 208, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 22, gap: 10 }, emptyIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { textAlign: 'center', fontSize: 22, fontWeight: '900', letterSpacing: -0.35 }, emptyBody: { textAlign: 'center', lineHeight: 20, fontWeight: '700' }, pressed: { opacity: 0.78 } });
