import type { MediaAssetDto, PlanDto, PlanPlaceMode } from '@hellowhen/contracts';
import { WebIcon } from '../../components/WebIcon';
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

export function PlanPreviewDeck({ title, description, rangeLabel, places }: { title: string; description: string; rangeLabel: string; places: PreviewPlace[] }) {
  const visibleTitle = title.trim() || 'Untitled Plan';
  const visibleDescription = description.trim() || 'Add a short description so joiners understand the purpose.';

  return (
    <section className="plan-preview-deck" aria-label="Plan feed preview">
      <article className="plan-feed-card plan-feed-card--summary">
        <span className="semantic-badge trade">Plan · 01/{Math.max(places.length + 1, 1).toString().padStart(2, '0')}</span>
        <div className="plan-feed-card__glass">
          <p className="eyebrow">Joinable activity</p>
          <h3>{visibleTitle}</h3>
          <p>{visibleDescription}</p>
          <div className="plan-preview-card__footer">
            <span>{rangeLabel || 'Date range appears here'}</span>
            <strong>{places.length} place{places.length === 1 ? '' : 's'}</strong>
          </div>
        </div>
      </article>
      {places.map((place, index) => {
        const imageSrc = planMediaSrc(place.media);
        const mode = place.mode ?? 'local';
        return (
          <article key={place.id} className="plan-feed-card plan-feed-card--poster">
            <div className="plan-feed-card__poster-media" aria-hidden="true">
              {imageSrc ? <img src={imageSrc} alt="" loading="lazy" /> : <WebIcon name="trade" size={42} decorative />}
            </div>
            <span className="plan-feed-card__badge">{previewDateTime(place)}</span>
            <div className="plan-feed-card__glass">
              <div className="status-row">
                <span className="semantic-badge instruction">Place {index + 1}/{places.length}</span>
                <span className="semantic-badge neutral">{planPlaceModeLabel(mode)}</span>
              </div>
              <h3>{visibleTitle}</h3>
              <h4>{place.title.trim() || 'Place name'}</h4>
              <p>{shortLocation(place.location) || (mode === 'remote' ? 'Online link or instructions' : 'Address or meeting point')}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function PlanDtoPreviewDeck({ plan }: { plan: PlanDto }) {
  const places = (plan.places ?? []).map((place) => ({
    id: place.id,
    mode: place.mode ?? 'local',
    title: place.title,
    note: place.note ?? undefined,
    location: place.addressPublicText ?? undefined,
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
    />
  );
}
