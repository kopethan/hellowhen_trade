import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { MediaStrip } from './components/MediaStrip';
import type { NeedItem } from './types';
import { useThemeTokens } from '../../providers/ThemeProvider';

type ApiResponse = { needs: NeedItem[] };

export function MyNeedsScreen() {
  const theme = useThemeTokens();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<NeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loadItems = useCallback(async () => {
    setLoading(true); setError(null);
    try { const result = await api.needs.mine() as ApiResponse; setItems(Array.isArray(result.needs) ? result.needs : []); }
    catch (caughtError) { setItems([]); setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void loadItems(); }, [loadItems]));
  const header = <View style={styles.headerRow}><View style={styles.headerCopy}><SemanticBadge label="Need" tone="need" /><AppText style={styles.title}>Needs</AppText><AppText style={[styles.subtitle, { color: theme.color.muted }]}>Save reusable requests and pair them with offers when publishing trades.</AppText></View><Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateNeed')} style={({ pressed }) => [styles.createButton, { backgroundColor: theme.semantic.need.bg }, pressed && styles.pressed]}><AppText style={[styles.createButtonText, { color: theme.color.background }]}>Create</AppText></Pressable></View>;

  return <AppFixedHeaderScreen header={header}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadItems(); }} />}>
    {error ? <InfoNotice tone="danger" title="Could not load needs" body={error} /> : null}
    {items.length === 0 ? <EmptyInventoryPlaceholder title="Create your first need" body="Add details and reference images, then choose it when publishing a trade." tone="need" onPress={() => navigation.navigate('CreateNeed')} /> : items.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => navigation.navigate('NeedDetail', { needId: item.id, title: item.title })} style={({ pressed }) => [pressed && styles.pressed]}><AppCard><View style={styles.cardHeaderRow}><AppText style={styles.cardTitle}>{item.title}</AppText><StatusBadge status={item.status} size="sm" /></View><AppText style={[styles.cardText, { color: theme.color.muted }]}>{item.description}</AppText><MediaStrip media={item.media} /></AppCard></Pressable>)}
  </ScrollView></AppFixedHeaderScreen>;
}

function EmptyInventoryPlaceholder({ title, body, tone, onPress }: { title: string; body: string; tone: 'need' | 'offer'; onPress: () => void }) {
  const theme = useThemeTokens();
  const semantic = tone === 'need' ? theme.semantic.need : theme.semantic.offer;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.emptyPlaceholder, { borderColor: semantic.border, backgroundColor: theme.color.subtleSurface }, pressed && styles.pressed]}>
      <View style={[styles.emptyIcon, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}><AppText style={[styles.emptyIconText, { color: semantic.text }]}>+</AppText></View>
      <AppText style={styles.emptyTitle}>{title}</AppText>
      <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{body}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({ content: { paddingBottom: 28, gap: 14 }, headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }, headerCopy: { flex: 1, gap: 8 }, title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 }, subtitle: { lineHeight: 20, fontWeight: '600' }, createButton: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 }, createButtonText: { color: '#FFFFFF', fontWeight: '900' }, cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, cardTitle: { flex: 1, fontSize: 20, fontWeight: '900' }, cardText: { lineHeight: 20, fontWeight: '600' }, emptyPlaceholder: { minHeight: 208, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 22, gap: 10 }, emptyIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, emptyIconText: { fontSize: 28, lineHeight: 30, fontWeight: '900' }, emptyTitle: { textAlign: 'center', fontSize: 22, fontWeight: '900', letterSpacing: -0.35 }, emptyBody: { textAlign: 'center', lineHeight: 20, fontWeight: '700' }, pressed: { opacity: 0.78 } });
