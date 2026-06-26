'use client';

import { useRouter } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import type { MediaAssetDto, PlaceDto, PlanPlaceMode } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { PlanPreviewDeck } from './PlanPreviewDeck';
import { buildPlanSchedule, toDateInputValue } from './planSchedule';
import { planMediaSrc, planPlaceModeLabel } from './plansPresentation';

type PlaceFormState = {
  id: string;
  sourcePlaceId?: string;
  sourcePlaceSource?: 'custom' | 'my_place' | 'hellowhen_library';
  sourcePlaceTitle?: string;
  mode: PlanPlaceMode;
  date: string;
  time: string;
  title: string;
  location: string;
  onlineLabel: string;
  onlineUrl: string;
  note: string;
  existingMedia: MediaAssetDto | null;
  media: MediaAssetDto | null;
  uploading: boolean;
};

type NewReusablePlaceState = {
  mode: PlanPlaceMode;
  title: string;
  description: string;
  category: string;
  location: string;
  onlineLabel: string;
  onlineUrl: string;
  note: string;
};

function makePlace(index: number, date = toDateInputValue()): PlaceFormState {
  return {
    id: `place-${Date.now()}-${index}`,
    sourcePlaceSource: 'custom',
    mode: 'local',
    date,
    time: index === 0 ? '13:00' : '',
    title: index === 0 ? 'Meeting point' : '',
    location: '',
    onlineLabel: '',
    onlineUrl: '',
    note: '',
    existingMedia: null,
    media: null,
    uploading: false,
  };
}

