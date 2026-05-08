import React, { useCallback, useState } from 'react';
import { Button, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { MediaStrip } from './components/MediaStrip';
import type { NeedItem } from './types';

type ApiResponse = { needs: NeedItem[] };

export function MyNeedsScreen() {
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
  return <AppScreen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadItems(); }} />}>
    <View style={styles.headerRow}><View style={styles.headerCopy}><SemanticBadge label="Need" tone="need" /><AppText style={styles.title}>Needs</AppText><AppText style={styles.subtitle}>Save reusable requests and pair them with offers when publishing trades.</AppText></View><Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateNeed')} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}><AppText style={styles.createButtonText}>Create</AppText></Pressable></View>
    {error ? <InfoNotice tone="danger" title="Could not load needs" body={error} /> : null}
    {items.length === 0 ? <AppCard><AppText style={styles.cardTitle}>No needs yet</AppText><AppText style={styles.cardText}>Create a need with details and reference images, then choose it when publishing a trade.</AppText><Button title="Create Need" onPress={() => navigation.navigate('CreateNeed')} /></AppCard> : items.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => navigation.navigate('NeedDetail', { needId: item.id, title: item.title })} style={({ pressed }) => [pressed && styles.pressed]}><AppCard><View style={styles.cardHeaderRow}><AppText style={styles.cardTitle}>{item.title}</AppText><StatusBadge status={item.status} size="sm" /></View><AppText style={styles.cardText}>{item.description}</AppText><MediaStrip media={item.media} /></AppCard></Pressable>)}
  </ScrollView></AppScreen>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 28, gap: 14 }, headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }, headerCopy: { flex: 1, gap: 8 }, title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 }, subtitle: { color: '#64748B', lineHeight: 20, fontWeight: '600' }, createButton: { borderRadius: 18, backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 12 }, createButtonText: { color: '#FFFFFF', fontWeight: '900' }, cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, cardTitle: { flex: 1, fontSize: 20, fontWeight: '900' }, cardText: { color: '#64748B', lineHeight: 20, fontWeight: '600' }, pressed: { opacity: 0.78 } });
