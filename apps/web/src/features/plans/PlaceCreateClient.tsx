'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { DiscoveryLanguage, InventoryTranslationDto, MediaAssetDto, PlanPlaceMode } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { mediaSrc, normalizeMediaUpload } from '../inventory/inventoryPresentation';
import { GooglePlacePicker } from './GooglePlacePicker';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';

type PlaceCreateClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
  placeId?: string;
};

type PlaceTranslationFormValue = { languageCode: DiscoveryLanguage; title: string; description: string };
type PlaceCreateStep = 'details' | 'image';

type PlaceCreateFormState = {
  mode: PlanPlaceMode;
  title: string;
  description: string;
  defaultLanguage: DiscoveryLanguage;
  translations: PlaceTranslationFormValue[];
  location: string;
  onlineLabel: string;
  onlineUrl: string;
};

function makePlaceCreateForm(defaultLanguage: DiscoveryLanguage = 'en'): PlaceCreateFormState {
  return {
    mode: 'local',
    title: '',
    description: '',
    defaultLanguage,
    translations: [],
    location: '',
    onlineLabel: '',
    onlineUrl: '',
  };
}

function formStateFromPlace(place: { mode?: PlanPlaceMode | null; title?: string | null; description?: string | null; defaultLanguage?: string | null; translations?: InventoryTranslationDto[] | null; addressPublicText?: string | null; areaLabel?: string | null; onlineLabel?: string | null; onlineUrl?: string | null }): PlaceCreateFormState {
  const mode = place.mode === 'remote' ? 'remote' : 'local';
  return {
    mode,
    title: place.title ?? '',
    description: place.description ?? '',
    defaultLanguage: normalizePlaceLanguage(place.defaultLanguage),
    translations: (place.translations ?? []).map((translation) => ({ languageCode: normalizePlaceLanguage(translation.languageCode), title: translation.title ?? '', description: translation.description ?? '' })),
    location: mode === 'local' ? place.addressPublicText ?? place.areaLabel ?? '' : '',
    onlineLabel: mode === 'remote' ? place.onlineLabel ?? '' : '',
    onlineUrl: mode === 'remote' ? place.onlineUrl ?? '' : '',
  };
}


const placeLanguageOptions: DiscoveryLanguage[] = ['en', 'fr', 'es'];

function normalizePlaceLanguage(value?: string | null): DiscoveryLanguage {
  if (value === 'fr' || value === 'es') return value;
  return 'en';
}

function placeLanguageLabel(language: DiscoveryLanguage) {
  if (language === 'fr') return 'French';
  if (language === 'es') return 'Spanish';
  return 'English';
}

function availablePlaceTranslationLanguages(state: PlaceCreateFormState) {
  const used = new Set([state.defaultLanguage, ...state.translations.map((translation) => translation.languageCode)]);
  return placeLanguageOptions.filter((language) => !used.has(language));
}

function addPlaceTranslationDraft(state: PlaceCreateFormState, languageCode: DiscoveryLanguage): PlaceCreateFormState {
  if (!availablePlaceTranslationLanguages(state).includes(languageCode)) return state;
  return { ...state, translations: [...state.translations, { languageCode, title: '', description: '' }] };
}

function setPlaceTranslationDraft(state: PlaceCreateFormState, draft: PlaceTranslationFormValue): PlaceCreateFormState {
  return { ...state, translations: state.translations.map((translation) => translation.languageCode === draft.languageCode ? draft : translation) };
}

function removePlaceTranslationDraft(state: PlaceCreateFormState, languageCode: DiscoveryLanguage): PlaceCreateFormState {
  return { ...state, translations: state.translations.filter((translation) => translation.languageCode !== languageCode) };
}

function normalizePlaceTranslationsForPayload(state: PlaceCreateFormState) {
  return state.translations
    .filter((translation) => translation.languageCode !== state.defaultLanguage)
    .filter((translation) => translation.title.trim() || translation.description.trim())
    .map((translation) => ({ languageCode: translation.languageCode, title: translation.title.trim(), description: translation.description.trim() }));
}

