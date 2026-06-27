'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { DiscoveryLanguage, InventoryTranslationDto, PlanPlaceMode } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';

type PlaceCreateClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
  placeId?: string;
};

type PlaceTranslationFormValue = { languageCode: DiscoveryLanguage; title: string; description: string };

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

function makePlaceCreateForm(): PlaceCreateFormState {
  return {
    mode: 'local',
    title: '',
    description: '',
    defaultLanguage: 'en',
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

function nextPlaceTranslationLanguage(state: PlaceCreateFormState) {
  const used = new Set([state.defaultLanguage, ...state.translations.map((translation) => translation.languageCode)]);
  return placeLanguageOptions.find((language) => !used.has(language));
}

function addPlaceTranslationDraft(state: PlaceCreateFormState): PlaceCreateFormState {
  const languageCode = nextPlaceTranslationLanguage(state);
  if (!languageCode) return state;
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

function PlaceModeSegment({ value, onChange }: { value: PlanPlaceMode; onChange: (value: PlanPlaceMode) => void }) {
  return (
    <div className="plan-mode-segment" aria-label="Place type">
      <button type="button" className={value === 'local' ? 'is-active' : ''} onClick={() => onChange('local')}>Local</button>
      <button type="button" className={value === 'remote' ? 'is-active' : ''} onClick={() => onChange('remote')}>Remote</button>
    </div>
  );
}

export function PlaceCreateClient({ plansEnabled, plansVisible, placeId }: PlaceCreateClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useWebAuth();
  const returnToPlan = searchParams.get('returnTo') === 'plan';
  const copyFromPlaceId = searchParams.get('copyFromPlaceId');
  const isEditing = Boolean(placeId);
  const [state, setState] = useState<PlaceCreateFormState>(makePlaceCreateForm());
  const [loadingPlace, setLoadingPlace] = useState(Boolean(placeId || copyFromPlaceId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const sourcePlaceId = placeId || copyFromPlaceId;
    if (!sourcePlaceId || !auth.hydrated || !auth.isAuthenticated) {
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(returnToPlan ? (isEditing && placeId ? `/places/${placeId}/edit?returnTo=plan` : '/places/new?returnTo=plan') : isEditing && placeId ? `/places/${placeId}/edit` : '/places/new')}`);
      return;
    }
    if (state.title.trim().length < 3) {
      setError('Add a Place name.');
      return;
    }
    const translationError = validatePlaceTranslations(state);
    if (translationError) {
      setError(translationError);
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');
    try {
      const body = {
        mode: state.mode,
        title: state.title,
        description: state.description.trim() || undefined,
        defaultLanguage: state.defaultLanguage,
        translations: normalizePlaceTranslationsForPayload(state),
        visibility: 'private' as const,
        status: 'active' as const,
        addressPublicText: state.mode === 'local' ? state.location.trim() || undefined : undefined,
        onlineLabel: state.mode === 'remote' ? state.onlineLabel.trim() || undefined : undefined,
        onlineUrl: state.mode === 'remote' ? state.onlineUrl.trim() || undefined : undefined,
      };
      const response = isEditing && placeId ? await api.places.update(placeId, body) : await api.places.create(body);

      if (returnToPlan) {
        const queryKey = isEditing ? 'updatedPlaceId' : 'createdPlaceId';
        router.replace(`/plans/new?${queryKey}=${encodeURIComponent(response.place.id)}`);
        return;
      }

      setMessage(isEditing ? `${response.place.title} was updated.` : `${response.place.title} was saved to My Places.`);
      if (!isEditing) setState(makePlaceCreateForm());
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, isEditing ? 'Could not update Place.' : 'Could not create Place.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page">
        <section className="page-intro plan-create-intro">
          <div>
            <PlansInternalBadge plansVisible={plansVisible} />
            <h2>{isEditing ? 'Edit Place' : 'Create Place'}</h2>
            <p>{returnToPlan ? (isEditing ? 'Update this Place, then return to your Plan.' : 'Save a Place, then return to your Plan.') : isEditing ? 'Update your reusable Place.' : 'Save an offline or online Place for future Plans.'}</p>
          </div>
        </section>

        {!auth.hydrated ? <section className="mobile-card"><p className="meta">Checking session...</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <h3>Log in required</h3>
            <p>Create and edit private reusable Places after signing in.</p>
            <button type="button" className="button primary" onClick={() => router.push(`/auth?next=${encodeURIComponent(returnToPlan ? (isEditing && placeId ? `/places/${placeId}/edit?returnTo=plan` : '/places/new?returnTo=plan') : isEditing && placeId ? `/places/${placeId}/edit` : '/places/new')}`)}>Log in</button>
          </section>
        ) : null}

        {auth.isAuthenticated && loadingPlace ? <section className="mobile-card"><p className="meta">Loading Place...</p></section> : null}

        {auth.isAuthenticated && !loadingPlace ? (
          <form className="mobile-card plan-form place-clean-form" onSubmit={submit}>
            <div className="plan-form__section-title">
              <div>
                <h3>Place details</h3>
                <p className="meta">Private by default. Reuse it in future Plans.</p>
              </div>
              <span className="semantic-badge place">My Place</span>
            </div>
            <PlaceModeSegment value={state.mode} onChange={(mode) => setState((current) => ({ ...current, mode }))} />
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
              <label>
                <span>Area / address</span>
                <input value={state.location} onChange={(event) => setState((current) => ({ ...current, location: event.target.value }))} maxLength={240} placeholder="Paris 11 or a public meeting point" />
              </label>
            )}
            <label>
              <span>Description</span>
              <textarea value={state.description} onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))} maxLength={2000} placeholder="Describe this place for later Plans." />
            </label>

            <section className="inventory-translation-compact place-translation-compact">
              <div className="inventory-translation-panel__header">
                <p className="eyebrow">Original language</p>
                <div className="plan-mode-segment" aria-label="Original Place language">
                  {placeLanguageOptions.map((languageCode) => (
                    <button
                      key={languageCode}
                      type="button"
                      className={state.defaultLanguage === languageCode ? 'is-active' : ''}
                      onClick={() => setState((current) => ({ ...current, defaultLanguage: languageCode, translations: current.translations.filter((translation) => translation.languageCode !== languageCode) }))}
                    >
                      {placeLanguageLabel(languageCode)}
                    </button>
                  ))}
                </div>
              </div>
              {state.translations.length ? (
                <section className="mobile-card mobile-card--soft inventory-translation-panel inventory-translation-panel--compact place-translation-panel">
                  {state.translations.map((translation) => (
                    <div className="inventory-translation-panel__fields" key={translation.languageCode}>
                      <div className="inventory-translation-panel__row">
                        <p className="eyebrow">{placeLanguageLabel(translation.languageCode)} translation</p>
                        <button type="button" className="button secondary compact" onClick={() => setState((current) => removePlaceTranslationDraft(current, translation.languageCode))}>Remove</button>
                      </div>
                      <label>
                        <span>Translated Place name</span>
                        <input
                          value={translation.title}
                          onChange={(event) => setState((current) => setPlaceTranslationDraft(current, { ...translation, title: event.target.value }))}
                          minLength={translation.title ? 3 : undefined}
                          maxLength={120}
                          placeholder="Translated place name"
                        />
                      </label>
                      <label>
                        <span>Translated description</span>
                        <textarea
                          value={translation.description}
                          onChange={(event) => setState((current) => setPlaceTranslationDraft(current, { ...translation, description: event.target.value }))}
                          maxLength={2000}
                          placeholder="Translated description"
                        />
                      </label>
                      <small>Fill both fields to save this language.</small>
                    </div>
                  ))}
                  {nextPlaceTranslationLanguage(state) ? <button type="button" className="button secondary compact" onClick={() => setState(addPlaceTranslationDraft)}>Add another language</button> : null}
                </section>
              ) : (
                <button type="button" className="inventory-translation-toggle" onClick={() => setState(addPlaceTranslationDraft)}>
                  <span>Add languages</span>
                  <strong>Translate Place name and description</strong>
                </button>
              )}
            </section>

            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <div className="cta-row">
              <button className="button primary" type="submit" disabled={saving || state.title.trim().length < 3}>{saving ? 'Saving...' : returnToPlan ? isEditing ? 'Update and return' : 'Save and return' : isEditing ? 'Update Place' : 'Save Place'}</button>
              <Link className="button secondary" href={returnToPlan ? '/plans/new' : '/plans'}>{returnToPlan ? 'Back to Plan draft' : 'Back to Plans'}</Link>
            </div>
          </form>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
