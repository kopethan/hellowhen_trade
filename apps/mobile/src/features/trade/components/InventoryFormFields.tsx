import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { DiscoveryLanguage, InventoryItemType, TradeExchangeMode } from '@hellowhen/contracts';
import { findInventoryCategoryOption, getAlternateInventoryLanguage, inventoryCategoryOptions } from '@hellowhen/shared';
import { AppText } from '../../../components/AppText';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';

export const inventoryItemTypes: InventoryItemType[] = ['service', 'goods', 'other'];
export const exchangeModes: TradeExchangeMode[] = ['remote', 'local', 'hybrid'];
export const inventoryLanguageOptions: DiscoveryLanguage[] = ['en', 'fr'];

type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

export function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseInventoryList(value: string, maxItems = 8) {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const rawItem of value.split(',')) {
    const item = rawItem.trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    items.push(item.slice(0, 80));
    if (items.length >= maxItems) break;
  }

  return items;
}

export function itemTypeLabel(itemType: InventoryItemType, t?: TFunction) {
  if (itemType === 'goods') return t?.('inventory.itemTypes.goods') ?? 'Goods';
  if (itemType === 'other') return t?.('inventory.itemTypes.other') ?? 'Other';
  return t?.('inventory.itemTypes.service') ?? 'Service';
}

export function itemTypePluralLabel(itemType: InventoryItemType | 'all', t?: TFunction) {
  if (itemType === 'all') return t?.('inventory.itemTypes.all') ?? 'All';
  if (itemType === 'goods') return t?.('inventory.itemTypes.goods') ?? 'Goods';
  if (itemType === 'other') return t?.('inventory.itemTypes.other') ?? 'Other';
  return t?.('inventory.itemTypes.services') ?? 'Services';
}

export function inventoryLanguageLabel(languageCode: DiscoveryLanguage, t?: TFunction) {
  if (languageCode === 'fr') return t?.('inventory.languages.fr') ?? 'French';
  return t?.('inventory.languages.en') ?? 'English';
}

export function getEditableTranslationLanguage(defaultLanguage: DiscoveryLanguage) {
  return getAlternateInventoryLanguage(defaultLanguage) as DiscoveryLanguage;
}

export function buildManualTranslation(defaultLanguage: DiscoveryLanguage, title: string, description: string) {
  const languageCode = getEditableTranslationLanguage(defaultLanguage);
  const cleanTitle = title.trim();
  const cleanDescription = description.trim();
  return cleanTitle || cleanDescription ? [{ languageCode, title: cleanTitle, description: cleanDescription }] : [];
}


export function categoryLabel(category?: string | null, t?: TFunction) {
  const option = findInventoryCategoryOption(category);
  if (!option) return category?.trim() ?? '';
  return t?.(option.labelKey) ?? option.value;
}

export function modeLabel(mode: TradeExchangeMode, t?: TFunction) {
  if (mode === 'remote') return t?.('inventory.modes.remote') ?? 'Remote';
  if (mode === 'local') return t?.('inventory.modes.local') ?? 'Local';
  return t?.('inventory.modes.hybrid') ?? 'Hybrid';
}

export function InventoryTextField({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  multiline,
  disabled,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  disabled?: boolean;
  maxLength?: number;
}) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <View style={styles.labelTopRow}>
          <AppText style={styles.label}>{label}</AppText>
          {maxLength ? <AppText style={[styles.counter, { color: value.length >= maxLength ? theme.semantic.danger.text : theme.color.muted }]}>{t('inventory.form.textCounter', { count: value.length, max: maxLength })}</AppText> : null}
        </View>
        {hint ? <AppText style={[styles.hint, { color: theme.color.muted }]}>{hint}</AppText> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.muted}
        editable={!disabled}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }, multiline && styles.textarea]}
      />
    </View>
  );
}


