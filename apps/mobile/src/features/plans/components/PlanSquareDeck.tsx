import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MediaAssetDto, PlaceStaticMapDto, PlanDto, PlanPlaceDto } from '@hellowhen/contracts';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppText } from '../../../components/AppText';
import { LowerImageAtmosphere } from '../../../components/LowerImageAtmosphere';
import { POSTER_CARD_GEOMETRY } from '../../../components/PosterCardGeometry';
import { PosterCardFooter } from '../../../components/PosterCardFooter';
import { SemanticBadge } from '../../../components/SemanticUI';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { ContinuousSquareStackDeck, type SquareStackDeckCard } from '../../trade/deck';
import { resolveMediaVariantUrl } from '../../trade/mediaUrls';

const MOBILE_PLAN_DECK_AVAILABLE_HEIGHT = 404;
const MOBILE_PLAN_DECK_MAX_CARD_SIZE = 348;
const FALLBACK_ACCENTS = ['#7C3AED', '#A855F7', '#C084FC', '#F97316'];
type PlanPlaceDeckCard = SquareStackDeckCard & {
  kind: 'place' | 'emptyPlace';
  plan: PlanDto;
  place?: PlanPlaceDto;
  placeIndex: number;
  placeTotal: number;
  media?: MediaAssetDto;
  staticMap?: PlaceStaticMapDto | null;
};

type PlanSquareDeckProps = {
  plan: PlanDto;
  index?: number;
  total?: number;
  onOpen?: () => void;
  style?: StyleProp<ViewStyle>;
  topBadgeLabel?: string;
  topBadgeTone?: SemanticColorName;
  showModeBadge?: boolean;
};

function activeMedia(media: MediaAssetDto[] | undefined) {
  return (media ?? []).filter((asset) => asset.status === 'active');
}

function activeMediaUrl(media?: MediaAssetDto | null) {
  if (!media?.url || media.status !== 'active') return null;
  return resolveMediaVariantUrl(media, 'card');
}

function staticMapUrlForTheme(staticMap?: PlaceStaticMapDto | null, themeMode: 'light' | 'dark' = 'light') {
  if (!staticMap) return null;
  return themeMode === 'dark' ? staticMap.darkUrl || staticMap.lightUrl || null : staticMap.lightUrl || staticMap.darkUrl || null;
}

function getPlaceMedia(place: PlanPlaceDto | undefined) {
  return activeMedia(place?.media)[0] ?? activeMedia(place?.sourcePlace?.media)[0];
}

function getPlaceStaticMap(place: PlanPlaceDto | undefined) {
  return place?.staticMap ?? place?.sourcePlace?.staticMap ?? null;
}

