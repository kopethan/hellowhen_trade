import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MediaAssetDto, PlaceStaticMapDto, PlanDto, PlanPlaceDto } from '@hellowhen/contracts';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppText } from '../../../components/AppText';
import { LowerImageAtmosphere } from '../../../components/LowerImageAtmosphere';
import { DECK_CARD_TYPOGRAPHY, POSTER_CARD_GEOMETRY } from '../../../components/PosterCardGeometry';
import { PosterCardFooter } from '../../../components/PosterCardFooter';
import { SemanticBadge } from '../../../components/SemanticUI';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import { useAuth } from '../../../providers/AuthProvider';
import { ContinuousSquareStackDeck, type SquareStackDeckCard } from '../../trade/deck';
import { resolveMediaVariantUrl } from '../../trade/mediaUrls';
import { formatPlanTemperature, isSyntheticPlanWeatherPlanId } from '../planWeatherModel';
import { usePlanPlaceWeather, useTemperatureUnitPreference } from '../planWeatherMobile';
import { getPlanPresentationState, getPlanPresentationTone, planPresentationLabelKey } from '../planPresentationState';

const MOBILE_PLAN_DECK_AVAILABLE_HEIGHT = 404;
const MOBILE_PLAN_DECK_MAX_CARD_SIZE = 348;
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
  showStatusBadge?: boolean;
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
  const lineOffset = hash % 37;
  const dotOffsetX = ((hash % 29) - 14) * 0.5;
  const dotOffsetY = (((hash >> 4) % 23) - 11) * 0.5;
  return { lineOffset, dotOffsetX, dotOffsetY };
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

