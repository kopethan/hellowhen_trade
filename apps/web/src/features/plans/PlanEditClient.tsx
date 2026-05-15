'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import type { MediaAssetDto, PlanDto, PlanPlaceDto, PlanPlaceMode } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { PlanPreviewDeck } from './PlanPreviewDeck';
import { buildPlanSchedule, toDateInputValue, toTimeInputValue } from './planSchedule';
import { planMediaSrc, planMetadata } from './plansPresentation';

type PlaceFormState = {
  id: string;
  placeId?: string;
  mode: PlanPlaceMode;
  date: string;
  time: string;
  title: string;
  location: string;
  note: string;
  existingMedia: MediaAssetDto | null;
  media: MediaAssetDto | null;
  uploading: boolean;
};

function normalizePlanMediaUpload(value: unknown): MediaAssetDto | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { media?: unknown; id?: unknown; url?: unknown };
  if (record.media && typeof record.media === 'object') return record.media as MediaAssetDto;
  if (typeof record.id === 'string' && typeof record.url === 'string') return value as MediaAssetDto;
  return null;
}

function selectedMediaIds(media: MediaAssetDto | null) {
  return media?.id ? [media.id] : undefined;
}

function planModeFromPlaces(places: PlaceFormState[]) {
  const modes = new Set(places.map((place) => place.mode));
  if (modes.size > 1) return 'hybrid' as const;
  return modes.has('remote') ? 'remote' as const : 'local' as const;
}

