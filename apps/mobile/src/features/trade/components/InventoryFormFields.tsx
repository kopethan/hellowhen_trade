import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { TradeExchangeMode } from '@hellowhen/contracts';
import { AppText } from '../../../components/AppText';

export const exchangeModes: TradeExchangeMode[] = ['remote', 'local', 'hybrid'];

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

export function modeLabel(mode: TradeExchangeMode) {
  if (mode === 'remote') return 'Remote';
  if (mode === 'local') return 'Local';
  return 'Hybrid';
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
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={styles.label}>{label}</AppText>
        {hint ? <AppText style={styles.hint}>{hint}</AppText> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        editable={!disabled}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

export function ModePicker({ value, onChange, disabled }: { value: TradeExchangeMode; onChange: (mode: TradeExchangeMode) => void; disabled?: boolean }) {
  return (
    <View style={styles.field}>
      <AppText style={styles.label}>Mode</AppText>
      <View style={styles.modeRow}>
        {exchangeModes.map((mode) => {
          const selected = value === mode;
          return (
            <Pressable
              key={mode}
              disabled={disabled}
              onPress={() => onChange(mode)}
              style={({ pressed }) => [styles.modeButton, selected && styles.modeButtonSelected, disabled && styles.disabled, pressed && styles.pressed]}
            >
              <AppText style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>{modeLabel(mode)}</AppText>
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
  return (
    <View style={styles.preview}>
      <AppText style={styles.previewEyebrow}>{eyebrow}</AppText>
      <AppText style={styles.previewTitle}>{title || 'Title appears here'}</AppText>
      <AppText style={styles.previewMeta}>{meta || 'Category · Timing · Mode · Location'}</AppText>
      <AppText style={styles.previewDescription} numberOfLines={3}>{description || 'A short summary will appear here while you write.'}</AppText>
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
    color: '#0F172A',
  },
  hint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: '#0F172A',
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
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  modeButtonSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#CCFBF1',
  },
  modeButtonText: {
    color: '#475569',
    fontWeight: '900',
  },
  modeButtonTextSelected: {
    color: '#0F766E',
  },
  preview: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 7,
  },
  previewEyebrow: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  previewTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  previewMeta: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  previewDescription: {
    color: '#64748B',
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