function makeNewReusablePlace(): NewReusablePlaceState {
  return {
    mode: 'local',
    title: '',
    description: '',
    category: '',
    location: '',
    onlineLabel: '',
    onlineUrl: '',
    note: '',
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
  return `${new Date(schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} → ${new Date(schedule.endsAt || schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function placeSourceLabel(place: PlaceDto) {
  return place.source === 'hellowhen_library' ? 'hellowhen library' : 'my place';
}

function libraryPlaceSource(place: PlaceDto): PlaceFormState['sourcePlaceSource'] {
  return place.source === 'hellowhen_library' ? 'hellowhen_library' : 'my_place';
}

function placeLocationForForm(place: PlaceDto) {
  return place.mode === 'remote' ? '' : place.addressPublicText ?? place.areaLabel ?? '';
}

function placePreviewLocation(place: PlaceFormState) {
  if (place.mode === 'remote') return place.onlineLabel.trim() || place.onlineUrl.trim() || place.location.trim();
  return place.location.trim();
}

function applyReusablePlacePatch(place: PlaceDto): Partial<PlaceFormState> {
  return {
    sourcePlaceId: place.id,
    sourcePlaceSource: libraryPlaceSource(place),
    sourcePlaceTitle: place.title,
    mode: place.mode ?? 'local',
    title: place.title,
    location: placeLocationForForm(place),
    onlineLabel: place.onlineLabel ?? '',
    onlineUrl: place.onlineUrl ?? '',
    note: place.defaultNote ?? place.description ?? '',
    existingMedia: place.media?.[0] ?? null,
    media: null,
  };
}

function resetToCustomPatch(): Partial<PlaceFormState> {
  return {
    sourcePlaceId: undefined,
    sourcePlaceSource: 'custom',
    sourcePlaceTitle: undefined,
    existingMedia: null,
  };
}

function filterPlaces(places: PlaceDto[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return places;
  return places.filter((place) => [place.title, place.description, place.category, place.areaLabel, place.addressPublicText, place.onlineLabel]
    .some((value) => value?.toLowerCase().includes(normalized)));
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
            {place.media ? <button type="button" className="secondary" onClick={onRemove}>Remove new image</button> : <span className="meta">Saved place image</span>}
          </figcaption>
        </figure>
      ) : <p className="meta">One image per place for this first version.</p>}
    </div>
  );
}

function PlacePickerList({
  places,
  emptyLabel,
  onChoose,
}: {
  places: PlaceDto[];
  emptyLabel: string;
  onChoose: (place: PlaceDto) => void;
}) {
  if (!places.length) return <p className="meta">{emptyLabel}</p>;
  return (
    <div className="plan-place-picker-list">
      {places.map((place) => {
        const media = place.media?.[0] ?? null;
        const meta = [planPlaceModeLabel(place.mode), place.category, place.areaLabel || place.addressPublicText || place.onlineLabel]
          .filter((value): value is string => Boolean(value && value.trim()))
          .join(' · ');
        return (
          <button type="button" className="plan-place-picker-card" key={place.id} onClick={() => onChoose(place)}>
            <span className="plan-place-picker-card__media">
              {media ? <img src={planMediaSrc(media)} alt={media.filename ?? place.title} /> : '⌖'}
            </span>
            <span className="plan-place-picker-card__body">
              <strong>{place.title}</strong>
              <small>{meta || placeSourceLabel(place)}</small>
              {place.description ? <span>{place.description}</span> : null}
            </span>
            <span className="semantic-badge instruction">Use</span>
          </button>
        );
      })}
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
  const [myPlaces, setMyPlaces] = useState<PlaceDto[]>([]);
  const [libraryPlaces, setLibraryPlaces] = useState<PlaceDto[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [pickerOpenForIndex, setPickerOpenForIndex] = useState<number | null>(null);
  const [pickerTab, setPickerTab] = useState<'mine' | 'library'>('mine');
  const [placeQuery, setPlaceQuery] = useState('');
  const [createPlaceOpen, setCreatePlaceOpen] = useState(false);
  const [newReusablePlace, setNewReusablePlace] = useState<NewReusablePlaceState>(makeNewReusablePlace());
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const usablePlacesForPreview = useMemo(() => places.filter((place) => place.date.trim() && place.time.trim()), [places]);
  const schedule = useMemo(() => buildPlanSchedule(usablePlacesForPreview), [usablePlacesForPreview]);
  const rangeLabel = rangeLabelFromSchedule(schedule);
  const filteredMyPlaces = useMemo(() => filterPlaces(myPlaces, placeQuery), [myPlaces, placeQuery]);
  const filteredLibraryPlaces = useMemo(() => filterPlaces(libraryPlaces, placeQuery), [libraryPlaces, placeQuery]);

  async function loadReusablePlaces() {
    setLoadingPlaces(true);
    try {
      const [mineResponse, libraryResponse] = await Promise.all([
        api.places.mine({ take: 100 }),
        api.places.library({ take: 100 }),
      ]);
      setMyPlaces(mineResponse.places);
      setLibraryPlaces(libraryResponse.places);
    } catch (loadError) {
      setError(getFriendlyApiErrorMessage(loadError, 'Could not load Place Library. You can still add custom places.'));
    } finally {
      setLoadingPlaces(false);
    }
  }

  useEffect(() => {
    if (!auth.hydrated || !auth.isAuthenticated) return;
    void loadReusablePlaces();
  }, [auth.hydrated, auth.isAuthenticated]);

  function updatePlace(index: number, update: Partial<PlaceFormState>) {
    setPlaces((current) => current.map((place, placeIndex) => placeIndex === index ? { ...place, ...update } : place));
  }

  function addPlace() {
    setPlaces((current) => {
      const previous = current[current.length - 1];
      return [...current, makePlace(current.length, previous?.date || toDateInputValue())];
    });
  }

  function addPlaceAndOpenPicker() {
    const nextIndex = places.length;
    const previous = places[places.length - 1];
    setPlaces((current) => [...current, makePlace(nextIndex, previous?.date || toDateInputValue())]);
    setPickerOpenForIndex(nextIndex);
    setPickerTab(myPlaces.length ? 'mine' : 'library');
    setCreatePlaceOpen(false);
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

  function openPicker(index: number) {
    setPickerOpenForIndex(index);
    setPickerTab(myPlaces.length ? 'mine' : 'library');
    setCreatePlaceOpen(false);
    setPlaceQuery('');
  }

  function chooseReusablePlace(place: PlaceDto) {
    const index = pickerOpenForIndex;
    if (index === null) return;
    updatePlace(index, applyReusablePlacePatch(place));
    setPickerOpenForIndex(null);
    setCreatePlaceOpen(false);
    setMessage(`Added ${place.title} from ${placeSourceLabel(place)}.`);
  }

  async function createReusablePlaceForPicker() {
    const index = pickerOpenForIndex;
    if (index === null) return;
    setCreatingPlace(true);
    setError('');
    setMessage('');
    try {
      const response = await api.places.create({
        mode: newReusablePlace.mode,
        title: newReusablePlace.title,
        description: newReusablePlace.description.trim() || undefined,
        category: newReusablePlace.category.trim() || undefined,
        visibility: 'private',
        status: 'active',
        addressPublicText: newReusablePlace.mode === 'local' ? newReusablePlace.location.trim() || undefined : undefined,
        onlineLabel: newReusablePlace.mode === 'remote' ? newReusablePlace.onlineLabel.trim() || undefined : undefined,
        onlineUrl: newReusablePlace.mode === 'remote' ? newReusablePlace.onlineUrl.trim() || undefined : undefined,
        defaultNote: newReusablePlace.note.trim() || undefined,
      });
      setMyPlaces((current) => [response.place, ...current.filter((place) => place.id !== response.place.id)]);
      updatePlace(index, applyReusablePlacePatch(response.place));
      setCreatePlaceOpen(false);
      setPickerOpenForIndex(null);
      setNewReusablePlace(makeNewReusablePlace());
      setMessage('Place saved and added to this Plan.');
    } catch (createError) {
      setError(getFriendlyApiErrorMessage(createError, 'Could not create Place.'));
    } finally {
      setCreatingPlace(false);
    }
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
      if (uploaded) updatePlace(index, { media: uploaded, existingMedia: null });
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
          placeId: place.sourcePlaceId,
          mode: place.mode,
          title: place.title,
          note: place.note.trim() || undefined,
          addressPublicText: place.mode === 'local' ? place.location.trim() || undefined : undefined,
          onlineLabel: place.mode === 'remote' ? place.onlineLabel.trim() || place.location.trim() || undefined : undefined,
          onlineUrl: place.mode === 'remote' ? place.onlineUrl.trim() || undefined : undefined,
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

  const activePickerPlace = pickerOpenForIndex === null ? null : places[pickerOpenForIndex] ?? null;

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page">
        <section className="page-intro plan-create-intro">
          <div>
            <PlansInternalBadge plansVisible={plansVisible} />
            <h2>Create Plan</h2>
            <p>Choose reusable Places, arrange them in order and time, or add one-off custom stops. Places stay independent from Trade, Needs, Offers, Agenda, and payments.</p>
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
                <p className="meta">Pick from My Places or Hellowhen Place Library, then adjust order and time for this Plan.</p>
              </div>
              <div className="cta-row">
                <button type="button" className="button secondary" onClick={addPlaceAndOpenPicker}>+ From library</button>
                <button type="button" className="button secondary" onClick={addPlace}>+ Custom</button>
              </div>
            </div>

            {loadingPlaces ? <p className="meta">Loading reusable Places...</p> : null}

            {places.map((place, index) => (
              <section className="plan-place-editor" key={place.id}>
                <div className="plan-place-editor__header">
                  <span className="semantic-badge instruction">Place {index + 1}</span>
                  <div className="cta-row">
                    <button type="button" className="button secondary" onClick={() => openPicker(index)}>Choose saved place</button>
                    <button type="button" className="button secondary" disabled={index === 0} onClick={() => movePlace(index, -1)}>Move up</button>
                    <button type="button" className="button secondary" disabled={index === places.length - 1} onClick={() => movePlace(index, 1)}>Move down</button>
                  </div>
                </div>
                {place.sourcePlaceId ? (
                  <div className="plan-source-place-strip">
                    <span className="semantic-badge success">{place.sourcePlaceSource === 'hellowhen_library' ? 'Library Place' : 'My Place'}</span>
                    <p>{place.sourcePlaceTitle || place.title}</p>
                    <button type="button" className="button secondary" onClick={() => updatePlace(index, resetToCustomPatch())}>Use as custom</button>
                  </div>
                ) : null}
                <PlaceModeSegment value={place.mode} onChange={(mode) => updatePlace(index, { mode, location: mode === 'remote' ? '' : place.location })} />
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
                {place.mode === 'remote' ? (
                  <div className="plan-form__row">
                    <label>
                      <span>Online label</span>
                      <input value={place.onlineLabel} onChange={(event) => updatePlace(index, { onlineLabel: event.target.value })} maxLength={120} placeholder="Zoom, Discord, website, livestream" />
                    </label>
                    <label>
                      <span>Online URL</span>
                      <input type="url" value={place.onlineUrl} onChange={(event) => updatePlace(index, { onlineUrl: event.target.value })} maxLength={500} placeholder="https://..." />
                    </label>
                  </div>
                ) : (
                  <label>
                    <span>Address or meeting point</span>
                    <input value={place.location} onChange={(event) => updatePlace(index, { location: event.target.value })} maxLength={240} placeholder="Search or enter an address" />
                  </label>
                )}
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

            <hr />
            <section className="plan-form__preview">
              <h3>Feed deck preview</h3>
              <div className="trade-create-preview__deck">
                <PlanPreviewDeck
                  title={title}
                  description={description}
                  rangeLabel={rangeLabel}
                  places={places.map((place) => ({ id: place.id, mode: place.mode, title: place.title, note: place.note, location: placePreviewLocation(place), date: place.date, time: place.time, media: place.media ?? place.existingMedia }))}
                  className="trade-stack-deck--create-preview"
                />
              </div>
            </section>

            {schedule.error ? <p className="form-error">{schedule.error}</p> : null}
            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <button className="button primary full" type="submit" disabled={saving || creatingPlace || places.some((place) => place.uploading)}>{saving ? 'Creating...' : 'Create hidden Plan'}</button>
          </form>
        ) : null}

        {activePickerPlace ? (
          <section className="mobile-card plan-place-picker-panel" aria-label="Place picker">
            <div className="plan-detail-topbar">
              <div>
                <h3>Choose Place {pickerOpenForIndex !== null ? pickerOpenForIndex + 1 : ''}</h3>
                <p className="meta">Saved Places are copied as snapshots into this Plan.</p>
              </div>
              <button type="button" className="plans-feed-icon-button" onClick={() => setPickerOpenForIndex(null)} aria-label="Close Place picker">×</button>
            </div>
            <div className="plans-tabs" role="tablist" aria-label="Place Library source">
              <button type="button" className={pickerTab === 'mine' ? 'is-active' : ''} onClick={() => setPickerTab('mine')}>My Places</button>
              <button type="button" className={pickerTab === 'library' ? 'is-active' : ''} onClick={() => setPickerTab('library')}>Hellowhen Library</button>
            </div>
            <label>
              <span>Search Places</span>
              <input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="Search title, category, area..." />
            </label>
            {pickerTab === 'mine' ? (
              <PlacePickerList places={filteredMyPlaces} emptyLabel="No matching My Places yet. Create one below or use a custom place." onChoose={chooseReusablePlace} />
            ) : (
              <PlacePickerList places={filteredLibraryPlaces} emptyLabel="No matching Hellowhen Library Places yet." onChoose={chooseReusablePlace} />
            )}
            <button type="button" className="button secondary full" onClick={() => setCreatePlaceOpen((current) => !current)}>
              {createPlaceOpen ? 'Hide create place' : '+ Create My Place'}
            </button>
            {createPlaceOpen ? (
              <div className="plan-create-place-box">
                <h4>Create My Place</h4>
                <PlaceModeSegment value={newReusablePlace.mode} onChange={(mode) => setNewReusablePlace((current) => ({ ...current, mode }))} />
                <label>
                  <span>Place name</span>
                  <input value={newReusablePlace.title} onChange={(event) => setNewReusablePlace((current) => ({ ...current, title: event.target.value }))} minLength={3} maxLength={120} required placeholder="Quiet coffee near République" />
                </label>
                <div className="plan-form__row">
                  <label>
                    <span>Category</span>
                    <input value={newReusablePlace.category} onChange={(event) => setNewReusablePlace((current) => ({ ...current, category: event.target.value }))} maxLength={80} placeholder="Culture, Work, Food..." />
                  </label>
                  {newReusablePlace.mode === 'local' ? (
                    <label>
                      <span>Area / address</span>
                      <input value={newReusablePlace.location} onChange={(event) => setNewReusablePlace((current) => ({ ...current, location: event.target.value }))} maxLength={240} placeholder="Paris 11 or meeting point" />
                    </label>
                  ) : (
                    <label>
                      <span>Online label</span>
                      <input value={newReusablePlace.onlineLabel} onChange={(event) => setNewReusablePlace((current) => ({ ...current, onlineLabel: event.target.value }))} maxLength={120} placeholder="Zoom, Discord, website" />
                    </label>
                  )}
                </div>
                {newReusablePlace.mode === 'remote' ? (
                  <label>
                    <span>Online URL</span>
                    <input type="url" value={newReusablePlace.onlineUrl} onChange={(event) => setNewReusablePlace((current) => ({ ...current, onlineUrl: event.target.value }))} maxLength={500} placeholder="https://..." />
                  </label>
                ) : null}
                <label>
                  <span>Description</span>
                  <textarea value={newReusablePlace.description} onChange={(event) => setNewReusablePlace((current) => ({ ...current, description: event.target.value }))} maxLength={2000} placeholder="Reusable place description." />
                </label>
                <label>
                  <span>Default note</span>
                  <textarea value={newReusablePlace.note} onChange={(event) => setNewReusablePlace((current) => ({ ...current, note: event.target.value }))} maxLength={1000} placeholder="What this place is good for." />
                </label>
                <div className="cta-row">
                  <button type="button" className="button secondary" onClick={() => setNewReusablePlace(makeNewReusablePlace())}>Reset</button>
                  <button type="button" className="button primary" disabled={creatingPlace || !newReusablePlace.title.trim()} onClick={() => void createReusablePlaceForPicker()}>{creatingPlace ? 'Saving...' : 'Save and use Place'}</button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
