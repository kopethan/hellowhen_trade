import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ForwardedRef } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import type {
  InventoryAvailabilityPreset,
  InventoryDurationPreset,
  InventoryItemType,
  InventoryTemplateDto,
  TradeExchangeMode,
} from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import { AppCard } from '../../../components/AppCard';
import { AppText } from '../../../components/AppText';
import { MobileIcon } from '../../../components/MobileIcon';
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
import { InfoNotice, SemanticBadge } from '../../../components/SemanticUI';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import {
  availabilityPresetLabel,
  categoryLabel,
  durationPresetLabel,
  exchangeModes,
  inventoryAvailabilityPresetOptions,
  itemTypeLabel,
  itemTypePluralLabel,
  modeLabel,
  needDurationPresetOptions,
  offerDurationPresetOptions,
} from './InventoryFormFields';
import { STARTER_PACK_FILTERS, matchesStarterPackFilter, type StarterPackFilter } from './starterTemplateFilters';
import { resolveMediaUrl } from '../mediaUrls';

type TemplateKind = 'need' | 'offer';
type ItemTypeFilter = 'all' | InventoryItemType;
type ModeFilter = 'all' | TradeExchangeMode;
type AvailabilityFilter = 'all' | InventoryAvailabilityPreset;
type DurationFilter = 'all' | InventoryDurationPreset;

type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

type StarterInventoryLibraryProps = {
  kind: TemplateKind;
  templates: InventoryTemplateDto[];
  loading?: boolean;
  error?: string | null;
  cloningTemplateId?: string | null;
  actionLabel?: string;
  emptyTitle?: string;
  emptyBody?: string;
  onUseTemplate: (template: InventoryTemplateDto) => void;
  headerControls?: boolean;
  onHeaderControlsStateChange?: (state: LibraryHeaderControlsState) => void;
};

type StarterTemplateFilterState = {
  starterPack: StarterPackFilter;
  itemType: ItemTypeFilter;
  category: string | null;
  mode: ModeFilter;
  availability: AvailabilityFilter;
  duration: DurationFilter;
};

const itemTypeFilters: ItemTypeFilter[] = ['all', 'service', 'goods', 'other'];
const defaultStarterFilters: StarterTemplateFilterState = {
  starterPack: 'all',
  itemType: 'all',
  category: null,
  mode: 'all',
  availability: 'all',
  duration: 'all',
};

function optionalModeLabel(mode: TradeExchangeMode | null | undefined, t: TFunction) {
  return mode ? modeLabel(mode, t) : undefined;
}

function templateMeta(template: InventoryTemplateDto, t: TFunction) {
  return [
    itemTypeLabel(template.itemType ?? 'service', t),
    template.category,
    template.kind === 'need' ? template.timing : template.availability,
    optionalModeLabel(template.mode, t),
    template.locationLabel,
  ].filter(Boolean).join(' · ');
}

function sourceLabel(template: InventoryTemplateDto, t: TFunction) {
  if (template.businessProfile?.displayName) return t('inventory.sourceLabels.fromBusiness', { name: template.businessProfile.displayName });
  if (template.sourceType === 'brand') return t('inventory.sourceLabels.brandLibrary');
  if (template.sourceType === 'business') return t('inventory.sourceLabels.companyLibrary');
  if (template.sourceType === 'partner') return t('inventory.sourceLabels.partnerLibrary');
  return t('inventory.sourceLabels.hellowhenLibrary');
}

function templateSearchText(template: InventoryTemplateDto, t: TFunction) {
  return [
    template.title,
    template.description,
    template.itemType,
    template.category,
    template.timing,
    template.availability,
    template.availabilityPreset,
    template.durationPreset,
    template.mode,
    template.locationLabel,
    ...(template.tags ?? []),
    ...(template.includes ?? []),
    sourceLabel(template, t),
  ].filter(Boolean).join(' ').toLowerCase();
}

