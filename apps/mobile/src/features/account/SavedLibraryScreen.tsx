import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { SAVED_LIBRARY_FREE_ITEM_LIMIT, type SavedCollectionDto, type SavedItemDto, type SavedItemType, type SavedLibrarySort } from '@hellowhen/contracts';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppCard } from '../../components/AppCard';
import { AppText } from '../../components/AppText';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { DetailEmptyState } from '../../components/detail';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge, toneForKind } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';

type SavedLibraryProps = NativeStackScreenProps<RootStackParamList, 'SavedLibrary'>;
type SavedCollectionProps = NativeStackScreenProps<RootStackParamList, 'SavedLibraryCollection'>;
type SavedLibraryNavigation = Pick<NativeStackNavigationProp<RootStackParamList>, 'goBack' | 'navigate'>;
type SavedFilter = 'all' | SavedItemType;
type CollectionEditorMode = 'create' | 'edit';

type SavedTab = {
  value: SavedFilter;
  labelKey: string;
};

const savedTabs: SavedTab[] = [
  { value: 'all', labelKey: 'account.saved.filters.all' },
  { value: 'trade', labelKey: 'account.saved.filters.trades' },
  { value: 'need', labelKey: 'account.saved.filters.needs' },
  { value: 'offer', labelKey: 'account.saved.filters.offers' },
  { value: 'user', labelKey: 'account.saved.filters.people' },
];

const savedSortOptions: { value: SavedLibrarySort; labelKey: string }[] = [
  { value: 'newest', labelKey: 'account.saved.sort.newest' },
  { value: 'oldest', labelKey: 'account.saved.sort.oldest' },
];

function itemTargetId(item: SavedItemDto) {
  return item.tradeId ?? item.needId ?? item.offerId ?? item.targetUserId ?? '';
}

function itemTitle(item: SavedItemDto, t: (key: string) => string) {
  switch (item.itemType) {
    case 'trade':
      return item.trade?.title ?? t('account.saved.unavailable.trade');
    case 'need':
      return item.need?.title ?? t('account.saved.unavailable.need');
    case 'offer':
      return item.offer?.title ?? t('account.saved.unavailable.offer');
    case 'user': {
      const profile = item.targetUser?.profile;
      return profile?.displayName ?? (profile?.handle ? `@${profile.handle}` : t('account.saved.unavailable.user'));
    }
  }
}

function itemBody(item: SavedItemDto, t: (key: string) => string) {
  switch (item.itemType) {
    case 'trade':
      return item.trade?.description || item.trade?.status || t('account.saved.itemBodies.trade');
    case 'need':
      return item.need?.description || t('account.saved.itemBodies.need');
    case 'offer':
      return item.offer?.description || t('account.saved.itemBodies.offer');
    case 'user': {
      const profile = item.targetUser?.profile;
      if (profile?.handle) return `@${profile.handle}`;
      if (profile?.countryCode) return profile.countryCode;
      return t('account.saved.itemBodies.user');
    }
  }
}

function collectionItemCount(collection: SavedCollectionDto) {
  return Array.isArray(collection.items) ? collection.items.length : 0;
}

function collectionHasSavedItem(collection: SavedCollectionDto, savedItemId: string) {
  return (collection.items ?? []).some((item) => item.savedItemId === savedItemId);
}

function formatSavedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function SavedLibraryScreen({ navigation }: SavedLibraryProps) {
  return <SavedLibraryContent navigation={navigation} />;
}

export function SavedCollectionDetailScreen({ navigation, route }: SavedCollectionProps) {
  return <SavedLibraryContent initialCollectionId={route.params.collectionId} initialTitle={route.params.title} navigation={navigation} />;
}

