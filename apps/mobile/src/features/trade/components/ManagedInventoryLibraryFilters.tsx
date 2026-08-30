import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ForwardedRef } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import type {
  InventoryAvailabilityPreset,
  InventoryDurationPreset,
  InventoryItemType,
  TradeExchangeMode,
} from '@hellowhen/contracts';
import { AppText } from '../../../components/AppText';
import {
  LibraryActiveFilterChips,
  LibraryFilterGroup,
  LibraryFilterOption,
  LibraryFilterScreen,
  LibraryInlineSearch,
  LibrarySearchFilterRow,
  type LibraryHeaderControlsHandle,
  type LibraryHeaderControlsState,
} from '../../../components/library';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import type { NeedItem, OfferItem } from '../types';
import {
  availabilityPresetLabel,
  categoryLabel,
  durationPresetLabel,
  exchangeModes,
  inventoryAvailabilityPresetOptions,
  inventoryItemTypes,
  itemTypePluralLabel,
  modeLabel,
  needDurationPresetOptions,
  offerDurationPresetOptions,
} from './InventoryFormFields';

type InventoryKind = 'need' | 'offer';
type ManagedInventoryItem = NeedItem | OfferItem;
type ItemTypeFilter = 'all' | InventoryItemType;
type ModeFilter = 'all' | TradeExchangeMode;
type AvailabilityFilter = 'all' | InventoryAvailabilityPreset;
type DurationFilter = 'all' | InventoryDurationPreset;
type StatusFilter = 'all' | string;

type ManagedInventoryFilterState = {
  itemType: ItemTypeFilter;
  category: string | null;
  mode: ModeFilter;
  availability: AvailabilityFilter;
  duration: DurationFilter;
  status: StatusFilter;
};

type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

const defaultFilters: ManagedInventoryFilterState = {
  itemType: 'all',
  category: null,
  mode: 'all',
  availability: 'all',
  duration: 'all',
  status: 'all',
};

function normalizeSearch(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120).toLowerCase();
}

