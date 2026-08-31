import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { InventoryTemplateDto } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppHeader } from '../../components/AppHeader';
import { AppSmartHeaderScreen } from '../../components/AppSmartHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice } from '../../components/SemanticUI';
import {
  EMPTY_LIBRARY_HEADER_CONTROLS_STATE,
  LibraryHeaderActions,
  SlidingSegmentedControl,
  type LibraryHeaderControlsHandle,
  type LibraryHeaderControlsState,
} from '../../components/library';
import { StarterInventoryLibrary } from './components/StarterInventoryLibrary';
import { InventoryCompactRow } from './components/InventoryCompactRow';
import { ManagedInventoryLibraryFilters } from './components/ManagedInventoryLibraryFilters';
import { InventoryFoldersPanel, type InventoryFolderSelection } from './components/InventoryFoldersPanel';
import { useInventoryDisplayResolver, useLocalizedInventoryItem, useLocalizedInventoryItems } from './inventoryDisplay';
import type { NeedItem } from './types';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useAuth } from '../../providers/AuthProvider';

type ApiResponse = { needs: NeedItem[] };
type TemplatesResponse = { templates: InventoryTemplateDto[] };
type CloneResponse = { need?: NeedItem };
type SourceTab = 'mine' | 'starter';

export function MyNeedsScreen() {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const auth = useAuth();
  const resolveInventoryDisplay = useInventoryDisplayResolver();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [sourceTab, setSourceTab] = useState<SourceTab>('mine');
  const mineControlsRef = useRef<LibraryHeaderControlsHandle>(null);
  const exploreControlsRef = useRef<LibraryHeaderControlsHandle>(null);
  const [controlsByTab, setControlsByTab] = useState<Record<SourceTab, LibraryHeaderControlsState>>({
    mine: { ...EMPTY_LIBRARY_HEADER_CONTROLS_STATE },
    starter: { ...EMPTY_LIBRARY_HEADER_CONTROLS_STATE },
  });
  const [items, setItems] = useState<NeedItem[]>([]);
  const [templates, setTemplates] = useState<InventoryTemplateDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdNeed, setCreatedNeed] = useState<NeedItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);
  const [folderSelection, setFolderSelection] = useState<InventoryFolderSelection>({ folderId: null, folderTitle: null, itemIds: [] });
  const [folderRefreshKey, setFolderRefreshKey] = useState(0);

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
      const result = await api.inventoryTemplates.list({ kind: 'need', language, countryCode: auth.user?.profile?.countryCode ?? undefined, take: 100 }) as TemplatesResponse;
      setTemplates(Array.isArray(result.templates) ? result.templates : []);
    } catch (caughtError) {
      setTemplates([]);
      setTemplateError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.starterNeedsCouldNotLoad')));
    } finally {
      setTemplateLoading(false);
    }
  }, [auth.user?.profile?.countryCode, language, t]);

  useFocusEffect(useCallback(() => { void loadItems(); void loadTemplates(); setFolderRefreshKey((key) => key + 1); }, [loadItems, loadTemplates]));

  const displayItems = useLocalizedInventoryItems(items);
  const displayCreatedItem = useLocalizedInventoryItem(createdNeed);

  const activeLoading = sourceTab === 'starter' ? templateLoading : loading;
  const activeControls = controlsByTab[sourceTab];
  const activeControlsRef = sourceTab === 'starter' ? exploreControlsRef : mineControlsRef;
  const updateControls = useCallback((tab: SourceTab, state: LibraryHeaderControlsState) => {
    setControlsByTab((current) => ({ ...current, [tab]: state }));
  }, []);
  const updateMineControls = useCallback((state: LibraryHeaderControlsState) => updateControls('mine', state), [updateControls]);
  const updateExploreControls = useCallback((state: LibraryHeaderControlsState) => updateControls('starter', state), [updateControls]);
  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace('Account');
  }, [navigation]);
  const header = (
    <AppHeader
      title={t('inventory.labels.needs')}
      onBack={handleBack}
      rightSlot={(
        <LibraryHeaderActions
          tone="need"
          state={activeControls}
          searchAccessibilityLabel={sourceTab === 'starter' ? t('inventory.libraryFilters.searchStarterLibrary') : t('inventory.libraryFilters.searchMyNeeds')}
          filterAccessibilityLabel={sourceTab === 'starter' ? t('inventory.libraryFilters.openFilters') : t('inventory.libraryFilters.filterMyNeeds')}
          createAccessibilityLabel={t('inventory.actions.createNeed')}
          onToggleSearch={() => activeControlsRef.current?.toggleSearch()}
          onOpenFilters={() => activeControlsRef.current?.openFilters()}
          onCreate={() => navigation.navigate('CreateNeed')}
        />
      )}
    />
  );

  const sortedItems = useMemo(() => {
    if (!folderSelection.folderId) return displayItems;
    const visibleIds = new Set(folderSelection.itemIds);
    return displayItems.filter((item) => visibleIds.has(item.id));
  }, [displayItems, folderSelection.folderId, folderSelection.itemIds]);

  const emptyTitle = folderSelection.folderId && folderSelection.folderTitle ? t('inventory.empty.noFolderItems', { folder: folderSelection.folderTitle }) : t('inventory.empty.createFirstNeed');
  const emptyBody = folderSelection.folderId ? t('inventory.empty.noFolderItemsBody', { items: t('inventory.labels.needs').toLowerCase() }) : t('inventory.empty.needNativeBody');

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
      setNotice(t('inventory.messages.starterSavedToMine', { title: resolveInventoryDisplay(result.need).title, collection: t('inventory.labels.myNeeds') }));
      setSourceTab('mine');
    } catch (caughtError) {
      setTemplateError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.couldNotSaveStarterNeed')));
    } finally {
      setCloningTemplateId(null);
    }
  }

  return (
    <AppSmartHeaderScreen header={header} resetKey={sourceTab}>
      {(scrollProps) => (
        <ScrollView {...scrollProps.scrollViewProps} contentContainerStyle={[scrollProps.contentInsetStyle, styles.content]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} refreshControl={<RefreshControl refreshing={activeLoading} onRefresh={() => { void loadItems(); void loadTemplates(); setFolderRefreshKey((key) => key + 1); }} />}>
          <SourceTabs value={sourceTab} onChange={(nextTab) => { setSourceTab(nextTab); setNotice(null); setCreatedNeed(null); }} />
          {sourceTab === 'mine' ? <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('inventory.empty.needNativeBody')}</AppText> : null}
          {notice ? <InfoNotice tone="success" title={t('inventory.messages.starterSaved')} body={notice} /> : null}
          {createdNeed ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('NeedDetail', { needId: createdNeed.id, title: displayCreatedItem?.title ?? createdNeed.title })} style={({ pressed }) => [styles.openCreatedButton, { backgroundColor: theme.semantic.need.softBg, borderColor: theme.semantic.need.border }, pressed && styles.pressed]}><AppText style={[styles.openCreatedText, { color: theme.semantic.need.text }]}>{t('inventory.actions.openSavedNeed')}</AppText><MobileIcon name="chevron-right" size={18} color={theme.semantic.need.text} /></Pressable> : null}
          <View style={sourceTab === 'mine' ? undefined : styles.hiddenSegment}>
            {betaFeatures.inventoryFoldersEnabled ? <InventoryFoldersPanel kind="need" items={displayItems.map((item) => ({ id: item.id, title: item.title }))} refreshKey={folderRefreshKey} onSelectionChange={setFolderSelection} /> : null}
            {error ? <InfoNotice tone="danger" title={t('inventory.errors.couldNotLoadNeed')} body={error} /> : null}
            <ManagedInventoryLibraryFilters ref={mineControlsRef} kind="need" items={sortedItems} headerControls onHeaderControlsStateChange={updateMineControls}>
              {(visibleItems) => visibleItems.length === 0
                ? <EmptyInventoryPlaceholder title={emptyTitle} body={emptyBody} tone="need" onPress={() => navigation.navigate('CreateNeed')} />
                : visibleItems.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => navigation.navigate('NeedDetail', { needId: item.id, title: item.title })} style={({ pressed }) => [pressed && styles.pressed]}><InventoryCompactRow kind="need" item={item} /></Pressable>)}
            </ManagedInventoryLibraryFilters>
          </View>
          <View style={sourceTab === 'starter' ? undefined : styles.hiddenSegment}>
            <StarterInventoryLibrary ref={exploreControlsRef} kind="need" templates={templates} loading={templateLoading} error={templateError} cloningTemplateId={cloningTemplateId} actionLabel={t('inventory.actions.useThisNeed')} onUseTemplate={(template) => { void cloneTemplate(template); }} headerControls onHeaderControlsStateChange={updateExploreControls} />
          </View>
        </ScrollView>
      )}
    </AppSmartHeaderScreen>
  );
}

function SourceTabs({ value, onChange }: { value: SourceTab; onChange: (value: SourceTab) => void }) {
  const { t } = useTranslation();
  return (
    <SlidingSegmentedControl<SourceTab>
      value={value}
      onChange={onChange}
      tone="need"
      options={[
        { value: 'mine', label: t('common.librarySegments.mine') },
        { value: 'starter', label: t('common.librarySegments.explore') },
      ]}
    />
  );
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

const styles = StyleSheet.create({
  content: { paddingBottom: 28, gap: 14 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  hiddenSegment: { display: 'none' },
  openCreatedButton: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  openCreatedText: { fontWeight: '900' },
  emptyPlaceholder: { minHeight: 208, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 22, gap: 10 },
  emptyIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { textAlign: 'center', fontSize: 22, fontWeight: '900', letterSpacing: -0.35 },
  emptyBody: { textAlign: 'center', lineHeight: 20, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
