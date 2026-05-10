'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import type { CreateNeedRequest, CreateOfferRequest, InventoryItemType, MediaAssetDto, NeedDto, OfferDto, TradeExchangeMode, UpdateNeedRequest, UpdateOfferRequest } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import {
  emptyInventoryFormValues,
  inventoryToFormValues,
  kindLabel,
  mediaSrc,
  normalizeInventoryItem,
  normalizeMediaUpload,
  parseCsvList,
  parseLineList,
  sideClassName,
  sideLabel,
  toIsoDate,
  type InventoryFormValues,
  type InventoryItem,
  type InventoryKind,
} from './inventoryPresentation';

type InventoryCreateRedirect = {
  pathname: string;
  selectedParam: 'needId' | 'offerId';
  preservedParams?: Record<string, string | undefined>;
};

type InventoryFormClientProps = {
  kind: InventoryKind;
  itemId?: string;
  mode: 'create' | 'edit';
  cancelHref?: string;
  afterCreateRedirect?: InventoryCreateRedirect;
};

type DeleteImpact = {
  blocked?: boolean;
  linkedTradeCount?: number;
  activeTradeCount?: number;
  historicalTradeCount?: number;
  activeTrades?: Array<{ id: string; title: string; status: string }>;
};

function selectedStatusOptions(kind: InventoryKind) {
  return kind === 'need'
    ? ['draft', 'active', 'fulfilled', 'closed', 'expired']
    : ['draft', 'active', 'accepted', 'closed', 'expired'];
}


function parseMode(value: string): TradeExchangeMode | undefined {
  return value === 'remote' || value === 'local' || value === 'hybrid' ? value : undefined;
}

function formToNeedPayload(values: InventoryFormValues, mediaIds: string[]): CreateNeedRequest | UpdateNeedRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status as NeedDto['status'],
    itemType: values.itemType,
    category: values.category.trim() || undefined,
    timing: values.timing.trim() || undefined,
    mode: parseMode(values.mode),
    locationLabel: values.locationLabel.trim() || undefined,
    tags: parseCsvList(values.tags),
    expiresAt: toIsoDate(values.expiresAt),
    mediaIds,
  };
}

function formToOfferPayload(values: InventoryFormValues, mediaIds: string[]): CreateOfferRequest | UpdateOfferRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status as OfferDto['status'],
    itemType: values.itemType,
    category: values.category.trim() || undefined,
    availability: values.availability.trim() || undefined,
    mode: parseMode(values.mode),
    locationLabel: values.locationLabel.trim() || undefined,
    includes: parseLineList(values.includes),
    tags: parseCsvList(values.tags),
    expiresAt: toIsoDate(values.expiresAt),
    mediaIds,
  };
}

function buildCreateRedirectHref(redirect: InventoryCreateRedirect, savedId: string) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(redirect.preservedParams ?? {})) {
    if (value) params.set(key, value);
  }
  params.set(redirect.selectedParam, savedId);
  const query = params.toString();
  return `${redirect.pathname}${query ? `?${query}` : ''}`;
}

