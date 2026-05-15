import type { MediaAssetDto, PlanDto } from '@hellowhen/contracts';
import { WebIcon } from '../../components/WebIcon';
import { formatWebDateTime } from '../../lib/webFormat';
import { formatPlanTime, toTimeInputValue } from './planSchedule';
import { planMediaSrc } from './plansPresentation';

type PreviewPlace = {
  id: string;
  title: string;
  note?: string;
  address?: string;
  time?: string;
  media?: MediaAssetDto | null;
};

export function PlanPreviewDeck({ title, description, rangeLabel, places }: { title: string; description: string; rangeLabel: string; places: PreviewPlace[] }) {
  const visibleTitle = title.trim() || 'Untitled Plan';
  const visibleDescription = description.trim() || 'Add a short description so joiners understand the purpose.';

  return (
    <section className="plan-preview-deck" aria-label="Plan feed preview">
      <article className="plan-feed-card plan-feed-card--summary">
        <span className="semantic-badge trade">Plan</span>
        <h3>{visibleTitle}</h3>
        <p>{visibleDescription}</p>
        <div className="plan-preview-card__footer">
          <span>{rangeLabel || 'Date range appears here'}</span>
          <strong>{places.length} place{places.length === 1 ? '' : 's'}</strong>
        </div>
      </article>
      {places.map((place, index) => {
        const imageSrc = planMediaSrc(place.media);
        return (
          <article key={place.id} className="plan-feed-card plan-feed-card--place">
            <div className="plan-feed-card__media" aria-hidden="true">
              {imageSrc ? <img src={imageSrc} alt="" loading="lazy" /> : <WebIcon name="trade" size={34} decorative />}
            </div>
            <div className="plan-feed-card__content">
              <span className="semantic-badge instruction">Place {index + 1}</span>
              <h3>{place.title.trim() || 'Place name'}</h3>
              <p>{place.note?.trim() || place.address?.trim() || 'Add notes or purpose for this stop.'}</p>
              <p className="meta">{formatPlanTime(place.time)}</p>
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
    title: place.title,
    note: place.note ?? undefined,
    address: place.addressPublicText ?? undefined,
    time: place.startsAt ? toTimeInputValue(place.startsAt) : undefined,
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
