import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MediaAssetDto, PlanDto, PlanPlaceDto } from '@hellowhen/contracts';
import { AppText } from '../../../components/AppText';
import { MobileIcon } from '../../../components/MobileIcon';
import { SemanticBadge } from '../../../components/SemanticUI';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { ContinuousSquareStackDeck, type SquareStackDeckCard } from '../../trade/deck';
import { resolveMediaUrl } from '../../trade/mediaUrls';

const MOBILE_PLAN_DECK_AVAILABLE_HEIGHT = 404;
const MOBILE_PLAN_DECK_MAX_CARD_SIZE = 348;

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
  if (!place) return 'Add places to this Plan';
  if (place.mode === 'remote') return place.onlineLabel || place.onlineUrl || 'Online place';
  return place.addressPublicText || place.sourcePlace?.areaLabel || 'Offline place';
}

function getPlanOwnerName(plan: PlanDto) {
  return plan.owner?.profile?.displayName || plan.owner?.profile?.handle || 'Hellowhen member';
}

function getPlanParticipantLabel(plan: PlanDto) {
  const count = plan.participantCount ?? plan.participants?.filter((participant) => participant.status === 'accepted').length ?? 0;
  return `${count} joined`;
}

function PlanPlaceDeckCardView({ card, onOpen }: { card: PlanPlaceDeckCard; onOpen: () => void }) {
  const theme = useThemeTokens();
  const imageUrl = activeMediaUrl(card.media);
  const place = card.place;
  const isEmpty = card.kind === 'emptyPlace' || !place;
  const cardCounter = isEmpty ? '0 places' : `${String(card.placeIndex + 1).padStart(2, '0')}/${String(card.placeTotal).padStart(2, '0')}`;
  const sourceLabel = place?.source === 'hellowhen_library' ? 'Library place' : place?.source === 'my_place' ? 'My place' : 'Custom place';
  const modeLabel = place?.mode === 'remote' ? 'Online' : 'Offline';
  const placeTitle = place?.title ?? 'No places yet';
  const placeBody = place?.note || place?.sourcePlace?.description || getPlaceLocationLabel(place);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.plan.title}. ${isEmpty ? 'No places yet' : `Place ${card.placeIndex + 1}: ${placeTitle}`}. View plan.`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: imageUrl ? theme.color.surface : theme.semantic.instruction.softBg, borderColor: theme.color.border },
        pressed && styles.pressed,
      ]}
    >
      {imageUrl ? <Image source={{ uri: imageUrl }} resizeMode="cover" style={styles.cardImage} /> : null}
      {imageUrl ? <View style={[styles.imageScrim, { backgroundColor: theme.color.background }]} /> : null}

      <View style={styles.cardTopRow}>
        <SemanticBadge label={`Place · ${cardCounter}`} tone="instruction" size="sm" />
        {!isEmpty ? <SemanticBadge label={modeLabel} tone="muted" size="sm" /> : null}
      </View>

      <View style={styles.cardBody}>
        <AppText style={[styles.planTitle, { color: theme.color.muted }]} numberOfLines={1}>{card.plan.title}</AppText>
        <AppText style={[styles.placeTitle, { color: theme.color.text }]} numberOfLines={3}>{placeTitle}</AppText>
        <AppText style={[styles.placeBody, { color: theme.color.muted }]} numberOfLines={3}>{isEmpty ? 'This Plan will appear as place cards once places are attached.' : placeBody}</AppText>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerMetaStack}>
          <View style={styles.footerMetaRow}>
            <MobileIcon name={place?.mode === 'remote' ? 'send' : 'calendar'} size={15} color={theme.color.muted} />
            <AppText style={[styles.footerMetaText, { color: theme.color.muted }]} numberOfLines={1}>{isEmpty ? getPlanOwnerName(card.plan) : getPlaceLocationLabel(place)}</AppText>
          </View>
          <View style={styles.footerMetaRow}>
            <MobileIcon name="activity" size={15} color={theme.color.muted} />
            <AppText style={[styles.footerMetaText, { color: theme.color.muted }]} numberOfLines={1}>{isEmpty ? getPlanParticipantLabel(card.plan) : `${sourceLabel} · ${formatPlanPlaceDate(place?.startsAt)}`}</AppText>
          </View>
        </View>
        <View style={[styles.openPill, { backgroundColor: theme.color.text }]}>
          <AppText style={[styles.openPillText, { color: theme.color.background }]}>View plan</AppText>
        </View>
      </View>
    </Pressable>
  );
}

export function PlanSquareDeck({ plan, onOpen, style }: PlanSquareDeckProps) {
  const cards = useMemo(() => buildPlanPlaceDeckCards(plan), [plan]);
  const handleOpen = onOpen ?? (() => {});

  return (
    <View style={[styles.container, style]}>
      <ContinuousSquareStackDeck<PlanPlaceDeckCard>
        cards={cards}
        renderCard={({ card }) => <PlanPlaceDeckCardView card={card} onOpen={handleOpen} />}
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
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.74,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardBody: {
    gap: 8,
    paddingVertical: 14,
  },
  planTitle: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  placeTitle: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  placeBody: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  cardFooter: {
    gap: 12,
  },
  footerMetaStack: {
    gap: 7,
  },
  footerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  footerMetaText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  openPill: {
    minHeight: 43,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  openPillText: {
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
});
