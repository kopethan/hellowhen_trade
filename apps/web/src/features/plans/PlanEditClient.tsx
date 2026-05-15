'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import type { MediaAssetDto, PlanDto, PlanPlaceDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { planDateTime, planMediaSrc, planMetadata } from './plansPresentation';

type PlanStatusForm = 'draft' | 'open' | 'cancelled';
type PlanModeForm = 'local' | 'remote' | 'hybrid';

type PlaceFormState = {
  title: string;
  note: string;
  addressPublicText: string;
  addressPrivateText: string;
  startsAt: string;
  order: string;
  media: MediaAssetDto[];
  uploading: boolean;
  saving: boolean;
  message: string;
  error: string;
};

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

function selectedMediaIds(media: MediaAssetDto[]) {
  return media.map((item) => item.id);
}

function normalizePlanMediaUpload(value: unknown): MediaAssetDto | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { media?: unknown; id?: unknown; url?: unknown };
  if (record.media && typeof record.media === 'object') return record.media as MediaAssetDto;
  if (typeof record.id === 'string' && typeof record.url === 'string') return value as MediaAssetDto;
  return null;
}

function placeFormFromPlace(place?: PlanPlaceDto | null): PlaceFormState {
  return {
    title: place?.title ?? '',
    note: place?.note ?? '',
    addressPublicText: place?.addressPublicText ?? '',
    addressPrivateText: place?.addressPrivateText ?? '',
    startsAt: toDateTimeLocalValue(place?.startsAt),
    order: String(place?.order ?? 0),
    media: [],
    uploading: false,
    saving: false,
    message: '',
    error: '',
  };
}

function PlanMediaGallery({ media, label }: { media?: MediaAssetDto[]; label: string }) {
  const visibleMedia = media ?? [];
  if (!visibleMedia.length) return null;

  return (
    <section className="plan-image-picker plan-image-picker--compact">
      <p className="eyebrow">Current {label}</p>
      <div className="plan-media-gallery">
        {visibleMedia.map((item) => (
          <img key={item.id} src={planMediaSrc(item)} alt={item.filename ?? `${label} image`} loading="lazy" />
        ))}
      </div>
    </section>
  );
}

type UploadPickerProps = {
  title: string;
  helper: string;
  media: MediaAssetDto[];
  uploading: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (mediaId: string) => void;
};