function inventorySearchText(item: ManagedInventoryItem) {
  return [
    item.title,
    item.originalTitle,
    item.description,
    item.originalDescription,
    item.itemType,
    item.category,
    item.mode,
    item.locationLabel,
    item.availabilityPreset,
    item.status,
    'timing' in item ? item.timing : null,
    'availability' in item ? item.availability : null,
    ...(item.tags ?? []),
    ...('includes' in item ? item.includes ?? [] : []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function durationPresetForItem(item: ManagedInventoryItem, kind: InventoryKind) {
  return kind === 'need'
    ? (item as NeedItem).estimatedDurationPreset
    : (item as OfferItem).typicalDurationPreset;
}

function itemMatchesFilters(item: ManagedInventoryItem, kind: InventoryKind, query: string, filters: ManagedInventoryFilterState) {
  const needle = normalizeSearch(query);
  if (needle && !inventorySearchText(item).includes(needle)) return false;
  if (filters.itemType !== 'all' && (item.itemType ?? 'service') !== filters.itemType) return false;
  if (filters.category && item.category?.trim().toLowerCase() !== filters.category.trim().toLowerCase()) return false;
  if (filters.mode !== 'all' && item.mode !== filters.mode) return false;
  if (filters.availability !== 'all' && item.availabilityPreset !== filters.availability) return false;
  if (filters.duration !== 'all' && durationPresetForItem(item, kind) !== filters.duration) return false;
  if (filters.status !== 'all' && item.status !== filters.status) return false;
  return true;
}

function uniqueTextOptions(values: Array<string | null | undefined>) {
  const valuesByKey = new Map<string, string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!valuesByKey.has(key)) valuesByKey.set(key, trimmed);
  }
  return [...valuesByKey.values()].sort((left, right) => left.localeCompare(right));
}

function availableOrderedOptions<T extends string>(values: Array<T | null | undefined>, order: readonly T[]) {
  const available = new Set(values.filter((value): value is T => Boolean(value)));
  return order.filter((value) => available.has(value));
}

function statusLabel(status: string, t: TFunction) {
  if (status === 'pending_review') return t('inventory.statuses.pendingReview');
  if (status === 'rejected') return t('inventory.statuses.rejected');
  if (status === 'fulfilled') return t('inventory.statuses.fulfilled');
  if (status === 'accepted') return t('inventory.statuses.accepted');
  if (status === 'closed') return t('inventory.statuses.closed');
  if (status === 'expired') return t('inventory.statuses.expired');
  if (status === 'draft') return t('inventory.statuses.draft');
  return t('inventory.statuses.active');
}

function activeFilterCount(filters: ManagedInventoryFilterState) {
  return Number(filters.itemType !== 'all')
    + Number(Boolean(filters.category))
    + Number(filters.mode !== 'all')
    + Number(filters.availability !== 'all')
    + Number(filters.duration !== 'all')
    + Number(filters.status !== 'all');
}

function filtersAreDefault(filters: ManagedInventoryFilterState) {
  return activeFilterCount(filters) === 0;
}

type ManagedInventoryLibraryFiltersProps<TItem extends ManagedInventoryItem> = {
  kind: InventoryKind;
  items: TItem[];
  children: (visibleItems: TItem[]) => React.ReactNode;
  headerControls?: boolean;
  onHeaderControlsStateChange?: (state: LibraryHeaderControlsState) => void;
};

function ManagedInventoryLibraryFiltersInner<TItem extends ManagedInventoryItem>({
  kind,
  items,
  children,
  headerControls = false,
  onHeaderControlsStateChange,
}: ManagedInventoryLibraryFiltersProps<TItem>, ref: ForwardedRef<LibraryHeaderControlsHandle>) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const tone = kind === 'need' ? 'need' : 'offer';
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ManagedInventoryFilterState>({ ...defaultFilters });
  const [draftFilters, setDraftFilters] = useState<ManagedInventoryFilterState>({ ...defaultFilters });
  const [filterScreenVisible, setFilterScreenVisible] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const categories = useMemo(() => uniqueTextOptions(items.map((item) => item.category)), [items]);
  const itemTypes = useMemo(() => availableOrderedOptions(items.map((item) => item.itemType ?? 'service'), inventoryItemTypes), [items]);
  const modes = useMemo(() => availableOrderedOptions(items.map((item) => item.mode), exchangeModes), [items]);
  const availabilityPresets = useMemo(() => availableOrderedOptions(items.map((item) => item.availabilityPreset), inventoryAvailabilityPresetOptions), [items]);
  const durationPresets = useMemo(() => availableOrderedOptions(
    items.map((item) => durationPresetForItem(item, kind)),
    kind === 'need' ? needDurationPresetOptions : offerDurationPresetOptions,
  ), [items, kind]);
  const statuses = useMemo(() => uniqueTextOptions(items.map((item) => item.status)), [items]);

  const visibleItems = useMemo(
    () => items.filter((item) => itemMatchesFilters(item, kind, query, filters)),
    [filters, items, kind, query],
  );
  const draftVisibleCount = useMemo(
    () => items.filter((item) => itemMatchesFilters(item, kind, query, draftFilters)).length,
    [draftFilters, items, kind, query],
  );
  const filterCount = activeFilterCount(filters);
  const hasQuery = Boolean(normalizeSearch(query));
  const hasSearchOrFilters = Boolean(hasQuery || filterCount);
  const canUseControls = items.length > 0;

  useImperativeHandle(ref, () => ({
    toggleSearch: () => {
      if (!canUseControls) return;
      setSearchExpanded((current) => {
        if (current) Keyboard.dismiss();
        return !current;
      });
    },
    closeSearch: () => {
      Keyboard.dismiss();
      setSearchExpanded(false);
    },
    openFilters: () => {
      if (!canUseControls) return;
      openFilters();
    },
  }), [canUseControls, filters]);

  useEffect(() => {
    onHeaderControlsStateChange?.({
      searchExpanded,
      hasQuery,
      filterCount,
      canSearch: canUseControls,
      canFilter: canUseControls,
    });
  }, [canUseControls, filterCount, hasQuery, onHeaderControlsStateChange, searchExpanded]);

  const itemTypeFilterLabel = (value: ItemTypeFilter) => itemTypePluralLabel(value, t);
  const modeFilterLabel = (value: ModeFilter) => value === 'all' ? t('inventory.libraryFilters.allModes') : modeLabel(value, t);
  const availabilityFilterLabel = (value: AvailabilityFilter) => value === 'all' ? t('inventory.libraryFilters.allAvailability') : availabilityPresetLabel(value, t);
  const durationFilterLabel = (value: DurationFilter) => value === 'all' ? t('inventory.libraryFilters.allDurations') : durationPresetLabel(value, t);
  const statusFilterLabel = (value: StatusFilter) => value === 'all' ? t('inventory.libraryFilters.allStatuses') : statusLabel(value, t);

  const activeFilters = [
    ...(filters.itemType !== 'all' ? [{
      key: 'item-type',
      label: itemTypeFilterLabel(filters.itemType),
      accessibilityLabel: `${t('common.actions.remove')} ${itemTypeFilterLabel(filters.itemType)}`,
      onRemove: () => setFilters((current) => ({ ...current, itemType: 'all' })),
    }] : []),
    ...(filters.category ? [{
      key: 'category',
      label: categoryLabel(filters.category, t),
      accessibilityLabel: `${t('common.actions.remove')} ${categoryLabel(filters.category, t)}`,
      onRemove: () => setFilters((current) => ({ ...current, category: null })),
    }] : []),
    ...(filters.mode !== 'all' ? [{
      key: 'mode',
      label: modeFilterLabel(filters.mode),
      accessibilityLabel: `${t('common.actions.remove')} ${modeFilterLabel(filters.mode)}`,
      onRemove: () => setFilters((current) => ({ ...current, mode: 'all' })),
    }] : []),
    ...(filters.availability !== 'all' ? [{
      key: 'availability',
      label: availabilityFilterLabel(filters.availability),
      accessibilityLabel: `${t('common.actions.remove')} ${availabilityFilterLabel(filters.availability)}`,
      onRemove: () => setFilters((current) => ({ ...current, availability: 'all' })),
    }] : []),
    ...(filters.duration !== 'all' ? [{
      key: 'duration',
      label: durationFilterLabel(filters.duration),
      accessibilityLabel: `${t('common.actions.remove')} ${durationFilterLabel(filters.duration)}`,
      onRemove: () => setFilters((current) => ({ ...current, duration: 'all' })),
    }] : []),
    ...(filters.status !== 'all' ? [{
      key: 'status',
      label: statusFilterLabel(filters.status),
      accessibilityLabel: `${t('common.actions.remove')} ${statusFilterLabel(filters.status)}`,
      onRemove: () => setFilters((current) => ({ ...current, status: 'all' })),
    }] : []),
  ];

  function openFilters() {
    setDraftFilters(filters);
    setFilterScreenVisible(true);
  }

  function clearAll() {
    setQuery('');
    setFilters({ ...defaultFilters });
    setDraftFilters({ ...defaultFilters });
  }

  if (items.length === 0) return <>{children(items)}</>;

  return (
    <View style={styles.wrapper}>
      {headerControls ? (
        searchExpanded ? (
          <LibraryInlineSearch
            query={query}
            onQueryChange={(value) => setQuery(value.slice(0, 120))}
            placeholder={kind === 'need' ? t('inventory.libraryFilters.searchMyNeeds') : t('inventory.libraryFilters.searchMyOffers')}
            clearAccessibilityLabel={t('inventory.libraryFilters.clearMineSearch')}
            tone={tone}
          />
        ) : null
      ) : (
        <LibrarySearchFilterRow
          query={query}
          onQueryChange={(value) => setQuery(value.slice(0, 120))}
          searchPlaceholder={kind === 'need' ? t('inventory.libraryFilters.searchMyNeeds') : t('inventory.libraryFilters.searchMyOffers')}
          filterAccessibilityLabel={kind === 'need' ? t('inventory.libraryFilters.filterMyNeeds') : t('inventory.libraryFilters.filterMyOffers')}
          onOpenFilters={openFilters}
          filterCount={filterCount}
          tone={tone}
          clearAccessibilityLabel={t('inventory.libraryFilters.clearMineSearch')}
          filtersExpanded={filterScreenVisible}
        />
      )}

      <LibraryActiveFilterChips filters={activeFilters} tone={tone} />

      <LibraryFilterScreen
        visible={filterScreenVisible}
        title={t('inventory.libraryFilters.title')}
        body={kind === 'need' ? t('inventory.libraryFilters.mineNeedsBody') : t('inventory.libraryFilters.mineOffersBody')}
        closeAccessibilityLabel={t('inventory.libraryFilters.closeFilters')}
        resetLabel={t('inventory.libraryFilters.reset')}
        applyLabel={t('inventory.libraryFilters.showResults', { count: draftVisibleCount })}
        onClose={() => setFilterScreenVisible(false)}
        onReset={() => setDraftFilters({ ...defaultFilters })}
        onApply={() => { setFilters(draftFilters); setFilterScreenVisible(false); }}
        tone={tone}
        resetDisabled={filtersAreDefault(draftFilters)}
      >
        {itemTypes.length > 1 ? (
          <LibraryFilterGroup title={t('inventory.libraryFilters.type')}>
            <LibraryFilterOption label={itemTypeFilterLabel('all')} selected={draftFilters.itemType === 'all'} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, itemType: 'all' }))} />
            {itemTypes.map((itemType) => (
              <LibraryFilterOption key={itemType} label={itemTypeFilterLabel(itemType)} selected={draftFilters.itemType === itemType} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, itemType }))} />
            ))}
          </LibraryFilterGroup>
        ) : null}

        {categories.length ? (
          <LibraryFilterGroup title={t('inventory.libraryFilters.category')}>
            <LibraryFilterOption label={t('inventory.libraryFilters.allCategories')} selected={!draftFilters.category} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, category: null }))} />
            {categories.map((category) => (
              <LibraryFilterOption key={category} label={categoryLabel(category, t)} selected={draftFilters.category?.toLowerCase() === category.toLowerCase()} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, category }))} />
            ))}
          </LibraryFilterGroup>
        ) : null}

        {modes.length ? (
          <LibraryFilterGroup title={t('inventory.libraryFilters.mode')}>
            <LibraryFilterOption label={modeFilterLabel('all')} selected={draftFilters.mode === 'all'} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, mode: 'all' }))} />
            {modes.map((mode) => (
              <LibraryFilterOption key={mode} label={modeFilterLabel(mode)} selected={draftFilters.mode === mode} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, mode }))} />
            ))}
          </LibraryFilterGroup>
        ) : null}

        {availabilityPresets.length ? (
          <LibraryFilterGroup title={t('inventory.libraryFilters.availability')}>
            <LibraryFilterOption label={availabilityFilterLabel('all')} selected={draftFilters.availability === 'all'} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, availability: 'all' }))} />
            {availabilityPresets.map((availability) => (
              <LibraryFilterOption key={availability} label={availabilityFilterLabel(availability)} selected={draftFilters.availability === availability} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, availability }))} />
            ))}
          </LibraryFilterGroup>
        ) : null}

        {durationPresets.length ? (
          <LibraryFilterGroup title={t('inventory.libraryFilters.duration')}>
            <LibraryFilterOption label={durationFilterLabel('all')} selected={draftFilters.duration === 'all'} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, duration: 'all' }))} />
            {durationPresets.map((duration) => (
              <LibraryFilterOption key={duration} label={durationFilterLabel(duration)} selected={draftFilters.duration === duration} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, duration }))} />
            ))}
          </LibraryFilterGroup>
        ) : null}

        {statuses.length > 1 ? (
          <LibraryFilterGroup title={t('inventory.libraryFilters.status')}>
            <LibraryFilterOption label={statusFilterLabel('all')} selected={draftFilters.status === 'all'} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, status: 'all' }))} />
            {statuses.map((status) => (
              <LibraryFilterOption key={status} label={statusFilterLabel(status)} selected={draftFilters.status === status} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, status }))} />
            ))}
          </LibraryFilterGroup>
        ) : null}
      </LibraryFilterScreen>

      {items.length > 0 && visibleItems.length === 0 && hasSearchOrFilters ? (
        <View style={[styles.emptyState, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <AppText style={styles.emptyTitle}>{t('inventory.libraryFilters.noMatchingMineTitle')}</AppText>
          <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{t('inventory.libraryFilters.noMatchingMineBody')}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={clearAll}
            style={({ pressed }) => [styles.clearButton, { borderColor: theme.semantic[tone].border, backgroundColor: theme.semantic[tone].softBg }, pressed && styles.pressed]}
          >
            <AppText style={[styles.clearButtonText, { color: theme.semantic[tone].text }]}>{t('inventory.libraryFilters.clearAll')}</AppText>
          </Pressable>
        </View>
      ) : children(visibleItems as TItem[])}
    </View>
  );
}


export const ManagedInventoryLibraryFilters = forwardRef(ManagedInventoryLibraryFiltersInner) as <TItem extends ManagedInventoryItem>(
  props: ManagedInventoryLibraryFiltersProps<TItem> & React.RefAttributes<LibraryHeaderControlsHandle>,
) => React.ReactElement;

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  emptyState: {
    minHeight: 180,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  emptyTitle: {
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  emptyBody: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  clearButton: {
    minHeight: 44,
    marginTop: 3,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
});
