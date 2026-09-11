'use client';

import type { InventoryDisplayLanguage, MediaAssetDto, PlaceStaticMapDto, PlanDto, PlanPlaceKind, PlanPlaceMode } from '@hellowhen/contracts';
import { SquareStackDeck, type SquareStackDeckItem } from '../deck/SquareStackDeck';
import { TradePosterCard } from '../trade/TradePosterCard';
import { formatWebDateTime } from '../../lib/webFormat';
import { toDateInputValue, toTimeInputValue } from './planSchedule';
import { resolvePlaceVisual, useResolvedPlaceVisualTheme, type PlaceVisualThemeMode } from './placeVisuals';
import { useWebTranslation } from '../../providers/WebI18nProvider';

type Translator = ReturnType<typeof useWebTranslation>['t'];

type PreviewPlace = {
  id: string;
  kind?: PlanPlaceKind;
  mode?: PlanPlaceMode;
  title: string;
  location?: string;
  date?: string;
  time?: string;
  startsAt?: string | null;
  media?: MediaAssetDto | null;
  staticMap?: PlaceStaticMapDto | null;
  displayLanguage?: InventoryDisplayLanguage | null;
};

type PlanPreviewDeckProps = {
  title: string;
  description: string;
  rangeLabel: string;
  places: PreviewPlace[];
  className?: string;
  onOpen?: () => void;
  actionLabel?: string;
  badgeLabel?: string;
};

type PlanDtoPreviewDeckProps = {
  plan: PlanDto;
  className?: string;
  onOpen?: () => void;
  actionLabel?: string;
  badgeLabel?: string;
};

function shortLocation(value?: string | null) {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  return trimmed.length > 58 ? `${trimmed.slice(0, 55)}...` : trimmed;
}

function previewDateTime(place: PreviewPlace, t: Translator) {
  const fallback = t('plans.create.preview.timeNotSet');
  if (place.startsAt) return formatWebDateTime(place.startsAt, fallback);
  if (place.date && place.time) return `${place.date} · ${place.time}`;
  if (place.time) return place.time;
  return fallback;
}

function cardCountLabel(index: number, totalCards: number) {
  return `${String(Math.max(index, 1)).padStart(2, '0')}/${String(Math.max(totalCards, 1)).padStart(2, '0')}`;
}

