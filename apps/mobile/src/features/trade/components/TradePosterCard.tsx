import React, { memo, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/AppText';
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
  variant?: TradePosterCardVariant;
  onPress: () => void;
};

const FALLBACK_ACCENTS = ['#f97316', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'];
const TEXT_ZONE_BLUR_BANDS = [
  { top: 45, height: 40, blur: 6, opacity: 0.04, tintOpacity: 0 },
  { top: 56, height: 36, blur: 12, opacity: 0.08, tintOpacity: 0.012 },
  { top: 66, height: 32, blur: 20, opacity: 0.13, tintOpacity: 0.03 },
  { top: 76, height: 25, blur: 30, opacity: 0.2, tintOpacity: 0.06 },
] as const;

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
  return (chips ?? []).map((chip) => chip.trim()).filter(Boolean).slice(0, 3);
}

function LowerAtmosphere({ imageUrl, isDark }: { imageUrl?: string | null; isDark: boolean }) {
  const imageTint = isDark ? 'rgba(8,10,12,0.16)' : 'rgba(255,255,255,0.12)';
  const bottomFeather = isDark ? 'rgba(3,5,8,0.18)' : 'rgba(255,255,255,0.12)';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {imageUrl ? TEXT_ZONE_BLUR_BANDS.map((band, index) => (
        <React.Fragment key={`poster-blur-band-${index}`}>
          <View
            style={[
              styles.blurBand,
              {
                top: `${band.top}%`,
                height: `${band.height}%`,
                opacity: band.opacity,
              },
            ]}
          >
            <Image source={{ uri: imageUrl }} resizeMode="cover" blurRadius={band.blur} style={StyleSheet.absoluteFillObject} />
          </View>
          <View
            style={[
              styles.blurBand,
              {
                top: `${band.top}%`,
                height: `${band.height}%`,
                backgroundColor: imageTint,
                opacity: band.tintOpacity,
              },
            ]}
          />
        </React.Fragment>
      )) : null}
      <View style={[styles.bottomWash, { backgroundColor: bottomFeather }]} />
    </View>
  );
}

function TradePosterCardInner({ id, imageUrl, badge, eyebrow, title, subtitle, chips, status, variant = 'trade', onPress }: TradePosterCardProps) {
  const theme = useThemeTokens();
  const isDark = theme.mode === 'dark';
  const [imageFailed, setImageFailed] = useState(!imageUrl);
  const visibleImageUrl = imageUrl && !imageFailed ? imageUrl : null;
  const fallback = useMemo(() => fallbackModel(id, variant), [id, variant]);
  const visibleChips = useMemo(() => normalizeChips(chips), [chips]);
  const fallbackLines = useMemo(() => Array.from({ length: 8 }, (_, index) => index), []);

  useEffect(() => {
    setImageFailed(!imageUrl);
  }, [imageUrl]);

  const mediaSurface = isDark ? '#0c1116' : '#dfe6dc';
  const titleColor = isDark ? '#FFFFFF' : '#101010';
  const bodyColor = isDark ? 'rgba(255,255,255,0.86)' : 'rgba(15,20,28,0.86)';
  const eyebrowColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(12,18,28,0.84)';
  const overlayTextShadow = isDark ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.38)';
  const pillBg = isDark ? 'rgba(10,16,24,0.36)' : 'rgba(255,255,255,0.84)';
  const pillBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.07)';
  const statusColor = status?.tone === 'none'
    ? (isDark ? 'rgba(255,255,255,0.58)' : 'rgba(15,23,42,0.58)')
    : status?.tone === 'expired'
      ? '#ef4444'
      : status?.tone === 'normal'
        ? '#ef4444'
        : status?.tone === 'soon'
          ? '#dc2626'
          : '#b91c1c';

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: mediaSurface }, pressed && styles.pressed]}>
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
                backgroundColor: fallback.accent,
                transform: [{ translateX: fallback.dotOffsetX }, { translateY: fallback.dotOffsetY }],
              },
            ]}
          />
        </View>
      )}

      <LowerAtmosphere imageUrl={visibleImageUrl} isDark={isDark} />

      <View style={styles.contentLayer}>
        <View style={styles.topBar}>
          <View style={[styles.badge, { backgroundColor: pillBg, borderColor: pillBorder }]}>
            <AppText style={[styles.badgeText, { color: eyebrowColor }]} numberOfLines={1}>{badge}</AppText>
          </View>
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
          {visibleChips.length ? (
            <View style={styles.chipRow}>
              {visibleChips.map((chip) => (
                <View key={`${id}-${chip}`} style={[styles.chip, { backgroundColor: pillBg, borderColor: pillBorder }]}>
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
  blurBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  bottomWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '17%',
    opacity: 0.1,
  },
  contentLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  badge: {
    minHeight: 26,
    maxWidth: '72%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.25,
  },
  copyBlock: {
    alignSelf: 'stretch',
    gap: 5,
    paddingRight: 8,
    paddingBottom: 2,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 7,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.45,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 7,
  },
  statusText: {
    alignSelf: 'flex-start',
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 7,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
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
