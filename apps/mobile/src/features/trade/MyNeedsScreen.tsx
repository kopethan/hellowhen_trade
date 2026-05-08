import React, { useCallback, useState } from 'react';
import { Button, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
    {items.length === 0 ? <AppCard><AppText style={styles.cardTitle}>No needs yet</AppText><AppText style={[styles.cardText, { color: theme.color.muted }]}>Create a need with details and reference images, then choose it when publishing a trade.</AppText><Button title="Create Need" onPress={() => navigation.navigate('CreateNeed')} /></AppCard> : items.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => navigation.navigate('NeedDetail', { needId: item.id, title: item.title })} style={({ pressed }) => [pressed && styles.pressed]}><AppCard><View style={styles.cardHeaderRow}><AppText style={styles.cardTitle}>{item.title}</AppText><StatusBadge status={item.status} size="sm" /></View><AppText style={[styles.cardText, { color: theme.color.muted }]}>{item.description}</AppText><MediaStrip media={item.media} /></AppCard></Pressable>)}
  </ScrollView></AppFixedHeaderScreen>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 28, gap: 14 }, headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }, headerCopy: { flex: 1, gap: 8 }, title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 }, subtitle: { lineHeight: 20, fontWeight: '600' }, createButton: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 }, createButtonText: { color: '#FFFFFF', fontWeight: '900' }, cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, cardTitle: { flex: 1, fontSize: 20, fontWeight: '900' }, cardText: { lineHeight: 20, fontWeight: '600' }, pressed: { opacity: 0.78 } });
