'use client';

import type { MediaAssetDto, PlanDto, PlanPlaceMode } from '@hellowhen/contracts';
import { SquareStackDeck, type SquareStackDeckItem } from '../deck/SquareStackDeck';
import { TradePosterCard } from '../trade/TradePosterCard';
import { formatWebDateTime } from '../../lib/webFormat';
import { toDateInputValue, toTimeInputValue } from './planSchedule';
import { planMediaSrc, planPlaceModeLabel } from './plansPresentation';

type PreviewPlace = {
  id: string;
  mode?: PlanPlaceMode;
  title: string;
  note?: string;
  location?: string;
  date?: string;
  time?: string;
  startsAt?: string | null;
  media?: MediaAssetDto | null;
};

type PlanPreviewDeckProps = {
  title: string;
  description: string;
  rangeLabel: string;
  places: PreviewPlace[];
  className?: string;
  onOpen?: () => void;
  actionLabel?: string;
};

type PlanDtoPreviewDeckProps = {
  plan: PlanDto;
  className?: string;
  onOpen?: () => void;
  actionLabel?: string;
};

function shortLocation(value?: string | null) {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  return trimmed.length > 58 ? `${trimmed.slice(0, 55)}...` : trimmed;
}

function previewDateTime(place: PreviewPlace) {
  if (place.startsAt) return formatWebDateTime(place.startsAt, 'Time not set');
  if (place.date && place.time) return `${place.date} · ${place.time}`;
  if (place.time) return place.time;
  return 'Time not set';
}

function cardCountLabel(index: number, totalCards: number) {
  return `${String(Math.max(index, 1)).padStart(2, '0')}/${String(Math.max(totalCards, 1)).padStart(2, '0')}`;
}

function compactJoin(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

function visiblePlaceTitle(place: PreviewPlace) {
  return place.title.trim() || 'Place name';
}

function visiblePlaceLocation(place: PreviewPlace) {
  const mode = place.mode ?? 'local';
  return shortLocation(place.location) || (mode === 'remote' ? 'Online link or instructions' : 'Address or meeting point');
}

function planDeckItems({ title, places, actionLabel = 'Open' }: Omit<PlanPreviewDeckProps, 'className' | 'onOpen'>): SquareStackDeckItem[] {
  const visibleTitle = title.trim() || 'Untitled Plan';
  const fallbackPlace: PreviewPlace = { id: `${visibleTitle}-empty-place`, title: 'Place to be added', mode: 'local' as PlanPlaceMode };
  const visiblePlaces: PreviewPlace[] = places.length ? places : [fallbackPlace];
  const totalCards = Math.max(visiblePlaces.length, 1);

  return visiblePlaces.map((place, index) => {
    const mode = place.mode ?? 'local';
    const placeTitle = visiblePlaceTitle(place);
    const location = visiblePlaceLocation(place);
    const timeLabel = previewDateTime(place);
    const imageSrc = planMediaSrc(place.media);
    const cardNumber = index + 1;

    return {
      id: `${place.id}-plan-place`,
      ariaLabel: `${actionLabel} ${visibleTitle}: ${placeTitle}`,
      content: (
        <TradePosterCard
          id={`${place.id}-plan-place`}
          imageUrl={imageSrc}
          imageAlt={placeTitle}
          badge={timeLabel === 'Time not set' ? `PLACE · ${cardCountLabel(cardNumber, totalCards)}` : timeLabel}
          eyebrow={`Place ${index + 1}/${totalCards} · ${planPlaceModeLabel(mode)}`}
          title={visibleTitle}
          detailTitle={placeTitle}
          subtitle={compactJoin([planPlaceModeLabel(mode), location])}
          chips={[`Place ${index + 1}/${totalCards}`, planPlaceModeLabel(mode)]}
          variant="trade"
        />
      ),
    };
  });
}

export function PlanPreviewDeck({ title, description, rangeLabel, places, className, onOpen, actionLabel }: PlanPreviewDeckProps) {
  const items = planDeckItems({ title, description, rangeLabel, places, actionLabel: actionLabel ?? (onOpen ? 'Open' : 'Preview') });
  const visibleTitle = title.trim() || 'Untitled Plan';
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

export function PlanDtoPreviewDeck({ plan, className, onOpen, actionLabel }: PlanDtoPreviewDeckProps) {
  const places = (plan.places ?? []).map((place) => ({
    id: place.id,
    mode: place.mode ?? 'local',
    title: place.title,
    note: place.note ?? undefined,
    location: place.addressPublicText ?? place.onlineLabel ?? place.onlineUrl ?? undefined,
    date: place.startsAt ? toDateInputValue(place.startsAt) : undefined,
    time: place.startsAt ? toTimeInputValue(place.startsAt) : undefined,
    startsAt: place.startsAt ?? undefined,
    media: place.media?.[0] ?? null,
  }));
  return (
    <PlanPreviewDeck
      title={plan.title}
      description={plan.description}
      rangeLabel={`${formatWebDateTime(plan.startsAt, 'No start')} → ${formatWebDateTime(plan.endsAt ?? plan.startsAt, 'No end')}`}
      places={places}
      className={className}
      onOpen={onOpen}
      actionLabel={actionLabel}
    />
  );
}
