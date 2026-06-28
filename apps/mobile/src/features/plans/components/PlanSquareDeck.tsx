import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MediaAssetDto, PlanDto, PlanPlaceDto } from '@hellowhen/contracts';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppText } from '../../../components/AppText';
import { SemanticBadge } from '../../../components/SemanticUI';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { ContinuousSquareStackDeck, type SquareStackDeckCard } from '../../trade/deck';
import { resolveMediaUrl } from '../../trade/mediaUrls';

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
  return resolveMediaUrl(media.url);
}

function getPlaceMedia(place: PlanPlaceDto | undefined) {
  return activeMedia(place?.media)[0] ?? activeMedia(place?.sourcePlace?.media)[0];
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

function getPlanParticipantLabel(plan: PlanDto) {
  const count = plan.participantCount ?? plan.participants?.filter((participant) => participant.status === 'accepted').length ?? 0;
  return `${count} joined`;
}

function getPlaceDateLabel(place: PlanPlaceDto | undefined, planStartsAt: string) {
  return formatPlanPlaceDate(place?.startsAt ?? planStartsAt);
}

function PlanPlaceDeckCardView({ card, onOpen, topBadgeLabel, topBadgeTone = 'instruction', showModeBadge = true }: { card: PlanPlaceDeckCard; onOpen: () => void; topBadgeLabel?: string; topBadgeTone?: SemanticColorName; showModeBadge?: boolean }) {
  const theme = useThemeTokens();
  const imageUrl = activeMediaUrl(card.media);
  const fallback = useMemo(() => fallbackModel(card.id), [card.id]);
  const place = card.place;
  const isEmpty = card.kind === 'emptyPlace' || !place;
  const cardCounter = isEmpty ? '0 places' : `${String(card.placeIndex + 1).padStart(2, '0')}/${String(card.placeTotal).padStart(2, '0')}`;
  const modeLabel = place?.mode === 'remote' ? 'Online' : 'Offline';
  const placeTitle = place?.title ?? 'No places yet';
  const locationLabel = isEmpty ? '' : getPlaceLocationLabel(place);
  const timeLabel = isEmpty ? getPlanParticipantLabel(card.plan) : getPlaceDateLabel(place, card.plan.startsAt);
  const primaryBadgeLabel = topBadgeLabel ?? `Place · ${cardCounter}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.plan.title}. ${isEmpty ? 'No places yet' : `Place ${card.placeIndex + 1}: ${placeTitle}`}. Open plan.`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: imageUrl ? theme.color.surface : theme.semantic.place.softBg, borderColor: imageUrl ? theme.color.border : theme.semantic.place.border },
        pressed && styles.pressed,
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} resizeMode="cover" style={styles.cardImage} />
      ) : (
        <View style={[styles.fallbackMedia, { backgroundColor: theme.semantic.place.softBg }]}>
          {Array.from({ length: 7 }, (_, index) => (
            <View
              key={`${card.id}:fallback-line:${index}`}
              style={[
                styles.fallbackLine,
                {
                  top: 24 + index * 31,
                  left: `${8 + ((fallback.lineOffset + index * 13) % 40)}%`,
                  backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(92,33,182,0.08)',
                },
              ]}
            />
          ))}
          <View style={[styles.fallbackRouteLine, { backgroundColor: theme.mode === 'dark' ? 'rgba(251,146,60,0.20)' : 'rgba(249,115,22,0.16)' }]} />
          <View
            style={[
              styles.fallbackDot,
              {
                backgroundColor: fallback.accent,
                borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.64)',
                transform: [{ translateX: fallback.dotOffsetX }, { translateY: fallback.dotOffsetY }],
              },
            ]}
          />
        </View>
      )}
      {imageUrl ? <View style={[styles.imageScrim, { backgroundColor: theme.color.background }]} /> : <View style={[styles.fallbackScrim, { backgroundColor: theme.color.background }]} />}

      <View style={styles.cardTopRow}>
        <SemanticBadge label={primaryBadgeLabel} tone={topBadgeTone} size="sm" />
        {showModeBadge && !isEmpty ? <SemanticBadge label={modeLabel} tone="muted" size="sm" /> : null}
      </View>

      <View style={styles.cardCopy}>
        <AppText style={[styles.planTitle, { color: theme.color.muted }]} numberOfLines={1}>{card.plan.title}</AppText>
        <AppText style={[styles.placeTitle, { color: theme.color.text }]} numberOfLines={2}>{placeTitle}</AppText>
        {isEmpty ? <AppText style={[styles.emptyHint, { color: theme.color.muted }]} numberOfLines={2}>Add a first stop to turn this Plan into route cards.</AppText> : null}
        {!isEmpty && locationLabel ? <AppText style={[styles.placeMetaText, { color: theme.color.muted }]} numberOfLines={1}>{locationLabel}</AppText> : null}
        <AppText style={[styles.placeTimeText, { color: theme.color.muted }]} numberOfLines={1}>{timeLabel}</AppText>
      </View>
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
        renderWindow="all"
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
  },
  card: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
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
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.62,
  },
  fallbackScrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardCopy: {
    gap: 6,
    paddingTop: 128,
  },
  planTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  placeTitle: {
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -1,
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  placeMetaText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  placeTimeText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
});