function compactJoin(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

function displayLanguageChip(displayLanguage?: InventoryDisplayLanguage | null) {
  if (!displayLanguage?.languageCode || displayLanguage.source === 'exact') return null;
  return displayLanguage.languageCode.toUpperCase();
}

function customStopKindLabel(kind: PlanPlaceKind | undefined, t: Translator) {
  if (kind === 'pause') return t('plans.deck.customStop.pause');
  if (kind === 'free_time') return t('plans.deck.customStop.freeTime');
  if (kind === 'meeting_point') return t('plans.deck.customStop.meetingPoint');
  if (kind === 'custom') return t('plans.deck.customStop.custom');
  return '';
}

function isCustomStop(place: PreviewPlace) {
  return (place.kind ?? 'place') !== 'place';
}

function visiblePlaceTitle(place: PreviewPlace, t: Translator) {
  return place.title.trim() || customStopKindLabel(place.kind, t) || t('plans.create.place.name');
}

function visiblePlaceLocation(place: PreviewPlace, t: Translator) {
  if (isCustomStop(place)) return t('plans.deck.customStop.noAddress');
  const mode = place.mode ?? 'local';
  return shortLocation(place.location) || (mode === 'remote' ? t('plans.create.preview.onlineDestination') : t('plans.create.preview.addressOrMeeting'));
}

function planDeckItems({ title, places, actionLabel, badgeLabel, themeMode }: Omit<PlanPreviewDeckProps, 'className' | 'onOpen'> & { themeMode: PlaceVisualThemeMode }, t: Translator): SquareStackDeckItem[] {
  const visibleTitle = title.trim() || t('plans.create.preview.untitled');
  const fallbackPlace: PreviewPlace = { id: `${visibleTitle}-empty-place`, title: t('plans.create.preview.placeToAdd'), mode: 'local' as PlanPlaceMode };
  const visiblePlaces: PreviewPlace[] = places.length ? places : [fallbackPlace];
  const totalCards = Math.max(visiblePlaces.length, 1);

  return visiblePlaces.map((place, index) => {
    const mode = place.mode ?? 'local';
    const customStop = isCustomStop(place);
    const placeTitle = visiblePlaceTitle(place, t);
    const location = visiblePlaceLocation(place, t);
    const timeLabel = previewDateTime(place, t);
    const placeVisual = customStop ? { url: null } : resolvePlaceVisual({ media: place.media, staticMap: place.staticMap, themeMode });
    const cardNumber = index + 1;
    const unitLabel = customStop ? t('plans.common.stop') : t('plans.common.place');
    const typeLabel = customStop ? customStopKindLabel(place.kind, t) : (mode === 'remote' ? t('plans.detail.values.online') : t('plans.detail.values.local'));

    return {
      id: `${place.id}-plan-place`,
      ariaLabel: `${actionLabel} ${visibleTitle}: ${placeTitle}`,
      content: (
        <TradePosterCard
          id={`${place.id}-plan-place`}
          imageUrl={placeVisual.url}
          imageAlt={placeTitle}
          badge={badgeLabel ?? (timeLabel === t('plans.create.preview.timeNotSet') ? `${unitLabel.toUpperCase()} · ${cardCountLabel(cardNumber, totalCards)}` : timeLabel)}
          eyebrow={`${unitLabel} ${index + 1}/${totalCards} · ${typeLabel}`}
          title={visibleTitle}
          detailTitle={placeTitle}
          subtitle={compactJoin([typeLabel, location])}
          chips={[displayLanguageChip(place.displayLanguage), `${unitLabel} ${index + 1}/${totalCards}`, typeLabel].filter((chip): chip is string => Boolean(chip))}
          variant="trade"
        />
      ),
    };
  });
}

export function PlanPreviewDeck({ title, description, rangeLabel, places, className, onOpen, actionLabel, badgeLabel }: PlanPreviewDeckProps) {
  const themeMode = useResolvedPlaceVisualTheme();
  const { t } = useWebTranslation();
  const items = planDeckItems({ title, description, rangeLabel, places, actionLabel: actionLabel ?? (onOpen ? t('common.actions.open') : t('common.actions.preview')), badgeLabel, themeMode }, t);
  const visibleTitle = title.trim() || t('plans.create.preview.untitled');
  const deckClassName = ['trade-stack-deck', 'plan-stack-deck', !onOpen ? 'trade-stack-deck--preview' : null, className].filter(Boolean).join(' ');

  return (
    <SquareStackDeck
      className={deckClassName}
      items={items}
      label={visibleTitle}
      onOpen={onOpen}
      lockScrollWithinDeck={!onOpen}
    />
  );
}

export function PlanDtoPreviewDeck({ plan, className, onOpen, actionLabel, badgeLabel }: PlanDtoPreviewDeckProps) {
  const { t } = useWebTranslation();
  const places = (plan.places ?? []).map((place) => ({
    id: place.id,
    kind: place.kind ?? 'place',
    mode: place.mode ?? 'local',
    title: place.title,
    location: place.addressPublicText ?? place.onlineLabel ?? place.onlineUrl ?? undefined,
    date: place.startsAt ? toDateInputValue(place.startsAt) : undefined,
    time: place.startsAt ? toTimeInputValue(place.startsAt) : undefined,
    startsAt: place.startsAt ?? undefined,
    media: place.media?.[0] ?? null,
    staticMap: place.staticMap ?? place.sourcePlace?.staticMap ?? null,
    displayLanguage: place.displayLanguage ?? place.sourcePlace?.displayLanguage ?? null,
  }));
  return (
    <PlanPreviewDeck
      title={plan.title}
      description={plan.description}
      rangeLabel={`${formatWebDateTime(plan.startsAt, t('plans.create.preview.noStart'))} → ${formatWebDateTime(plan.endsAt ?? plan.startsAt, t('plans.create.preview.noEnd'))}`}
      places={places}
      className={className}
      onOpen={onOpen}
      actionLabel={actionLabel}
      badgeLabel={badgeLabel}
    />
  );
}
