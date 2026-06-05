import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { InventoryItemType, InventoryTemplateDto, TradeExchangeMode } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import { AppCard } from '../../../components/AppCard';
import { AppText } from '../../../components/AppText';
import { MobileIcon } from '../../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../../components/SemanticUI';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import { itemTypeLabel, itemTypePluralLabel, modeLabel } from './InventoryFormFields';
import { resolveMediaUrl } from '../mediaUrls';

type TemplateKind = 'need' | 'offer';
type ItemTypeFilter = 'all' | InventoryItemType;

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
};

const itemTypeFilters: ItemTypeFilter[] = ['all', 'service', 'goods', 'other'];

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
    template.category,
    template.timing,
    template.availability,
    template.locationLabel,
    ...(template.tags ?? []),
    ...(template.includes ?? []),
    sourceLabel(template, t),
  ].filter(Boolean).join(' ').toLowerCase();
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

export function StarterInventoryLibrary({
  kind,
  templates,
  loading = false,
  error = null,
  cloningTemplateId = null,
  actionLabel,
  emptyTitle,
  emptyBody,
  onUseTemplate,
}: StarterInventoryLibraryProps) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
  const plural = kind === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase();
  const defaultActionLabel = kind === 'need' ? t('inventory.actions.useThisNeed') : t('inventory.actions.useThisOffer');
  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesType = itemTypeFilter === 'all' || (template.itemType ?? 'service') === itemTypeFilter;
      const matchesSearch = !needle || templateSearchText(template, t).includes(needle);
      return matchesType && matchesSearch;
    });
  }, [itemTypeFilter, query, t, templates]);
  const sections = useMemo(() => groupedTemplates(filteredTemplates, t), [filteredTemplates, t]);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.searchBox, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        <MobileIcon name="search" size={18} color={theme.color.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`${t('common.actions.search')} ${t('inventory.labels.starterLibrary').toLowerCase()}`}
          placeholderTextColor={theme.color.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { color: theme.color.text }]}
        />
      </View>

      <View style={styles.filterRow}>
        {itemTypeFilters.map((filter) => {
          const selected = itemTypeFilter === filter;
          return (
            <Pressable
              key={filter}
              accessibilityRole="button"
              onPress={() => setItemTypeFilter(filter)}
              style={({ pressed }) => [
                styles.filterChip,
                { backgroundColor: theme.color.surface, borderColor: theme.color.border },
                selected && { backgroundColor: theme.color.text, borderColor: theme.color.text },
                pressed && styles.pressed,
              ]}
            >
              <AppText style={[styles.filterChipText, { color: selected ? theme.color.background : theme.color.muted }]}>{itemTypePluralLabel(filter, t)}</AppText>
            </Pressable>
          );
        })}
      </View>

      {error ? <InfoNotice tone="danger" title={t('inventory.errors.starterLibraryError')} body={error} /> : null}
      {loading ? <InfoNotice tone="instruction" title={t('inventory.messages.loadingStarterLibrary')} body={t('inventory.messages.checkingReusableStarters', { items: plural })} /> : null}

      {!loading && sections.length === 0 ? (
        <AppCard style={styles.emptyCard}>
          <SemanticBadge label={t('inventory.labels.starterLibrary')} tone="instruction" />
          <AppText style={styles.emptyTitle}>{emptyTitle ?? t('inventory.empty.noStarterFound', { items: plural })}</AppText>
          <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{emptyBody ?? t('inventory.empty.tryAnotherSearch')}</AppText>
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
      accessibilityLabel={`${cloning ? t('common.states.saving') : actionLabel}: ${template.title}`}
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
        <View style={styles.templateTopRow}>
          <SemanticBadge label={t(`inventory.labels.${kind}`)} tone={tone} size="sm" style={styles.kindBadge} />
          <SemanticBadge label={sourceLabel(template, t)} tone="instruction" size="sm" style={styles.sourceBadge} />
        </View>
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
          ) : null}
          <View style={[styles.usePill, { backgroundColor: semantic.bg }]}>
            <AppText style={[styles.usePillText, { color: theme.color.background }]} numberOfLines={1}>{cloning ? t('common.states.saving') : actionLabel}</AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  searchBox: { minHeight: 48, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '800', paddingVertical: 0 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  filterChipText: { fontSize: 13, fontWeight: '900' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.2 },
  sectionCount: { fontSize: 12, fontWeight: '900' },
  templateCard: { flexDirection: 'row', overflow: 'hidden', borderRadius: 24, borderWidth: 1, aspectRatio: 3 },
  templateMediaZone: { width: '33.333%', height: '100%', position: 'relative' },
  templateMediaImage: { width: '100%', height: '100%' },
  templateMediaFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  templateContentZone: { flex: 1, paddingHorizontal: 12, paddingVertical: 9, justifyContent: 'space-between', gap: 5 },
  templateTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  kindBadge: { flexShrink: 0 },
  sourceBadge: { flexShrink: 1 },
  templateMainCopy: { gap: 2 },
  templateTitle: { fontSize: 16, lineHeight: 20, fontWeight: '900', letterSpacing: -0.15 },
  templateMeta: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  templateFooterRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  templateFooterMeta: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  templateFooterText: { flex: 1, fontSize: 11, fontWeight: '900', letterSpacing: 0.25, textTransform: 'uppercase' },
  usePill: { flexShrink: 0, maxWidth: 104, minHeight: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 6 },
  usePillText: { fontSize: 11, fontWeight: '900' },
  emptyCard: { gap: 10 },
  emptyTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.25 },
  emptyBody: { lineHeight: 20, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
