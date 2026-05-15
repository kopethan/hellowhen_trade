'use client';

import { useRouter } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import type { MediaAssetDto } from '@hellowhen/contracts';
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
  time: string;
  title: string;
  address: string;
  note: string;
  media: MediaAssetDto | null;
  uploading: boolean;
};

function makePlace(index: number): PlaceFormState {
  return {
    id: `place-${Date.now()}-${index}`,
    time: index === 0 ? '13:00' : '',
    title: index === 0 ? 'Meeting point' : '',
    address: '',
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
  const defaultPlanDate = useMemo(() => toDateInputValue(), []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Culture');
  const [locationLabel, setLocationLabel] = useState('Paris');
  const [planDate, setPlanDate] = useState(defaultPlanDate);
  const [places, setPlaces] = useState<PlaceFormState[]>([makePlace(0)]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const schedule = useMemo(() => buildPlanSchedule(planDate, places.filter((place) => place.time.trim())), [planDate, places]);
  const rangeLabel = schedule.startsAt
    ? `${new Date(schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} -> ${new Date(schedule.endsAt || schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
    : '';

  function updatePlace(index: number, update: Partial<PlaceFormState>) {
    setPlaces((current) => current.map((place, placeIndex) => placeIndex === index ? { ...place, ...update } : place));
  }

  function addPlace() {
    setPlaces((current) => [...current, makePlace(current.length)]);
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
    const usablePlaces = places.filter((place) => place.title.trim() && place.time.trim());
    const nextSchedule = buildPlanSchedule(planDate, usablePlaces);
    if (!nextSchedule.startsAt || usablePlaces.length === 0) {
      setError('Add at least one place with a valid time.');
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
        mode: 'local',
        locationLabel: locationLabel.trim() || undefined,
        startsAt: nextSchedule.startsAt,
        endsAt: nextSchedule.endsAt || nextSchedule.startsAt,
        joinApprovalMode: 'automatic',
        status: 'open',
        places: usablePlaces.map((place, index) => ({
          title: place.title,
          note: place.note.trim() || undefined,
          addressPublicText: place.address.trim() || undefined,
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
            <p>Build a simple date-based Plan. Add places in order; the app calculates the full time range automatically.</p>
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
              <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required placeholder="Saturday in Paris" />
            </label>
            <label>
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={2000} required placeholder="Explain what you want to do and who can join." />
            </label>
            <div className="plan-form__row">
              <label>
                <span>Plan date</span>
                <input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} required />
              </label>
              <label>
                <span>City / area</span>
                <input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} maxLength={160} placeholder="Paris" />
              </label>
            </div>
            <label>
              <span>Category</span>
              <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} placeholder="Culture" />
            </label>

            <hr />
            <div className="plan-form__section-title">
              <div>
                <h3>Places</h3>
                <p className="meta">Use times only. If a later place time is earlier than the previous one, it automatically becomes the next day.</p>
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
                <div className="plan-form__row">
                  <label>
                    <span>Time</span>
                    <input type="time" value={place.time} onChange={(event) => updatePlace(index, { time: event.target.value })} required />
                  </label>
                  <label>
                    <span>Place name</span>
                    <input value={place.title} onChange={(event) => updatePlace(index, { title: event.target.value })} minLength={3} maxLength={120} required placeholder="Coffee near République" />
                  </label>
                </div>
                <label>
                  <span>Place address</span>
                  <input value={place.address} onChange={(event) => updatePlace(index, { address: event.target.value })} maxLength={160} placeholder="Address or meeting area" />
                </label>
                <label>
                  <span>Place notes / purpose</span>
                  <textarea value={place.note} onChange={(event) => updatePlace(index, { note: event.target.value })} maxLength={1000} placeholder="What is this stop for?" />
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
              <PlanPreviewDeck title={title} description={description} rangeLabel={rangeLabel} places={places.map((place) => ({ id: place.id, title: place.title, note: place.note, address: place.address, time: place.time, media: place.media }))} />
            </section>

            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <button className="button primary full" type="submit" disabled={saving || places.some((place) => place.uploading)}>{saving ? 'Creating...' : 'Create hidden Plan'}</button>
          </form>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