function validatePlaceTranslations(state: PlaceCreateFormState) {
  for (const translation of normalizePlaceTranslationsForPayload(state)) {
    if (!translation.title || !translation.description) return 'Complete both translated title and description, or remove that language.';
    if (translation.title.length < 3) return 'Translated Place name must be at least 3 characters.';
  }
  return '';
}


function placeTranslationSummary(state: PlaceCreateFormState) {
  const draftCount = state.translations.length;
  if (!draftCount) return `Original: ${placeLanguageLabel(state.defaultLanguage)} · Optional`;
  return `Original: ${placeLanguageLabel(state.defaultLanguage)} · ${draftCount} translation${draftCount === 1 ? '' : 's'}`;
}

function placeHasTranslations(place: { translations?: InventoryTranslationDto[] | null }) {
  return Boolean((place.translations ?? []).some((translation) => (translation.title ?? '').trim() || (translation.description ?? '').trim()));
}

function activePlaceMedia(media?: MediaAssetDto[] | null) {
  return (media ?? []).filter((asset) => asset.status !== 'removed').slice(0, 1);
}

function PlaceModeSegment({ value, onChange }: { value: PlanPlaceMode; onChange: (value: PlanPlaceMode) => void }) {
  return (
    <div className="plan-mode-segment place-mode-segment" aria-label="Place type">
      <button type="button" className={value === 'local' ? 'is-active' : ''} onClick={() => onChange('local')}>Offline</button>
      <button type="button" className={value === 'remote' ? 'is-active' : ''} onClick={() => onChange('remote')}>Online</button>
    </div>
  );
}

