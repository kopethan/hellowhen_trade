'use client';

import { useRouter } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import type { MediaAssetDto, PlanPlaceMode } from '@hellowhen/contracts';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { PlanPreviewDeck } from './PlanPreviewDeck';
import { buildPlanSchedule, toDateInputValue } from './planSchedule';
import { planMediaSrc } from './plansPresentation';

type PlaceFormState = {
  id: string;
  mode: PlanPlaceMode;
  date: string;
  time: string;
  title: string;
  location: string;
  note: string;
  media: MediaAssetDto | null;
  uploading: boolean;
};

function makePlace(index: number, date = toDateInputValue()): PlaceFormState {
  return {
    id: `place-${Date.now()}-${index}`,
    mode: 'local',
    date,
    time: index === 0 ? '13:00' : '',
    title: index === 0 ? 'Meeting point' : '',
    location: '',
    note: '',
    media: null,
    uploading: false,
  };
}

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
  return `${new Date(schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} -> ${new Date(schedule.endsAt || schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
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
  return (
    <div className="plan-place-image-picker">
      <label className="image-upload-button">
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={place.uploading || Boolean(place.media)} onChange={onUpload} />
        {place.uploading ? 'Uploading...' : place.media ? 'One image selected' : 'Add place image'}
      </label>
      {place.media ? (
        <figure>
          <img src={planMediaSrc(place.media)} alt={place.media.filename ?? 'Place image'} />
          <figcaption>
            <span className="semantic-badge instruction">1 image</span>
            <button type="button" className="secondary" onClick={onRemove}>Remove</button>
          </figcaption>
        </figure>
      ) : <p className="meta">One image per place for this first version.</p>}
    </div>
  );
}

type PlanCreateClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
};

export function PlanCreateClient({ plansEnabled, plansVisible }: PlanCreateClientProps) {
  const router = useRouter();
  const auth = useWebAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Culture');
  const [places, setPlaces] = useState<PlaceFormState[]>([makePlace(0)]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const usablePlacesForPreview = useMemo(() => places.filter((place) => place.date.trim() && place.time.trim()), [places]);
  const schedule = useMemo(() => buildPlanSchedule(usablePlacesForPreview), [usablePlacesForPreview]);
  const rangeLabel = rangeLabelFromSchedule(schedule);

  function updatePlace(index: number, update: Partial<PlaceFormState>) {
    setPlaces((current) => current.map((place, placeIndex) => placeIndex === index ? { ...place, ...update } : place));
  }

  function addPlace() {
    setPlaces((current) => {
      const previous = current[current.length - 1];
      return [...current, makePlace(current.length, previous?.date || toDateInputValue())];
    });
  }

  function removePlace(index: number) {
    setPlaces((current) => current.length <= 1 ? current : current.filter((_, placeIndex) => placeIndex !== index));
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
      setMessage('Place image uploaded.');
    } catch (uploadError) {
      setError(getFriendlyApiErrorMessage(uploadError, 'Could not upload place image.'));
    } finally {
      updatePlace(index, { uploading: false });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.isAuthenticated) {
      router.push('/auth?next=/plans/new');
      return;
    }
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
      const response = await api.plans.create({
        title,
        description,
        category: category.trim() || undefined,
        mode: planModeFromPlaces(usablePlaces),
        startsAt: nextSchedule.startsAt,
        endsAt: nextSchedule.endsAt || nextSchedule.startsAt,
        joinApprovalMode: 'automatic',
        status: 'open',
        places: usablePlaces.map((place, index) => ({
          mode: place.mode,
          title: place.title,
          note: place.note.trim() || undefined,
          addressPublicText: place.location.trim() || undefined,
          startsAt: nextSchedule.placeStartsAt[index],
          order: index,
          mediaIds: selectedMediaIds(place.media),
        })),
      });
      router.replace(`/plans/${response.plan.id}`);
    } catch (saveError) {
      setError(getFriendlyApiErrorMessage(saveError, 'Could not create Plan.'));
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
            <h2>Create Plan</h2>
            <p>Add places with their own Local/Remote type, date, time, and one image. The feed deck is previewed below.</p>
          </div>
        </section>

        {!auth.hydrated ? <section className="mobile-card"><p className="meta">Checking session...</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <h3>Log in required</h3>
            <p>Use a demo or internal account to create hidden Plans.</p>
            <button type="button" className="button primary" onClick={() => router.push('/auth?next=/plans/new')}>Log in</button>
          </section>
        ) : null}

        {auth.isAuthenticated ? (
          <form className="mobile-card plan-form" onSubmit={submit}>
            <label>
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required placeholder="Saturday museum route" />
            </label>
            <label>
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={2000} required placeholder="Explain the whole plan and who can join." />
            </label>
            <label>
              <span>Category</span>
              <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} placeholder="Culture" />
            </label>

            <hr />
            <div className="plan-form__section-title">
              <div>
                <h3>Places</h3>
                <p className="meta">Each place has its own date/time. New places copy the previous date, and the saved range follows the ordered places.</p>
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
                  <input value={place.title} onChange={(event) => updatePlace(index, { title: event.target.value })} minLength={3} maxLength={120} required placeholder={place.mode === 'remote' ? 'Planning call' : 'Coffee meeting point'} />
                </label>
                <label>
                  <span>{place.mode === 'remote' ? 'Online link or instructions' : 'Address or meeting point'}</span>
                  <input value={place.location} onChange={(event) => updatePlace(index, { location: event.target.value })} maxLength={240} placeholder={place.mode === 'remote' ? 'Zoom, Google Meet, Discord, website, or instructions' : 'Search or enter an address'} />
                </label>
                <label>
                  <span>Place notes / purpose</span>
                  <textarea value={place.note} onChange={(event) => updatePlace(index, { note: event.target.value })} maxLength={1000} placeholder="Why this stop matters or what people should know." />
                </label>
                <PlaceImagePicker
                  place={place}
                  onUpload={(event) => { const files = event.target.files; event.currentTarget.value = ''; void uploadPlaceImage(index, files); }}
                  onRemove={() => updatePlace(index, { media: null })}
                />
                {places.length > 1 ? <button type="button" className="button secondary full" onClick={() => removePlace(index)}>Remove place</button> : null}
              </section>
            ))}

            <button type="button" className="button secondary full" onClick={addPlace}>+ Add another place</button>

            <hr />
            <section className="plan-form__preview">
              <h3>Feed deck preview</h3>
              <PlanPreviewDeck title={title} description={description} rangeLabel={rangeLabel} places={places.map((place) => ({ id: place.id, mode: place.mode, title: place.title, note: place.note, location: place.location, date: place.date, time: place.time, media: place.media }))} />
            </section>

            {schedule.error ? <p className="form-error">{schedule.error}</p> : null}
            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <button className="button primary full" type="submit" disabled={saving || places.some((place) => place.uploading)}>{saving ? 'Creating...' : 'Create hidden Plan'}</button>
          </form>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