function UploadPicker({ title, helper, media, uploading, onUpload, onRemove }: UploadPickerProps) {
  return (
    <section className="plan-image-picker">
      <div>
        <p className="eyebrow">New images</p>
        <h3>{title}</h3>
        <p>{helper}</p>
      </div>
      <label className="image-upload-button">
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || media.length >= 5} onChange={onUpload} />
        {uploading ? 'Uploading...' : media.length >= 5 ? 'Image limit reached' : 'Upload images'}
      </label>
      {media.length ? (
        <div className="plan-media-grid">
          {media.map((item) => (
            <figure key={item.id}>
              <img src={planMediaSrc(item)} alt={item.filename ?? 'Uploaded Plan image'} />
              <figcaption>
                <span className="semantic-badge instruction">new</span>
                <button type="button" className="secondary" onClick={() => onRemove(item.id)}>Remove</button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PlaceEditor({
  planId,
  place,
  onSaved,
}: {
  planId: string;
  place: PlanPlaceDto;
  onSaved: (plan: PlanDto) => void;
}) {
  const [form, setForm] = useState<PlaceFormState>(() => placeFormFromPlace(place));

  useEffect(() => {
    setForm(placeFormFromPlace(place));
  }, [place.id]);

  function updateForm(update: Partial<PlaceFormState>) {
    setForm((current) => ({ ...current, ...update }));
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    updateForm({ uploading: true, error: '', message: '' });
    try {
      const nextMedia = [...form.media];
      for (const file of Array.from(files).slice(0, Math.max(0, 5 - nextMedia.length))) {
        const formData = new FormData();
        formData.append('image', file);
        const response = await api.media.uploadImage(formData);
        const uploaded = normalizePlanMediaUpload(response);
        if (uploaded) nextMedia.push(uploaded);
      }
      updateForm({ media: nextMedia.slice(0, 5), message: 'Place image uploaded.' });
    } catch (uploadError) {
      updateForm({ error: getFriendlyApiErrorMessage(uploadError, 'Could not upload place image.') });
    } finally {
      updateForm({ uploading: false });
    }
  }

  async function savePlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateForm({ saving: true, error: '', message: '' });
    try {
      const response = await api.plans.updatePlace(planId, place.id, {
        title: form.title,
        note: form.note.trim() || undefined,
        addressPublicText: form.addressPublicText.trim() || undefined,
        addressPrivateText: form.addressPrivateText.trim() || undefined,
        startsAt: form.startsAt ? toIsoDateTime(form.startsAt) : undefined,
        order: form.order ? Number(form.order) : undefined,
        mediaIds: selectedMediaIds(form.media),
      });
      updateForm({ media: [], message: 'Place updated.' });
      onSaved(response.plan);
    } catch (saveError) {
      updateForm({ error: getFriendlyApiErrorMessage(saveError, 'Could not update place.') });
    } finally {
      updateForm({ saving: false });
    }
  }

  return (
    <form className="plan-place-editor" onSubmit={savePlace}>
      <div>
        <span className="semantic-badge instruction">Stop {place.order + 1}</span>
        <h4>{place.title}</h4>
      </div>
      <label>
        <span>Place title</span>
        <input value={form.title} onChange={(event) => updateForm({ title: event.target.value })} minLength={3} maxLength={120} required />
      </label>
      <label>
        <span>Public note</span>
        <textarea value={form.note} onChange={(event) => updateForm({ note: event.target.value })} maxLength={1000} />
      </label>
      <div className="plan-form__row">
        <label>
          <span>Public area</span>
          <input value={form.addressPublicText} onChange={(event) => updateForm({ addressPublicText: event.target.value })} maxLength={160} />
        </label>
        <label>
          <span>Private exact detail</span>
          <input value={form.addressPrivateText} onChange={(event) => updateForm({ addressPrivateText: event.target.value })} maxLength={240} />
        </label>
      </div>
      <div className="plan-form__row">
        <label>
          <span>Starts at</span>
          <input type="datetime-local" value={form.startsAt} onChange={(event) => updateForm({ startsAt: event.target.value })} />
        </label>
        <label>
          <span>Order</span>
          <input type="number" min={0} max={50} value={form.order} onChange={(event) => updateForm({ order: event.target.value })} />
        </label>
      </div>
      <PlanMediaGallery media={place.media} label="place images" />
      <UploadPicker
        title={form.media.length ? `${form.media.length} new image${form.media.length === 1 ? '' : 's'} selected` : 'Attach more place images'}
        helper="New images are appended to this stop. Existing approved images remain attached."
        media={form.media}
        uploading={form.uploading}
        onUpload={(event) => { const files = event.target.files; event.currentTarget.value = ''; void uploadFiles(files); }}
        onRemove={(mediaId) => updateForm({ media: form.media.filter((item) => item.id !== mediaId) })}
      />
      {form.message ? <p className="success-message">{form.message}</p> : null}
      {form.error ? <p className="form-error">{form.error}</p> : null}
      <button className="button secondary full" type="submit" disabled={form.saving || form.uploading}>{form.saving ? 'Saving stop...' : 'Save stop'}</button>
    </form>
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
  const [uploadingPlanMedia, setUploadingPlanMedia] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [mode, setMode] = useState<PlanModeForm>('local');
  const [startsAt, setStartsAt] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [status, setStatus] = useState<PlanStatusForm>('open');
  const [planMedia, setPlanMedia] = useState<MediaAssetDto[]>([]);
  const [newPlace, setNewPlace] = useState<PlaceFormState>(() => placeFormFromPlace(null));

  const isOwner = Boolean(auth.user?.id && plan?.ownerId === auth.user.id);
  const acceptedOrPendingCount = useMemo(() => (plan?.participants ?? []).filter((participant) => ['pending', 'accepted'].includes(participant.status)).length, [plan?.participants]);

  async function loadPlan() {
    setLoading(true);
    setError('');
    try {
      const response = await api.plans.get(planId);
      const loadedPlan = response.plan;
      setPlan(loadedPlan);
      setTitle(loadedPlan.title);
      setDescription(loadedPlan.description);
      setCategory(loadedPlan.category ?? '');
      setLocationLabel(loadedPlan.locationLabel ?? '');
      setMode((loadedPlan.mode ?? 'local') as PlanModeForm);
      setStartsAt(toDateTimeLocalValue(loadedPlan.startsAt));
      setMaxParticipants(loadedPlan.maxParticipants ? String(loadedPlan.maxParticipants) : '');
      setStatus(['draft', 'open', 'cancelled'].includes(loadedPlan.status) ? loadedPlan.status as PlanStatusForm : 'open');
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

  async function uploadPlanFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadingPlanMedia(true);
    setMessage('');
    setError('');
    try {
      const nextMedia = [...planMedia];
      for (const file of Array.from(files).slice(0, Math.max(0, 5 - nextMedia.length))) {
        const formData = new FormData();
        formData.append('image', file);
        const response = await api.media.uploadImage(formData);
        const uploaded = normalizePlanMediaUpload(response);
        if (uploaded) nextMedia.push(uploaded);
      }
      setPlanMedia(nextMedia.slice(0, 5));
      setMessage('Plan image uploaded. Save changes to attach it.');
    } catch (uploadError) {
      setError(getFriendlyApiErrorMessage(uploadError, 'Could not upload Plan image.'));
    } finally {
      setUploadingPlanMedia(false);
    }
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.plans.update(planId, {
        title,
        description,
        category: category.trim() || null,
        mode,
        locationLabel: locationLabel.trim() || null,
        startsAt: toIsoDateTime(startsAt),
        maxParticipants: maxParticipants ? Number(maxParticipants) : null,
        status,
        mediaIds: selectedMediaIds(planMedia),
      });
      setPlan(response.plan);
      setPlanMedia([]);
      setMessage(status === 'cancelled' ? 'Plan cancelled.' : 'Plan updated.');
      if (status === 'cancelled') router.refresh();
    } catch (saveError) {
      setError(getFriendlyApiErrorMessage(saveError, 'Could not update Plan.'));
    } finally {
      setSaving(false);
    }
  }

  function updateNewPlace(update: Partial<PlaceFormState>) {
    setNewPlace((current) => ({ ...current, ...update }));
  }

  async function uploadNewPlaceFiles(files: FileList | null) {
    if (!files?.length) return;
    updateNewPlace({ uploading: true, error: '', message: '' });
    try {
      const nextMedia = [...newPlace.media];
      for (const file of Array.from(files).slice(0, Math.max(0, 5 - nextMedia.length))) {
        const formData = new FormData();
        formData.append('image', file);
        const response = await api.media.uploadImage(formData);
        const uploaded = normalizePlanMediaUpload(response);
        if (uploaded) nextMedia.push(uploaded);
      }
      updateNewPlace({ media: nextMedia.slice(0, 5), message: 'Place image uploaded.' });
    } catch (uploadError) {
      updateNewPlace({ error: getFriendlyApiErrorMessage(uploadError, 'Could not upload place image.') });
    } finally {
      updateNewPlace({ uploading: false });
    }
  }

  async function addPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner || !newPlace.title.trim()) return;
    updateNewPlace({ saving: true, error: '', message: '' });
    try {
      const response = await api.plans.createPlace(planId, {
        title: newPlace.title,
        note: newPlace.note.trim() || undefined,
        addressPublicText: newPlace.addressPublicText.trim() || undefined,
        addressPrivateText: newPlace.addressPrivateText.trim() || undefined,
        startsAt: newPlace.startsAt ? toIsoDateTime(newPlace.startsAt) : undefined,
        order: newPlace.order ? Number(newPlace.order) : plan?.places?.length ?? 0,
        mediaIds: selectedMediaIds(newPlace.media),
      });
      setPlan(response.plan);
      setNewPlace({ ...placeFormFromPlace(null), order: String(response.plan.places?.length ?? 0), message: 'Place added.' });
    } catch (saveError) {
      updateNewPlace({ error: getFriendlyApiErrorMessage(saveError, 'Could not add place.') });
    } finally {
      updateNewPlace({ saving: false });
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
            <p>Only the Plan owner can edit hidden Plan details and stops.</p>
            <Link className="button secondary" href={`/plans/${planId}`}>Back to Plan</Link>
          </section>
        ) : null}

        {plan && isOwner ? (
          <>
            {acceptedOrPendingCount > 0 ? (
              <section className="mobile-card mobile-card--soft">
                <h3>Change warning</h3>
                <p>This Plan has pending or accepted participants. Time, city, stop, and private meeting-point changes are major changes. Keep details clear and use support if a safety issue appears.</p>
              </section>
            ) : null}

            <form className="mobile-card plan-form" onSubmit={savePlan}>
              <h3>Plan details</h3>
              <label>
                <span>Title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required />
              </label>
              <label>
                <span>Description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={2000} required />
              </label>
              <div className="plan-form__row">
                <label>
                  <span>Category</span>
                  <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} />
                </label>
                <label>
                  <span>Mode</span>
                  <select value={mode} onChange={(event) => setMode(event.target.value as PlanModeForm)}>
                    <option value="local">In person</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </label>
              </div>
              <label>
                <span>City / area</span>
                <input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} maxLength={160} />
              </label>
              <div className="plan-form__row">
                <label>
                  <span>Starts at</span>
                  <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
                </label>
                <label>
                  <span>Max participants</span>
                  <input type="number" min={1} max={100} value={maxParticipants} onChange={(event) => setMaxParticipants(event.target.value)} />
                </label>
              </div>
              <label>
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as PlanStatusForm)}>
                  <option value="draft">Draft</option>
                  <option value="open">Open for requests</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              {status === 'cancelled' ? <p className="form-error">Cancelling closes the Plan for new join requests. Keep this only for internal testing or real safety/admin reasons.</p> : null}

              <PlanMediaGallery media={plan.media} label="Plan images" />
              <UploadPicker
                title={planMedia.length ? `${planMedia.length} new Plan image${planMedia.length === 1 ? '' : 's'} selected` : 'Attach more Plan images'}
                helper="New images are appended to this Plan. Existing approved images remain attached."
                media={planMedia}
                uploading={uploadingPlanMedia}
                onUpload={(event) => { const files = event.target.files; event.currentTarget.value = ''; void uploadPlanFiles(files); }}
                onRemove={(mediaId) => setPlanMedia((current) => current.filter((item) => item.id !== mediaId))}
              />

              {message ? <p className="success-message">{message}</p> : null}
              {error ? <p className="form-error">{error}</p> : null}
              <button className="button primary full" type="submit" disabled={saving || uploadingPlanMedia}>{saving ? 'Saving...' : status === 'cancelled' ? 'Cancel Plan' : 'Save Plan'}</button>
            </form>

            <section className="mobile-card plan-form">
              <h3>Existing places</h3>
              {(plan.places ?? []).length ? (
                <div className="mobile-list">
                  {(plan.places ?? []).map((place) => <PlaceEditor key={place.id} planId={plan.id} place={place} onSaved={setPlan} />)}
                </div>
              ) : <p className="meta">No places added yet.</p>}
            </section>

            <form className="mobile-card plan-form" onSubmit={addPlace}>
              <h3>Add another place / stop</h3>
              <label>
                <span>Place title</span>
                <input value={newPlace.title} onChange={(event) => updateNewPlace({ title: event.target.value })} minLength={3} maxLength={120} required placeholder="Next stop" />
              </label>
              <label>
                <span>Public note</span>
                <textarea value={newPlace.note} onChange={(event) => updateNewPlace({ note: event.target.value })} maxLength={1000} placeholder="What people can know before approval." />
              </label>
              <div className="plan-form__row">
                <label>
                  <span>Public area</span>
                  <input value={newPlace.addressPublicText} onChange={(event) => updateNewPlace({ addressPublicText: event.target.value })} maxLength={160} placeholder="City/area only" />
                </label>
                <label>
                  <span>Private exact detail</span>
                  <input value={newPlace.addressPrivateText} onChange={(event) => updateNewPlace({ addressPrivateText: event.target.value })} maxLength={240} placeholder="Shown after approval" />
                </label>
              </div>
              <div className="plan-form__row">
                <label>
                  <span>Starts at</span>
                  <input type="datetime-local" value={newPlace.startsAt} onChange={(event) => updateNewPlace({ startsAt: event.target.value })} />
                </label>
                <label>
                  <span>Order</span>
                  <input type="number" min={0} max={50} value={newPlace.order} onChange={(event) => updateNewPlace({ order: event.target.value })} />
                </label>
              </div>
              <UploadPicker
                title={newPlace.media.length ? `${newPlace.media.length} new place image${newPlace.media.length === 1 ? '' : 's'} selected` : 'Attach place images'}
                helper="Images are shown with this stop. Private exact details still stay hidden until approval."
                media={newPlace.media}
                uploading={newPlace.uploading}
                onUpload={(event) => { const files = event.target.files; event.currentTarget.value = ''; void uploadNewPlaceFiles(files); }}
                onRemove={(mediaId) => updateNewPlace({ media: newPlace.media.filter((item) => item.id !== mediaId) })}
              />
              {newPlace.message ? <p className="success-message">{newPlace.message}</p> : null}
              {newPlace.error ? <p className="form-error">{newPlace.error}</p> : null}
              <button className="button secondary full" type="submit" disabled={newPlace.saving || newPlace.uploading}>{newPlace.saving ? 'Adding...' : 'Add place'}</button>
            </form>

            <section className="mobile-card mobile-card--soft">
              <h3>Lifecycle note</h3>
              <p>Keep Plans hidden while testing. Status changes and stop edits are for internal QA; do not add public chat, maps, payments, or notifications yet.</p>
              <p className="meta">Current public start: {planDateTime(plan.startsAt)}</p>
            </section>
          </>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