function rangeLabelFromSchedule(schedule: ReturnType<typeof buildPlanSchedule>) {
  if (!schedule.startsAt) return '';
  return `${new Date(schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} → ${new Date(schedule.endsAt || schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function placeFormFromPlace(place: PlanPlaceDto): PlaceFormState {
  return {
    id: place.id,
    placeId: place.id,
    mode: place.mode ?? 'local',
    date: toDateInputValue(place.startsAt),
    time: toTimeInputValue(place.startsAt),
    title: place.title,
    location: place.addressPublicText ?? '',
    note: place.note ?? '',
    existingMedia: place.media?.[0] ?? null,
    media: null,
    uploading: false,
  };
}

function makeNewPlace(index: number, date = toDateInputValue()): PlaceFormState {
  return {
    id: `new-place-${Date.now()}-${index}`,
    mode: 'local',
    date,
    time: '',
    title: '',
    location: '',
    note: '',
    existingMedia: null,
    media: null,
    uploading: false,
  };
}

function PlaceModeSegment({ value, onChange }: { value: PlanPlaceMode; onChange: (value: PlanPlaceMode) => void }) {
  return (
    <div className="plan-mode-segment" aria-label="Place type">
      <button type="button" className={value === 'local' ? 'is-active' : ''} onClick={() => onChange('local')}>Local</button>
      <button type="button" className={value === 'remote' ? 'is-active' : ''} onClick={() => onChange('remote')}>Remote</button>
    </div>
  );
}

function PlaceImagePicker({ place, onUpload, onRemove }: { place: PlaceFormState; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) {
  const visibleMedia = place.media ?? place.existingMedia;
  return (
    <div className="plan-place-image-picker">
      <label className="image-upload-button">
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={place.uploading || Boolean(visibleMedia)} onChange={onUpload} />
        {place.uploading ? 'Uploading...' : visibleMedia ? 'One image selected' : 'Add place image'}
      </label>
      {visibleMedia ? (
        <figure>
          <img src={planMediaSrc(visibleMedia)} alt={visibleMedia.filename ?? 'Place image'} />
          <figcaption>
            <span className="semantic-badge instruction">1 image</span>
            {place.media ? <button type="button" className="secondary" onClick={onRemove}>Remove new image</button> : <span className="meta">Saved image</span>}
          </figcaption>
        </figure>
      ) : <p className="meta">One image per place for this first version.</p>}
    </div>
  );
}

type PlanEditClientProps = {
  planId: string;
  plansEnabled?: boolean;
  plansVisible?: boolean;
};

export function PlanEditClient({ planId, plansEnabled, plansVisible }: PlanEditClientProps) {
  const router = useRouter();
  const auth = useWebAuth();
  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [places, setPlaces] = useState<PlaceFormState[]>([]);

  const isOwner = Boolean(auth.user?.id && plan?.ownerId === auth.user.id);
  const participantCount = plan?.participantCount ?? 0;
  const usablePlacesForPreview = useMemo(() => places.filter((place) => place.date.trim() && place.time.trim()), [places]);
  const schedule = useMemo(() => buildPlanSchedule(usablePlacesForPreview), [usablePlacesForPreview]);
  const rangeLabel = rangeLabelFromSchedule(schedule);

  function hydrateForm(loadedPlan: PlanDto) {
    setPlan(loadedPlan);
    setTitle(loadedPlan.title);
    setDescription(loadedPlan.description);
    setCategory(loadedPlan.category ?? '');
    const hydratedPlaces = (loadedPlan.places ?? []).map((place) => placeFormFromPlace(place));
    setPlaces(hydratedPlaces.length ? hydratedPlaces : [makeNewPlace(0)]);
  }

  async function loadPlan() {
    setLoading(true);
    setError('');
    try {
      const response = await api.plans.get(planId);
      hydrateForm(response.plan);
    } catch (loadError) {
      setPlan(null);
      setError(getFriendlyApiErrorMessage(loadError, 'Could not load Plan.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth.hydrated) return;
    void loadPlan();
  }, [auth.hydrated, planId]);

  function updatePlace(index: number, update: Partial<PlaceFormState>) {
    setPlaces((current) => current.map((place, placeIndex) => placeIndex === index ? { ...place, ...update } : place));
  }

  function addPlace() {
    setPlaces((current) => {
      const previous = current[current.length - 1];
      return [...current, makeNewPlace(current.length, previous?.date || toDateInputValue())];
    });
  }

  function removeLocalPlace(index: number) {
    setPlaces((current) => {
      const target = current[index];
      if (current.length <= 1 || target?.placeId) return current;
      return current.filter((_, placeIndex) => placeIndex !== index);
    });
  }

  function movePlace(index: number, direction: -1 | 1) {
    setPlaces((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const currentPlace = next[index];
      const targetPlace = next[nextIndex];
      if (!currentPlace || !targetPlace) return current;
      next[index] = targetPlace;
      next[nextIndex] = currentPlace;
      return next;
    });
  }

  async function uploadPlaceImage(index: number, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    updatePlace(index, { uploading: true });
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.media.uploadImage(formData);
      const uploaded = normalizePlanMediaUpload(response);
      if (uploaded) updatePlace(index, { media: uploaded });
      setMessage('Place image uploaded. Save changes to attach it.');
    } catch (uploadError) {
      setError(getFriendlyApiErrorMessage(uploadError, 'Could not upload place image.'));
    } finally {
      updatePlace(index, { uploading: false });
    }
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner) return;
    const usablePlaces = places.filter((place) => place.title.trim() && place.date.trim() && place.time.trim());
    const nextSchedule = buildPlanSchedule(usablePlaces);
    if (nextSchedule.error || !nextSchedule.startsAt || usablePlaces.length === 0) {
      setError(nextSchedule.error || 'Add at least one place with a valid date and time.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.plans.update(planId, {
        title,
        description,
        category: category.trim() || null,
        mode: planModeFromPlaces(usablePlaces),
        locationLabel: null,
        startsAt: nextSchedule.startsAt,
        endsAt: nextSchedule.endsAt || nextSchedule.startsAt,
        maxParticipants: null,
        joinApprovalMode: 'automatic',
        status: 'open',
      });
      let latestPlan = response.plan;
      for (const [index, place] of usablePlaces.entries()) {
        const body = {
          mode: place.mode,
          title: place.title,
          note: place.note.trim() || undefined,
          addressPublicText: place.location.trim() || undefined,
          startsAt: nextSchedule.placeStartsAt[index],
          order: index,
          mediaIds: selectedMediaIds(place.media),
        };
        const placeResponse = place.placeId
          ? await api.plans.updatePlace(planId, place.placeId, body)
          : await api.plans.createPlace(planId, body);
        latestPlan = placeResponse.plan;
      }
      hydrateForm(latestPlan);
      setMessage('Plan updated.');
      router.refresh();
    } catch (saveError) {
      setError(getFriendlyApiErrorMessage(saveError, 'Could not update Plan.'));
    } finally {
      setSaving(false);
    }
  }

  async function cancelPlan() {
    if (!isOwner) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.plans.update(planId, { status: 'cancelled' });
      hydrateForm(response.plan);
      setMessage('Plan cancelled.');
      router.refresh();
    } catch (cancelError) {
      setError(getFriendlyApiErrorMessage(cancelError, 'Could not cancel Plan.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page">
        <section className="page-intro">
          <div>
            <PlansInternalBadge plansVisible={plansVisible} />
            <h2>Edit Plan</h2>
            <p>{plan ? planMetadata(plan) : 'Owner-only hidden Plan editor.'}</p>
          </div>
          <Link className="button secondary page-intro__action" href={`/plans/${planId}`}>Detail</Link>
        </section>

        {!auth.hydrated || loading ? <section className="mobile-card"><p className="meta">Loading Plan...</p></section> : null}
        {error ? <section className="mobile-card mobile-card--soft"><p>{error}</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <h3>Log in required</h3>
            <p>Use an internal owner account to edit this hidden Plan.</p>
            <Link className="button primary" href={`/auth?next=/plans/${planId}/edit`}>Log in</Link>
          </section>
        ) : null}
        {plan && auth.isAuthenticated && !isOwner ? (
          <section className="mobile-card mobile-card--soft">
            <h3>Owner only</h3>
            <p>Only the Plan owner can edit hidden Plan details and places.</p>
            <Link className="button secondary" href={`/plans/${planId}`}>Back to Plan</Link>
          </section>
        ) : null}

        {plan && isOwner ? (
          <form className="mobile-card plan-form" onSubmit={savePlan}>
            {participantCount > 0 ? (
              <section className="notice-box info">
                <strong>{participantCount} participant{participantCount === 1 ? '' : 's'} joined.</strong> Keep date, link, address, and place changes clear while testing instant join.
              </section>
            ) : null}

            <h3>Plan details</h3>
            <label>
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required />
            </label>
            <label>
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={2000} required />
            </label>
            <label>
              <span>Category</span>
              <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} />
            </label>

            <hr />
            <div className="plan-form__section-title">
              <div>
                <h3>Places</h3>
                <p className="meta">Move places with buttons. Each place has its own Local/Remote type, date, and time.</p>
              </div>
            </div>

            {places.map((place, index) => (
              <section className="plan-place-editor" key={place.id}>
                <div className="plan-place-editor__header">
                  <span className="semantic-badge instruction">Place {index + 1}</span>
                  <div className="cta-row">
                    <button type="button" className="button secondary" disabled={index === 0} onClick={() => movePlace(index, -1)}>Move up</button>
                    <button type="button" className="button secondary" disabled={index === places.length - 1} onClick={() => movePlace(index, 1)}>Move down</button>
                  </div>
                </div>
                <PlaceModeSegment value={place.mode} onChange={(mode) => updatePlace(index, { mode, location: '' })} />
                <div className="plan-form__row">
                  <label>
                    <span>Date</span>
                    <input type="date" value={place.date} onChange={(event) => updatePlace(index, { date: event.target.value })} required />
                  </label>
                  <label>
                    <span>Time</span>
                    <input type="time" value={place.time} onChange={(event) => updatePlace(index, { time: event.target.value })} required />
                  </label>
                </div>
                <label>
                  <span>Place name</span>
                  <input value={place.title} onChange={(event) => updatePlace(index, { title: event.target.value })} minLength={3} maxLength={120} required />
                </label>
                <label>
                  <span>{place.mode === 'remote' ? 'Online link or instructions' : 'Address or meeting point'}</span>
                  <input value={place.location} onChange={(event) => updatePlace(index, { location: event.target.value })} maxLength={240} placeholder={place.mode === 'remote' ? 'Zoom, Google Meet, Discord, website, or instructions' : 'Search or enter an address'} />
                </label>
                <label>
                  <span>Place notes / purpose</span>
                  <textarea value={place.note} onChange={(event) => updatePlace(index, { note: event.target.value })} maxLength={1000} />
                </label>
                <PlaceImagePicker
                  place={place}
                  onUpload={(event) => { const files = event.target.files; event.currentTarget.value = ''; void uploadPlaceImage(index, files); }}
                  onRemove={() => updatePlace(index, { media: null })}
                />
                {!place.placeId && places.length > 1 ? <button type="button" className="button secondary full" onClick={() => removeLocalPlace(index)}>Remove place</button> : null}
              </section>
            ))}

            <button type="button" className="button secondary full" onClick={addPlace}>+ Add another place</button>

            <hr />
            <section className="plan-form__preview">
              <h3>Feed deck preview</h3>
              <PlanPreviewDeck title={title} description={description} rangeLabel={rangeLabel} places={places.map((place) => ({ id: place.id, mode: place.mode, title: place.title, note: place.note, location: place.location, date: place.date, time: place.time, media: place.media ?? place.existingMedia }))} />
            </section>

            {schedule.error ? <p className="form-error">{schedule.error}</p> : null}
            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <button className="button primary full" type="submit" disabled={saving || places.some((place) => place.uploading)}>{saving ? 'Saving...' : 'Save Plan'}</button>
            <button className="button secondary full" type="button" disabled={saving} onClick={cancelPlan}>Cancel Plan</button>
          </form>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
