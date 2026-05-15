'use client';

import { useRouter } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import type { MediaAssetDto } from '@hellowhen/contracts';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { planMediaSrc } from './plansPresentation';

function toDateTimeLocalValue(date: Date) {
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

type PlanImagePickerProps = {
  title: string;
  helper: string;
  media: MediaAssetDto[];
  uploading: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (mediaId: string) => void;
};

function PlanImagePicker({ title, helper, media, uploading, onUpload, onRemove }: PlanImagePickerProps) {
  return (
    <section className="plan-image-picker">
      <div>
        <p className="eyebrow">Images</p>
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
              <img src={planMediaSrc(item)} alt={item.filename ?? 'Plan image'} />
              <figcaption>
                <span className="semantic-badge instruction">{item.status}</span>
                <button type="button" className="secondary" onClick={() => onRemove(item.id)}>Remove</button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function PlanCreateClient() {
  const router = useRouter();
  const auth = useWebAuth();
  const defaultStartsAt = useMemo(() => toDateTimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000)), []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Culture');
  const [locationLabel, setLocationLabel] = useState('Paris');
  const [mode, setMode] = useState<'local' | 'remote' | 'hybrid'>('local');
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [maxParticipants, setMaxParticipants] = useState('3');
  const [placeTitle, setPlaceTitle] = useState('Meeting point');
  const [placeNote, setPlaceNote] = useState('Short internal test stop.');
  const [placePublicAddress, setPlacePublicAddress] = useState('City area only');
  const [placePrivateAddress, setPlacePrivateAddress] = useState('Exact meeting point shown after approval.');
  const [status, setStatus] = useState<'draft' | 'open'>('open');
  const [planMedia, setPlanMedia] = useState<MediaAssetDto[]>([]);
  const [placeMedia, setPlaceMedia] = useState<MediaAssetDto[]>([]);
  const [uploadingPlanMedia, setUploadingPlanMedia] = useState(false);
  const [uploadingPlaceMedia, setUploadingPlaceMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function uploadFiles(files: FileList | null, target: 'plan' | 'place') {
    if (!files?.length) return;
    const currentMedia = target === 'plan' ? planMedia : placeMedia;
    const setMedia = target === 'plan' ? setPlanMedia : setPlaceMedia;
    const setUploading = target === 'plan' ? setUploadingPlanMedia : setUploadingPlaceMedia;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const nextMedia = [...currentMedia];
      for (const file of Array.from(files).slice(0, Math.max(0, 5 - nextMedia.length))) {
        const formData = new FormData();
        formData.append('image', file);
        const response = await api.media.uploadImage(formData);
        const uploaded = normalizePlanMediaUpload(response);
        if (uploaded) nextMedia.push(uploaded);
      }
      setMedia(nextMedia.slice(0, 5));
      setMessage(target === 'plan' ? 'Plan image uploaded.' : 'Place image uploaded.');
    } catch (uploadError) {
      setError(getFriendlyApiErrorMessage(uploadError, 'Could not upload image.'));
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.isAuthenticated) {
      router.push('/auth?next=/plans/new');
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
        mode,
        locationLabel: locationLabel.trim() || undefined,
        startsAt: toIsoDateTime(startsAt),
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
        joinApprovalMode: 'owner_approval',
        status,
        mediaIds: selectedMediaIds(planMedia),
        places: placeTitle.trim() ? [{
          title: placeTitle,
          note: placeNote.trim() || undefined,
          addressPublicText: placePublicAddress.trim() || undefined,
          addressPrivateText: placePrivateAddress.trim() || undefined,
          startsAt: toIsoDateTime(startsAt),
          order: 0,
          mediaIds: selectedMediaIds(placeMedia),
        }] : [],
      });
      router.replace(`/plans/${response.plan.id}`);
    } catch (saveError) {
      setError(getFriendlyApiErrorMessage(saveError, 'Could not create Plan.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlansFeatureGate>
      <main className="mobile-page plans-page">
        <section className="page-intro">
          <div>
            <PlansInternalBadge />
            <h2>Create Plan</h2>
            <p>Internal-only form for testing Plans. Exact private location is hidden until join approval.</p>
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
                <span>Category</span>
                <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} />
              </label>
              <label>
                <span>Mode</span>
                <select value={mode} onChange={(event) => setMode(event.target.value as 'local' | 'remote' | 'hybrid')}>
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
              <select value={status} onChange={(event) => setStatus(event.target.value as 'draft' | 'open')}>
                <option value="open">Open for requests</option>
                <option value="draft">Draft</option>
              </select>
            </label>

            <PlanImagePicker
              title={planMedia.length ? `${planMedia.length} Plan image${planMedia.length === 1 ? '' : 's'} selected` : 'Add Plan images'}
              helper="Images attach to the Plan summary and remain internal while Plans are hidden."
              media={planMedia}
              uploading={uploadingPlanMedia}
              onUpload={(event) => { const files = event.target.files; event.currentTarget.value = ''; void uploadFiles(files, 'plan'); }}
              onRemove={(mediaId) => setPlanMedia((current) => current.filter((item) => item.id !== mediaId))}
            />

            <hr />
            <h3>First place / stop</h3>
            <label>
              <span>Place title</span>
              <input value={placeTitle} onChange={(event) => setPlaceTitle(event.target.value)} maxLength={120} />
            </label>
            <label>
              <span>Public note</span>
              <textarea value={placeNote} onChange={(event) => setPlaceNote(event.target.value)} maxLength={1000} />
            </label>
            <label>
              <span>Public area</span>
              <input value={placePublicAddress} onChange={(event) => setPlacePublicAddress(event.target.value)} maxLength={160} />
            </label>
            <label>
              <span>Private exact detail</span>
              <input value={placePrivateAddress} onChange={(event) => setPlacePrivateAddress(event.target.value)} maxLength={240} />
            </label>

            <PlanImagePicker
              title={placeMedia.length ? `${placeMedia.length} Place image${placeMedia.length === 1 ? '' : 's'} selected` : 'Add Place images'}
              helper="Place images are shown with this stop. Private address text is still hidden until approval."
              media={placeMedia}
              uploading={uploadingPlaceMedia}
              onUpload={(event) => { const files = event.target.files; event.currentTarget.value = ''; void uploadFiles(files, 'place'); }}
              onRemove={(mediaId) => setPlaceMedia((current) => current.filter((item) => item.id !== mediaId))}
            />

            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <button className="button primary full" type="submit" disabled={saving || uploadingPlanMedia || uploadingPlaceMedia}>{saving ? 'Creating...' : 'Create hidden Plan'}</button>
          </form>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