function sortedPlanPlaces(plan: PlanDto) {
  return [...(plan.places ?? [])].sort((first, second) => first.order - second.order);
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function fallbackModel(id: string) {
  const hash = hashString(id);
  const accent = FALLBACK_ACCENTS[hash % FALLBACK_ACCENTS.length] ?? '#7C3AED';
  const lineOffset = hash % 37;
  const dotOffsetX = ((hash % 29) - 14) * 0.5;
  const dotOffsetY = (((hash >> 4) % 23) - 11) * 0.5;
  return { accent, lineOffset, dotOffsetX, dotOffsetY };
}

function buildPlanPlaceDeckCards(plan: PlanDto): PlanPlaceDeckCard[] {
  const places = sortedPlanPlaces(plan);
  if (places.length === 0) {
    return [{ id: `${plan.id}:empty-place`, kind: 'emptyPlace', plan, placeIndex: 0, placeTotal: 0 }];
  }

  return places.map((place, index) => ({
    id: `${plan.id}:place:${place.id}`,
    kind: 'place' as const,
    plan,
    place,
    placeIndex: index,
    placeTotal: places.length,
    media: getPlaceMedia(place),
    staticMap: getPlaceStaticMap(place),
  }));
}

function formatPlanPlaceDate(value?: string | null) {
  if (!value) return 'Flexible time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function getPlaceLocationLabel(place: PlanPlaceDto | undefined) {
  if (!place) return '';
  if (place.mode === 'remote') return place.onlineLabel || place.onlineUrl || '';
  return place.addressPublicText || place.sourcePlace?.areaLabel || '';
}

function getPlaceLanguageLabel(place: PlanPlaceDto | undefined) {
  const displayLanguage = place?.displayLanguage ?? place?.sourcePlace?.displayLanguage ?? null;
  if (!displayLanguage?.languageCode || displayLanguage.source === 'exact') return '';
  return displayLanguage.languageCode.toUpperCase();
}

function getPlanParticipantLabel(plan: PlanDto) {
  const count = plan.participantCount ?? plan.participants?.filter((participant) => participant.status === 'accepted').length ?? 0;
  return `${count} joined`;
}

function getPlaceDateLabel(place: PlanPlaceDto | undefined, planStartsAt: string) {
  return formatPlanPlaceDate(place?.startsAt ?? planStartsAt);
}

function PlanPlaceDeckCardView({ card, onOpen, topBadgeLabel, topBadgeTone = 'instruction', showModeBadge = true }: { card: PlanPlaceDeckCard; onOpen: () => void; topBadgeLabel?: string; topBadgeTone?: SemanticColorName; showModeBadge?: boolean }) {
  const theme = useThemeTokens();
  const isDark = theme.mode === 'dark';
  const mediaUrl = activeMediaUrl(card.media);
  const staticMapUrl = staticMapUrlForTheme(card.staticMap, theme.mode);
  const imageUrl = mediaUrl ?? staticMapUrl;
  const fallback = useMemo(() => fallbackModel(card.id), [card.id]);
  const place = card.place;
  const isEmpty = card.kind === 'emptyPlace' || !place;
  const cardCounter = isEmpty ? '0 places' : `${String(card.placeIndex + 1).padStart(2, '0')}/${String(card.placeTotal).padStart(2, '0')}`;
  const modeLabel = place?.mode === 'remote' ? 'Online' : 'Offline';
  const placeTitle = place?.title ?? 'No places yet';
  const languageLabel = isEmpty ? '' : getPlaceLanguageLabel(place);
  const locationLabel = isEmpty ? '' : [languageLabel, getPlaceLocationLabel(place)].filter(Boolean).join(' · ');
  const timeLabel = isEmpty ? getPlanParticipantLabel(card.plan) : getPlaceDateLabel(place, card.plan.startsAt);
  const primaryBadgeLabel = topBadgeLabel ?? `Place · ${cardCounter}`;
  const hasPosterImage = Boolean(imageUrl);
  const posterTextShadow = hasPosterImage ? 'rgba(0,0,0,0.34)' : isDark ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.48)';
  const posterTitleColor = hasPosterImage ? '#FFFFFF' : theme.color.text;
  const posterMutedColor = hasPosterImage ? 'rgba(255,255,255,0.86)' : theme.color.muted;
  const posterSubtleColor = hasPosterImage ? 'rgba(255,255,255,0.74)' : theme.color.muted;
  const posterPillBg = hasPosterImage ? 'rgba(10,15,22,0.24)' : undefined;
  const posterPillBorder = hasPosterImage ? 'rgba(255,255,255,0.08)' : undefined;
  const posterPillText = hasPosterImage ? 'rgba(255,255,255,0.9)' : undefined;
  const fallbackSurface = isDark ? '#241833' : '#F2E9FF';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.plan.title}. ${isEmpty ? 'No places yet' : `Place ${card.placeIndex + 1}: ${placeTitle}`}. Open plan.`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: imageUrl ? '#0B1016' : fallbackSurface, borderColor: 'transparent', borderWidth: 0 },
        pressed && styles.pressed,
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} resizeMode="cover" style={styles.cardImage} />
      ) : (
        <View style={[styles.fallbackMedia, { backgroundColor: fallbackSurface }]}>
          {Array.from({ length: 7 }, (_, index) => (
            <View
              key={`${card.id}:fallback-line:${index}`}
              style={[
                styles.fallbackLine,
                {
                  top: 24 + index * 31,
                  left: `${8 + ((fallback.lineOffset + index * 13) % 40)}%`,
                  backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.055)' : 'rgba(92,33,182,0.055)',
                },
              ]}
            />
          ))}
          <View style={[styles.fallbackRouteLine, { backgroundColor: theme.mode === 'dark' ? 'rgba(251,146,60,0.16)' : 'rgba(249,115,22,0.12)' }]} />
          <View
            style={[
              styles.fallbackDot,
              {
                backgroundColor: fallback.accent,
                borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.5)',
                transform: [{ translateX: fallback.dotOffsetX }, { translateY: fallback.dotOffsetY }],
              },
            ]}
          />
        </View>
      )}
      {imageUrl ? <LowerImageAtmosphere imageUrl={imageUrl} isDark={isDark} preset="plan" /> : null}

      <View style={styles.cardTopRow}>
        {hasPosterImage ? (
          <View style={[styles.posterPill, { backgroundColor: posterPillBg, borderColor: posterPillBorder }]}>
            <AppText style={[styles.posterPillText, { color: posterPillText }]} numberOfLines={1}>{primaryBadgeLabel}</AppText>
          </View>
        ) : (
          <SemanticBadge label={primaryBadgeLabel} tone={topBadgeTone} size="sm" />
        )}
        {showModeBadge && !isEmpty ? (hasPosterImage ? (
          <View style={[styles.posterPill, styles.posterModePill, { backgroundColor: posterPillBg, borderColor: posterPillBorder }]}>
            <AppText style={[styles.posterPillText, { color: posterPillText }]} numberOfLines={1}>{modeLabel}</AppText>
          </View>
        ) : (
          <SemanticBadge label={modeLabel} tone="muted" size="sm" />
        )) : null}
      </View>

      <PosterCardFooter
        enabled={hasPosterImage}
        style={[styles.cardCopy, hasPosterImage && styles.posterCardCopy]}
        surfaceStyle={styles.posterCardFooterSurface}
        contentStyle={styles.posterCardFooterContent}
      >
        <AppText style={[styles.planTitle, { color: posterSubtleColor, textShadowColor: posterTextShadow }]} numberOfLines={1}>{card.plan.title}</AppText>
        <AppText style={[styles.placeTitle, { color: posterTitleColor, textShadowColor: posterTextShadow }]} numberOfLines={2}>{placeTitle}</AppText>
        {isEmpty ? <AppText style={[styles.emptyHint, { color: posterMutedColor, textShadowColor: posterTextShadow }]} numberOfLines={2}>Add a first stop to turn this Plan into route cards.</AppText> : null}
        {!isEmpty && locationLabel ? <AppText style={[styles.placeMetaText, { color: posterMutedColor, textShadowColor: posterTextShadow }]} numberOfLines={1}>{locationLabel}</AppText> : null}
        <AppText style={[styles.placeTimeText, { color: posterMutedColor, textShadowColor: posterTextShadow }]} numberOfLines={1}>{timeLabel}</AppText>
      </PosterCardFooter>
    </Pressable>
  );
}

export function PlanSquareDeck({ plan, onOpen, style, topBadgeLabel, topBadgeTone, showModeBadge = true }: PlanSquareDeckProps) {
  const cards = useMemo(() => buildPlanPlaceDeckCards(plan), [plan]);
  const handleOpen = onOpen ?? (() => {});

  return (
    <View style={[styles.container, style]}>
      <ContinuousSquareStackDeck<PlanPlaceDeckCard>
        cards={cards}
        renderCard={({ card }) => <PlanPlaceDeckCardView card={card} onOpen={handleOpen} topBadgeLabel={topBadgeLabel} topBadgeTone={topBadgeTone} showModeBadge={showModeBadge} />}
        renderWindow="visible"
        showDebugBadge={false}
        depthEffect="motionOnly"
        availableHeight={MOBILE_PLAN_DECK_AVAILABLE_HEIGHT}
        maxCardSize={MOBILE_PLAN_DECK_MAX_CARD_SIZE}
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
    borderWidth: 0,
    overflow: 'hidden',
    padding: POSTER_CARD_GEOMETRY.contentInset,
    justifyContent: 'space-between',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  fallbackMedia: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  fallbackLine: {
    position: 'absolute',
    width: '66%',
    height: 16,
    borderRadius: 999,
    transform: [{ rotate: '-16deg' }],
  },
  fallbackRouteLine: {
    position: 'absolute',
    left: '16%',
    right: '16%',
    bottom: '30%',
    height: 7,
    borderRadius: 999,
    transform: [{ rotate: '-16deg' }],
  },
  fallbackDot: {
    position: 'absolute',
    left: '50%',
    top: '38%',
    width: 58,
    height: 58,
    marginLeft: -29,
    marginTop: -29,
    borderRadius: 999,
    borderWidth: 3,
    opacity: 0.9,
  },
  fallbackScrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  posterPill: {
    minHeight: POSTER_CARD_GEOMETRY.topPillMinHeight,
    maxWidth: POSTER_CARD_GEOMETRY.topPillMaxWidth,
    flexShrink: 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: POSTER_CARD_GEOMETRY.topPillPaddingHorizontal,
    paddingVertical: POSTER_CARD_GEOMETRY.topPillPaddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterModePill: {
    maxWidth: POSTER_CARD_GEOMETRY.secondaryPillMaxWidth,
  },
  posterPillText: {
    fontSize: POSTER_CARD_GEOMETRY.topPillFontSize,
    lineHeight: POSTER_CARD_GEOMETRY.topPillLineHeight,
    fontWeight: '900',
    letterSpacing: POSTER_CARD_GEOMETRY.topPillLetterSpacing,
    textTransform: 'uppercase',
  },
  cardCopy: {
    alignSelf: 'stretch',
    gap: POSTER_CARD_GEOMETRY.footerContentGap,
    paddingTop: 0,
    paddingRight: 0,
  },
  posterCardCopy: {
    paddingTop: 0,
  },
  posterCardFooterSurface: {
    marginHorizontal: POSTER_CARD_GEOMETRY.footerBleed,
    marginBottom: POSTER_CARD_GEOMETRY.footerBleed,
    borderRadius: POSTER_CARD_GEOMETRY.footerRadius,
  },
  posterCardFooterContent: {
    gap: POSTER_CARD_GEOMETRY.footerContentGap,
    paddingHorizontal: POSTER_CARD_GEOMETRY.footerContentPaddingHorizontal,
    paddingTop: POSTER_CARD_GEOMETRY.footerContentPaddingTop,
    paddingBottom: POSTER_CARD_GEOMETRY.footerContentPaddingBottom,
  },
  planTitle: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.72,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  placeTitle: {
    fontSize: 25.5,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.82,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4.5,
  },
  emptyHint: {
    fontSize: 13.5,
    lineHeight: 18.5,
    fontWeight: '800',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4.5,
  },
  placeMetaText: {
    marginTop: 3,
    fontSize: 12.2,
    lineHeight: 16.5,
    fontWeight: '800',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4.5,
  },
  placeTimeText: {
    fontSize: 12.2,
    lineHeight: 16.5,
    fontWeight: '800',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4.5,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
});
