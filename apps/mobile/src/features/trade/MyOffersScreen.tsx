import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { InventoryTemplateDto } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { MediaStrip } from './components/MediaStrip';
import { StarterInventoryLibrary } from './components/StarterInventoryLibrary';
import type { OfferItem } from './types';
import { useThemeTokens } from '../../providers/ThemeProvider';

type ApiResponse = { offers: OfferItem[] };
type TemplatesResponse = { templates: InventoryTemplateDto[] };
type CloneResponse = { offer?: OfferItem };
type SourceTab = 'mine' | 'starter';

export function MyOffersScreen() {
  const theme = useThemeTokens();
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
  }, []);

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const result = await api.inventoryTemplates.list({ kind: 'offer', take: 100 }) as TemplatesResponse;
      setTemplates(Array.isArray(result.templates) ? result.templates : []);
    } catch (caughtError) {
      setTemplates([]);
      setTemplateError(getFriendlyApiErrorMessage(caughtError, 'Starter offers could not be loaded.'));
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadItems(); void loadTemplates(); }, [loadItems, loadTemplates]));

  const activeLoading = sourceTab === 'starter' ? templateLoading : loading;
  const header = <View style={styles.headerRow}><View style={styles.headerCopy}><SemanticBadge label="Offer" tone="offer" /><AppText style={styles.title}>Offers</AppText><AppText style={[styles.subtitle, { color: theme.color.muted }]}>Save reusable services or start from the Hellowhen Library.</AppText></View><Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateOffer')} style={({ pressed }) => [styles.createButton, { backgroundColor: theme.semantic.offer.bg }, pressed && styles.pressed]}><View style={styles.createButtonContent}><MobileIcon name="add" size={16} color={theme.color.background} /><AppText style={[styles.createButtonText, { color: theme.color.background }]}>Create</AppText></View></Pressable></View>;

  const sortedItems = useMemo(() => items, [items]);

  async function cloneTemplate(template: InventoryTemplateDto) {
    setNotice(null);
    setCreatedOffer(null);
    setTemplateError(null);
    try {
      setCloningTemplateId(template.id);
      const result = await api.inventoryTemplates.clone(template.id, { status: 'active' }) as CloneResponse;
      if (!result.offer) throw new Error('Starter Offer was saved, but the response could not be read.');
      setItems((current) => [result.offer!, ...current.filter((item) => item.id !== result.offer!.id)]);
      setCreatedOffer(result.offer);
      setNotice(`${result.offer.title} was saved to My Offers.`);
      setSourceTab('mine');
    } catch (caughtError) {
      setTemplateError(getFriendlyApiErrorMessage(caughtError, 'Could not save this starter Offer.'));
    } finally {
      setCloningTemplateId(null);
    }
  }

  return <AppFixedHeaderScreen header={header}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={activeLoading} onRefresh={() => { void loadItems(); void loadTemplates(); }} />}>
    <SourceTabs value={sourceTab} onChange={(nextTab) => { setSourceTab(nextTab); setNotice(null); setCreatedOffer(null); }} />
    {notice ? <InfoNotice tone="success" title="Starter saved" body={notice} /> : null}
    {createdOffer ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('OfferDetail', { offerId: createdOffer.id, title: createdOffer.title })} style={({ pressed }) => [styles.openCreatedButton, { backgroundColor: theme.semantic.offer.softBg, borderColor: theme.semantic.offer.border }, pressed && styles.pressed]}><AppText style={[styles.openCreatedText, { color: theme.semantic.offer.text }]}>Open saved Offer</AppText><MobileIcon name="chevron-right" size={18} color={theme.semantic.offer.text} /></Pressable> : null}
    {sourceTab === 'starter' ? <StarterInventoryLibrary kind="offer" templates={templates} loading={templateLoading} error={templateError} cloningTemplateId={cloningTemplateId} actionLabel="Use this Offer" onUseTemplate={(template) => { void cloneTemplate(template); }} /> : <>
      {error ? <InfoNotice tone="danger" title="Could not load offers" body={error} /> : null}
      {sortedItems.length === 0 ? <EmptyInventoryPlaceholder title="Create your first offer" body="Add services, availability, and sample images, or switch to Starter Offers for ideas." tone="offer" onPress={() => navigation.navigate('CreateOffer')} /> : sortedItems.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => navigation.navigate('OfferDetail', { offerId: item.id, title: item.title })} style={({ pressed }) => [pressed && styles.pressed]}><AppCard><View style={styles.cardHeaderRow}><AppText style={styles.cardTitle}>{item.title}</AppText><StatusBadge status={item.status} size="sm" /></View><AppText style={[styles.cardText, { color: theme.color.muted }]}>{item.description}</AppText><MediaStrip media={item.media} /></AppCard></Pressable>)}
    </>}
  </ScrollView></AppFixedHeaderScreen>;
}

function SourceTabs({ value, onChange }: { value: SourceTab; onChange: (value: SourceTab) => void }) {
  const theme = useThemeTokens();
  return <View style={[styles.sourceTabs, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><SourceTabButton label="My Offers" active={value === 'mine'} onPress={() => onChange('mine')} /><SourceTabButton label="Starter Offers" active={value === 'starter'} onPress={() => onChange('starter')} /></View>;
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

const styles = StyleSheet.create({ content: { paddingBottom: 28, gap: 14 }, headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }, headerCopy: { flex: 1, gap: 8 }, title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 }, subtitle: { lineHeight: 20, fontWeight: '600' }, createButton: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 }, createButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 7 }, createButtonText: { color: '#FFFFFF', fontWeight: '900' }, sourceTabs: { flexDirection: 'row', borderRadius: 22, borderWidth: 1, padding: 4, gap: 4 }, sourceTabButton: { flex: 1, minHeight: 44, borderRadius: 18, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, sourceTabText: { fontSize: 13, fontWeight: '900' }, openCreatedButton: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, openCreatedText: { fontWeight: '900' }, cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, cardTitle: { flex: 1, fontSize: 20, fontWeight: '900' }, cardText: { lineHeight: 20, fontWeight: '600' }, emptyPlaceholder: { minHeight: 208, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 22, gap: 10 }, emptyIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { textAlign: 'center', fontSize: 22, fontWeight: '900', letterSpacing: -0.35 }, emptyBody: { textAlign: 'center', lineHeight: 20, fontWeight: '700' }, pressed: { opacity: 0.78 } });
