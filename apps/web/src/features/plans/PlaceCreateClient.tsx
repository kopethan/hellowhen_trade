'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { DiscoveryLanguage, GoogleResolvedPlace, InventoryTranslationDto, MediaAssetDto, PlaceStaticMapTemplateFamily, PlanPlaceMode } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { mediaSrc, normalizeMediaUpload } from '../inventory/inventoryPresentation';
import { GooglePlacePicker } from './GooglePlacePicker';
import { emptyProviderAddressFormState, offlineProviderAddressError, onlineDestinationError, onlineProviderHint, providerAddressFormStateFromGooglePlace, providerAddressFormStateFromStoredPlace, providerAddressPayloadFromFormState, providerAddressStatusLabel, type WebProviderAddressFormState } from './placeAddressForm';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';

type PlaceCreateClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
  placeId?: string;
};

type PlaceTranslationFormValue = { languageCode: DiscoveryLanguage; title: string; description: string };

const PLACE_STATIC_MAP_TEMPLATE_FAMILIES = [
  'clean_local',
  'night_social',
  'soft_pastel',
  'minimal_address',
  'city_grid',
  'green_outdoor',
  'warm_travel',
  'premium_mono',
] as const satisfies readonly PlaceStaticMapTemplateFamily[];
type PlaceCreateStep = 'details' | 'image';

type PlaceCreateFormState = {
  mode: PlanPlaceMode;
  title: string;
  description: string;
  defaultLanguage: DiscoveryLanguage;
  translations: PlaceTranslationFormValue[];
  location: string;
  providerAddress: WebProviderAddressFormState;
  onlineLabel: string;
  onlineUrl: string;
  staticMapTemplateFamily: PlaceStaticMapTemplateFamily | '';
};

function makePlaceCreateForm(defaultLanguage: DiscoveryLanguage = 'en'): PlaceCreateFormState {
  return {
    mode: 'local',
    title: '',
    description: '',
    defaultLanguage,
    translations: [],
    location: '',
    providerAddress: emptyProviderAddressFormState(),
    onlineLabel: '',
    onlineUrl: '',
    staticMapTemplateFamily: '',
  };
}

function normalizeStaticMapTemplateFamily(value?: string | null): PlaceStaticMapTemplateFamily | '' {
  return PLACE_STATIC_MAP_TEMPLATE_FAMILIES.includes(value as PlaceStaticMapTemplateFamily) ? value as PlaceStaticMapTemplateFamily : '';
}

function formStateFromPlace(place: { mode?: PlanPlaceMode | null; title?: string | null; description?: string | null; defaultLanguage?: string | null; translations?: InventoryTranslationDto[] | null; addressPublicText?: string | null; areaLabel?: string | null; googlePlaceId?: string | null; googlePlaceName?: string | null; formattedAddress?: string | null; googleMapsUri?: string | null; latitude?: number | null; longitude?: number | null; locationSource?: string | null; addressValidationStatus?: string | null; onlineLabel?: string | null; onlineUrl?: string | null; staticMapTemplateFamily?: string | null }): PlaceCreateFormState {
  const mode = place.mode === 'remote' ? 'remote' : 'local';
  return {
    mode,
    title: place.title ?? '',
    description: place.description ?? '',
    defaultLanguage: normalizePlaceLanguage(place.defaultLanguage),
    translations: (place.translations ?? []).map((translation) => ({ languageCode: normalizePlaceLanguage(translation.languageCode), title: translation.title ?? '', description: translation.description ?? '' })),
    location: mode === 'local' ? place.formattedAddress ?? place.addressPublicText ?? place.areaLabel ?? '' : '',
    providerAddress: mode === 'local' ? providerAddressFormStateFromStoredPlace(place) : emptyProviderAddressFormState(),
    onlineLabel: mode === 'remote' ? place.onlineLabel ?? '' : '',
    onlineUrl: mode === 'remote' ? place.onlineUrl ?? '' : '',
    staticMapTemplateFamily: normalizeStaticMapTemplateFamily(place.staticMapTemplateFamily),
  };
}

function placeStaticMapTemplateCopy(templateFamily: PlaceStaticMapTemplateFamily, t: ReturnType<typeof useWebTranslation>['t']) {
  return {
    label: t(`places.list.mapTemplate.families.${templateFamily}.label`),
    description: t(`places.list.mapTemplate.families.${templateFamily}.body`),
  };
}

