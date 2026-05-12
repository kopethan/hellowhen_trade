import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { InventoryItemType, TradeExchangeMode } from '@hellowhen/contracts';
import { AppText } from '../../../components/AppText';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';

export const inventoryItemTypes: InventoryItemType[] = ['service', 'goods', 'other'];
export const exchangeModes: TradeExchangeMode[] = ['remote', 'local', 'hybrid'];

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
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  disabled?: boolean;
}) {
  const theme = useThemeTokens();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={styles.label}>{label}</AppText>
        {hint ? <AppText style={[styles.hint, { color: theme.color.muted }]}>{hint}</AppText> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.muted}
        editable={!disabled}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }, multiline && styles.textarea]}
      />
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
  label: {
    fontSize: 14,
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