function formatPlanPlaceDate(value: string | null | undefined, language: 'en' | 'fr' | 'es', flexibleLabel: string) {
  if (!value) return flexibleLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
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

function getPlanParticipantCount(plan: PlanDto) {
  return plan.participantCount ?? plan.participants?.filter((participant) => participant.status === 'accepted').length ?? 0;
}

function PlanPlaceDeckCardView({ card, deckIndex, deckTotal, onOpen, topBadgeLabel, topBadgeTone = 'place', showModeBadge = true, showStatusBadge = true }: { card: PlanPlaceDeckCard; deckIndex: number; deckTotal: number; onOpen: () => void; topBadgeLabel?: string; topBadgeTone?: SemanticColorName; showModeBadge?: boolean; showStatusBadge?: boolean }) {
  const theme = useThemeTokens();
  const { language, t } = useTranslation();
  const isDark = theme.mode === 'dark';
  const mediaUrl = activeMediaUrl(card.media);
  const staticMapUrl = staticMapUrlForTheme(card.staticMap, theme.mode);
  const imageUrl = mediaUrl ?? staticMapUrl;
  const fallback = useMemo(() => fallbackModel(card.id), [card.id]);
  const place = card.place;
  const isEmpty = card.kind === 'emptyPlace' || !place;
  const auth = useAuth();
  const { unit: temperatureUnit, toggleUnit: toggleTemperatureUnit } = useTemperatureUnitPreference();
  const weatherCandidate = usePlanPlaceWeather(
    card.plan.id,
    place,
    auth.user?.id,
    Boolean(auth.user && place && !isEmpty && !isSyntheticPlanWeatherPlanId(card.plan.id)),
  );
  const attributionLogoUrl = weatherCandidate
    ? (theme.mode === 'dark' ? weatherCandidate.attribution.logoDarkUrl : weatherCandidate.attribution.logoLightUrl)
    : null;
  const [attributionLogoReady, setAttributionLogoReady] = useState(false);
  const [attributionLogoFailed, setAttributionLogoFailed] = useState(false);

  useEffect(() => {
    setAttributionLogoReady(false);
    setAttributionLogoFailed(false);
  }, [attributionLogoUrl]);

  const weatherVisible = Boolean(weatherCandidate && attributionLogoUrl && attributionLogoReady && !attributionLogoFailed);
  const temperatureLabel = weatherCandidate && weatherVisible ? formatPlanTemperature(weatherCandidate.temperatureC, temperatureUnit) : '';
  const cardCounter = isEmpty ? t('plans.deck.noPlacesCount') : `${String(card.placeIndex + 1).padStart(2, '0')}/${String(card.placeTotal).padStart(2, '0')}`;
  const modeLabel = place?.mode === 'remote' ? t('plans.deck.online') : t('plans.deck.offline');
  const modeWeatherLabel = temperatureLabel ? `${modeLabel} · ${temperatureLabel}` : modeLabel;
  const placeTitle = place?.title ?? t('plans.deck.noPlaces');
  const languageLabel = isEmpty ? '' : getPlaceLanguageLabel(place);
  const locationLabel = isEmpty ? '' : [languageLabel, getPlaceLocationLabel(place)].filter(Boolean).join(' · ');
  const timeLabel = isEmpty
    ? t('plans.deck.participants', { count: getPlanParticipantCount(card.plan) })
    : formatPlanPlaceDate(place?.startsAt ?? card.plan.startsAt, language, t('plans.common.flexibleTime'));
  const contentBadgeLabel = topBadgeLabel ?? t('plans.deck.placeBadge', { counter: cardCounter });
  const deckCounter = `${String(deckIndex + 1).padStart(2, '0')}/${String(Math.max(deckTotal, 1)).padStart(2, '0')}`;
  const primaryBadgeLabel = deckTotal > 1 ? `${deckCounter} · ${contentBadgeLabel}` : contentBadgeLabel;
  const presentationState = getPlanPresentationState(card.plan);
  const presentationLabel = t(planPresentationLabelKey(presentationState));
  const presentationTone = getPlanPresentationTone(presentationState);
  const hasPosterImage = Boolean(imageUrl);
  const posterTextShadow = hasPosterImage ? 'rgba(0,0,0,0.34)' : isDark ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.48)';
  const posterTitleColor = hasPosterImage ? '#FFFFFF' : theme.color.text;
  const posterMutedColor = hasPosterImage ? 'rgba(255,255,255,0.86)' : theme.color.muted;
  const posterPlanColor = hasPosterImage ? 'rgba(255,255,255,0.74)' : theme.semantic.plan.text;
  const posterPillBg = hasPosterImage ? 'rgba(10,15,22,0.24)' : undefined;
  const posterPillBorder = hasPosterImage ? 'rgba(255,255,255,0.08)' : undefined;
  const posterPillText = hasPosterImage ? 'rgba(255,255,255,0.9)' : undefined;
  const fallbackSurface = theme.semantic.place.softBg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isEmpty
        ? t('plans.deck.accessibilityEmpty', { plan: card.plan.title })
        : t('plans.deck.accessibilityPlace', { plan: card.plan.title, index: card.placeIndex + 1, place: placeTitle })}
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
                  backgroundColor: theme.semantic.place.border,
                  opacity: isDark ? 0.18 : 0.22,
                },
              ]}
            />
          ))}
          <View style={[styles.fallbackRouteLine, { backgroundColor: theme.semantic.plan.border, opacity: isDark ? 0.34 : 0.28 }]} />
          <View
            style={[
              styles.fallbackDot,
              {
                backgroundColor: theme.semantic.place.bg,
                borderColor: theme.semantic.place.onBg,
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
        {showModeBadge && !isEmpty ? (temperatureLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('plans.deck.weather.temperatureAccessibility', { temperature: temperatureLabel })}
            accessibilityHint={t(temperatureUnit === 'celsius' ? 'plans.deck.weather.switchToFahrenheit' : 'plans.deck.weather.switchToCelsius')}
            hitSlop={6}
            onPress={(event) => {
              event.stopPropagation();
              void toggleTemperatureUnit();
            }}
            style={({ pressed }) => [styles.weatherToggle, pressed && styles.weatherTogglePressed]}
          >
            {hasPosterImage ? (
              <View style={[styles.posterPill, styles.posterWeatherPill, { backgroundColor: posterPillBg, borderColor: posterPillBorder }]}>
                <AppText style={[styles.posterPillText, { color: posterPillText }]} numberOfLines={1}>{modeWeatherLabel}</AppText>
              </View>
            ) : (
              <SemanticBadge label={modeWeatherLabel} tone="muted" size="sm" />
            )}
          </Pressable>
        ) : hasPosterImage ? (
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
        <View style={styles.planTitleRow}>
          <AppText style={[styles.planTitle, styles.planTitleFlex, { color: posterPlanColor, textShadowColor: posterTextShadow }]} numberOfLines={1}>{card.plan.title}</AppText>
          {showStatusBadge ? <SemanticBadge label={presentationLabel} tone={presentationTone} size="sm" /> : null}
        </View>
        <AppText style={[styles.placeTitle, { color: posterTitleColor, textShadowColor: posterTextShadow }]} numberOfLines={2}>{placeTitle}</AppText>
        {isEmpty ? <AppText style={[styles.emptyHint, { color: posterMutedColor, textShadowColor: posterTextShadow }]} numberOfLines={2}>{t('plans.deck.addFirstStop')}</AppText> : null}
        {!isEmpty && locationLabel ? <AppText style={[styles.placeMetaText, { color: posterMutedColor, textShadowColor: posterTextShadow }]} numberOfLines={1}>{locationLabel}</AppText> : null}
        <AppText
          style={[
            styles.placeTimeText,
            weatherVisible && styles.placeTimeTextWithWeatherAttribution,
            { color: posterMutedColor, textShadowColor: posterTextShadow },
          ]}
          numberOfLines={1}
        >{timeLabel}</AppText>
        {weatherCandidate && attributionLogoUrl ? (
          <Pressable
            accessible={weatherVisible}
            pointerEvents={weatherVisible ? 'auto' : 'none'}
            accessibilityRole="link"
            accessibilityLabel={t('plans.deck.weather.openAttribution')}
            hitSlop={6}
            onPress={(event) => {
              event.stopPropagation();
              void Linking.openURL(weatherCandidate.attribution.legalUrl).catch(() => undefined);
            }}
            style={({ pressed }) => [
              styles.weatherAttribution,
              { backgroundColor: theme.color.surface, borderColor: theme.color.border },
              !weatherVisible && styles.weatherAttributionPending,
              pressed && styles.weatherTogglePressed,
            ]}
          >
            <Image
              source={{ uri: attributionLogoUrl }}
              resizeMode="contain"
              style={[styles.weatherAttributionLogo, attributionLogoFailed && styles.weatherAttributionLogoHidden]}
              onLoad={() => setAttributionLogoReady(true)}
              onError={() => {
                setAttributionLogoReady(false);
                setAttributionLogoFailed(true);
              }}
            />
          </Pressable>
        ) : null}
      </PosterCardFooter>
    </Pressable>
  );
}

export function PlanSquareDeck({ plan, index = 0, total = 1, onOpen, style, topBadgeLabel, topBadgeTone, showModeBadge = true, showStatusBadge = true }: PlanSquareDeckProps) {
  const cards = useMemo(() => buildPlanPlaceDeckCards(plan), [plan]);
  const handleOpen = onOpen ?? (() => {});

  return (
    <View style={[styles.container, style]}>
      <ContinuousSquareStackDeck<PlanPlaceDeckCard>
        cards={cards}
        renderCard={({ card }) => <PlanPlaceDeckCardView card={card} deckIndex={index} deckTotal={total} onOpen={handleOpen} topBadgeLabel={topBadgeLabel} topBadgeTone={topBadgeTone} showModeBadge={showModeBadge} showStatusBadge={showStatusBadge} />}
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
  posterWeatherPill: {
    maxWidth: '100%',
  },
  posterPillText: {
    fontSize: POSTER_CARD_GEOMETRY.topPillFontSize,
    lineHeight: POSTER_CARD_GEOMETRY.topPillLineHeight,
    fontWeight: '900',
    letterSpacing: POSTER_CARD_GEOMETRY.topPillLetterSpacing,
    textTransform: 'uppercase',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planTitleFlex: {
    flex: 1,
    minWidth: 0,
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
    ...DECK_CARD_TYPOGRAPHY.eyebrow,
    textTransform: 'uppercase',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  placeTitle: {
    ...DECK_CARD_TYPOGRAPHY.title,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4.5,
  },
  emptyHint: {
    ...DECK_CARD_TYPOGRAPHY.meta,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4.5,
  },
  placeMetaText: {
    marginTop: 3,
    ...DECK_CARD_TYPOGRAPHY.meta,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4.5,
  },
  placeTimeText: {
    ...DECK_CARD_TYPOGRAPHY.status,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4.5,
  },
  placeTimeTextWithWeatherAttribution: {
    paddingRight: 78,
  },
  weatherToggle: {
    borderRadius: 999,
    flexShrink: 0,
    maxWidth: '54%',
  },
  weatherTogglePressed: {
    opacity: 0.72,
  },
  weatherAttribution: {
    position: 'absolute',
    right: POSTER_CARD_GEOMETRY.footerContentPaddingHorizontal,
    bottom: POSTER_CARD_GEOMETRY.footerContentPaddingBottom,
    minHeight: 18,
    maxWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  weatherAttributionPending: {
    opacity: 0,
  },
  weatherAttributionLogo: {
    width: 56,
    height: 10,
  },
  weatherAttributionLogoHidden: {
    width: 0,
    height: 0,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
});