const placeLanguageOptions: DiscoveryLanguage[] = ['en', 'fr', 'es'];

function normalizePlaceLanguage(value?: string | null): DiscoveryLanguage {
  if (value === 'fr' || value === 'es') return value;
  return 'en';
}

function placeLanguageLabel(language: DiscoveryLanguage, t: ReturnType<typeof useWebTranslation>['t']) {
  return t(`places.languages.${language}`);
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

function setPlaceOriginalLanguage(state: PlaceCreateFormState, languageCode: DiscoveryLanguage): PlaceCreateFormState {
  if (state.defaultLanguage === languageCode) return state;
  return {
    ...state,
    defaultLanguage: languageCode,
    translations: state.translations.filter((translation) => translation.languageCode !== languageCode),
  };
}

function normalizePlaceTranslationsForPayload(state: PlaceCreateFormState) {
  return state.translations
    .filter((translation) => translation.languageCode !== state.defaultLanguage)
    .filter((translation) => translation.title.trim() || translation.description.trim())
    .map((translation) => ({ languageCode: translation.languageCode, title: translation.title.trim(), description: translation.description.trim() }));
}

function validatePlaceTranslations(state: PlaceCreateFormState, t: ReturnType<typeof useWebTranslation>['t']) {
  for (const translation of normalizePlaceTranslationsForPayload(state)) {
    if (!translation.title || !translation.description) return t('places.editor.errors.translationIncomplete');
    if (translation.title.length < 3) return t('places.editor.errors.translationNameTooShort');
  }
  return '';
}


function placeTranslationSummary(state: PlaceCreateFormState, t: ReturnType<typeof useWebTranslation>['t']) {
  const original = placeLanguageLabel(state.defaultLanguage, t);
  const draftCount = state.translations.length;
  if (!draftCount) return t('places.editor.language.summaryNone', { original });
  if (draftCount === 1) return t('places.editor.language.summaryDraftOne', { original, translation: placeLanguageLabel(state.translations[0]?.languageCode ?? state.defaultLanguage, t) });
  return t('places.editor.language.summaryDraftMany', { original, count: draftCount });
}

function placeHasTranslations(place: { translations?: InventoryTranslationDto[] | null }) {
  return Boolean((place.translations ?? []).some((translation) => (translation.title ?? '').trim() || (translation.description ?? '').trim()));
}

function activePlaceMedia(media?: MediaAssetDto[] | null) {
  return (media ?? []).filter((asset) => asset.status !== 'removed').slice(0, 1);
}

function PlaceModeSegment({ value, onChange }: { value: PlanPlaceMode; onChange: (value: PlanPlaceMode) => void }) {
  const { t } = useWebTranslation();
  return (
    <div className="plan-mode-segment place-mode-segment" aria-label={t('places.list.filters.mode')}>
      <button type="button" className={value === 'local' ? 'is-active' : ''} onClick={() => onChange('local')}>{t('places.editor.mode.offline')}</button>
      <button type="button" className={value === 'remote' ? 'is-active' : ''} onClick={() => onChange('remote')}>{t('places.editor.mode.online')}</button>
    </div>
  );
}

export function PlaceCreateClient({ plansEnabled, plansVisible, placeId }: PlaceCreateClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useWebAuth();
  const { language, t } = useWebTranslation();
  const returnToPlan = searchParams.get('returnTo') === 'plan';
  const copyFromPlaceId = searchParams.get('copyFromPlaceId');
  const isEditing = Boolean(placeId);
  const returnHref = returnToPlan ? '/plans/new' : '/places';
  const returnLabel = returnToPlan ? t('places.editor.return.planDraft') : t('places.editor.return.myPlaces');
  const saveLabel = returnToPlan ? (isEditing ? t('places.editor.return.updatePlanDraft') : t('places.editor.return.savePlanDraft')) : isEditing ? t('places.editor.actions.update') : t('places.editor.actions.save');
  const [state, setState] = useState<PlaceCreateFormState>(() => makePlaceCreateForm(normalizePlaceLanguage(language)));
  const [step, setStep] = useState<PlaceCreateStep>('details');
  const [translationPanelOpen, setTranslationPanelOpen] = useState(false);
  const [media, setMedia] = useState<MediaAssetDto[]>([]);
  const [canCustomizeMapTemplates, setCanCustomizeMapTemplates] = useState(false);
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
    if (!betaFeatures.plusSubscriptionFeatures.customizationEnabled || !auth.hydrated || !auth.isAuthenticated) {
      setCanCustomizeMapTemplates(false);
      return;
    }
    let mounted = true;
    async function loadPlusSnapshot() {
      try {
        const response = await api.plus.me();
        if (mounted) setCanCustomizeMapTemplates(Boolean(response.access.entitlements.customization));
      } catch {
        if (mounted) setCanCustomizeMapTemplates(false);
      }
    }
    void loadPlusSnapshot();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated]);

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
        setError(getFriendlyApiErrorMessage(caughtError, isEditing ? t('places.editor.errors.load') : t('places.editor.errors.copy')));
      })
      .finally(() => {
        if (!cancelled) setLoadingPlace(false);
      });

    return () => { cancelled = true; };
  }, [auth.hydrated, auth.isAuthenticated, copyFromPlaceId, isEditing, placeId, t]);

  function nextUrl() {
    return returnToPlan ? (isEditing && placeId ? `/places/${placeId}/edit?returnTo=plan` : '/places/new?returnTo=plan') : isEditing && placeId ? `/places/${placeId}/edit` : '/places/new';
  }

  function validateDetails() {
    if (state.title.trim().length < 3) return t('places.editor.errors.addName');
    if (state.mode === 'local') {
      const addressError = offlineProviderAddressError(state.providerAddress);
      if (addressError) return t('places.editor.errors.confirmedAddress');
    }
    if (state.mode === 'remote') {
      const destinationError = onlineDestinationError({ onlineUrl: state.onlineUrl });
      if (destinationError) return destinationError;
    }
    const translationError = validatePlaceTranslations(state, t);
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
      setMessage(t('places.editor.messages.imageUploaded'));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('places.editor.image.uploading')));
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
    setMessage(t('places.editor.messages.imageRemoved'));
  }

  function applyResolvedAddress(place: GoogleResolvedPlace | null) {
    setState((current) => ({ ...current, location: place?.formattedAddress || current.location, providerAddress: providerAddressFormStateFromGooglePlace(place) }));
  }

  function clearResolvedAddress(location: string) {
    setState((current) => ({ ...current, location, providerAddress: emptyProviderAddressFormState() }));
  }

  function changeMode(mode: PlanPlaceMode) {
    setState((current) => ({
      ...current,
      mode,
      location: mode === 'remote' ? '' : current.location,
      providerAddress: mode === 'remote' ? emptyProviderAddressFormState() : current.providerAddress,
      onlineLabel: mode === 'local' ? '' : current.onlineLabel,
      onlineUrl: mode === 'local' ? '' : current.onlineUrl,
    }));
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
      const providerAddressPayload = state.mode === 'local' ? providerAddressPayloadFromFormState(state.providerAddress) : null;
      const body = {
        mode: state.mode,
        title: state.title.trim(),
        description: state.description.trim() || undefined,
        defaultLanguage: state.defaultLanguage,
        translations: normalizePlaceTranslationsForPayload(state),
        visibility: 'private' as const,
        status: 'active' as const,
        addressPublicText: state.mode === 'local' ? providerAddressPayload?.formattedAddress : undefined,
        googlePlaceId: providerAddressPayload?.googlePlaceId,
        googlePlaceName: providerAddressPayload?.googlePlaceName,
        formattedAddress: providerAddressPayload?.formattedAddress,
        googleMapsUri: providerAddressPayload?.googleMapsUri,
        latitude: providerAddressPayload?.latitude,
        longitude: providerAddressPayload?.longitude,
        locationSource: providerAddressPayload?.locationSource,
        addressValidationStatus: providerAddressPayload?.addressValidationStatus,
        onlineLabel: state.mode === 'remote' ? state.onlineLabel.trim() || undefined : undefined,
        onlineUrl: state.mode === 'remote' ? state.onlineUrl.trim() || undefined : undefined,
        mediaIds: media.map((item) => item.id).slice(0, 1),
        staticMapTemplateFamily: canCustomizeMapTemplates && state.mode === 'local' && state.staticMapTemplateFamily ? state.staticMapTemplateFamily : undefined,
      };
      const response = isEditing && placeId ? await api.places.update(placeId, body) : await api.places.create(body);
      setMedia(activePlaceMedia(response.place.media));

      if (returnToPlan) {
        const queryKey = isEditing ? 'updatedPlaceId' : 'createdPlaceId';
        router.replace(`/plans/new?${queryKey}=${encodeURIComponent(response.place.id)}`);
        return;
      }

      setMessage(isEditing ? t('places.editor.messages.updated', { title: response.place.title }) : t('places.editor.messages.saved', { title: response.place.title }));
      if (!isEditing) {
        setState(makePlaceCreateForm(normalizePlaceLanguage(language)));
        setTranslationPanelOpen(false);
        setMedia([]);
        setStep('details');
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, isEditing ? t('places.editor.errors.update') : t('places.editor.errors.create')));
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
            <h2>{isEditing ? t('places.editor.title.edit') : t('places.editor.title.create')}</h2>
            <p>{returnToPlan ? t('places.editor.subtitle.copy') : isEditing ? t('places.editor.subtitle.edit') : t('places.editor.subtitle.create')}</p>
          </div>
        </section>

        {!auth.hydrated ? <section className="mobile-card"><p className="meta">{t('places.editor.auth.checking')}</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <h3>{t('places.editor.auth.loginRequired')}</h3>
            <p>{t('places.editor.auth.body')}</p>
            <button type="button" className="button primary" onClick={() => router.push(`/auth?next=${encodeURIComponent(nextUrl())}`)}>{t('places.editor.auth.login')}</button>
          </section>
        ) : null}

        {auth.isAuthenticated && loadingPlace ? <section className="mobile-card"><p className="meta">{t('places.editor.auth.loading')}</p></section> : null}

        {auth.isAuthenticated && !loadingPlace && editingLockedByPlans ? (
          <section className="mobile-card mobile-card--soft place-edit-locked-card">
            <span className="semantic-badge warning">{usedInPlansCount === 1 ? t('places.list.usage.one') : t('places.list.usage.many', { count: usedInPlansCount })}</span>
            <h3>{t('places.editor.locked.title')}</h3>
            <p>{t('places.editor.locked.body')}</p>
            <div className="cta-row">
              <Link className="button secondary" href={returnHref}>{returnLabel}</Link>
              <Link className="button primary" href={`/places/new?copyFromPlaceId=${encodeURIComponent(placeId ?? '')}`}>{t('places.editor.locked.createCopy')}</Link>
            </div>
          </section>
        ) : null}

        {auth.isAuthenticated && !loadingPlace && !editingLockedByPlans ? (
          <form className="mobile-card plan-form place-clean-form" onSubmit={handleSubmit} noValidate>
            <div className="place-step-tabs" aria-label={t('places.editor.title.create')}>
              <button type="button" className={step === 'details' ? 'is-active' : ''} onClick={() => setStep('details')} disabled={saving || uploading}>{t('places.editor.steps.details')}</button>
              <button type="button" className={step === 'image' ? 'is-active' : ''} onClick={goToImageStep} disabled={saving || uploading}>{t('places.editor.steps.image')}</button>
            </div>

            {step === 'details' ? (
              <>
                <div className="plan-form__section-title place-form__section-title">
                  <div>
                    <h3>{t('places.editor.details.title')}</h3>
                    <p className="meta">{t('places.editor.details.privateByDefault')}</p>
                  </div>
                  <span className="semantic-badge place">{t('places.editor.badge')}</span>
                </div>
                <div className="place-form__divider">
                  <PlaceModeSegment value={state.mode} onChange={changeMode} />
                </div>
                <label>
                  <span>{t('places.editor.fields.name')}</span>
                  <input value={state.title} onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))} minLength={3} maxLength={120} required placeholder={t('places.editor.fields.namePlaceholder')} />
                </label>
                {state.mode === 'remote' ? (
                  <div className="plan-form__row">
                    <label>
                      <span>{t('places.editor.fields.onlineLabel')}</span>
                      <input value={state.onlineLabel} onChange={(event) => setState((current) => ({ ...current, onlineLabel: event.target.value }))} maxLength={120} placeholder={t('places.editor.fields.onlineLabelPlaceholder')} />
                    </label>
                    <label>
                      <span>{t('places.editor.fields.onlineUrl')}</span>
                      <input type="url" value={state.onlineUrl} onChange={(event) => setState((current) => ({ ...current, onlineUrl: event.target.value }))} maxLength={500} placeholder="https://..." />
                      <small>{onlineProviderHint({ onlineUrl: state.onlineUrl })}</small>
                    </label>
                  </div>
                ) : (
                  <>
                    <GooglePlacePicker
                      value={state.location}
                      onValueChange={clearResolvedAddress}
                      onResolvedPlace={applyResolvedAddress}
                      disabled={saving || uploading}
                      label={t('places.editor.fields.address')}
                      placeholder={t('places.editor.fields.addressPlaceholder')}
                      helperText={t('places.editor.fields.addressHelp')}
                      languageCode={state.defaultLanguage}
                    />
                    {state.location.trim() && !providerAddressStatusLabel(state.providerAddress) ? <p className="form-error">{t('places.editor.errors.confirmedAddress')}</p> : null}
                  </>
                )}
                <label className="place-description-field">
                  <span>{t('places.editor.fields.description')}</span>
                  <textarea value={state.description} onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))} maxLength={2000} placeholder={t('places.editor.fields.descriptionPlaceholder')} />
                </label>

                <section className="inventory-translation-compact place-translation-compact">
                  <button
                    className="inventory-translation-toggle place-translation-main-toggle"
                    type="button"
                    aria-expanded={translationPanelOpen}
                    onClick={() => setTranslationPanelOpen((open) => !open)}
                  >
                    <span>{translationPanelOpen ? t('places.editor.language.hideOptions') : t('places.editor.language.panelTitle')}</span>
                    <strong>{placeTranslationSummary(state, t)}</strong>
                  </button>

                  {translationPanelOpen ? (
                    <section className="mobile-card mobile-card--soft inventory-translation-panel inventory-translation-panel--compact place-translation-panel">
                      <div className="inventory-translation-panel__header place-translation-summary">
                        <div className="inventory-form__helper-copy">
                          <strong>{t('places.editor.language.sectionTitle')}</strong>
                          <span>{t('places.editor.language.sectionBody')}</span>
                        </div>
                        <span className="inventory-language-summary">{t('places.editor.language.originalBadge', { language: placeLanguageLabel(state.defaultLanguage, t) })}</span>
                      </div>

                      <label className="field-label inventory-original-language-field">
                        <span className="field-label__row"><span>{t('places.editor.language.originalLabel')}</span></span>
                        <select value={state.defaultLanguage} onChange={(event) => setState((current) => setPlaceOriginalLanguage(current, normalizePlaceLanguage(event.target.value)))}>
                          {placeLanguageOptions.map((languageCode) => <option key={languageCode} value={languageCode}>{placeLanguageLabel(languageCode, t)}</option>)}
                        </select>
                        <small>{t('places.editor.language.originalHelp')}</small>
                      </label>

                      {state.translations.length ? (
                        state.translations.map((translation) => (
                          <div className="inventory-translation-panel__fields place-translation-fields" key={translation.languageCode}>
                            <div className="inventory-translation-panel__row">
                              <div>
                                <p className="eyebrow">{t('places.editor.language.manualFor', { language: placeLanguageLabel(translation.languageCode, t) })}</p>
                                <small>{t('places.editor.language.manualHelp')}</small>
                              </div>
                              <button type="button" className="button secondary compact" onClick={() => setState((current) => removePlaceTranslationDraft(current, translation.languageCode))}>{t('places.editor.language.remove')}</button>
                            </div>
                            <label>
                              <span>{t('places.editor.language.translatedName')}</span>
                              <input
                                value={translation.title}
                                onChange={(event) => setState((current) => setPlaceTranslationDraft(current, { ...translation, title: event.target.value }))}
                                minLength={translation.title ? 3 : undefined}
                                maxLength={120}
                                placeholder={t('places.editor.language.translatedNamePlaceholder')}
                              />
                            </label>
                            <label>
                              <span>{t('places.editor.language.translatedDescription')}</span>
                              <textarea
                                value={translation.description}
                                onChange={(event) => setState((current) => setPlaceTranslationDraft(current, { ...translation, description: event.target.value }))}
                                maxLength={2000}
                                placeholder={t('places.editor.language.translatedDescriptionPlaceholder')}
                              />
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="meta place-translation-empty">{t('places.editor.language.optionalBody')}</p>
                      )}

                      {availablePlaceTranslationLanguages(state).length ? (
                        <div className="inventory-language-actions place-translation-language-actions">
                          <span>{state.translations.length ? t('places.editor.language.addAnotherLanguage') : t('places.editor.language.addLanguage')}</span>
                          <div className="inventory-language-picker__buttons">
                            {availablePlaceTranslationLanguages(state).map((languageCode) => (
                              <button
                                key={languageCode}
                                type="button"
                                className="button secondary compact"
                                onClick={() => setState((current) => addPlaceTranslationDraft(current, languageCode))}
                              >
                                {placeLanguageLabel(languageCode, t)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <small className="inventory-language-complete">{t('places.editor.language.allAdded')}</small>
                      )}
                    </section>
                  ) : null}
                </section>
              </>
            ) : (
              <section className="place-image-step">
                <div className="plan-form__section-title place-form__section-title">
                  <div>
                    <h3>{t('places.editor.image.title')}</h3>
                    <p className="meta">{t('places.editor.image.body')}</p>
                  </div>
                  <span className="semantic-badge place">{t('places.editor.image.stepBadge')}</span>
                </div>
                <div className="place-image-picker-panel">
                  {imagePreviewSrc ? (
                    <figure className="place-image-preview-card">
                      <img src={imagePreviewSrc} alt={t('places.editor.image.selectedAlt')} />
                      <figcaption>
                        <div>
                          <strong>{t('places.editor.image.selected')}</strong>
                          <span>{t('places.editor.image.saveToKeep')}</span>
                        </div>
                        <button type="button" className="button secondary compact" onClick={removeImage} disabled={saving || uploading}>{t('places.editor.actions.remove')}</button>
                      </figcaption>
                    </figure>
                  ) : (
                    <div className="place-image-empty">
                      <strong>{t('places.editor.image.emptyTitle')}</strong>
                      <span>{t('places.editor.image.emptyBody')}</span>
                    </div>
                  )}
                  <label className="image-upload-button image-upload-button--full">
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving || uploading} onChange={handleImageChange} />
                    {uploading ? t('places.editor.actions.uploading') : imagePreviewSrc ? t('places.editor.image.replace') : t('places.editor.image.upload')}
                  </label>
                </div>

                {betaFeatures.plusSubscriptionFeatures.customizationEnabled && state.mode === 'local' ? (
                  <section className="place-map-template-picker">
                    <div className="inventory-form__helper-copy">
                      <strong>{t('places.list.mapTemplate.title')}</strong>
                      <span>{canCustomizeMapTemplates ? t('places.list.mapTemplate.plusBody') : t('places.list.mapTemplate.freeBody')}</span>
                    </div>
                    <div className="place-map-template-picker__grid" aria-label={t('places.list.mapTemplate.accessibility')}>
                      <button
                        type="button"
                        className={["place-map-template-option", !state.staticMapTemplateFamily ? 'is-selected' : null].filter(Boolean).join(' ')}
                        onClick={() => setState((current) => ({ ...current, staticMapTemplateFamily: '' }))}
                        disabled={saving || uploading || !canCustomizeMapTemplates}
                        aria-pressed={!state.staticMapTemplateFamily}
                      >
                        <span className="place-map-template-option__swatch is-system" aria-hidden="true" />
                        <strong>{t('places.list.mapTemplate.system')}</strong>
                        <small>{t('places.list.mapTemplate.systemBody')}</small>
                      </button>
                      {PLACE_STATIC_MAP_TEMPLATE_FAMILIES.map((templateFamily) => {
                        const selected = state.staticMapTemplateFamily === templateFamily;
                        const copy = placeStaticMapTemplateCopy(templateFamily, t);
                        return (
                          <button
                            key={templateFamily}
                            type="button"
                            className={["place-map-template-option", `place-map-template-option--${templateFamily}`, selected ? 'is-selected' : null].filter(Boolean).join(' ')}
                            onClick={() => setState((current) => ({ ...current, staticMapTemplateFamily: templateFamily }))}
                            disabled={saving || uploading || !canCustomizeMapTemplates}
                            aria-pressed={selected}
                          >
                            <span className="place-map-template-option__swatch" aria-hidden="true" />
                            <strong>{copy.label}</strong>
                            <small>{copy.description}</small>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </section>
            )}

            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <div className="cta-row place-save-row">
              {step === 'details' ? (
                <button className="button primary" type="submit" disabled={saving || uploading}>{t('places.editor.actions.continueToImage')}</button>
              ) : (
                <button className="button primary" type="submit" disabled={saving || uploading}>{saving ? t('places.editor.actions.saving') : saveLabel}</button>
              )}
              {step === 'image' ? <button type="button" className="button secondary" onClick={() => setStep('details')} disabled={saving || uploading}>{t('places.editor.actions.back')}</button> : null}
              <Link className="button secondary" href={returnHref}>{returnLabel}</Link>
            </div>
          </form>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
