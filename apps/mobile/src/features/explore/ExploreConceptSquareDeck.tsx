import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MediaAssetDto, PlaceStaticMapDto } from '@hellowhen/contracts';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppText } from '../../components/AppText';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { DECK_CARD_TYPOGRAPHY, POSTER_CARD_GEOMETRY } from '../../components/PosterCardGeometry';
import { PosterCardFooter } from '../../components/PosterCardFooter';
import { SemanticBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { ContinuousSquareStackDeck, type SquareStackDeckCard } from '../trade/deck';
import { resolveMediaVariantUrl } from '../trade/mediaUrls';
import { MOBILE_TRADE_DECK_AVAILABLE_HEIGHT, MOBILE_TRADE_DECK_MAX_CARD_SIZE } from '../trade/components/tradeDeckGeometry';

type ExploreConceptTone = Extract<SemanticColorName, 'need' | 'offer' | 'place'>;

type ExploreConceptCard = SquareStackDeckCard & {
  media?: MediaAssetDto;
  useStaticMap?: boolean;
};

type ExploreConceptSquareDeckProps = {
  conceptId: string;
  title: string;
  description?: string | null;
  meta?: string | null;
  badgeLabel: string;
  tone: ExploreConceptTone;
  media?: MediaAssetDto[];
  staticMap?: PlaceStaticMapDto | null;
  accessibilityLabel: string;
  onOpen: () => void;
  style?: StyleProp<ViewStyle>;
};

function activeConceptMedia(media: MediaAssetDto[] | undefined) {
  return (media ?? []).filter((asset) => asset.status === 'active' && Boolean(asset.url));
}

function buildConceptCards(conceptId: string, media: MediaAssetDto[] | undefined, staticMap: PlaceStaticMapDto | null | undefined): ExploreConceptCard[] {
  const activeMedia = activeConceptMedia(media);
  if (activeMedia.length > 0) {
    return activeMedia.map((asset) => ({ id: `${conceptId}:media:${asset.id}`, media: asset }));
  }
  if (staticMap) return [{ id: `${conceptId}:static-map`, useStaticMap: true }];
  return [{ id: `${conceptId}:fallback` }];
}

function staticMapUrlForTheme(staticMap: PlaceStaticMapDto | null | undefined, themeMode: 'light' | 'dark') {
  if (!staticMap) return null;
  return themeMode === 'dark'
    ? staticMap.darkUrl || staticMap.lightUrl || null
    : staticMap.lightUrl || staticMap.darkUrl || null;
}

function conceptIcon(tone: ExploreConceptTone): MobileIconName {
  if (tone === 'need') return 'need';
  if (tone === 'offer') return 'offer';
  return 'location-on';
}

function ConceptCardView({
  card,
  cardIndex,
  cardTotal,
  title,
  description,
  meta,
  badgeLabel,
  tone,
  staticMap,
  accessibilityLabel,
  onOpen,
}: {
  card: ExploreConceptCard;
  cardIndex: number;
  cardTotal: number;
  title: string;
  description?: string | null;
  meta?: string | null;
  badgeLabel: string;
  tone: ExploreConceptTone;
  staticMap?: PlaceStaticMapDto | null;
  accessibilityLabel: string;
  onOpen: () => void;
}) {
  const theme = useThemeTokens();
  const imageUrl = card.media
    ? resolveMediaVariantUrl(card.media, 'card')
    : card.useStaticMap
      ? staticMapUrlForTheme(staticMap, theme.mode)
      : null;
  const semantic = theme.semantic[tone];
  const hasImage = Boolean(imageUrl);
  const posterTitleColor = hasImage ? '#FFFFFF' : theme.color.text;
  const posterBodyColor = hasImage ? 'rgba(255,255,255,0.88)' : theme.color.muted;
  const pillBackground = hasImage ? 'rgba(8,12,18,0.28)' : undefined;
  const pillBorder = hasImage ? 'rgba(255,255,255,0.12)' : undefined;
  const mediaCounter = cardTotal > 1 ? `${String(cardIndex + 1).padStart(2, '0')}/${String(cardTotal).padStart(2, '0')}` : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: hasImage ? '#0B1016' : semantic.softBg,
          borderColor: hasImage ? 'transparent' : semantic.border,
          borderWidth: hasImage ? 0 : StyleSheet.hairlineWidth,
        },
        pressed && styles.pressed,
      ]}
    >
      {imageUrl ? <Image source={{ uri: imageUrl }} resizeMode="cover" style={styles.image} /> : null}
      {hasImage ? <View pointerEvents="none" style={styles.imageScrim} /> : null}
      {!hasImage ? (
        <View pointerEvents="none" style={styles.fallbackVisual}>
          <View style={[styles.fallbackIcon, { backgroundColor: semantic.bg, borderColor: semantic.border }]}>
            <MobileIcon name={conceptIcon(tone)} size={34} color={semantic.onBg} decorative />
          </View>
          <View style={[styles.fallbackLine, styles.fallbackLineWide, { backgroundColor: semantic.border }]} />
          <View style={[styles.fallbackLine, { backgroundColor: semantic.border }]} />
        </View>
      ) : null}

      <View style={styles.topRow}>
        {hasImage ? (
          <View style={[styles.posterPill, { backgroundColor: pillBackground, borderColor: pillBorder }]}>
            <AppText style={styles.posterPillText} numberOfLines={1}>{badgeLabel}</AppText>
          </View>
        ) : (
          <SemanticBadge label={badgeLabel} tone={tone} size="sm" />
        )}
        {mediaCounter ? (
          <View style={[styles.counterPill, hasImage ? { backgroundColor: pillBackground, borderColor: pillBorder } : { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <AppText style={[styles.counterText, { color: hasImage ? '#FFFFFF' : theme.color.muted }]}>{mediaCounter}</AppText>
          </View>
        ) : null}
      </View>

      <PosterCardFooter
        enabled={hasImage}
        style={[styles.copy, hasImage && styles.posterCopy]}
        surfaceStyle={styles.posterFooterSurface}
        contentStyle={styles.posterFooterContent}
      >
        <AppText style={[styles.title, { color: posterTitleColor }]} numberOfLines={2} ellipsizeMode="tail">{title}</AppText>
        {description ? <AppText style={[styles.description, { color: posterBodyColor }]} numberOfLines={2} ellipsizeMode="tail">{description}</AppText> : null}
        {meta ? <AppText style={[styles.meta, { color: posterBodyColor }]} numberOfLines={1} ellipsizeMode="tail">{meta}</AppText> : null}
      </PosterCardFooter>
    </Pressable>
  );
}

export function ExploreConceptSquareDeck({
  conceptId,
  title,
  description,
  meta,
  badgeLabel,
  tone,
  media,
  staticMap,
  accessibilityLabel,
  onOpen,
  style,
}: ExploreConceptSquareDeckProps) {
  const cards = useMemo(() => buildConceptCards(conceptId, media, staticMap), [conceptId, media, staticMap]);

  return (
    <View style={[styles.container, style]}>
      <ContinuousSquareStackDeck<ExploreConceptCard>
        cards={cards}
        renderCard={({ card, index, total }) => (
          <ConceptCardView
            card={card}
            cardIndex={index}
            cardTotal={total}
            title={title}
            description={description}
            meta={meta}
            badgeLabel={badgeLabel}
            tone={tone}
            staticMap={staticMap}
            accessibilityLabel={accessibilityLabel}
            onOpen={onOpen}
          />
        )}
        renderWindow="visible"
        showDebugBadge={false}
        depthEffect="motionOnly"
        availableHeight={MOBILE_TRADE_DECK_AVAILABLE_HEIGHT}
        maxCardSize={MOBILE_TRADE_DECK_MAX_CARD_SIZE}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 2,
    elevation: 2,
  },
  card: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: POSTER_CARD_GEOMETRY.cardRadius,
    overflow: 'hidden',
    padding: POSTER_CARD_GEOMETRY.contentInset,
    justifyContent: 'space-between',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  fallbackVisual: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    opacity: 0.88,
  },
  fallbackIcon: {
    width: 82,
    height: 82,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLine: {
    width: '34%',
    height: 10,
    borderRadius: 999,
    opacity: 0.65,
  },
  fallbackLineWide: {
    width: '56%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  posterPill: {
    minHeight: POSTER_CARD_GEOMETRY.topPillMinHeight,
    maxWidth: POSTER_CARD_GEOMETRY.topPillMaxWidth,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: POSTER_CARD_GEOMETRY.topPillPaddingHorizontal,
    paddingVertical: POSTER_CARD_GEOMETRY.topPillPaddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPillText: {
    color: '#FFFFFF',
    fontSize: POSTER_CARD_GEOMETRY.topPillFontSize,
    lineHeight: POSTER_CARD_GEOMETRY.topPillLineHeight,
    fontWeight: '900',
    letterSpacing: POSTER_CARD_GEOMETRY.topPillLetterSpacing,
  },
  counterPill: {
    minHeight: POSTER_CARD_GEOMETRY.topPillMinHeight,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  copy: {
    gap: 5,
  },
  posterCopy: {
    marginHorizontal: POSTER_CARD_GEOMETRY.footerBleed,
    marginBottom: POSTER_CARD_GEOMETRY.footerBleed,
  },
  posterFooterSurface: {
    borderRadius: POSTER_CARD_GEOMETRY.footerRadius,
  },
  posterFooterContent: {
    paddingHorizontal: POSTER_CARD_GEOMETRY.footerContentPaddingHorizontal,
    paddingTop: POSTER_CARD_GEOMETRY.footerContentPaddingTop,
    paddingBottom: POSTER_CARD_GEOMETRY.footerContentPaddingBottom,
    gap: POSTER_CARD_GEOMETRY.footerContentGap,
  },
  title: {
    ...DECK_CARD_TYPOGRAPHY.title,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  meta: {
    ...DECK_CARD_TYPOGRAPHY.meta,
  },
  pressed: {
    opacity: 0.92,
  },
});
