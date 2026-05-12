import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { MediaAssetDto } from '@hellowhen/contracts';
import { AppText } from '../../../components/AppText';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { StatusBadge } from '../../../components/SemanticUI';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import { resolveMediaUrl } from '../mediaUrls';

export type InventoryMode = 'remote' | 'local' | 'hybrid';
export const inventoryModes: InventoryMode[] = ['remote', 'local', 'hybrid'];

export function getOptionalString(item: unknown, key: string) {
  const value = typeof item === 'object' && item !== null ? (item as Record<string, unknown>)[key] : undefined;
  return typeof value === 'string' ? value : '';
}

export function getStringArray(item: unknown, key: string) {
  const value = typeof item === 'object' && item !== null ? (item as Record<string, unknown>)[key] : undefined;
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

export function normalizeMode(value: unknown): InventoryMode {
  return value === 'local' || value === 'hybrid' ? value : 'remote';
}

export function modeLabel(mode: InventoryMode, t?: (key: string) => string) {
  if (mode === 'remote') return t?.('inventory.modes.remote') ?? 'Remote';
  if (mode === 'local') return t?.('inventory.modes.local') ?? 'Local';
  return t?.('inventory.modes.hybrid') ?? 'Hybrid';
}

export function parseCsv(value: string, maxItems = 8) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawItem of value.split(',')) {
    const item = rawItem.trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item.slice(0, 80));
    if (result.length >= maxItems) break;
  }
  return result;
}

export function joinCsv(items?: string[]) { return (items ?? []).join(', '); }
export function optionalText(value: string) { const trimmed = value.trim(); return trimmed.length > 0 ? trimmed : null; }

export function InventoryTextField({ label, value, onChangeText, placeholder, multiline, disabled }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; disabled?: boolean }) {
  const theme = useThemeTokens();
  return <View style={styles.field}><AppText style={styles.label}>{label}</AppText><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.color.muted} editable={!disabled} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }, multiline && styles.textarea]} /></View>;
}

export function InventoryModePicker({ value, onChange, disabled }: { value: InventoryMode; onChange: (value: InventoryMode) => void; disabled?: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return <View style={styles.field}><AppText style={styles.label}>{t('inventory.labels.mode')}</AppText><View style={styles.modeRow}>{inventoryModes.map((mode) => { const selected = value === mode; return <Pressable key={mode} disabled={disabled} onPress={() => onChange(mode)} style={({ pressed }) => [styles.modeButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, disabled && styles.disabled, pressed && styles.pressed]}><AppText style={[styles.modeButtonText, { color: selected ? theme.semantic.proposal.text : theme.color.muted }]}>{modeLabel(mode, t)}</AppText></Pressable>; })}</View></View>;
}

export function ExistingMediaManager({ media, disabled, onRemove }: { media?: MediaAssetDto[]; disabled?: boolean; onRemove: (mediaId: string) => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const visible = (media ?? []).filter((item) => item.status !== 'removed');
  if (visible.length === 0) return <View style={[styles.emptyMedia, { borderColor: theme.color.border }]}><AppText style={[styles.emptyMediaText, { color: theme.color.muted }]}>{t('inventory.labels.noImages')}</AppText></View>;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>{visible.map((item) => <View key={item.id} style={styles.mediaCard}><Image source={{ uri: resolveMediaUrl(item.url) }} style={styles.mediaImage} />{item.status !== 'active' ? <View style={styles.mediaStatus}><StatusBadge status={item.status} size="sm" /></View> : null}<Pressable disabled={disabled} onPress={() => onRemove(item.id)} style={({ pressed }) => [styles.removeMediaButton, disabled && styles.disabled, pressed && styles.pressed]}><AppText style={styles.removeMediaButtonText}>{t('common.actions.remove')}</AppText></Pressable></View>)}</ScrollView>;
}


export function DangerButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.dangerButton, disabled && styles.disabled, pressed && styles.pressed]}><AppText style={styles.dangerButtonText}>{label}</AppText></Pressable>; }
export function PrimaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}><AppText style={styles.primaryButtonText}>{label}</AppText></Pressable>; }
export function SecondaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, disabled && styles.disabled, pressed && styles.pressed]}><AppText style={styles.secondaryButtonText}>{label}</AppText></Pressable>; }

const styles = StyleSheet.create({ field: { gap: 8 }, label: { fontWeight: '900' }, input: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16, fontWeight: '700' }, textarea: { minHeight: 128, lineHeight: 22 }, modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, modeButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 }, modeButtonSelected: {}, modeButtonText: { fontWeight: '900' }, modeButtonTextSelected: {}, mediaRow: { gap: 12 }, mediaCard: { width: 148, gap: 8 }, mediaImage: { width: 148, height: 112, borderRadius: 18, backgroundColor: '#E2E8F0' }, mediaStatus: { position: 'absolute', top: 8, left: 8 }, removeMediaButton: { borderRadius: 999, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', paddingVertical: 8, alignItems: 'center' }, removeMediaButtonText: { color: '#991B1B', fontSize: 12, fontWeight: '900' }, emptyMedia: { borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', padding: 12 }, emptyMediaText: { fontWeight: '700' }, primaryButton: { borderRadius: 18, backgroundColor: '#111827', paddingVertical: 14, alignItems: 'center' }, primaryButtonText: { color: '#FFFFFF', fontWeight: '900' }, secondaryButton: { borderRadius: 18, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingVertical: 14, alignItems: 'center' }, secondaryButtonText: { color: '#334155', fontWeight: '900' }, dangerButton: { borderRadius: 18, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', paddingVertical: 14, alignItems: 'center' }, dangerButtonText: { color: '#991B1B', fontWeight: '900' }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.78 } });
