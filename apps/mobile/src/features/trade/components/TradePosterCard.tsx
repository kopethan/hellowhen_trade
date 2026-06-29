import React, { memo, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { normalizePreviewCardTheme } from '@hellowhen/shared';
import { AppText } from '../../../components/AppText';
import { LowerImageAtmosphere } from '../../../components/LowerImageAtmosphere';
import { useThemeTokens } from '../../../providers/ThemeProvider';

export type TradePosterCardVariant = 'trade' | 'need' | 'offer';
export type TradePosterCardStatusTone = 'normal' | 'soon' | 'urgent' | 'none' | 'expired';

type TradePosterCardProps = {
  id: string;
  imageUrl?: string | null;
  badge: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  chips?: string[];
  status?: { label: string; tone: TradePosterCardStatusTone } | null;
  topMeta?: string | null;
  footerLabel?: string;
  identity?: React.ReactNode;
  variant?: TradePosterCardVariant;
  onPress: () => void;
  previewTheme?: string | null;
  accessibilityLabel?: string;
};

const FALLBACK_ACCENTS = ['#f97316', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'];
const THEME_FALLBACK_ACCENTS = {
  default: null,
  blue: '#3b82f6',
  green: '#10b981',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
} as const;
function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function fallbackModel(id: string, variant: TradePosterCardVariant) {
  const hash = hashString(`${variant}-${id}`);
  const accent = FALLBACK_ACCENTS[hash % FALLBACK_ACCENTS.length] ?? '#6366f1';
  const lineOffset = hash % 43;
  const dotOffsetX = ((hash % 27) - 13) * 0.42;
  const dotOffsetY = (((hash >> 3) % 21) - 10) * 0.55;

  return { accent, lineOffset, dotOffsetX, dotOffsetY };
}

function normalizeChips(chips: string[] | undefined) {
  const seen = new Set<string>();

  return (chips ?? [])
    .map((chip) => chip.trim())
    .filter((chip) => {
      if (!chip) return false;
      const normalized = chip.toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 3);
}

function TradePosterCardInner({ id, imageUrl, badge, eyebrow, title, subtitle, chips, status, topMeta, footerLabel, identity, variant = 'trade', onPress, previewTheme, accessibilityLabel }: TradePosterCardProps) {
  const theme = useThemeTokens();
  const isDark = theme.mode === 'dark';
  const [imageFailed, setImageFailed] = useState(!imageUrl);
  const visibleImageUrl = imageUrl && !imageFailed ? imageUrl : null;
  const fallback = useMemo(() => fallbackModel(id, variant), [id, variant]);
  const controlledTheme = normalizePreviewCardTheme(previewTheme);
  const controlledAccent = THEME_FALLBACK_ACCENTS[controlledTheme];
  const visibleChips = useMemo(() => normalizeChips(chips), [chips]);
  const fallbackLines = useMemo(() => Array.from({ length: 8 }, (_, index) => index), []);

  useEffect(() => {
    setImageFailed(!imageUrl);
  }, [imageUrl]);

  const mediaSurface = isDark ? '#0c1116' : '#dfe6dc';
  const hasPosterImage = Boolean(visibleImageUrl);
  const titleColor = hasPosterImage ? '#FFFFFF' : isDark ? '#FFFFFF' : '#101010';
  const bodyColor = hasPosterImage ? 'rgba(255,255,255,0.9)' : isDark ? 'rgba(255,255,255,0.86)' : 'rgba(15,20,28,0.86)';
  const eyebrowColor = hasPosterImage ? 'rgba(255,255,255,0.94)' : isDark ? 'rgba(255,255,255,0.92)' : 'rgba(12,18,28,0.84)';
  const overlayTextShadow = hasPosterImage ? 'rgba(0,0,0,0.42)' : isDark ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.38)';
  const topPillBg = hasPosterImage ? 'rgba(12,17,24,0.32)' : isDark ? 'rgba(10,16,24,0.36)' : 'rgba(255,255,255,0.84)';
  const topPillBorder = hasPosterImage ? 'rgba(255,255,255,0.1)' : isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.07)';
  const lowerPillBg = hasPosterImage ? 'rgba(12,17,24,0.18)' : topPillBg;
  const lowerPillBorder = hasPosterImage ? 'rgba(255,255,255,0.08)' : topPillBorder;
  const cardBorder = hasPosterImage ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.08)';
  const statusColor = status?.tone === 'none'
    ? (hasPosterImage ? 'rgba(255,255,255,0.9)' : isDark ? 'rgba(255,255,255,0.58)' : 'rgba(15,23,42,0.58)')
    : status?.tone === 'expired'
      ? (hasPosterImage ? '#FECACA' : '#ef4444')
      : status?.tone === 'normal'
        ? (hasPosterImage ? 'rgba(255,255,255,0.9)' : '#ef4444')
        : status?.tone === 'soon'
          ? (hasPosterImage ? '#FDE68A' : '#dc2626')
          : (hasPosterImage ? '#FCD34D' : '#b91c1c');

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: controlledAccent && !visibleImageUrl ? `${controlledAccent}24` : mediaSurface, borderColor: cardBorder }, pressed && styles.pressed]}>
      {visibleImageUrl ? (
        <Image source={{ uri: visibleImageUrl }} resizeMode="cover" onError={() => setImageFailed(true)} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.fallbackMedia, { backgroundColor: mediaSurface }]}>
          {fallbackLines.map((line) => (
            <View
              key={`poster-fallback-line-${id}-${line}`}
              style={[
                styles.fallbackLine,
                {
                  top: 22 + line * 29,
                  left: `${8 + ((fallback.lineOffset + line * 11) % 42)}%`,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                },
              ]}
            />
          ))}
          <View
            style={[
              styles.fallbackDot,
              {
                backgroundColor: controlledAccent ?? fallback.accent,
                transform: [{ translateX: fallback.dotOffsetX }, { translateY: fallback.dotOffsetY }],
              },
            ]}
          />
        </View>
      )}

      <LowerImageAtmosphere imageUrl={visibleImageUrl} isDark={isDark} preset="trade" />

      <View style={styles.contentLayer}>
        <View style={styles.topBar}>
          <View style={[styles.badge, { backgroundColor: topPillBg, borderColor: topPillBorder }]}>
            <AppText style={[styles.badgeText, { color: eyebrowColor }]} numberOfLines={1}>{badge}</AppText>
          </View>
          {identity ? <View style={styles.identitySlot}>{identity}</View> : topMeta ? (
            <View style={[styles.topMetaBadge, { backgroundColor: topPillBg, borderColor: topPillBorder }]}>
              <AppText style={[styles.topMetaText, { color: eyebrowColor }]} numberOfLines={1}>{topMeta}</AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.copyBlock}>
          {eyebrow ? (
            <AppText
              style={[
                styles.eyebrow,
                {
                  color: eyebrowColor,
                  textShadowColor: overlayTextShadow,
                },
              ]}
              numberOfLines={1}
            >
              {eyebrow}
            </AppText>
          ) : null}
          <AppText
            style={[
              styles.title,
              {
                color: titleColor,
                textShadowColor: overlayTextShadow,
              },
            ]}
            numberOfLines={2}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              style={[
                styles.subtitle,
                {
                  color: bodyColor,
                  textShadowColor: overlayTextShadow,
                },
              ]}
              numberOfLines={2}
            >
              {subtitle}
            </AppText>
          ) : null}
          {status?.label ? (
            <AppText style={[styles.statusText, { color: statusColor, textShadowColor: overlayTextShadow }]} numberOfLines={1}>
              {status.label}
            </AppText>
          ) : null}
          {footerLabel ? (
            <AppText style={[styles.footerLabel, { color: titleColor, textShadowColor: overlayTextShadow }]} numberOfLines={1}>
              {footerLabel}
            </AppText>
          ) : null}
          {visibleChips.length ? (
            <View style={styles.chipRow}>
              {visibleChips.map((chip, index) => (
                <View key={`${id}-chip-${index}-${chip}`} style={[styles.chip, { backgroundColor: lowerPillBg, borderColor: lowerPillBorder }]}>
                  <AppText style={[styles.chipText, { color: eyebrowColor }]} numberOfLines={1}>{chip}</AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export const TradePosterCard = memo(TradePosterCardInner);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackMedia: {
    overflow: 'hidden',
  },
  fallbackLine: {
    position: 'absolute',
    width: '62%',
    height: 18,
    borderRadius: 999,
    transform: [{ rotate: '-18deg' }],
  },
  fallbackDot: {
    position: 'absolute',
    left: '50%',
    top: '37%',
    width: 52,
    height: 52,
    marginLeft: -26,
    marginTop: -26,
    borderRadius: 999,
    opacity: 0.82,
  },
  contentLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 17,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: {
    minHeight: 25,
    maxWidth: '58%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identitySlot: {
    maxWidth: '48%',
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  topMetaBadge: {
    minHeight: 25,
    maxWidth: '48%',
    flexShrink: 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topMetaText: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.25,
  },
  badgeText: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.75,
    textTransform: 'uppercase',
  },
  copyBlock: {
    alignSelf: 'stretch',
    gap: 4,
    paddingRight: 8,
    paddingBottom: 0,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.75,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 7,
  },
  title: {
    fontSize: 18.5,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.45,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  statusText: {
    alignSelf: 'flex-start',
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  footerLabel: {
    alignSelf: 'flex-start',
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.45,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    maxWidth: 132,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.84,
  },
});
