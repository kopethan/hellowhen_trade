import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { MediaAssetDto } from '@hellowhen/contracts';
import { AppText } from '../../../components/AppText';
import { MobileIcon } from '../../../components/MobileIcon';
import { SemanticBadge, StatusBadge } from '../../../components/SemanticUI';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import { resolveMediaVariantUrl } from '../mediaUrls';
import type { NeedItem, OfferItem } from '../types';

type TFunction = ReturnType<typeof useTranslation>['t'];
type InventoryCompactRowProps = { kind: 'need' | 'offer'; item: NeedItem | OfferItem };

function visibleMedia(media?: MediaAssetDto[]) { return (media ?? []).filter((asset) => asset.status !== 'removed'); }
function firstMediaUrl(media?: MediaAssetDto[]) { const first = visibleMedia(media)[0]; return first ? resolveMediaVariantUrl(first, 'thumb') : ''; }
function labelize(value: string) { return value.replaceAll('_', ' ').replaceAll('-', ' ').trim(); }
function modeLabel(mode: string | null | undefined, t: TFunction) { if (mode === 'remote') return t('trade.modes.remote'); if (mode === 'local') return t('trade.modes.local'); if (mode === 'hybrid') return t('trade.modes.hybrid'); return null; }
function typeLabel(itemType: string | undefined, t: TFunction) { if (itemType === 'goods') return t('inventory.itemTypes.goods'); if (itemType === 'other') return t('inventory.itemTypes.other'); return t('inventory.itemTypes.service'); }
function metadataFor(kind: 'need' | 'offer', item: NeedItem | OfferItem, t: TFunction) { const timing = kind === 'need' ? (item as NeedItem).timing : (item as OfferItem).availability; const parts = [item.category ? labelize(item.category) : typeLabel(item.itemType, t), modeLabel(item.mode, t), timing?.trim()].filter(Boolean); return parts.join(' · '); }
function mediaCountLabel(count: number, t: TFunction) { return `${count} ${t('inventory.labels.images').toLowerCase()}`; }

export function InventoryCompactRow({ kind, item }: InventoryCompactRowProps) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const semantic = kind === 'need' ? theme.semantic.need : theme.semantic.offer;
  const media = visibleMedia(item.media);
  const thumbnailUrl = firstMediaUrl(item.media);
  const metadata = metadataFor(kind, item, t);
  const imageLabel = mediaCountLabel(media.length, t);

  return (
    <View style={[styles.card, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={[styles.mediaZone, { backgroundColor: semantic.softBg }]}> 
        {thumbnailUrl ? <Image source={{ uri: thumbnailUrl }} resizeMode="cover" style={styles.mediaImage} /> : <View style={[styles.mediaFallback, { backgroundColor: semantic.softBg }]}><MobileIcon name={kind} size={28} color={semantic.text} /></View>}
        {media[0]?.status && media[0].status !== 'active' ? <View style={styles.mediaStatus}><StatusBadge status={media[0].status} size="sm" /></View> : null}
      </View>
      <View style={styles.contentZone}>
        <View style={styles.topRow}><SemanticBadge label={t(`inventory.labels.${kind}`)} tone={kind} size="sm" style={styles.kindBadge} /><StatusBadge status={item.status} size="sm" /></View>
        <View style={styles.mainCopy}><AppText style={styles.title} numberOfLines={2}>{item.title}</AppText>{metadata ? <AppText style={[styles.meta, { color: theme.color.muted }]} numberOfLines={1}>{metadata}</AppText> : null}</View>
        {media.length > 0 ? (
          <View style={styles.footerRow}>
            <MobileIcon name="image" size={14} color={theme.color.muted} />
            <AppText style={[styles.footerText, { color: theme.color.muted }]} numberOfLines={1}>{imageLabel}</AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', overflow: 'hidden', borderRadius: 24, borderWidth: 1, aspectRatio: 3 },
  mediaZone: { width: '33.333%', height: '100%', position: 'relative' },
  mediaImage: { width: '100%', height: '100%' },
  mediaFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mediaStatus: { position: 'absolute', left: 7, bottom: 7 },
  contentZone: { flex: 1, paddingHorizontal: 12, paddingVertical: 9, justifyContent: 'space-between', gap: 5 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  kindBadge: { flexShrink: 1 },
  mainCopy: { gap: 2 },
  title: { fontSize: 16, lineHeight: 20, fontWeight: '900', letterSpacing: -0.15 },
  meta: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  footerRow: { minHeight: 18, flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { flex: 1, fontSize: 11, fontWeight: '900', letterSpacing: 0.25, textTransform: 'uppercase' },
});