export function PlaceCreateClient({ plansEnabled, plansVisible, placeId }: PlaceCreateClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useWebAuth();
  const { language } = useWebTranslation();
  const returnToPlan = searchParams.get('returnTo') === 'plan';
  const copyFromPlaceId = searchParams.get('copyFromPlaceId');
  const isEditing = Boolean(placeId);
  const returnHref = returnToPlan ? '/plans/new' : '/places';
  const returnLabel = returnToPlan ? 'Back to Plan draft' : 'Back to My Places';
  const saveLabel = returnToPlan ? (isEditing ? 'Update and return to Plan draft' : 'Save and return to Plan draft') : isEditing ? 'Update Place' : 'Save Place';
  const [state, setState] = useState<PlaceCreateFormState>(() => makePlaceCreateForm(normalizePlaceLanguage(language)));
  const [step, setStep] = useState<PlaceCreateStep>('details');
  const [translationPanelOpen, setTranslationPanelOpen] = useState(false);
  const [media, setMedia] = useState<MediaAssetDto[]>([]);
  const [loadingPlace, setLoadingPlace] = useState(Boolean(placeId || copyFromPlaceId));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [usedInPlansCount, setUsedInPlansCount] = useState(0);

  useEffect(() => {
    if (isEditing || copyFromPlaceId) return;
    const appLanguage = normalizePlaceLanguage(language);
    setState((current) => {
      if (current.defaultLanguage === appLanguage || current.translations.length) return current;
      return { ...current, defaultLanguage: appLanguage };
    });
  }, [copyFromPlaceId, isEditing, language]);

  useEffect(() => {
    const sourcePlaceId = placeId || copyFromPlaceId;
    if (!sourcePlaceId || !auth.hydrated || !auth.isAuthenticated) {
      setUsedInPlansCount(0);
      setLoadingPlace(false);
      return;
    }

    let cancelled = false;
    setLoadingPlace(true);
    setError('');
    api.places.get(sourcePlaceId)
      .then((response) => {
        if (cancelled) return;
        setState(formStateFromPlace(response.place));
        setTranslationPanelOpen(placeHasTranslations(response.place));
        setMedia(isEditing ? activePlaceMedia(response.place.media) : []);
        setUsedInPlansCount(isEditing ? Number((response.place as typeof response.place & { usedInPlansCount?: number }).usedInPlansCount ?? 0) : 0);
      })
      .catch((caughtError) => {
        if (cancelled) return;
        setError(getFriendlyApiErrorMessage(caughtError, isEditing ? 'Could not load Place.' : 'Could not copy Place.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingPlace(false);
      });

    return () => { cancelled = true; };
  }, [auth.hydrated, auth.isAuthenticated, copyFromPlaceId, isEditing, placeId]);

  function nextUrl() {
    return returnToPlan ? (isEditing && placeId ? `/places/${placeId}/edit?returnTo=plan` : '/places/new?returnTo=plan') : isEditing && placeId ? `/places/${placeId}/edit` : '/places/new';
  }

  function validateDetails() {
    if (state.title.trim().length < 3) return 'Add a Place name.';
    if (state.mode === 'remote' && state.onlineUrl.trim()) {
      try {
        const parsedUrl = new URL(state.onlineUrl.trim());
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) return 'Add a valid online URL.';
      } catch {
        return 'Add a valid online URL.';
      }
    }
    const translationError = validatePlaceTranslations(state);
    if (translationError) setTranslationPanelOpen(true);
    return translationError;
  }

  function goToImageStep() {
    const detailsError = validateDetails();
    if (detailsError) {
      setMessage('');
      setError(detailsError);
      setStep('details');
      return;
    }
    setError('');
    setMessage('');
    setStep('image');
  }

  async function uploadPlaceImage(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.media.uploadImage(formData);
      const uploaded = normalizeMediaUpload(response);
      if (!uploaded) throw new Error('Upload returned no image.');
      setMedia([{ ...uploaded, sortOrder: 0, isCover: true }]);
      setMessage('Place image uploaded. Save the Place to keep it.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, 'Could not upload Place image.'));
    } finally {
      setUploading(false);
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    void uploadPlaceImage(event.target.files);
    event.currentTarget.value = '';
  }

  function removeImage() {
    if (saving || uploading) return;
    setMedia([]);
    setMessage('Image removed. Save the Place to keep this change.');
  }

  async function savePlace() {
    if (!auth.isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(nextUrl())}`);
      return;
    }
    const detailsError = validateDetails();
    if (detailsError) {
      setError(detailsError);
      setStep('details');
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');
    try {
      const body = {
        mode: state.mode,
        title: state.title.trim(),
        description: state.description.trim() || undefined,
        defaultLanguage: state.defaultLanguage,
        translations: normalizePlaceTranslationsForPayload(state),
        visibility: 'private' as const,
        status: 'active' as const,
        addressPublicText: state.mode === 'local' ? state.location.trim() || undefined : undefined,
        onlineLabel: state.mode === 'remote' ? state.onlineLabel.trim() || undefined : undefined,
        onlineUrl: state.mode === 'remote' ? state.onlineUrl.trim() || undefined : undefined,
        mediaIds: media.map((item) => item.id).slice(0, 1),
      };
      const response = isEditing && placeId ? await api.places.update(placeId, body) : await api.places.create(body);
      setMedia(activePlaceMedia(response.place.media));

      if (returnToPlan) {
        const queryKey = isEditing ? 'updatedPlaceId' : 'createdPlaceId';
        router.replace(`/plans/new?${queryKey}=${encodeURIComponent(response.place.id)}`);
        return;
      }

      setMessage(isEditing ? `${response.place.title} was updated.` : `${response.place.title} was saved to My Places.`);
      if (!isEditing) {
        setState(makePlaceCreateForm(normalizePlaceLanguage(language)));
        setTranslationPanelOpen(false);
        setMedia([]);
        setStep('details');
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, isEditing ? 'Could not update Place.' : 'Could not create Place.'));
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 'details') {
      goToImageStep();
      return;
    }
    void savePlace();
  }

  const selectedMedia = media[0];
  const imagePreviewSrc = selectedMedia ? mediaSrc(selectedMedia) : '';
  const editingLockedByPlans = isEditing && usedInPlansCount > 0;

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page">
        <section className="page-intro plan-create-intro place-create-intro">
          <div>
            <PlansInternalBadge plansVisible={plansVisible} />
            <h2>{isEditing ? 'Edit Place' : 'Create Place'}</h2>
            <p>{returnToPlan ? (isEditing ? 'Update this Place and return to your Plan draft.' : 'Save this Place and return to your Plan draft.') : 'Reusable Place for My Places and future Plans.'}</p>
          </div>
        </section>

        {!auth.hydrated ? <section className="mobile-card"><p className="meta">Checking session...</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <h3>Log in required</h3>
            <p>Create and edit private reusable Places after signing in.</p>
            <button type="button" className="button primary" onClick={() => router.push(`/auth?next=${encodeURIComponent(nextUrl())}`)}>Log in</button>
          </section>
        ) : null}

        {auth.isAuthenticated && loadingPlace ? <section className="mobile-card"><p className="meta">Loading Place...</p></section> : null}

        {auth.isAuthenticated && !loadingPlace && editingLockedByPlans ? (
          <section className="mobile-card mobile-card--soft place-edit-locked-card">
            <span className="semantic-badge warning">Used in {usedInPlansCount === 1 ? '1 Plan' : `${usedInPlansCount} Plans`}</span>
            <h3>This Place is locked</h3>
            <p>It is already used inside a Plan, so its saved details cannot be edited. Existing Plans keep their saved Place snapshot.</p>
            <div className="cta-row">
              <Link className="button secondary" href={returnHref}>{returnLabel}</Link>
              <Link className="button primary" href={`/places/new?copyFromPlaceId=${encodeURIComponent(placeId ?? '')}`}>Create editable copy</Link>
            </div>
          </section>
        ) : null}

        {auth.isAuthenticated && !loadingPlace && !editingLockedByPlans ? (
          <form className="mobile-card plan-form place-clean-form" onSubmit={handleSubmit} noValidate>
            <div className="place-step-tabs" aria-label="Create Place steps">
              <button type="button" className={step === 'details' ? 'is-active' : ''} onClick={() => setStep('details')} disabled={saving || uploading}>1. Details</button>
              <button type="button" className={step === 'image' ? 'is-active' : ''} onClick={goToImageStep} disabled={saving || uploading}>2. Image</button>
            </div>

            {step === 'details' ? (
              <>
                <div className="plan-form__section-title place-form__section-title">
                  <div>
                    <h3>Place details</h3>
                    <p className="meta">Private by default.</p>
                  </div>
                  <span className="semantic-badge place">My Place</span>
                </div>
                <div className="place-form__divider">
                  <PlaceModeSegment value={state.mode} onChange={(mode) => setState((current) => ({ ...current, mode }))} />
                </div>
                <label>
                  <span>Place name</span>
                  <input value={state.title} onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))} minLength={3} maxLength={120} required placeholder="Quiet coffee near République" />
                </label>
                {state.mode === 'remote' ? (
                  <div className="plan-form__row">
                    <label>
                      <span>Online label</span>
                      <input value={state.onlineLabel} onChange={(event) => setState((current) => ({ ...current, onlineLabel: event.target.value }))} maxLength={120} placeholder="Zoom, Discord, website" />
                    </label>
                    <label>
                      <span>Online URL</span>
                      <input type="url" value={state.onlineUrl} onChange={(event) => setState((current) => ({ ...current, onlineUrl: event.target.value }))} maxLength={500} placeholder="https://..." />
                    </label>
                  </div>
                ) : (
                  <GooglePlacePicker
                    value={state.location}
                    onValueChange={(location) => setState((current) => ({ ...current, location }))}
                    disabled={saving || uploading}
                    label="Search address or place"
                    placeholder="Café, park, address, station..."
                    helperText="Choose a Google suggestion when possible. Hellowhen will save the confirmed public address text for this Place."
                    languageCode={state.defaultLanguage}
                  />
                )}
                <label className="place-description-field">
                  <span>Description <small>Optional</small></span>
                  <textarea value={state.description} onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))} maxLength={2000} placeholder="Useful details for this Place." />
                </label>

                <section className="inventory-translation-compact place-translation-compact">
                  <button
                    className="inventory-translation-toggle place-translation-main-toggle"
                    type="button"
                    aria-expanded={translationPanelOpen}
                    onClick={() => setTranslationPanelOpen((open) => !open)}
                  >
                    <span>{translationPanelOpen ? 'Hide language options' : 'Language & translations'}</span>
                    <strong>{placeTranslationSummary(state)}</strong>
                  </button>

                  {translationPanelOpen ? (
                    <section className="mobile-card mobile-card--soft inventory-translation-panel inventory-translation-panel--compact place-translation-panel">
                      <div className="inventory-translation-panel__header place-translation-summary">
                        <div className="inventory-form__helper-copy">
                          <strong>Languages</strong>
                          <span>Translations are optional. The original Place language follows your app language when you create a new Place.</span>
                        </div>
                        <span className="inventory-language-summary">Original content: {placeLanguageLabel(state.defaultLanguage)}</span>
                      </div>

                      {state.translations.length ? (
                        state.translations.map((translation) => (
                          <div className="inventory-translation-panel__fields place-translation-fields" key={translation.languageCode}>
                            <div className="inventory-translation-panel__row">
                              <div>
                                <p className="eyebrow">Manual translation for {placeLanguageLabel(translation.languageCode)}</p>
                                <small>Complete both fields, or leave both empty and remove this language.</small>
                              </div>
                              <button type="button" className="button secondary compact" onClick={() => setState((current) => removePlaceTranslationDraft(current, translation.languageCode))}>Remove translation</button>
                            </div>
                            <label>
                              <span>Translated Place name <small>Optional</small></span>
                              <input
                                value={translation.title}
                                onChange={(event) => setState((current) => setPlaceTranslationDraft(current, { ...translation, title: event.target.value }))}
                                minLength={translation.title ? 3 : undefined}
                                maxLength={120}
                                placeholder="Translated place name"
                              />
                            </label>
                            <label>
                              <span>Translated description <small>Optional</small></span>
                              <textarea
                                value={translation.description}
                                onChange={(event) => setState((current) => setPlaceTranslationDraft(current, { ...translation, description: event.target.value }))}
                                maxLength={2000}
                                placeholder="Translated description"
                              />
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="meta place-translation-empty">Translations are optional. Add a language only if you want to write a manual translation for this Place.</p>
                      )}

                      {availablePlaceTranslationLanguages(state).length ? (
                        <div className="inventory-language-actions place-translation-language-actions">
                          <span>{state.translations.length ? 'Add another language' : 'Add language'}</span>
                          <div className="inventory-language-picker__buttons">
                            {availablePlaceTranslationLanguages(state).map((languageCode) => (
                              <button
                                key={languageCode}
                                type="button"
                                className="button secondary compact"
                                onClick={() => setState((current) => addPlaceTranslationDraft(current, languageCode))}
                              >
                                {placeLanguageLabel(languageCode)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <small className="inventory-language-complete">All supported languages are already added.</small>
                      )}
                    </section>
                  ) : null}
                </section>
              </>
            ) : (
              <section className="place-image-step">
                <div className="plan-form__section-title place-form__section-title">
                  <div>
                    <h3>Place image</h3>
                    <p className="meta">Optional. One image can become the background for this Place in Plan cards later.</p>
                  </div>
                  <span className="semantic-badge place">Step 2/2</span>
                </div>
                <div className="place-image-picker-panel">
                  {imagePreviewSrc ? (
                    <figure className="place-image-preview-card">
                      <img src={imagePreviewSrc} alt="Selected Place" />
                      <figcaption>
                        <div>
                          <strong>Selected image</strong>
                          <span>Save the Place to keep this image.</span>
                        </div>
                        <button type="button" className="button secondary compact" onClick={removeImage} disabled={saving || uploading}>Remove</button>
                      </figcaption>
                    </figure>
                  ) : (
                    <div className="place-image-empty">
                      <strong>No image yet</strong>
                      <span>Add one photo that represents this Place. Avoid private/sensitive information.</span>
                    </div>
                  )}
                  <label className="image-upload-button image-upload-button--full">
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving || uploading} onChange={handleImageChange} />
                    {uploading ? 'Uploading...' : imagePreviewSrc ? 'Replace image' : 'Upload image'}
                  </label>
                </div>
              </section>
            )}

            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <div className="cta-row place-save-row">
              {step === 'details' ? (
                <button className="button primary" type="submit" disabled={saving || uploading}>Continue to image</button>
              ) : (
                <button className="button primary" type="submit" disabled={saving || uploading}>{saving ? 'Saving...' : saveLabel}</button>
              )}
              {step === 'image' ? <button type="button" className="button secondary" onClick={() => setStep('details')} disabled={saving || uploading}>Back to details</button> : null}
              <Link className="button secondary" href={returnHref}>{returnLabel}</Link>
            </div>
          </form>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
