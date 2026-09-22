import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
  type LibraryHeaderControlsHandle,
  type LibraryHeaderControlsState,
} from '../../components/library';
import { InventoryCompactRow } from './components/InventoryCompactRow';
import { ManagedInventoryLibraryFilters } from './components/ManagedInventoryLibraryFilters';
import { InventoryFoldersPanel, type InventoryFolderSelection } from './components/InventoryFoldersPanel';
import { useLocalizedInventoryItems } from './inventoryDisplay';
import type { NeedItem } from './types';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';

type ApiResponse = { needs: NeedItem[] };

export function MyNeedsScreen() {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const mineControlsRef = useRef<LibraryHeaderControlsHandle>(null);
  const [controls, setControls] = useState<LibraryHeaderControlsState>({ ...EMPTY_LIBRARY_HEADER_CONTROLS_STATE });
  const [items, setItems] = useState<NeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  useFocusEffect(useCallback(() => { void loadItems(); setFolderRefreshKey((key) => key + 1); }, [loadItems]));

  const displayItems = useLocalizedInventoryItems(items);
  const updateMineControls = useCallback((state: LibraryHeaderControlsState) => setControls(state), []);
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
          state={controls}
          searchAccessibilityLabel={t('inventory.libraryFilters.searchMyNeeds')}
          filterAccessibilityLabel={t('inventory.libraryFilters.filterMyNeeds')}
          createAccessibilityLabel={t('inventory.actions.createNeed')}
          onToggleSearch={() => mineControlsRef.current?.toggleSearch()}
          onOpenFilters={() => mineControlsRef.current?.openFilters()}
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

  return (
    <AppSmartHeaderScreen header={header} resetKey="need">
      {(scrollProps) => (
        <ScrollView {...scrollProps.scrollViewProps} contentContainerStyle={[scrollProps.contentInsetStyle, styles.content]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadItems(); setFolderRefreshKey((key) => key + 1); }} />}>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('inventory.empty.needNativeBody')}</AppText>
            {betaFeatures.inventoryFoldersEnabled ? <InventoryFoldersPanel kind="need" items={displayItems.map((item) => ({ id: item.id, title: item.title }))} refreshKey={folderRefreshKey} onSelectionChange={setFolderSelection} /> : null}
            {error ? <InfoNotice tone="danger" title={t('inventory.errors.couldNotLoadNeed')} body={error} /> : null}
            <ManagedInventoryLibraryFilters ref={mineControlsRef} kind="need" items={sortedItems} headerControls onHeaderControlsStateChange={updateMineControls}>
              {(visibleItems) => visibleItems.length === 0
                ? <EmptyInventoryPlaceholder title={emptyTitle} body={emptyBody} tone="need" onPress={() => navigation.navigate('CreateNeed')} />
                : visibleItems.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => navigation.navigate('NeedDetail', { needId: item.id, title: item.title })} style={({ pressed }) => [pressed && styles.pressed]}><InventoryCompactRow kind="need" item={item} /></Pressable>)}
            </ManagedInventoryLibraryFilters>
        </ScrollView>
      )}
    </AppSmartHeaderScreen>
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
  emptyPlaceholder: { minHeight: 208, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 22, gap: 10 },
  emptyIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { textAlign: 'center', fontSize: 22, fontWeight: '900', letterSpacing: -0.35 },
  emptyBody: { textAlign: 'center', lineHeight: 20, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