export function InventoryFormClient({ kind, itemId, mode, cancelHref, afterCreateRedirect }: InventoryFormClientProps) {
  const auth = useWebAuth();
  const router = useRouter();
  const [values, setValues] = useState<InventoryFormValues>(emptyInventoryFormValues);
  const [media, setMedia] = useState<MediaAssetDto[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const demoDataEnabled = isWebDemoDataEnabled();

  const baseHref = kind === 'need' ? '/needs' : '/offers';
  const formCancelHref = cancelHref ?? baseHref;
  const noun = kindLabel(kind);
  const lowerNoun = noun.toLowerCase();
  const isEditProtected = mode === 'edit' && Boolean(deleteImpact?.blocked);

  useEffect(() => {
    if (mode !== 'edit' || !itemId) return;
    if (!auth.hydrated) return;
    const requestedItemId = itemId;
    let mounted = true;
    async function loadItem() {
      setLoading(true);
      try {
        if (!auth.isAuthenticated) throw new Error('signed_out_inventory');
        const response = kind === 'need' ? await api.needs.get(requestedItemId) : await api.offers.get(requestedItemId);
        if (!mounted) return;
        const item = normalizeInventoryItem(response, kind);
        if (item) {
          setValues(inventoryToFormValues(item));
          setMedia(item.media ?? []);
        }
      } catch {
        if (!mounted) return;
        const fallback = demoDataEnabled ? (kind === 'need' ? mockNeeds : mockOffers).find((item) => item.id === requestedItemId) ?? null : null;
        setValues(inventoryToFormValues(fallback));
        setMedia(fallback?.media ?? []);
        setMessage(demoDataEnabled && fallback ? 'Using demo data because this item could not be loaded from the API.' : 'This item could not be loaded from the API.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadItem();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated, demoDataEnabled, itemId, kind, mode]);

  useEffect(() => {
    if (mode !== 'edit' || !itemId || !auth.hydrated || !auth.isAuthenticated) return;
    const requestedItemId = itemId;
    let mounted = true;
    async function loadDeleteImpact() {
      try {
        const response = kind === 'need' ? await api.needs.deleteImpact(requestedItemId) : await api.offers.deleteImpact(requestedItemId);
        if (mounted) setDeleteImpact(response as DeleteImpact);
      } catch {
        if (mounted) setDeleteImpact(null);
      }
    }
    void loadDeleteImpact();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated, itemId, kind, mode]);

  const mediaIds = useMemo(() => media.map((item) => item.id), [media]);

  function updateField<Key extends keyof InventoryFormValues>(field: Key, value: InventoryFormValues[Key]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function uploadFiles(files: FileList | null) {
    if (isEditProtected || !files?.length) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const nextMedia = [...media];
      for (const file of Array.from(files).slice(0, Math.max(0, 5 - nextMedia.length))) {
        const formData = new FormData();
        formData.append('image', file);
        const response = await api.media.uploadImage(formData);
        const uploaded = normalizeMediaUpload(response);
        if (uploaded) nextMedia.push(uploaded);
      }
      setMedia(nextMedia.slice(0, 5));
      setMessage('Image uploaded. It will appear on this saved item after you save.');
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause));
    } finally {
      setUploading(false);
    }
  }

  function removeMedia(mediaId: string) {
    if (isEditProtected) return;
    setMedia((current) => current.filter((item) => item.id !== mediaId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isEditProtected) {
      setError(`Close or delete the active trade before editing this ${lowerNoun}.`);
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = kind === 'need' ? formToNeedPayload(values, mediaIds) : formToOfferPayload(values, mediaIds);
      let saved: InventoryItem | null = null;
      if (kind === 'need') {
        const response = mode === 'edit' && itemId
          ? await api.needs.update(itemId, payload as UpdateNeedRequest)
          : await api.needs.create(payload as CreateNeedRequest);
        saved = normalizeInventoryItem(response, kind);
      } else {
        const response = mode === 'edit' && itemId
          ? await api.offers.update(itemId, payload as UpdateOfferRequest)
          : await api.offers.create(payload as CreateOfferRequest);
        saved = normalizeInventoryItem(response, kind);
      }
      if (mode === 'create' && afterCreateRedirect && saved?.id) {
        router.push(buildCreateRedirectHref(afterCreateRedirect, saved.id));
      } else {
        router.push(`${baseHref}/${saved?.id ?? itemId ?? ''}`.replace(/\/$/, ''));
      }
      router.refresh();
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog() {
    setError('');
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!itemId) return;
    if (deleteImpact?.blocked) {
      setDeleteDialogOpen(false);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (kind === 'need') await api.needs.remove(itemId);
      else await api.offers.remove(itemId);
      router.push(baseHref);
      router.refresh();
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause));
      try {
        const response = kind === 'need' ? await api.needs.deleteImpact(itemId) : await api.offers.deleteImpact(itemId);
        setDeleteImpact(response as DeleteImpact);
      } catch {
        // Keep the API error message visible if impact refresh also fails.
      }
    } finally {
      setSaving(false);
      setDeleteDialogOpen(false);
    }
  }

  if (loading || (mode === 'edit' && !auth.hydrated)) {
    return (
      <section className="mobile-page">
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">Loading</span>
          <h3>{!auth.hydrated ? 'Checking your session...' : `Loading ${lowerNoun}...`}</h3>
        </section>
      </section>
    );
  }

  return (
    <section className="mobile-page">
      {!auth.isAuthenticated && auth.hydrated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">Signed out</span>
          <h3>Sign in to save real {kind === 'need' ? 'needs' : 'offers'}</h3>
          <p>This form is wired to the API and needs a session before it can save.</p>
          <Link href="/auth" className="button">Sign in</Link>
        </section>
      ) : null}

      <form className="inventory-form" onSubmit={handleSubmit}>
        {isEditProtected ? (
          <section className="notice-box warning inventory-delete-warning">
            <strong>This {lowerNoun} is locked by an active trade.</strong>
            <span>Close or delete that trade before editing or deleting this {lowerNoun}.</span>
            {deleteImpact?.activeTrades?.[0] ? <Link href={`/trades/${deleteImpact.activeTrades[0].id}`} className="button secondary">View trade</Link> : null}
          </section>
        ) : null}

        <fieldset className="inventory-form__editable" disabled={isEditProtected}>
        <section className="mobile-card inventory-form__hero">
          <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind)}</span>
          <label className="field-label">
            Title
            <input value={values.title} onChange={(event) => updateField('title', event.target.value)} placeholder={kind === 'need' ? 'What do you need?' : 'What can you offer?'} required minLength={3} maxLength={120} />
          </label>
          <label className="field-label">
            Description
            <textarea value={values.description} onChange={(event) => updateField('description', event.target.value)} placeholder={kind === 'need' ? 'Describe the help you want.' : 'Describe what you can provide.'} required minLength={10} maxLength={2000} rows={5} />
          </label>
        </section>

        <section className="mobile-card mobile-card--soft inventory-form__grid">
          <label className="field-label">
            Status
            <select value={values.status} onChange={(event) => updateField('status', event.target.value)}>
              {selectedStatusOptions(kind).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="field-label">
            Type
            <select value={values.itemType} onChange={(event) => updateField('itemType', event.target.value as InventoryItemType)}>
              <option value="service">Service</option>
              <option value="goods">Goods</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field-label">
            Category
            <input value={values.category} onChange={(event) => updateField('category', event.target.value)} placeholder="Design, tutoring, repair..." maxLength={80} />
          </label>
          <label className="field-label">
            {kind === 'need' ? 'Timing' : 'Availability'}
            <input value={kind === 'need' ? values.timing : values.availability} onChange={(event) => updateField(kind === 'need' ? 'timing' : 'availability', event.target.value)} placeholder={kind === 'need' ? 'This week, today, flexible...' : 'Weekends, evenings, remote...'} maxLength={80} />
          </label>
          <label className="field-label">
            Mode
            <select value={values.mode} onChange={(event) => updateField('mode', event.target.value)}>
              <option value="">Not specified</option>
              <option value="remote">Remote</option>
              <option value="local">Local</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <label className="field-label">
            Location label
            <input value={values.locationLabel} onChange={(event) => updateField('locationLabel', event.target.value)} placeholder="Remote, Paris, local area..." maxLength={120} />
          </label>
          <label className="field-label">
            Expires
            <input value={values.expiresAt} onChange={(event) => updateField('expiresAt', event.target.value)} type="date" />
          </label>
          <label className="field-label inventory-form__wide">
            Tags
            <input value={values.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="design, launch, remote" />
          </label>
          {kind === 'offer' ? (
            <label className="field-label inventory-form__wide">
              Includes
              <textarea value={values.includes} onChange={(event) => updateField('includes', event.target.value)} placeholder="One revision\n10 edited photos\n30-minute call" rows={4} />
            </label>
          ) : null}
        </section>

        <section className="mobile-card inventory-media-panel">
          <div>
            <p className="eyebrow">Images</p>
            <h3>{media.length ? `${media.length}/5 selected` : `Add ${lowerNoun} images`}</h3>
            <p>Images appear on this saved Need or Offer after upload. Support can remove reported images if needed.</p>
          </div>
          <label className="image-upload-button">
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => uploadFiles(event.target.files)} disabled={isEditProtected || uploading || media.length >= 5} />
            {uploading ? 'Uploading...' : media.length >= 5 ? 'Image limit reached' : 'Upload images'}
          </label>
          {media.length ? (
            <div className="inventory-media-grid">
              {media.map((item) => (
                <figure key={item.id}>
                  <img src={mediaSrc(item)} alt={item.filename ?? `${noun} image`} />
                  <figcaption>
                    <span className="semantic-badge instruction">{item.status}</span>
                    <button type="button" className="secondary" onClick={() => removeMedia(item.id)} disabled={isEditProtected}>Remove</button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </section>

        </fieldset>

        {message ? <p className="form-message form-message--success">{message}</p> : null}
        {error ? <p className="form-message form-message--error">{error}</p> : null}

        <div className="sticky-form-actions">
          {mode === 'edit' ? <button type="button" className={deleteImpact?.blocked ? 'secondary warning-button' : 'secondary danger-button'} onClick={openDeleteDialog} disabled={saving}>{deleteImpact?.blocked ? 'Used in trade' : 'Delete'}</button> : <Link href={formCancelHref} className="button secondary">Cancel</Link>}
          <button type="submit" disabled={saving || uploading || isEditProtected}>{saving ? 'Saving...' : mode === 'edit' ? `Save ${noun}` : `Create ${noun}`}</button>
        </div>
      </form>

      <ConfirmDialog
        open={deleteDialogOpen}
        eyebrow={deleteImpact?.blocked ? 'Protected' : 'Delete'}
        title={deleteImpact?.blocked ? `Can't delete this ${lowerNoun}` : `Delete ${lowerNoun}?`}
        body={deleteImpact?.blocked
          ? `This ${lowerNoun} is used by an active trade. Close or delete that trade before editing or deleting this ${lowerNoun}.`
          : deleteImpact?.linkedTradeCount
            ? `This ${lowerNoun} is linked to past trades. It will be removed from your inventory, and past trades will stay closed without deleting them.`
            : `This ${lowerNoun} is not used in an active trade. Deleting it cannot be undone.`}
        variant={deleteImpact?.blocked ? 'warning' : 'danger'}
        confirmLabel={deleteImpact?.blocked ? 'OK' : 'Delete'}
        showCancel={!deleteImpact?.blocked}
        loading={saving}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={deleteImpact?.blocked ? () => setDeleteDialogOpen(false) : handleDelete}
      />
    </section>
  );
}
