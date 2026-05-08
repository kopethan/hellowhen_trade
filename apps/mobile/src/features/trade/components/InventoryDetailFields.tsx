import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { MediaAssetDto } from '@hellowhen/contracts';
import { AppText } from '../../../components/AppText';
import { StatusBadge } from '../../../components/SemanticUI';
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

export function modeLabel(mode: InventoryMode) {
  if (mode === 'remote') return 'Remote';
  if (mode === 'local') return 'Local';
  return 'Hybrid';
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
  return <View style={styles.field}><AppText style={styles.label}>{label}</AppText><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94A3B8" editable={!disabled} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.textarea]} /></View>;
}

export function InventoryModePicker({ value, onChange, disabled }: { value: InventoryMode; onChange: (value: InventoryMode) => void; disabled?: boolean }) {
  return <View style={styles.field}><AppText style={styles.label}>Mode</AppText><View style={styles.modeRow}>{inventoryModes.map((mode) => { const selected = value === mode; return <Pressable key={mode} disabled={disabled} onPress={() => onChange(mode)} style={({ pressed }) => [styles.modeButton, selected && styles.modeButtonSelected, disabled && styles.disabled, pressed && styles.pressed]}><AppText style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>{modeLabel(mode)}</AppText></Pressable>; })}</View></View>;
}

export function ExistingMediaManager({ media, disabled, onRemove }: { media?: MediaAssetDto[]; disabled?: boolean; onRemove: (mediaId: string) => void }) {
  const visible = (media ?? []).filter((item) => item.status !== 'removed');
  if (visible.length === 0) return <View style={styles.emptyMedia}><AppText style={styles.emptyMediaText}>No saved images yet.</AppText></View>;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>{visible.map((item) => <View key={item.id} style={styles.mediaCard}><Image source={{ uri: resolveMediaUrl(item.url) }} style={styles.mediaImage} />{item.status !== 'active' ? <View style={styles.mediaStatus}><StatusBadge status={item.status} size="sm" /></View> : null}<Pressable disabled={disabled} onPress={() => onRemove(item.id)} style={({ pressed }) => [styles.removeMediaButton, disabled && styles.disabled, pressed && styles.pressed]}><AppText style={styles.removeMediaButtonText}>Remove</AppText></Pressable></View>)}</ScrollView>;
}

export function DangerButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.dangerButton, disabled && styles.disabled, pressed && styles.pressed]}><AppText style={styles.dangerButtonText}>{label}</AppText></Pressable>; }
export function PrimaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}><AppText style={styles.primaryButtonText}>{label}</AppText></Pressable>; }
export function SecondaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, disabled && styles.disabled, pressed && styles.pressed]}><AppText style={styles.secondaryButtonText}>{label}</AppText></Pressable>; }

const styles = StyleSheet.create({ field: { gap: 8 }, label: { color: '#0F172A', fontWeight: '900' }, input: { borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 12, color: '#0F172A', fontSize: 16, fontWeight: '700' }, textarea: { minHeight: 128, lineHeight: 22 }, modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, modeButton: { borderRadius: 999, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 9 }, modeButtonSelected: { borderColor: '#111827', backgroundColor: '#F1F5F9' }, modeButtonText: { color: '#475569', fontWeight: '900' }, modeButtonTextSelected: { color: '#111827' }, mediaRow: { gap: 12 }, mediaCard: { width: 148, gap: 8 }, mediaImage: { width: 148, height: 112, borderRadius: 18, backgroundColor: '#E2E8F0' }, mediaStatus: { position: 'absolute', top: 8, left: 8 }, removeMediaButton: { borderRadius: 999, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', paddingVertical: 8, alignItems: 'center' }, removeMediaButtonText: { color: '#991B1B', fontSize: 12, fontWeight: '900' }, emptyMedia: { borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', padding: 12 }, emptyMediaText: { color: '#64748B', fontWeight: '700' }, primaryButton: { borderRadius: 18, backgroundColor: '#111827', paddingVertical: 14, alignItems: 'center' }, primaryButtonText: { color: '#FFFFFF', fontWeight: '900' }, secondaryButton: { borderRadius: 18, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingVertical: 14, alignItems: 'center' }, secondaryButtonText: { color: '#334155', fontWeight: '900' }, dangerButton: { borderRadius: 18, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', paddingVertical: 14, alignItems: 'center' }, dangerButtonText: { color: '#991B1B', fontWeight: '900' }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.78 } });