export function LanguagePicker({ value, onChange, disabled }: { value: DiscoveryLanguage; onChange: (language: DiscoveryLanguage) => void; disabled?: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={styles.label}>{t('inventory.labels.defaultLanguage')}</AppText>
        <AppText style={[styles.hint, { color: theme.color.muted }]}>{t('inventory.form.languageBody')}</AppText>
      </View>
      <View style={styles.modeRow}>
        {inventoryLanguageOptions.map((languageCode) => {
          const selected = value === languageCode;
          return (
            <Pressable
              key={languageCode}
              disabled={disabled}
              onPress={() => onChange(languageCode)}
              style={({ pressed }) => [styles.modeButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, disabled && styles.disabled, pressed && styles.pressed]}
            >
              <AppText style={[styles.modeButtonText, { color: selected ? theme.semantic.proposal.text : theme.color.muted }]}>{inventoryLanguageLabel(languageCode, t)}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function OriginalLanguageSummary({ languageCode }: { languageCode: DiscoveryLanguage }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <View style={[styles.languageSummary, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }]}>
        <AppText style={[styles.languageSummaryText, { color: theme.semantic.proposal.text }]}>{t('inventory.form.originalContentLanguage', { language: inventoryLanguageLabel(languageCode, t) })}</AppText>
      </View>
    </View>
  );
}

export function AddTranslationButton({ defaultLanguage, onAdd, disabled }: { defaultLanguage: DiscoveryLanguage; onAdd: () => void; disabled?: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const translationLanguage = getEditableTranslationLanguage(defaultLanguage);
  return (
    <View style={styles.field}>
      <AppText style={[styles.hint, { color: theme.color.muted }]}>{t('inventory.form.chooseTranslationLanguage')}</AppText>
      <Pressable
        disabled={disabled}
        onPress={onAdd}
        style={({ pressed }) => [styles.modeButton, styles.addLanguageButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <AppText style={[styles.modeButtonText, { color: theme.color.text }]}>{t('inventory.actions.addLanguage')} · {inventoryLanguageLabel(translationLanguage, t)}</AppText>
      </Pressable>
    </View>
  );
}

export function ManualTranslationFields({
  defaultLanguage,
  title,
  description,
  onChangeTitle,
  onChangeDescription,
  onRemove,
  disabled,
  titleMaxLength,
  descriptionMaxLength,
}: {
  defaultLanguage: DiscoveryLanguage;
  title: string;
  description: string;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  titleMaxLength?: number;
  descriptionMaxLength?: number;
}) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const translationLanguage = getEditableTranslationLanguage(defaultLanguage);
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <View style={styles.labelTopRow}>
          <AppText style={styles.label}>{t('inventory.form.manualTranslationFor', { language: inventoryLanguageLabel(translationLanguage, t) })}</AppText>
          {onRemove ? (
            <Pressable disabled={disabled} onPress={onRemove} style={({ pressed }) => [styles.removeButton, disabled && styles.disabled, pressed && styles.pressed]}>
              <AppText style={[styles.removeButtonText, { color: theme.semantic.danger.text }]}>{t('inventory.actions.removeTranslation')}</AppText>
            </Pressable>
          ) : null}
        </View>
        <AppText style={[styles.hint, { color: theme.color.muted }]}>{t('inventory.form.translationHelp')}</AppText>
      </View>
      <InventoryTextField
        label={t('inventory.form.translationTitleLabel', { language: inventoryLanguageLabel(translationLanguage, t) })}
        value={title}
        onChangeText={onChangeTitle}
        placeholder={t('inventory.form.translationTitlePlaceholder')}
        maxLength={titleMaxLength}
        disabled={disabled}
      />
      <InventoryTextField
        label={t('inventory.form.translationDescriptionLabel', { language: inventoryLanguageLabel(translationLanguage, t) })}
        value={description}
        onChangeText={onChangeDescription}
        placeholder={t('inventory.form.translationDescriptionPlaceholder')}
        maxLength={descriptionMaxLength}
        multiline
        disabled={disabled}
      />
    </View>
  );
}

export function CategoryPicker({ value, onChange, disabled }: { value: string; onChange: (category: string) => void; disabled?: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={styles.label}>{t('inventory.labels.category')}</AppText>
        <AppText style={[styles.hint, { color: theme.color.muted }]}>{t('inventory.form.categoryHelp')}</AppText>
      </View>
      <View style={styles.modeRow}>
        <Pressable
          disabled={disabled}
          onPress={() => onChange('')}
          style={({ pressed }) => [styles.modeButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, !value && { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, disabled && styles.disabled, pressed && styles.pressed]}
        >
          <AppText style={[styles.modeButtonText, { color: !value ? theme.semantic.proposal.text : theme.color.muted }]}>{t('inventory.labels.optional')}</AppText>
        </Pressable>
        {inventoryCategoryOptions.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.modeButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, disabled && styles.disabled, pressed && styles.pressed]}
            >
              <AppText style={[styles.modeButtonText, { color: selected ? theme.semantic.proposal.text : theme.color.muted }]}>{t(option.labelKey)}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function InventoryTypePicker({ value, onChange, disabled }: { value: InventoryItemType; onChange: (itemType: InventoryItemType) => void; disabled?: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{t('inventory.labels.type')}</AppText>
      <View style={styles.modeRow}>
        {inventoryItemTypes.map((itemType) => {
          const selected = value === itemType;
          return (
            <Pressable
              key={itemType}
              disabled={disabled}
              onPress={() => onChange(itemType)}
              style={({ pressed }) => [styles.modeButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, disabled && styles.disabled, pressed && styles.pressed]}
            >
              <AppText style={[styles.modeButtonText, { color: selected ? theme.semantic.proposal.text : theme.color.muted }]}>{itemTypeLabel(itemType, t)}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ModePicker({ value, onChange, disabled }: { value: TradeExchangeMode; onChange: (mode: TradeExchangeMode) => void; disabled?: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{t('inventory.labels.mode')}</AppText>
      <View style={styles.modeRow}>
        {exchangeModes.map((mode) => {
          const selected = value === mode;
          return (
            <Pressable
              key={mode}
              disabled={disabled}
              onPress={() => onChange(mode)}
              style={({ pressed }) => [styles.modeButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, disabled && styles.disabled, pressed && styles.pressed]}
            >
              <AppText style={[styles.modeButtonText, { color: selected ? theme.semantic.proposal.text : theme.color.muted }]}>{modeLabel(mode, t)}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function InventoryPreview({
  eyebrow,
  title,
  meta,
  description,
}: {
  eyebrow: string;
  title: string;
  meta: string;
  description: string;
}) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={[styles.preview, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
      <AppText style={[styles.previewEyebrow, { color: theme.color.muted }]}>{eyebrow}</AppText>
      <AppText style={styles.previewTitle}>{title || t('inventory.form.previewTitleFallback')}</AppText>
      <AppText style={[styles.previewMeta, { color: theme.color.muted }]}>{meta || t('inventory.form.previewMetaFallback')}</AppText>
      <AppText style={[styles.previewDescription, { color: theme.color.muted }]} numberOfLines={3}>{description || t('inventory.form.previewDescriptionFallback')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  labelRow: {
    gap: 3,
  },
  labelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '900',
  },
  counter: {
    fontSize: 12,
    fontWeight: '900',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  textarea: {
    minHeight: 128,
    lineHeight: 22,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  modeButtonSelected: {},
  modeButtonText: {
    fontWeight: '900',
  },
  addLanguageButton: {
    alignSelf: 'flex-start',
  },
  languageSummary: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  languageSummaryText: {
    fontSize: 12,
    fontWeight: '900',
  },
  removeButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '900',
  },
  modeButtonTextSelected: {
    color: '#0F766E',
  },
  preview: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 7,
  },
  previewEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  previewMeta: {
    fontSize: 13,
    fontWeight: '800',
  },
  previewDescription: {
    lineHeight: 20,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.76,
  },
});