function matchesTemplateFilters(template: InventoryTemplateDto, filters: StarterTemplateFilterState, needle: string, t: TFunction) {
  if (!matchesStarterPackFilter(template, filters.starterPack)) return false;
  if (filters.itemType !== 'all' && (template.itemType ?? 'service') !== filters.itemType) return false;
  if (filters.category && template.category?.trim().toLowerCase() !== filters.category.trim().toLowerCase()) return false;
  if (filters.mode !== 'all' && template.mode !== filters.mode) return false;
  if (filters.availability !== 'all' && template.availabilityPreset !== filters.availability) return false;
  if (filters.duration !== 'all' && template.durationPreset !== filters.duration) return false;
  return !needle || templateSearchText(template, t).includes(needle);
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

function sectionLabel(itemType: InventoryItemType, t: TFunction) {
  return itemTypePluralLabel(itemType, t);
}

function groupedTemplates(templates: InventoryTemplateDto[], t: TFunction) {
  const order: InventoryItemType[] = ['service', 'goods', 'other'];
  return order.map((itemType) => ({
    key: itemType,
    label: sectionLabel(itemType, t),
    templates: templates.filter((template) => (template.itemType ?? 'service') === itemType),
  })).filter((section) => section.templates.length > 0);
}

function starterFilterCount(filters: StarterTemplateFilterState) {
  return Number(filters.starterPack !== 'all')
    + Number(filters.itemType !== 'all')
    + Number(Boolean(filters.category))
    + Number(filters.mode !== 'all')
    + Number(filters.availability !== 'all')
    + Number(filters.duration !== 'all');
}

function StarterInventoryLibraryInner({
  kind,
  templates,
  loading = false,
  error = null,
  cloningTemplateId = null,
  actionLabel,
  emptyTitle,
  emptyBody,
  onUseTemplate,
  headerControls = false,
  onHeaderControlsStateChange,
}: StarterInventoryLibraryProps, ref: ForwardedRef<LibraryHeaderControlsHandle>) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<StarterTemplateFilterState>({ ...defaultStarterFilters });
  const [filterScreenVisible, setFilterScreenVisible] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [draftFilters, setDraftFilters] = useState<StarterTemplateFilterState>({ ...defaultStarterFilters });
  const plural = kind === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase();
  const defaultActionLabel = kind === 'need' ? t('inventory.actions.useThisNeed') : t('inventory.actions.useThisOffer');
  const tone = kind === 'need' ? 'need' : 'offer';
  const needle = query.trim().toLowerCase();
  const categories = useMemo(() => uniqueTextOptions(templates.map((template) => template.category)), [templates]);
  const modes = useMemo(() => availableOrderedOptions(templates.map((template) => template.mode), exchangeModes), [templates]);
  const availabilityPresets = useMemo(() => availableOrderedOptions(templates.map((template) => template.availabilityPreset), inventoryAvailabilityPresetOptions), [templates]);
  const durationPresets = useMemo(() => availableOrderedOptions(
    templates.map((template) => template.durationPreset),
    kind === 'need' ? needDurationPresetOptions : offerDurationPresetOptions,
  ), [kind, templates]);
  const filteredTemplates = useMemo(
    () => templates.filter((template) => matchesTemplateFilters(template, filters, needle, t)),
    [filters, needle, t, templates],
  );
  const draftFilteredCount = useMemo(
    () => templates.filter((template) => matchesTemplateFilters(template, draftFilters, needle, t)).length,
    [draftFilters, needle, t, templates],
  );
  const sections = useMemo(() => groupedTemplates(filteredTemplates, t), [filteredTemplates, t]);
  const activeFilterCount = starterFilterCount(filters);
  const hasQuery = Boolean(needle);
  const canUseControls = templates.length > 0;

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
      filterCount: activeFilterCount,
      canSearch: canUseControls,
      canFilter: canUseControls,
    });
  }, [activeFilterCount, canUseControls, hasQuery, onHeaderControlsStateChange, searchExpanded]);

  const packLabel = (pack: StarterPackFilter) => t(STARTER_PACK_FILTERS.find((filter) => filter.value === pack)?.key ?? 'inventory.starterPacks.all');
  const modeFilterLabel = (mode: ModeFilter) => mode === 'all' ? t('inventory.libraryFilters.allModes') : modeLabel(mode, t);
  const availabilityFilterLabel = (availability: AvailabilityFilter) => availability === 'all' ? t('inventory.libraryFilters.allAvailability') : availabilityPresetLabel(availability, t);
  const durationFilterLabel = (duration: DurationFilter) => duration === 'all' ? t('inventory.libraryFilters.allDurations') : durationPresetLabel(duration, t);

  const activeFilters = [
    ...(filters.starterPack !== 'all' ? [{
      key: 'starter-pack',
      label: packLabel(filters.starterPack),
      accessibilityLabel: `${t('common.actions.remove')} ${packLabel(filters.starterPack)}`,
      onRemove: () => setFilters((current) => ({ ...current, starterPack: 'all' })),
    }] : []),
    ...(filters.itemType !== 'all' ? [{
      key: 'item-type',
      label: itemTypePluralLabel(filters.itemType, t),
      accessibilityLabel: `${t('common.actions.remove')} ${itemTypePluralLabel(filters.itemType, t)}`,
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
  ];

  function openFilters() {
    setDraftFilters(filters);
    setFilterScreenVisible(true);
  }
  const closeFilters = () => setFilterScreenVisible(false);
  const resetDraftFilters = () => setDraftFilters({ ...defaultStarterFilters });
  const clearAll = () => {
    setQuery('');
    setFilters({ ...defaultStarterFilters });
    setDraftFilters({ ...defaultStarterFilters });
  };
  const applyDraftFilters = () => {
    setFilters(draftFilters);
    setFilterScreenVisible(false);
  };

  return (
    <View style={styles.wrapper}>
      {headerControls ? (
        searchExpanded ? (
          <LibraryInlineSearch
            query={query}
            onQueryChange={(value) => setQuery(value.slice(0, 120))}
            placeholder={t('inventory.libraryFilters.searchStarterLibrary')}
            clearAccessibilityLabel={t('inventory.libraryFilters.clearSearch')}
            tone={tone}
          />
        ) : null
      ) : (
        <LibrarySearchFilterRow
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder={t('inventory.libraryFilters.searchStarterLibrary')}
          filterAccessibilityLabel={t('inventory.libraryFilters.openFilters')}
          onOpenFilters={openFilters}
          filterCount={activeFilterCount}
          tone={tone}
          clearAccessibilityLabel={t('inventory.libraryFilters.clearSearch')}
          filtersExpanded={filterScreenVisible}
        />
      )}

      <LibraryActiveFilterChips filters={activeFilters} tone={tone} />

      <LibraryFilterScreen
        visible={filterScreenVisible}
        title={t('inventory.libraryFilters.title')}
        body={t('inventory.libraryFilters.body')}
        closeAccessibilityLabel={t('inventory.libraryFilters.closeFilters')}
        resetLabel={t('inventory.libraryFilters.reset')}
        applyLabel={t('inventory.libraryFilters.showResults', { count: draftFilteredCount })}
        onClose={closeFilters}
        onReset={resetDraftFilters}
        onApply={applyDraftFilters}
        tone={tone}
        resetDisabled={starterFilterCount(draftFilters) === 0}
      >
        <LibraryFilterGroup title={t('inventory.libraryFilters.ideaGroup')}>
          {STARTER_PACK_FILTERS.map((filter) => (
            <LibraryFilterOption key={filter.value} label={t(filter.key)} selected={draftFilters.starterPack === filter.value} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, starterPack: filter.value }))} />
          ))}
        </LibraryFilterGroup>

        <LibraryFilterGroup title={t('inventory.libraryFilters.type')}>
          {itemTypeFilters.map((itemType) => (
            <LibraryFilterOption key={itemType} label={itemTypePluralLabel(itemType, t)} selected={draftFilters.itemType === itemType} tone={tone} onPress={() => setDraftFilters((current) => ({ ...current, itemType }))} />
          ))}
        </LibraryFilterGroup>

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
      </LibraryFilterScreen>

      {error ? <InfoNotice tone="danger" title={t('inventory.errors.starterLibraryError')} body={error} /> : null}
      {loading ? <InfoNotice tone="instruction" title={t('inventory.messages.loadingStarterLibrary')} body={t('inventory.messages.checkingReusableStarters', { items: plural })} /> : null}

      {!loading && sections.length === 0 ? (
        <AppCard style={styles.emptyCard}>
          <SemanticBadge label={t('inventory.labels.starterLibrary')} tone="instruction" />
          <AppText style={styles.emptyTitle}>{emptyTitle ?? t('inventory.empty.noStarterFound', { items: plural })}</AppText>
          <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{emptyBody ?? t('inventory.empty.tryAnotherSearch')}</AppText>
          {needle || activeFilterCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={clearAll}
              style={({ pressed }) => [
                styles.emptyAction,
                { backgroundColor: theme.semantic[tone].softBg, borderColor: theme.semantic[tone].border },
                pressed && styles.pressed,
              ]}
            >
              <AppText style={[styles.emptyActionText, { color: theme.semantic[tone].text }]}>{t('inventory.libraryFilters.clearAll')}</AppText>
            </Pressable>
          ) : null}
        </AppCard>
      ) : null}

      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText style={styles.sectionTitle}>{section.label}</AppText>
            <AppText style={[styles.sectionCount, { color: theme.color.muted }]}>{section.templates.length}</AppText>
          </View>
          {section.templates.map((template) => (
            <StarterTemplateCard
              key={template.id}
              template={template}
              theme={theme}
              kind={kind}
              actionLabel={actionLabel ?? defaultActionLabel}
              cloning={cloningTemplateId === template.id}
              disabled={Boolean(cloningTemplateId)}
              onPress={() => onUseTemplate(template)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function visibleTemplateMedia(template: InventoryTemplateDto) {
  return (template.media ?? []).filter((asset) => asset.status !== 'removed');
}

function templateThumbnailUrl(template: InventoryTemplateDto) {
  const first = visibleTemplateMedia(template)[0];
  return first?.url ? resolveMediaUrl(first.url) : '';
}

function StarterTemplateCard({ template, theme, kind, actionLabel, cloning, disabled, onPress }: { template: InventoryTemplateDto; theme: ThemeTokens; kind: TemplateKind; actionLabel: string; cloning: boolean; disabled: boolean; onPress: () => void }) {
  const tone = kind === 'need' ? 'need' : 'offer';
  const { t } = useTranslation();
  const semantic = theme.semantic[tone];
  const meta = templateMeta(template, t);
  const media = visibleTemplateMedia(template);
  const thumbnailUrl = templateThumbnailUrl(template);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cloning ? t('common.states.saving') : actionLabel}: ${template.title}. ${t(`inventory.labels.${kind}`)}. ${sourceLabel(template, t)}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.templateCard,
        { backgroundColor: theme.color.surface, borderColor: theme.color.border },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.templateMediaZone, { backgroundColor: semantic.softBg }]}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} resizeMode="cover" style={styles.templateMediaImage} />
        ) : (
          <View style={[styles.templateMediaFallback, { backgroundColor: semantic.softBg }]}>
            <MobileIcon name={kind} size={28} color={semantic.text} />
          </View>
        )}
      </View>
      <View style={styles.templateContentZone}>
        <View style={styles.templateMainCopy}>
          <AppText style={styles.templateTitle} numberOfLines={2}>{template.title}</AppText>
          {meta ? <AppText style={[styles.templateMeta, { color: theme.color.muted }]} numberOfLines={1}>{meta}</AppText> : null}
        </View>
        <View style={styles.templateFooterRow}>
          {media.length > 0 ? (
            <View style={styles.templateFooterMeta}>
              <MobileIcon name="image" size={14} color={theme.color.muted} />
              <AppText style={[styles.templateFooterText, { color: theme.color.muted }]} numberOfLines={1}>
                {`${media.length} ${t('inventory.labels.images').toLowerCase()}`}
              </AppText>
            </View>
          ) : <View style={styles.templateFooterMeta} />}
          {cloning ? (
            <AppText style={[styles.templateSavingText, { color: semantic.text }]} numberOfLines={1}>{t('common.states.saving')}</AppText>
          ) : (
            <MobileIcon name="chevron-right" size={18} color={theme.color.muted} />
          )}
        </View>
      </View>
    </Pressable>
  );
}


