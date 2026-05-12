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
import type { NeedItem } from './types';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';

type ApiResponse = { needs: NeedItem[] };
type TemplatesResponse = { templates: InventoryTemplateDto[] };
type CloneResponse = { need?: NeedItem };
type SourceTab = 'mine' | 'starter';

export function MyNeedsScreen() {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [sourceTab, setSourceTab] = useState<SourceTab>('mine');
  const [items, setItems] = useState<NeedItem[]>([]);
  const [templates, setTemplates] = useState<InventoryTemplateDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdNeed, setCreatedNeed] = useState<NeedItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.needs.mine() as ApiResponse;
      setItems(Array.isArray(result.needs) ? result.needs : []);
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
      const result = await api.inventoryTemplates.list({ kind: 'need', take: 100 }) as TemplatesResponse;
      setTemplates(Array.isArray(result.templates) ? result.templates : []);
    } catch (caughtError) {
      setTemplates([]);
      setTemplateError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.starterNeedsCouldNotLoad')));
    } finally {
      setTemplateLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void loadItems(); void loadTemplates(); }, [loadItems, loadTemplates]));

  const activeLoading = sourceTab === 'starter' ? templateLoading : loading;
  const header = <View style={styles.headerRow}><View style={styles.headerCopy}><SemanticBadge label={t('inventory.labels.need')} tone="need" /><AppText style={styles.title}>{t('inventory.labels.needs')}</AppText><AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('inventory.empty.needNativeBody')}</AppText></View><Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateNeed')} style={({ pressed }) => [styles.createButton, { backgroundColor: theme.semantic.need.bg }, pressed && styles.pressed]}><View style={styles.createButtonContent}><MobileIcon name="add" size={16} color={theme.color.background} /><AppText style={[styles.createButtonText, { color: theme.color.background }]}>{t('common.actions.create')}</AppText></View></Pressable></View>;

  const sortedItems = useMemo(() => items, [items]);

  async function cloneTemplate(template: InventoryTemplateDto) {
    setNotice(null);
    setCreatedNeed(null);
    setTemplateError(null);
    try {
      setCloningTemplateId(template.id);
      const result = await api.inventoryTemplates.clone(template.id, { status: 'active' }) as CloneResponse;
      if (!result.need) throw new Error(t('inventory.errors.starterSavedUnreadableNeed'));
      setItems((current) => [result.need!, ...current.filter((item) => item.id !== result.need!.id)]);
      setCreatedNeed(result.need);
      setNotice(t('inventory.messages.starterSavedToMine', { title: result.need.title, collection: t('inventory.labels.myNeeds') }));
      setSourceTab('mine');
    } catch (caughtError) {
      setTemplateError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.couldNotSaveStarterNeed')));
    } finally {
      setCloningTemplateId(null);
    }
  }

  return <AppFixedHeaderScreen header={header}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={activeLoading} onRefresh={() => { void loadItems(); void loadTemplates(); }} />}>
    <SourceTabs value={sourceTab} onChange={(nextTab) => { setSourceTab(nextTab); setNotice(null); setCreatedNeed(null); }} />
    {notice ? <InfoNotice tone="success" title={t('inventory.messages.starterSaved')} body={notice} /> : null}
    {createdNeed ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('NeedDetail', { needId: createdNeed.id, title: createdNeed.title })} style={({ pressed }) => [styles.openCreatedButton, { backgroundColor: theme.semantic.need.softBg, borderColor: theme.semantic.need.border }, pressed && styles.pressed]}><AppText style={[styles.openCreatedText, { color: theme.semantic.need.text }]}>{t('inventory.actions.openSavedNeed')}</AppText><MobileIcon name="chevron-right" size={18} color={theme.semantic.need.text} /></Pressable> : null}
    {sourceTab === 'starter' ? <StarterInventoryLibrary kind="need" templates={templates} loading={templateLoading} error={templateError} cloningTemplateId={cloningTemplateId} actionLabel={t('inventory.actions.useThisNeed')} onUseTemplate={(template) => { void cloneTemplate(template); }} /> : <>
      {error ? <InfoNotice tone="danger" title={t('inventory.errors.couldNotLoadNeed')} body={error} /> : null}
      {sortedItems.length === 0 ? <EmptyInventoryPlaceholder title={t('inventory.empty.createFirstNeed')} body={t('inventory.empty.needNativeBody')} tone="need" onPress={() => navigation.navigate('CreateNeed')} /> : sortedItems.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => navigation.navigate('NeedDetail', { needId: item.id, title: item.title })} style={({ pressed }) => [pressed && styles.pressed]}><AppCard><View style={styles.cardHeaderRow}><AppText style={styles.cardTitle}>{item.title}</AppText><StatusBadge status={item.status} size="sm" /></View><AppText style={[styles.cardText, { color: theme.color.muted }]}>{item.description}</AppText><MediaStrip media={item.media} /></AppCard></Pressable>)}
    </>}
  </ScrollView></AppFixedHeaderScreen>;
}

function SourceTabs({ value, onChange }: { value: SourceTab; onChange: (value: SourceTab) => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return <View style={[styles.sourceTabs, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><SourceTabButton label={t('inventory.labels.myNeeds')} active={value === 'mine'} onPress={() => onChange('mine')} /><SourceTabButton label={t('inventory.labels.starterNeeds')} active={value === 'starter'} onPress={() => onChange('starter')} /></View>;
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