function SavedLibraryContent({ initialCollectionId, initialTitle, navigation }: { initialCollectionId?: string; initialTitle?: string; navigation: SavedLibraryNavigation }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<SavedFilter>('all');
  const [sort, setSort] = useState<SavedLibrarySort>('newest');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(initialCollectionId ?? null);
  const [items, setItems] = useState<SavedItemDto[]>([]);
  const [collections, setCollections] = useState<SavedCollectionDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<CollectionEditorMode | null>(null);
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionTitleError, setCollectionTitleError] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [managingItem, setManagingItem] = useState<SavedItemDto | null>(null);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId],
  );

  const load = useCallback(async ({ append = false, cursor }: { append?: boolean; cursor?: string } = {}) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);

    try {
      const [savedResponse, collectionsResponse] = await Promise.all([
        api.saved.list({
          take: 50,
          sort,
          ...(filter !== 'all' ? { itemType: filter } : {}),
          ...(selectedCollectionId ? { collectionId: selectedCollectionId } : {}),
          ...(query ? { q: query } : {}),
          ...(cursor ? { cursor } : {}),
        }),
        api.saved.collections(),
      ]);
      setItems((current) => append ? [...current, ...(savedResponse.items ?? [])] : (savedResponse.items ?? []));
      setNextCursor(savedResponse.nextCursor ?? null);
      const nextCollections = collectionsResponse.collections ?? [];
      setCollections(nextCollections);
      setSelectedCollectionId((current) => (current && !nextCollections.some((collection) => collection.id === current) ? null : current));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('account.saved.loadError')));
      if (!append) {
        setItems([]);
        setNextCursor(null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, selectedCollectionId, query, sort, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function applySearch() {
    setQuery(searchInput.trim());
    setNextCursor(null);
  }

  function clearSearch() {
    setSearchInput('');
    setQuery('');
    setNextCursor(null);
  }

  function updateSort(nextSort: SavedLibrarySort) {
    setSort(nextSort);
    setNextCursor(null);
  }

  function openCreateCollection() {
    setMessage(null);
    setError(null);
    setCollectionTitleError(null);
    setCollectionTitle('');
    setCollectionDescription('');
    setEditorMode('create');
  }

  function openEditCollection() {
    if (!selectedCollection) return;
    setMessage(null);
    setError(null);
    setCollectionTitleError(null);
    setCollectionTitle(selectedCollection.title);
    setCollectionDescription(selectedCollection.description ?? '');
    setEditorMode('edit');
  }

  async function saveCollection() {
    const title = collectionTitle.trim();
    const description = collectionDescription.trim();
    if (!title) {
      setCollectionTitleError(t('account.saved.collections.titleRequired'));
      return;
    }

    setCollectionTitleError(null);
    setBusyAction('collection-save');
    setError(null);
    try {
      if (editorMode === 'edit' && selectedCollection) {
        const response = await api.saved.updateCollection(selectedCollection.id, { title, description: description || null });
        setCollections((current) => current.map((collection) => (collection.id === response.collection.id ? response.collection : collection)));
        setMessage(t('account.saved.collections.updated', { title: response.collection.title }));
      } else {
        const response = await api.saved.createCollection({ title, description: description || undefined });
        setCollections((current) => [response.collection, ...current.filter((collection) => collection.id !== response.collection.id)]);
        setSelectedCollectionId(response.collection.id);
        setMessage(t('account.saved.collections.created', { title: response.collection.title }));
      }
      setEditorMode(null);
      await load();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('account.saved.collections.saveError')));
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteSelectedCollection() {
    if (!selectedCollection) return;
    const title = selectedCollection.title;
    setBusyAction('collection-delete');
    setError(null);
    try {
      await api.saved.removeCollection(selectedCollection.id);
      setCollections((current) => current.filter((collection) => collection.id !== selectedCollection.id));
      setSelectedCollectionId(null);
      setDeleteConfirmVisible(false);
      setMessage(t('account.saved.collections.deleted', { title }));
      if (initialCollectionId) navigation.navigate('SavedLibrary');
      await load();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('account.saved.collections.deleteError')));
    } finally {
      setBusyAction(null);
    }
  }

  async function removeSavedItem(savedItemId: string) {
    setUpdatingId(savedItemId);
    setError(null);
    try {
      await api.saved.remove(savedItemId);
      setItems((current) => current.filter((item) => item.id !== savedItemId));
      setCollections((current) => current.map((collection) => ({
        ...collection,
        items: collection.items?.filter((item) => item.savedItemId !== savedItemId),
      })));
      setManagingItem((current) => (current?.id === savedItemId ? null : current));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('account.saved.removeError')));
    } finally {
      setUpdatingId(null);
    }
  }

  async function addItemToCollection(collection: SavedCollectionDto, item: SavedItemDto) {
    setBusyAction(`collection-item-${collection.id}-${item.id}`);
    setError(null);
    try {
      await api.saved.addCollectionItem(collection.id, { savedItemId: item.id });
      setMessage(t('account.saved.collections.itemAdded', { title: itemTitle(item, t), collection: collection.title }));
      await load();
      setManagingItem(null);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('account.saved.collections.itemAddError')));
    } finally {
      setBusyAction(null);
    }
  }

  async function removeItemFromCollection(collection: SavedCollectionDto, item: SavedItemDto) {
    setBusyAction(`collection-item-${collection.id}-${item.id}`);
    setError(null);
    try {
      await api.saved.removeCollectionItem(collection.id, item.id);
      setMessage(t('account.saved.collections.itemRemoved', { title: itemTitle(item, t), collection: collection.title }));
      if (selectedCollectionId === collection.id) setItems((current) => current.filter((entry) => entry.id !== item.id));
      await load();
      setManagingItem(null);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('account.saved.collections.itemRemoveError')));
    } finally {
      setBusyAction(null);
    }
  }

  function openCollection(collection: SavedCollectionDto | null) {
    setNextCursor(null);
    if (!collection) {
      setSelectedCollectionId(null);
      if (initialCollectionId) navigation.navigate('SavedLibrary');
      return;
    }
    if (initialCollectionId) {
      setSelectedCollectionId(collection.id);
      return;
    }
    navigation.navigate('SavedLibraryCollection', { collectionId: collection.id, title: collection.title });
  }

  function openItem(item: SavedItemDto) {
    if (item.itemType === 'trade' && item.tradeId) {
      navigation.navigate('TradeDetail', { tradeId: item.tradeId, title: item.trade?.title, description: item.trade?.description, status: item.trade?.status });
      return;
    }
    if (item.itemType === 'need' && item.needId) {
      navigation.navigate('NeedDetail', { needId: item.needId, title: item.need?.title });
      return;
    }
    if (item.itemType === 'offer' && item.offerId) {
      navigation.navigate('OfferDetail', { offerId: item.offerId, title: item.offer?.title });
      return;
    }
    if (item.itemType === 'user' && item.targetUserId) {
      const profile = item.targetUser?.profile;
      navigation.navigate('UserProfile', { userId: item.targetUserId, displayName: profile?.displayName ?? profile?.handle ?? undefined });
    }
  }

  const hasItems = items.length > 0;
  const hasCollections = collections.length > 0;
  const searchActive = Boolean(query);
  const plusPublic = betaFeatures.plusSubscriptionFeatures.plusPublic;
  const headerTitle = selectedCollection?.title ?? initialTitle ?? t('account.saved.title');

  return (
    <AppFixedHeaderScreen header={<AppHeader title={headerTitle} onBack={() => navigation.goBack()} /> }>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}>
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <SemanticBadge label={t('account.saved.privateBadge')} tone="proposal" />
            <SemanticBadge label={t('account.saved.collections.title')} tone="instruction" />
          </View>
          <AppText style={styles.title}>{t('account.saved.title')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.saved.body')}</AppText>
        </View>

        <AppCard style={[styles.summaryCard, { backgroundColor: theme.color.subtleSurface }]}>
          <View style={[styles.summaryIcon, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <MobileIcon name="save" size={22} color={theme.semantic.proposal.text} />
          </View>
          <View style={styles.summaryCopy}>
            <AppText style={styles.summaryTitle}>{t('account.saved.summaryTitle')}</AppText>
            <AppText style={[styles.summaryBody, { color: theme.color.muted }]}>{t('account.saved.summaryBody')}</AppText>
          </View>
        </AppCard>

        <InfoNotice
          tone="success"
          title={t('account.saved.plus.title')}
          body={plusPublic ? t('account.saved.plus.body', { limit: SAVED_LIBRARY_FREE_ITEM_LIMIT }) : t('account.saved.plus.comingSoonBody', { limit: SAVED_LIBRARY_FREE_ITEM_LIMIT })}
        />

        <View style={[styles.searchPanel, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <View style={[styles.searchInputRow, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
            <MobileIcon name="search" size={18} color={theme.color.muted} />
            <TextInput
              value={searchInput}
              maxLength={80}
              onChangeText={setSearchInput}
              onSubmitEditing={applySearch}
              placeholder={t('account.saved.search.placeholder')}
              placeholderTextColor={theme.color.muted}
              returnKeyType="search"
              style={[styles.searchInput, { color: theme.color.text }]}
            />
          </View>
          <View style={styles.searchActionRow}>
            <Pressable accessibilityRole="button" onPress={applySearch} style={({ pressed }) => [styles.searchActionButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
              <AppText style={[styles.searchActionText, { color: theme.color.background }]}>{t('common.actions.search')}</AppText>
            </Pressable>
            {searchInput || query ? (
              <Pressable accessibilityRole="button" onPress={clearSearch} style={({ pressed }) => [styles.searchClearButton, { borderColor: theme.color.border }, pressed && styles.pressed]}>
                <AppText style={[styles.searchClearText, { color: theme.color.text }]}>{t('account.saved.search.clear')}</AppText>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.sortRow}>
            <AppText style={[styles.sortLabel, { color: theme.color.muted }]}>{t('account.saved.sort.label')}</AppText>
            <View style={styles.sortButtons}>
              {savedSortOptions.map((option) => (
                <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: sort === option.value }} onPress={() => updateSort(option.value)} style={({ pressed }) => [styles.sortChip, { backgroundColor: sort === option.value ? theme.color.text : theme.color.surface, borderColor: sort === option.value ? theme.color.text : theme.color.border }, pressed && styles.pressed]}>
                  <AppText style={[styles.sortChipText, { color: sort === option.value ? theme.color.background : theme.color.text }]}>{t(option.labelKey)}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.collectionToolbar, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <View style={styles.collectionToolbarCopy}>
            <AppText style={styles.collectionToolbarTitle}>{t('account.saved.collections.title')}</AppText>
            <AppText style={[styles.collectionToolbarBody, { color: theme.color.muted }]}>{t('account.saved.collections.manageBody')}</AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={openCreateCollection} style={({ pressed }) => [styles.collectionCreateButton, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, pressed && styles.pressed]}>
            <MobileIcon name="add" size={17} color={theme.semantic.proposal.text} />
            <AppText style={[styles.collectionCreateText, { color: theme.semantic.proposal.text }]}>{t('account.saved.collections.create')}</AppText>
          </Pressable>
        </View>

        <View style={styles.filterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
            {savedTabs.map((tab) => (
              <FilterChip
                key={tab.value}
                label={t(tab.labelKey)}
                active={filter === tab.value}
                onPress={() => { setFilter(tab.value); setNextCursor(null); }}
              />
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
            <CollectionChip label={t('account.saved.collections.allSaved')} active={!selectedCollectionId} onPress={() => openCollection(null)} />
            {collections.map((collection) => (
              <CollectionChip
                key={collection.id}
                label={collection.title}
                count={collectionItemCount(collection)}
                active={selectedCollectionId === collection.id}
                onPress={() => openCollection(collection)}
              />
            ))}
          </ScrollView>
        </View>

        {message ? <InfoNotice tone="success" title={t('common.states.saved')} body={message} /> : null}
        {error && hasItems ? <InfoNotice tone="danger" title={t('account.saved.loadError')} body={error} /> : null}

        {!selectedCollection && hasCollections ? (
          <View style={[styles.collectionOverview, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <View style={styles.collectionOverviewHeader}>
              <View style={styles.collectionOverviewCopy}>
                <SemanticBadge label={t('account.saved.collections.title')} tone="instruction" size="sm" />
                <AppText style={styles.collectionTitle}>{t('account.saved.collections.overviewTitle')}</AppText>
                <AppText style={[styles.collectionBody, { color: theme.color.muted }]}>{t('account.saved.collections.overviewBody')}</AppText>
              </View>
              <Pressable accessibilityRole="button" onPress={openCreateCollection} style={({ pressed }) => [styles.collectionOverviewCreate, { borderColor: theme.color.border }, pressed && styles.pressed]}>
                <AppText style={[styles.collectionActionText, { color: theme.color.text }]}>{t('account.saved.collections.create')}</AppText>
              </Pressable>
            </View>
            <View style={styles.collectionOverviewGrid}>
              {collections.slice(0, 4).map((collection) => (
                <Pressable key={collection.id} accessibilityRole="button" onPress={() => openCollection(collection)} style={({ pressed }) => [styles.collectionOverviewCard, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                  <AppText style={styles.collectionOverviewTitle} numberOfLines={1}>{collection.title}</AppText>
                  <AppText style={[styles.collectionOverviewBody, { color: theme.color.muted }]} numberOfLines={2}>{collection.description || t('account.saved.collections.defaultBody')}</AppText>
                  <AppText style={[styles.collectionOverviewCount, { color: theme.color.muted }]}>{t('account.saved.collections.itemCount', { count: collectionItemCount(collection) })}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {selectedCollection ? (
          <View style={[styles.collectionCard, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
            <SemanticBadge label={t('account.saved.collections.collection')} tone="instruction" size="sm" />
            <View style={styles.collectionCopy}>
              <AppText style={styles.collectionTitle}>{selectedCollection.title}</AppText>
              <AppText style={[styles.collectionBody, { color: theme.color.muted }]}>{selectedCollection.description || t('account.saved.collections.defaultBody')}</AppText>
            </View>
            <View style={styles.collectionActions}>
              <Pressable accessibilityRole="button" onPress={openEditCollection} style={({ pressed }) => [styles.collectionActionButton, { borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.collectionActionText, { color: theme.color.text }]}>{t('common.actions.edit')}</AppText></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setDeleteConfirmVisible(true)} style={({ pressed }) => [styles.collectionActionButton, { borderColor: theme.semantic.danger.border, backgroundColor: theme.semantic.danger.softBg }, pressed && styles.pressed]}><AppText style={[styles.collectionActionText, { color: theme.semantic.danger.text }]}>{t('account.saved.collections.delete')}</AppText></Pressable>
            </View>
          </View>
        ) : null}

        <AppText style={[styles.resultSummary, { color: theme.color.muted }]}>
          {searchActive ? t('account.saved.search.resultsFor', { count: items.length, query }) : t('account.saved.resultSummary', { count: items.length })}
        </AppText>

        {loading && !hasItems ? (
          <View style={[styles.loadingState, { borderColor: theme.color.border }]}>
            <ActivityIndicator color={theme.color.text} />
            <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{t('account.saved.loading')}</AppText>
          </View>
        ) : null}

        {!loading && !hasItems ? (
          <DetailEmptyState
            icon={error ? 'warning' : 'save'}
            title={error ? t('account.saved.loadError') : (searchActive ? t('account.saved.search.noResultsTitle') : (selectedCollection ? t('account.saved.emptyCollectionTitle') : t('account.saved.emptyTitle')))}
            body={error ?? (searchActive ? t('account.saved.search.noResultsBody') : (selectedCollection ? t('account.saved.emptyCollectionBody') : t('account.saved.emptyBody')))}
            actionLabel={error ? t('common.actions.tryAgain') : t('account.saved.browseTrades')}
            onAction={error ? () => { void load(); } : () => navigation.navigate('TradeTabs')}
          />
        ) : null}

        {hasItems ? (
          <View style={styles.list}>
            {items.map((item) => (
              <SavedItemCard
                key={item.id}
                item={item}
                title={itemTitle(item, t)}
                body={itemBody(item, t)}
                targetId={itemTargetId(item)}
                updating={updatingId === item.id}
                onManageCollections={() => setManagingItem(item)}
                onOpen={() => openItem(item)}
                onRemove={() => { void removeSavedItem(item.id); }}
              />
            ))}
          </View>
        ) : null}

        {nextCursor ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('account.saved.loadMore')} disabled={loadingMore} onPress={() => { void load({ append: true, cursor: nextCursor }); }} style={({ pressed }) => [styles.loadMoreButton, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, (pressed || loadingMore) && styles.pressed]}>
            {loadingMore ? <ActivityIndicator color={theme.color.text} /> : <AppText style={[styles.loadMoreText, { color: theme.color.text }]}>{t('account.saved.loadMore')}</AppText>}
          </Pressable>
        ) : null}

        {!hasCollections ? (
          <View style={[styles.collectionsPreview, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
            <SemanticBadge label={t('account.saved.collections.title')} tone="instruction" />
            <AppText style={styles.collectionTitle}>{t('account.saved.collections.emptyTitle')}</AppText>
            <AppText style={[styles.collectionBody, { color: theme.color.muted }]}>{t('account.saved.collections.emptyBody')}</AppText>
            <Pressable accessibilityRole="button" onPress={openCreateCollection} style={({ pressed }) => [styles.collectionCreateButton, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, pressed && styles.pressed]}>
              <MobileIcon name="add" size={17} color={theme.semantic.proposal.text} />
              <AppText style={[styles.collectionCreateText, { color: theme.semantic.proposal.text }]}>{t('account.saved.collections.create')}</AppText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <CollectionEditorModal
        busy={busyAction === 'collection-save'}
        description={collectionDescription}
        onChangeDescription={setCollectionDescription}
        onChangeTitle={setCollectionTitle}
        onClose={() => setEditorMode(null)}
        onSave={() => { void saveCollection(); }}
        title={collectionTitle}
        titleError={collectionTitleError}
        visible={Boolean(editorMode)}
        mode={editorMode ?? 'create'}
      />

      <CollectionMembershipModal
        busyAction={busyAction}
        collections={collections}
        item={managingItem}
        onAdd={(collection, item) => addItemToCollection(collection, item)}
        onClose={() => setManagingItem(null)}
        onRemove={(collection, item) => removeItemFromCollection(collection, item)}
        visible={Boolean(managingItem)}
      />

      <AppConfirmSheet
        visible={deleteConfirmVisible}
        title={t('account.saved.collections.deleteTitle')}
        body={selectedCollection ? t('account.saved.collections.deleteConfirm', { title: selectedCollection.title }) : undefined}
        cancelLabel={t('common.actions.cancel')}
        confirmLabel={busyAction === 'collection-delete' ? t('common.states.working') : t('account.saved.collections.delete')}
        tone="danger"
        confirmDisabled={busyAction === 'collection-delete'}
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={() => { void deleteSelectedCollection(); }}
      />
    </AppFixedHeaderScreen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.filterChip, { backgroundColor: active ? theme.color.text : theme.color.surface, borderColor: active ? theme.color.text : theme.color.border }, pressed && styles.pressed]}>
      <AppText style={[styles.filterChipText, { color: active ? theme.color.background : theme.color.text }]}>{label}</AppText>
    </Pressable>
  );
}

function CollectionChip({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={typeof count === 'number' ? `${label} · ${count}` : label} accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.collectionChip, { backgroundColor: active ? theme.color.text : theme.color.surface, borderColor: active ? theme.color.text : theme.color.border }, pressed && styles.pressed]}>
      <AppText style={[styles.collectionChipText, { color: active ? theme.color.background : theme.color.text }]} numberOfLines={1}>{label}</AppText>
      {typeof count === 'number' ? (
        <View style={[styles.collectionCount, { backgroundColor: active ? theme.color.background : theme.color.subtleSurface }]}>
          <AppText style={[styles.collectionCountText, { color: active ? theme.color.text : theme.color.muted }]}>{count}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

function SavedItemCard({ item, title, body, targetId, updating, onManageCollections, onOpen, onRemove }: { item: SavedItemDto; title: string; body: string; targetId: string; updating: boolean; onManageCollections: () => void; onOpen: () => void; onRemove: () => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const canOpen = Boolean(targetId);
  const tone = toneForKind(item.itemType === 'user' ? 'proposal' : item.itemType);
  const semantic = theme.semantic[tone];

  return (
    <View style={[styles.itemCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.itemTopRow}>
        <View style={[styles.itemIcon, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}>
          <MobileIcon name={item.itemType === 'user' ? 'profile' : item.itemType} size={18} color={semantic.text} />
        </View>
        <View style={styles.itemCopy}>
          <SemanticBadge label={t(`account.saved.types.${item.itemType}`)} tone={tone} size="sm" />
          <AppText style={styles.itemTitle} numberOfLines={2}>{title}</AppText>
          <AppText style={[styles.itemBody, { color: theme.color.muted }]} numberOfLines={3}>{body}</AppText>
        </View>
      </View>

      <View style={styles.itemMetaRow}>
        <AppText style={[styles.itemMetaText, { color: theme.color.muted }]}>{t('account.saved.savedAt', { date: formatSavedDate(item.createdAt) })}</AppText>
        {targetId ? <AppText style={[styles.itemMetaText, { color: theme.color.muted }]}>{t('account.saved.targetId', { id: targetId.slice(0, 8) })}</AppText> : <SemanticBadge label={t('account.saved.unavailable.badge')} tone="danger" size="sm" />}
      </View>

      {item.collections?.length ? (
        <View style={styles.itemCollections}>
          {item.collections.map((collection) => <View key={collection.id} style={[styles.itemCollectionTag, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><AppText style={[styles.itemCollectionTagText, { color: theme.color.muted }]}>{collection.title}</AppText></View>)}
        </View>
      ) : null}

      <View style={styles.itemActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.actions.open')} disabled={!canOpen} onPress={onOpen} style={({ pressed }) => [styles.itemPrimaryAction, { backgroundColor: canOpen ? theme.color.text : theme.color.border }, pressed && canOpen && styles.pressed]}>
          <AppText style={[styles.itemPrimaryActionText, { color: theme.color.background }]}>{t('common.actions.open')}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('account.saved.collections.manage')} onPress={onManageCollections} style={({ pressed }) => [styles.itemSecondaryAction, { borderColor: theme.color.border }, pressed && styles.pressed]}>
          <AppText style={[styles.itemSecondaryActionText, { color: theme.color.text }]}>{t('account.saved.collections.manage')}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.actions.remove')} disabled={updating} onPress={onRemove} style={({ pressed }) => [styles.itemSecondaryAction, { borderColor: theme.color.border }, (pressed || updating) && styles.pressed]}>
          {updating ? <ActivityIndicator color={theme.color.text} /> : <AppText style={[styles.itemSecondaryActionText, { color: theme.color.text }]}>{t('common.actions.remove')}</AppText>}
        </Pressable>
      </View>
    </View>
  );
}

function CollectionEditorModal({ busy, description, mode, onChangeDescription, onChangeTitle, onClose, onSave, title, titleError, visible }: { busy: boolean; description: string; mode: CollectionEditorMode; onChangeDescription: (value: string) => void; onChangeTitle: (value: string) => void; onClose: () => void; onSave: () => void; title: string; titleError: string | null; visible: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalTapArea}>
          <Pressable accessibilityRole="menu" onPress={(event) => event.stopPropagation()} style={[styles.modalSheet, { backgroundColor: theme.color.elevated, borderColor: theme.color.border }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>{mode === 'edit' ? t('account.saved.collections.editTitle') : t('account.saved.collections.createTitle')}</AppText>
              <AppText style={[styles.modalBody, { color: theme.color.muted }]}>{t('account.saved.collections.editorBody')}</AppText>
            </View>
            <View style={styles.formFields}>
              <TextInput value={title} onChangeText={onChangeTitle} maxLength={80} placeholder={t('account.saved.collections.titlePlaceholder')} placeholderTextColor={theme.color.muted} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: titleError ? theme.semantic.danger.border : theme.color.border, color: theme.color.text }]} />
              {titleError ? <AppText style={[styles.fieldError, { color: theme.semantic.danger.text }]}>{titleError}</AppText> : null}
              <TextInput value={description} onChangeText={onChangeDescription} maxLength={240} placeholder={t('account.saved.collections.descriptionPlaceholder')} placeholderTextColor={theme.color.muted} multiline textAlignVertical="top" style={[styles.input, styles.textArea, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
            </View>
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.modalButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.modalButtonText, { color: theme.color.text }]}>{t('common.actions.cancel')}</AppText></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={onSave} style={({ pressed }) => [styles.modalButton, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, pressed && !busy && styles.pressed, busy && styles.disabled]}><AppText style={[styles.modalButtonText, { color: theme.semantic.proposal.text }]}>{busy ? t('common.states.working') : t('common.actions.save')}</AppText></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CollectionMembershipModal({ busyAction, collections, item, onAdd, onClose, onRemove, visible }: { busyAction: string | null; collections: SavedCollectionDto[]; item: SavedItemDto | null; onAdd: (collection: SavedCollectionDto, item: SavedItemDto) => Promise<void>; onClose: () => void; onRemove: (collection: SavedCollectionDto, item: SavedItemDto) => Promise<void>; visible: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  if (!item) return null;
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalBackdrop}>
        <Pressable accessibilityRole="menu" onPress={(event) => event.stopPropagation()} style={[styles.modalSheet, styles.membershipModalSheet, { backgroundColor: theme.color.elevated, borderColor: theme.color.border }]}>
          <View style={styles.modalHeader}>
            <AppText style={styles.modalTitle} numberOfLines={2}>{t('account.saved.collections.manageItemTitle', { title: itemTitle(item, t) })}</AppText>
            <AppText style={[styles.modalBody, { color: theme.color.muted }]}>{t('account.saved.collections.manageItemBody')}</AppText>
          </View>
          <ScrollView contentContainerStyle={styles.membershipList} showsVerticalScrollIndicator={false}>
            {collections.length === 0 ? <AppText style={[styles.emptyInline, { color: theme.color.muted }]}>{t('account.saved.collections.createFirst')}</AppText> : collections.map((collection) => {
              const inCollection = collectionHasSavedItem(collection, item.id);
              const busyKey = `collection-item-${collection.id}-${item.id}`;
              return (
                <View key={collection.id} style={[styles.membershipRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
                  <View style={styles.membershipCopy}>
                    <AppText style={styles.membershipTitle} numberOfLines={1}>{collection.title}</AppText>
                    <AppText style={[styles.membershipBody, { color: theme.color.muted }]} numberOfLines={2}>{collection.description || t('account.saved.collections.defaultBody')}</AppText>
                  </View>
                  <Pressable accessibilityRole="button" disabled={busyAction === busyKey} onPress={() => { void (inCollection ? onRemove(collection, item) : onAdd(collection, item)); }} style={({ pressed }) => [styles.membershipAction, { backgroundColor: inCollection ? theme.semantic.danger.softBg : theme.semantic.proposal.softBg, borderColor: inCollection ? theme.semantic.danger.border : theme.semantic.proposal.border }, pressed && busyAction !== busyKey && styles.pressed, busyAction === busyKey && styles.disabled]}>
                    <AppText style={[styles.membershipActionText, { color: inCollection ? theme.semantic.danger.text : theme.semantic.proposal.text }]}>{busyAction === busyKey ? '…' : (inCollection ? t('account.saved.collections.removeFromCollection') : t('account.saved.collections.addToCollection'))}</AppText>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.closeModalButton, { borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.closeModalText, { color: theme.color.muted }]}>{t('common.actions.close')}</AppText></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  summaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, gap: 4 },
  summaryTitle: { fontSize: 18, fontWeight: '900' },
  summaryBody: { lineHeight: 19, fontWeight: '700' },
  searchPanel: { borderRadius: 22, borderWidth: 1, padding: 12, gap: 10 },
  searchInputRow: { minHeight: 48, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  searchInput: { flex: 1, minHeight: 46, fontSize: 15, fontWeight: '700' },
  searchActionRow: { flexDirection: 'row', gap: 9 },
  searchActionButton: { flex: 1, minHeight: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  searchActionText: { fontSize: 13, fontWeight: '900' },
  searchClearButton: { minHeight: 42, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  searchClearText: { fontSize: 13, fontWeight: '900' },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sortLabel: { fontSize: 12, fontWeight: '900' },
  sortButtons: { flexDirection: 'row', gap: 7 },
  sortChip: { minHeight: 34, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11 },
  sortChipText: { fontSize: 12, fontWeight: '900' },
  collectionToolbar: { borderRadius: 22, borderWidth: 1, padding: 13, gap: 10 },
  collectionToolbarCopy: { gap: 3 },
  collectionToolbarTitle: { fontSize: 17, fontWeight: '900' },
  collectionToolbarBody: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  collectionCreateButton: { minHeight: 42, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 13 },
  collectionCreateText: { fontSize: 13, fontWeight: '900' },
  filterWrap: { gap: 8 },
  horizontalChips: { gap: 8, paddingRight: 18 },
  filterChip: { minHeight: 42, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  filterChipText: { fontWeight: '900' },
  collectionChip: { maxWidth: 210, minHeight: 42, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  collectionChipText: { fontWeight: '900' },
  collectionCount: { minWidth: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  collectionCountText: { fontSize: 12, fontWeight: '900' },
  collectionOverview: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 12 },
  collectionOverviewHeader: { gap: 10 },
  collectionOverviewCopy: { gap: 6 },
  collectionOverviewCreate: { minHeight: 40, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  collectionOverviewGrid: { gap: 9 },
  collectionOverviewCard: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 5 },
  collectionOverviewTitle: { fontSize: 15, fontWeight: '900' },
  collectionOverviewBody: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  collectionOverviewCount: { fontSize: 12, fontWeight: '900' },
  collectionCard: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 10 },
  collectionCopy: { gap: 4 },
  collectionTitle: { fontSize: 18, fontWeight: '900' },
  collectionBody: { lineHeight: 19, fontWeight: '700' },
  collectionActions: { flexDirection: 'row', gap: 9 },
  collectionActionButton: { flex: 1, minHeight: 42, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  collectionActionText: { fontSize: 13, fontWeight: '900' },
  resultSummary: { marginTop: 2, fontSize: 12, fontWeight: '900' },
  loadingState: { minHeight: 116, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyBody: { fontWeight: '700', lineHeight: 20, textAlign: 'center' },
  list: { gap: 12 },
  itemCard: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 12 },
  itemTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, gap: 7 },
  itemTitle: { fontSize: 19, lineHeight: 23, fontWeight: '900' },
  itemBody: { lineHeight: 19, fontWeight: '700' },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  itemMetaText: { fontSize: 12, fontWeight: '800' },
  itemCollections: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  itemCollectionTag: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  itemCollectionTagText: { fontSize: 12, fontWeight: '800' },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  itemPrimaryAction: { flex: 1, minWidth: 96, minHeight: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  itemPrimaryActionText: { fontWeight: '900' },
  itemSecondaryAction: { flex: 1, minWidth: 96, minHeight: 44, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  itemSecondaryActionText: { fontWeight: '900' },
  loadMoreButton: { minHeight: 46, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  loadMoreText: { fontWeight: '900' },
  collectionsPreview: { borderRadius: 22, borderWidth: 1, padding: 15, gap: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.62)', padding: 14 },
  modalTapArea: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderWidth: 1, borderRadius: 28, padding: 16, gap: 16, maxHeight: '86%' },
  membershipModalSheet: { minHeight: 360 },
  modalHeader: { gap: 5, paddingHorizontal: 2 },
  modalTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.25 },
  modalBody: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  formFields: { gap: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, fontSize: 15, fontWeight: '700' },
  textArea: { minHeight: 86, paddingTop: 12 },
  fieldError: { fontSize: 12, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1, minHeight: 48, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  modalButtonText: { fontSize: 14, fontWeight: '900' },
  membershipList: { gap: 10, paddingBottom: 4 },
  membershipRow: { minHeight: 66, borderWidth: 1, borderRadius: 18, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  membershipCopy: { flex: 1, gap: 3 },
  membershipTitle: { fontSize: 14, fontWeight: '900' },
  membershipBody: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  membershipAction: { minHeight: 38, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  membershipActionText: { fontSize: 12, fontWeight: '900' },
  emptyInline: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  closeModalButton: { minHeight: 48, borderTopWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeModalText: { fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