export const StarterInventoryLibrary = forwardRef<LibraryHeaderControlsHandle, StarterInventoryLibraryProps>(StarterInventoryLibraryInner);

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.2 },
  sectionCount: { fontSize: 12, fontWeight: '900' },
  templateCard: { flexDirection: 'row', overflow: 'hidden', borderRadius: 24, borderWidth: 1, aspectRatio: 3 },
  templateMediaZone: { width: '33.333%', height: '100%', position: 'relative' },
  templateMediaImage: { width: '100%', height: '100%' },
  templateMediaFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  templateContentZone: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'space-between', gap: 3 },
  templateMainCopy: { gap: 2 },
  templateTitle: { fontSize: 16, lineHeight: 20, fontWeight: '900', letterSpacing: -0.15 },
  templateMeta: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  templateFooterRow: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  templateFooterMeta: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  templateFooterText: { flex: 1, fontSize: 11, fontWeight: '900', letterSpacing: 0.25, textTransform: 'uppercase' },
  templateSavingText: { flexShrink: 0, maxWidth: 96, fontSize: 11, fontWeight: '900', letterSpacing: 0.25, textTransform: 'uppercase' },
  emptyCard: { gap: 10 },
  emptyTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.25 },
  emptyBody: { lineHeight: 20, fontWeight: '700' },
  emptyAction: { minHeight: 44, alignSelf: 'flex-start', borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  emptyActionText: { fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
