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

const fallbackItems: NeedItem[] = [{ id: 'mock-needs-1', ownerId: 'mock-owner', title: 'Need a quick logo cleanup', description: 'Private mock need. Replace this with your own API-created needs when the server is running.', status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), expiresAt: null, media: [] }];
type ApiResponse = { needs: NeedItem[] };

export function MyNeedsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<NeedItem[]>(fallbackItems);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');
  const [loading, setLoading] = useState(false);
  const loadItems = useCallback(async () => {
    setLoading(true); setError(null);
    try { const result = await api.needs.mine() as ApiResponse; setItems(Array.isArray(result.needs) ? result.needs : []); setSource('api'); }
    catch (caughtError) { setItems(fallbackItems); setSource('fallback'); setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void loadItems(); }, [loadItems]));
  return <AppScreen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadItems(); }} />}>
    <View style={styles.headerRow}><View style={styles.headerCopy}><SemanticBadge label="Need" tone="need" /><AppText style={styles.title}>Needs</AppText><AppText style={styles.subtitle}>Private owner-managed requests. Blue means the user needs help.</AppText></View><Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateNeed')} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}><AppText style={styles.createButtonText}>Create</AppText></Pressable></View>
    {error ? <InfoNotice tone="warning" title="API fallback" body={error} /> : null}
    <AppText style={styles.sourceLabel}>{source === 'api' ? 'API needs' : 'Fallback needs'}{loading ? ' · refreshing' : ''}</AppText>
    {items.length === 0 ? <AppCard><AppText style={styles.cardTitle}>No needs yet</AppText><AppText style={styles.cardText}>Create your first private need with images, then later convert it into a public trade.</AppText><Button title="Create Need" onPress={() => navigation.navigate('CreateNeed')} /></AppCard> : items.map((item) => <AppCard key={item.id}><View style={styles.cardHeaderRow}><AppText style={styles.cardTitle}>{item.title}</AppText><StatusBadge status={item.status} size="sm" /></View><AppText style={styles.cardText}>{item.description}</AppText><MediaStrip media={item.media} /></AppCard>)}
  </ScrollView></AppScreen>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 28, gap: 14 }, headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }, headerCopy: { flex: 1, gap: 8 }, title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 }, subtitle: { color: '#64748B', lineHeight: 20, fontWeight: '600' }, createButton: { borderRadius: 18, backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 12 }, createButtonText: { color: '#FFFFFF', fontWeight: '900' }, sourceLabel: { color: '#64748B', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }, cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, cardTitle: { flex: 1, fontSize: 20, fontWeight: '900' }, cardText: { color: '#64748B', lineHeight: 20, fontWeight: '600' }, pressed: { opacity: 0.78 } });
