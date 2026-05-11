import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { InventoryItemType, InventoryTemplateDto, TradeExchangeMode } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import { AppCard } from '../../../components/AppCard';
import { AppText } from '../../../components/AppText';
import { MobileIcon } from '../../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../../components/SemanticUI';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { itemTypeLabel, modeLabel } from './InventoryFormFields';

type TemplateKind = 'need' | 'offer';
type ItemTypeFilter = 'all' | InventoryItemType;

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

const itemTypeFilters: Array<{ value: ItemTypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'service', label: 'Services' },
  { value: 'goods', label: 'Goods' },
  { value: 'other', label: 'Other' },
];

function optionalModeLabel(mode?: TradeExchangeMode | null) {
  return mode ? modeLabel(mode) : undefined;
}

function templateMeta(template: InventoryTemplateDto) {
  return [
    itemTypeLabel(template.itemType ?? 'service'),
    template.category,
    template.kind === 'need' ? template.timing : template.availability,
    optionalModeLabel(template.mode),
    template.locationLabel,
  ].filter(Boolean).join(' · ');
}

function sourceLabel(template: InventoryTemplateDto) {
  if (template.businessProfile?.displayName) return `From ${template.businessProfile.displayName}`;
  if (template.sourceType === 'brand') return 'Brand Library';
  if (template.sourceType === 'business') return 'Company Library';
  if (template.sourceType === 'partner') return 'Partner Library';
  return 'Hellowhen Library';
}

function templateSearchText(template: InventoryTemplateDto) {
  return [
    template.title,
    template.description,
    template.category,
    template.timing,
    template.availability,
    template.locationLabel,
    ...(template.tags ?? []),
    ...(template.includes ?? []),
    sourceLabel(template),
  ].filter(Boolean).join(' ').toLowerCase();
}

function sectionLabel(itemType: InventoryItemType) {
  if (itemType === 'goods') return 'Goods';
  if (itemType === 'other') return 'Other';
  return 'Services';
}

function groupedTemplates(templates: InventoryTemplateDto[]) {
  const order: InventoryItemType[] = ['service', 'goods', 'other'];
  return order.map((itemType) => ({
    key: itemType,
    label: sectionLabel(itemType),
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
  const [query, setQuery] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
  const plural = kind === 'need' ? 'needs' : 'offers';
  const defaultActionLabel = kind === 'need' ? 'Use this Need' : 'Use this Offer';
  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesType = itemTypeFilter === 'all' || (template.itemType ?? 'service') === itemTypeFilter;
      const matchesSearch = !needle || templateSearchText(template).includes(needle);
      return matchesType && matchesSearch;
    });
  }, [itemTypeFilter, query, templates]);
  const sections = useMemo(() => groupedTemplates(filteredTemplates), [filteredTemplates]);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.searchBox, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        <MobileIcon name="search" size={18} color={theme.color.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search starter ${plural}`}
          placeholderTextColor={theme.color.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { color: theme.color.text }]}
        />
      </View>

      <View style={styles.filterRow}>
        {itemTypeFilters.map((filter) => {
          const selected = itemTypeFilter === filter.value;
          return (
            <Pressable
              key={filter.value}
              accessibilityRole="button"
              onPress={() => setItemTypeFilter(filter.value)}
              style={({ pressed }) => [
                styles.filterChip,
                { backgroundColor: theme.color.surface, borderColor: theme.color.border },
                selected && { backgroundColor: theme.color.text, borderColor: theme.color.text },
                pressed && styles.pressed,
              ]}
            >
              <AppText style={[styles.filterChipText, { color: selected ? theme.color.background : theme.color.muted }]}>{filter.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      {error ? <InfoNotice tone="danger" title="Starter library error" body={error} /> : null}
      {loading ? <InfoNotice tone="instruction" title="Loading starter library" body={`Checking reusable starter ${plural}.`} /> : null}

      {!loading && sections.length === 0 ? (
        <AppCard style={styles.emptyCard}>
          <SemanticBadge label="Starter library" tone="instruction" />
          <AppText style={styles.emptyTitle}>{emptyTitle ?? `No starter ${plural} found`}</AppText>
          <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{emptyBody ?? 'Try another search or filter.'}</AppText>
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

function StarterTemplateCard({ template, theme, kind, actionLabel, cloning, disabled, onPress }: { template: InventoryTemplateDto; theme: ThemeTokens; kind: TemplateKind; actionLabel: string; cloning: boolean; disabled: boolean; onPress: () => void }) {
  const tone = kind === 'need' ? 'need' : 'offer';
  const meta = templateMeta(template);
  return (
    <AppCard style={styles.templateCard}>
      <View style={styles.templateHeader}>
        <View style={styles.templateTitleWrap}>
          <SemanticBadge label={sourceLabel(template)} tone="instruction" size="sm" />
          <AppText style={styles.templateTitle}>{template.title}</AppText>
        </View>
        <SemanticBadge label={itemTypeLabel(template.itemType ?? 'service')} tone={tone} size="sm" />
      </View>
      {meta ? <AppText style={[styles.templateMeta, { color: theme.color.muted }]}>{meta}</AppText> : null}
      <AppText style={[styles.templateDescription, { color: theme.color.muted }]}>{template.description}</AppText>
      {template.includes?.length ? <AppText style={[styles.templateMeta, { color: theme.color.muted }]}>Includes: {template.includes.join(', ')}</AppText> : null}
      {template.tags?.length ? <View style={styles.tagRow}>{template.tags.slice(0, 4).map((tag) => <SemanticBadge key={tag} label={tag} tone="muted" size="sm" />)}</View> : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.useButton,
          { backgroundColor: theme.semantic[tone].bg },
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <AppText style={[styles.useButtonText, { color: theme.color.background }]}>{cloning ? 'Saving...' : actionLabel}</AppText>
      </Pressable>
    </AppCard>
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
  templateCard: { gap: 10 },
  templateHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  templateTitleWrap: { flex: 1, gap: 7 },
  templateTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.35 },
  templateMeta: { fontSize: 13, lineHeight: 18, fontWeight: '900' },
  templateDescription: { lineHeight: 20, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  useButton: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 11, marginTop: 2 },
  useButtonText: { fontWeight: '900' },
  emptyCard: { gap: 10 },
  emptyTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.25 },
  emptyBody: { lineHeight: 20, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
