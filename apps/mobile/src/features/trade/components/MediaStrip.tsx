import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import type { MediaAssetDto } from '@hellowhen/contracts';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import { AppText } from '../../../components/AppText';
import { StatusBadge } from '../../../components/SemanticUI';
import { resolveMediaVariantUrl } from '../mediaUrls';

export function MediaStrip({ media, size = 'small' }: { media?: MediaAssetDto[]; size?: 'small' | 'large' }) {
  const { t } = useTranslation();
  const visible = (media ?? []).filter((item) => item.status !== 'removed');
  if (visible.length === 0) return null;
  return <View style={styles.wrap}><AppText style={styles.label}>{t('inventory.labels.images')}</AppText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{visible.map((item) => <View key={item.id} style={styles.imageWrap}><Image source={{ uri: resolveMediaVariantUrl(item, size === 'large' ? 'card' : 'thumb') }} style={[styles.image, size === 'large' && styles.largeImage]} />{item.status !== 'active' ? <View style={styles.status}><StatusBadge status={item.status} size="sm" /></View> : null}</View>)}</ScrollView></View>;
}
const styles = StyleSheet.create({ wrap: { gap: 8 }, label: { color: '#64748B', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 }, row: { gap: 10 }, imageWrap: { position: 'relative' }, image: { width: 112, height: 84, borderRadius: 16, backgroundColor: '#E2E8F0' }, largeImage: { width: 248, height: 172, borderRadius: 22 }, status: { position: 'absolute', left: 8, bottom: 8 } });
