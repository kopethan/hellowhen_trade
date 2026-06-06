'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CreateNeedRequest, CreateOfferRequest, InventoryDurationPreset, MediaAssetDto, TradeExchangeMode } from '@hellowhen/contracts';
import type { TranslationValues } from '@hellowhen/i18n';
import { INVENTORY_DESCRIPTION_MAX_LENGTH, INVENTORY_DESCRIPTION_MIN_LENGTH, INVENTORY_TITLE_MAX_LENGTH, INVENTORY_TITLE_MIN_LENGTH } from '@hellowhen/contracts/src/inventoryLimits';
import { findInventoryCategoryOption, getNextWizardStepId, getPreviousWizardStepId, inventoryCategoryOptions, type WizardStepDefinition } from '@hellowhen/shared';
import { buildWebWizardDraftKey, useWebWizardDraft, WizardFooter, WizardShell } from '../wizard';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { InventoryMediaOrderPanel } from './InventoryMediaOrderPanel';
import { InventoryPreviewThemePicker } from './InventoryPreviewThemePicker';
import {
  durationPresetLabel,
  durationPresetMinutes,
  emptyInventoryFormValues,
  getAvailableInventoryTranslationLanguages,
  getInventoryTranslationDraft,
  getVisibleInventoryTranslations,
  inventoryLanguageLabel,
  isInventoryDurationPreset,
  itemTypeLabel,
  kindLabel,
  modeLabel,
  normalizeInventoryItem,
  needDurationPresetOptions,
  normalizeInventoryTranslationsForPayload,
  normalizeMediaUpload,
  offerDurationPresetOptions,
  parseCsvList,
  parseLineList,
  removeInventoryTranslationDraft,
  setInventoryTranslationDraft,
  sideClassName,
  sideLabel,
  toIsoDate,
  type InventoryFormValues,
  type InventoryI18n,
  type InventoryItem,
  type InventoryKind,
} from './inventoryPresentation';

type InventoryCreateRedirect = {
  pathname: string;
  selectedParam: 'needId' | 'offerId' | 'proposalNeedId' | 'proposalOfferId';
  preservedParams?: Record<string, string | undefined>;
};

type InventoryCreateWizardClientProps = {
  kind: InventoryKind;
  cancelHref?: string;
  afterCreateRedirect?: InventoryCreateRedirect;
};

type InventoryWizardStepId = 'idea' | 'details' | 'images';
type LegacyInventoryWizardStepId = InventoryWizardStepId | 'review';
type InventoryWizardPersistedDraft = {
  activeStepId: LegacyInventoryWizardStepId;
  values: InventoryFormValues;
  media: MediaAssetDto[];
};

function parseMode(value: string): TradeExchangeMode | undefined {
  return value === 'remote' || value === 'local' || value === 'hybrid' ? value : undefined;
}

function formToNeedPayload(values: InventoryFormValues, mediaIds: string[], coverMediaId?: string): CreateNeedRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    defaultLanguage: values.defaultLanguage,
    translations: normalizeInventoryTranslationsForPayload(values),
    status: 'active',
    itemType: values.itemType,
    category: values.category.trim() || undefined,
    estimatedDurationPreset: values.estimatedDurationPreset,
    estimatedDurationMinutes: durationPresetMinutes(values.estimatedDurationPreset),
    mode: parseMode(values.mode),
    locationLabel: values.locationLabel.trim() || undefined,
    tags: parseCsvList(values.tags),
    expiresAt: toIsoDate(values.expiresAt),
    previewTheme: values.previewTheme,
    mediaIds,
    coverMediaId,
  };
}

function formToOfferPayload(values: InventoryFormValues, mediaIds: string[], coverMediaId?: string): CreateOfferRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    defaultLanguage: values.defaultLanguage,
    translations: normalizeInventoryTranslationsForPayload(values),
    status: 'active',
    itemType: values.itemType,
    category: values.category.trim() || undefined,
    typicalDurationPreset: values.typicalDurationPreset,
    typicalDurationMinutes: durationPresetMinutes(values.typicalDurationPreset),
    mode: parseMode(values.mode),
    locationLabel: values.locationLabel.trim() || undefined,
    includes: parseLineList(values.includes),
    tags: parseCsvList(values.tags),
    expiresAt: toIsoDate(values.expiresAt),
    previewTheme: values.previewTheme,
    mediaIds,
    coverMediaId,
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

function normalizeMediaOrder(items: MediaAssetDto[]): MediaAssetDto[] {
  const hasCover = items.some((item) => item.isCover);
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
    isCover: hasCover ? Boolean(item.isCover) : index === 0,
  }));
}

function buildFullFormHref(pathname: string, searchParams: { toString: () => string }) {
  const fullPathname = pathname.endsWith('/full') ? pathname : `${pathname.replace(/\/$/, '')}/full`;
  const query = searchParams.toString();
  return `${fullPathname}${query ? `?${query}` : ''}`;
}

function validateIdea(values: InventoryFormValues, kind: InventoryKind, t: (key: string, values?: TranslationValues) => string) {
  const cleanTitle = values.title.trim();
  const cleanDescription = values.description.trim();
  if (cleanTitle.length < INVENTORY_TITLE_MIN_LENGTH) return kind === 'need' ? t('validation.needTitleTooShort') : t('validation.offerTitleTooShort');
  if (cleanTitle.length > INVENTORY_TITLE_MAX_LENGTH) return t('validation.titleTooLong', { max: INVENTORY_TITLE_MAX_LENGTH });
  if (cleanDescription.length < INVENTORY_DESCRIPTION_MIN_LENGTH) return kind === 'need' ? t('validation.needDescriptionTooShort') : t('validation.offerDescriptionTooShort');
  if (cleanDescription.length > INVENTORY_DESCRIPTION_MAX_LENGTH) return t('validation.descriptionTooLong', { max: INVENTORY_DESCRIPTION_MAX_LENGTH });
  const incompleteTranslation = values.translations.some((translation) => (
    (translation.title.trim() !== '' && translation.description.trim() === '')
    || (translation.title.trim() === '' && translation.description.trim() !== '')
  ));
  if (incompleteTranslation) return t('inventory.errors.translationIncomplete');
  for (const translation of normalizeInventoryTranslationsForPayload(values)) {
    if (translation.title.length < INVENTORY_TITLE_MIN_LENGTH) return t('inventory.errors.translationTitleTooShort');
    if (translation.description.length < INVENTORY_DESCRIPTION_MIN_LENGTH) return t('inventory.errors.translationDescriptionTooShort');
  }
  return '';
}

function validateDetails(values: InventoryFormValues, t: (key: string) => string) {
  if (!parseMode(values.mode)) return t('validation.modeRequired');
  return '';
}

function InventoryPresetPicker<TValue extends string>({
  label,
  hint,
  value,
  options,
  optionalLabel,
  getLabel,
  onChange,
}: {
  label: string;
  hint?: string;
  value?: TValue;
  options: TValue[];
  optionalLabel: string;
  getLabel: (value: TValue) => string;
  onChange: (value: TValue | undefined) => void;
}) {
  return (
    <fieldset className="inventory-preset-field">
      <legend>
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </legend>
      <div className="inventory-preset-field__options">
        <button
          type="button"
          className={!value ? 'inventory-preset-field__option inventory-preset-field__option--selected' : 'inventory-preset-field__option'}
          aria-pressed={!value}
          onClick={() => onChange(undefined)}
        >
          {optionalLabel}
        </button>
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              type="button"
              key={option}
              className={selected ? 'inventory-preset-field__option inventory-preset-field__option--selected' : 'inventory-preset-field__option'}
              aria-pressed={selected}
              onClick={() => onChange(option)}
            >
              {getLabel(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function InventoryCreateWizardClient({ kind, cancelHref, afterCreateRedirect }: InventoryCreateWizardClientProps) {
  const auth = useWebAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, language } = useWebTranslation();
  const [activeStepId, setActiveStepId] = useState<InventoryWizardStepId>('idea');
  const [values, setValues] = useState<InventoryFormValues>(emptyInventoryFormValues);
  const [media, setMedia] = useState<MediaAssetDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [attemptedStepId, setAttemptedStepId] = useState<InventoryWizardStepId | null>(null);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [translationPanelOpen, setTranslationPanelOpen] = useState(false);
  const [translationPickerOpen, setTranslationPickerOpen] = useState(false);
  const [wizardMenuOpen, setWizardMenuOpen] = useState(false);
  const [wizardHelpOpen, setWizardHelpOpen] = useState(false);
  const i18n = useMemo(() => ({ t, language }), [language, t]);
  const noun = kindLabel(kind, i18n);
  const baseHref = kind === 'need' ? '/needs' : '/offers';
  const formCancelHref = cancelHref ?? baseHref;
  const fullFormHref = buildFullFormHref(pathname, searchParams);
  const mediaIds = useMemo(() => media.map((item) => item.id), [media]);
  const coverMediaId = useMemo(() => media.find((item) => item.isCover)?.id ?? media[0]?.id, [media]);
  const persistedDraft = useMemo<InventoryWizardPersistedDraft>(() => ({
    activeStepId,
    values,
    media,
  }), [activeStepId, media, values]);
  const draftStorageKey = useMemo(() => buildWebWizardDraftKey(kind === 'need' ? 'create-need' : 'create-offer', auth.user?.id), [auth.user?.id, kind]);
  const restoreDraft = useCallback((savedDraft: InventoryWizardPersistedDraft) => {
    const restoredValues = { ...emptyInventoryFormValues, ...(savedDraft.values ?? {}) };
    restoredValues.timing = '';
    restoredValues.availability = '';
    restoredValues.availabilityPreset = undefined;
    restoredValues.estimatedDurationPreset = isInventoryDurationPreset(restoredValues.estimatedDurationPreset) ? restoredValues.estimatedDurationPreset : undefined;
    restoredValues.estimatedDurationMinutes = durationPresetMinutes(restoredValues.estimatedDurationPreset);
    restoredValues.typicalDurationPreset = isInventoryDurationPreset(restoredValues.typicalDurationPreset) ? restoredValues.typicalDurationPreset : undefined;
    restoredValues.typicalDurationMinutes = durationPresetMinutes(restoredValues.typicalDurationPreset);
    setValues(restoredValues);
    setMedia(Array.isArray(savedDraft.media) ? normalizeMediaOrder(savedDraft.media) : []);
    setTranslationPanelOpen(Boolean(restoredValues.translations?.some((translation) => translation.title?.trim() || translation.description?.trim())));
    const restoredStepId = savedDraft.activeStepId === 'review' ? 'images' : savedDraft.activeStepId;
    setActiveStepId(['idea', 'details', 'images'].includes(restoredStepId) ? restoredStepId : 'idea');
  }, []);
  const inventoryWizardDraft = useWebWizardDraft({
    storageKey: draftStorageKey,
    draft: persistedDraft,
    enabled: !saving,
    hasContent: (candidate) => {
      const candidateValues = candidate.values ?? emptyInventoryFormValues;
      return Boolean(
        candidateValues.title?.trim()
        || candidateValues.description?.trim()
        || candidateValues.category?.trim()
        || candidateValues.estimatedDurationPreset
        || candidateValues.typicalDurationPreset
        || candidateValues.tags?.trim()
        || candidateValues.locationLabel?.trim()
        || candidateValues.includes?.trim()
        || candidateValues.expiresAt?.trim()
        || candidateValues.translations?.some((translation) => translation.title?.trim() || translation.description?.trim())
        || candidateValues.previewTheme !== 'default'
        || candidate.media?.length,
      );
    },
    onRestore: restoreDraft,
  });

  const steps = useMemo<WizardStepDefinition<InventoryWizardStepId>[]>(() => ([
    {
      id: 'idea',
      title: kind === 'need' ? t('inventory.form.needQuestion') : t('inventory.form.offerQuestion'),
      description: kind === 'need' ? t('inventory.wizard.needIdeaBody') : t('inventory.wizard.offerIdeaBody'),
      completed: !validateIdea(values, kind, t),
    },
    {
      id: 'details',
      title: t('inventory.wizard.detailsTitle'),
      description: t('inventory.wizard.detailsBody'),
      completed: !validateDetails(values, t) || Boolean(values.estimatedDurationPreset || values.typicalDurationPreset),
    },
    {
      id: 'images',
      title: `${t('inventory.wizard.imagesTitle')} + ${t('common.actions.save')}`,
      description: kind === 'need' ? t('inventory.wizard.needImagesBody') : t('inventory.wizard.offerImagesBody'),
      optional: true,
      completed: media.length > 0,
    },
  ]), [kind, media.length, t, values]);

  useEffect(() => {
    setValues((current) => current.defaultLanguage === language ? current : { ...current, defaultLanguage: language });
  }, [language]);

  function updateField<Key extends keyof InventoryFormValues>(field: Key, value: InventoryFormValues[Key]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateDurationPreset(nextPreset: InventoryDurationPreset | undefined) {
    const nextMinutes = durationPresetMinutes(nextPreset);
    setValues((current) => (kind === 'need'
      ? { ...current, estimatedDurationPreset: nextPreset, estimatedDurationMinutes: nextMinutes }
      : { ...current, typicalDurationPreset: nextPreset, typicalDurationMinutes: nextMinutes }));
  }

  function addTranslationLanguage(languageCode: InventoryFormValues['defaultLanguage']) {
    setValues((current) => setInventoryTranslationDraft(current, { languageCode, title: '', description: '' }));
    setTranslationPickerOpen(false);
    setTranslationPanelOpen(true);
  }

  function removeTranslationLanguage(languageCode: InventoryFormValues['defaultLanguage']) {
    setValues((current) => removeInventoryTranslationDraft(current, languageCode));
    setTranslationPickerOpen(false);
  }

  function hasTranslationFieldIssue() {
    return values.translations.some((translation) => {
      const cleanTitle = translation.title.trim();
      const cleanDescription = translation.description.trim();
      return (cleanTitle && !cleanDescription)
        || (!cleanTitle && cleanDescription)
        || (cleanTitle.length > 0 && cleanTitle.length < INVENTORY_TITLE_MIN_LENGTH)
        || (cleanDescription.length > 0 && cleanDescription.length < INVENTORY_DESCRIPTION_MIN_LENGTH);
    });
  }

  function currentStepValidationError() {
    if (activeStepId === 'idea') return validateIdea(values, kind, t);
    if (activeStepId === 'details') return validateDetails(values, t);
    return '';
  }

  function validateAll() {
    return validateIdea(values, kind, t) || validateDetails(values, t);
  }

  function goNext() {
    const validationError = currentStepValidationError();
    setAttemptedStepId(activeStepId);
    if (validationError) {
      if (activeStepId === 'idea' && hasTranslationFieldIssue()) setTranslationPanelOpen(true);
      setError(validationError);
      return;
    }
    setAttemptedStepId(null);
    setError('');
    setMessage('');
    const nextStepId = getNextWizardStepId(steps, activeStepId);
    if (nextStepId) setActiveStepId(nextStepId);
  }

  function goBack() {
    setError('');
    setMessage('');
    const previousStepId = getPreviousWizardStepId(steps, activeStepId);
    if (previousStepId) setActiveStepId(previousStepId);
  }

  function editStep(stepId: InventoryWizardStepId) {
    setAttemptedStepId(null);
    setError('');
    setMessage('');
    setActiveStepId(stepId);
  }

  function resetWizardDraft() {
    inventoryWizardDraft.clearDraft();
    setValues({ ...emptyInventoryFormValues, defaultLanguage: language });
    setMedia([]);
    setActiveStepId('idea');
    setAttemptedStepId(null);
    setShowOptionalDetails(false);
    setTranslationPanelOpen(false);
    setTranslationPickerOpen(false);
    setWizardHelpOpen(false);
    setWizardMenuOpen(false);
    setError('');
    setMessage('');
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
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
        if (uploaded) nextMedia.push({ ...uploaded, sortOrder: nextMedia.length, isCover: nextMedia.length === 0 });
      }
      setMedia(normalizeMediaOrder(nextMedia.slice(0, 5)));
      setMessage(t('inventory.messages.imageUploaded'));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause));
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void uploadFiles(event.target.files);
    event.target.value = '';
  }

  function removeMedia(mediaId: string) {
    setMedia((current) => normalizeMediaOrder(current.filter((item) => item.id !== mediaId)));
  }

  function moveMedia(mediaId: string, direction: 'up' | 'down') {
    setMedia((current) => {
      const index = current.findIndex((item) => item.id === mediaId);
      if (index < 0) return current;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(nextIndex, 0, item);
      return normalizeMediaOrder(next);
    });
  }

  function setCoverMedia(mediaId: string) {
    setMedia((current) => {
      const index = current.findIndex((item) => item.id === mediaId);
      if (index < 0) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.unshift(item);
      return normalizeMediaOrder(next.map((candidate) => ({ ...candidate, isCover: candidate.id === mediaId })));
    });
  }

  async function saveItem() {
    const validationError = validateAll();
    if (validationError) {
      const detailsError = validateDetails(values, t);
      const nextStepId: InventoryWizardStepId = validationError === detailsError ? 'details' : 'idea';
      setAttemptedStepId(nextStepId);
      setError(validationError);
      setActiveStepId(nextStepId);
      return;
    }
    setAttemptedStepId(null);
    setSaving(true);
    setError('');
    setMessage('');
    try {
      let saved: InventoryItem | null = null;
      if (kind === 'need') {
        const response = await api.needs.create(formToNeedPayload(values, mediaIds, coverMediaId));
        saved = normalizeInventoryItem(response, kind);
      } else {
        const response = await api.offers.create(formToOfferPayload(values, mediaIds, coverMediaId));
        saved = normalizeInventoryItem(response, kind);
      }
      inventoryWizardDraft.clearDraft();
      if (afterCreateRedirect && saved?.id) {
        router.push(buildCreateRedirectHref(afterCreateRedirect, saved.id));
      } else {
        router.push(`${baseHref}/${saved?.id ?? ''}`.replace(/\/$/, ''));
      }
      router.refresh();
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  const locationPlaceholder = kind === 'need' ? t('inventory.form.locationNeedPlaceholder') : t('inventory.form.locationOfferPlaceholder');
  const tagsPlaceholder = kind === 'need' ? t('inventory.form.tagsNeedPlaceholder') : t('inventory.form.tagsOfferPlaceholder');
  const selectedDurationPreset = kind === 'need' ? values.estimatedDurationPreset : values.typicalDurationPreset;
  const finalDurationPresetLabel = durationPresetLabel(selectedDurationPreset, i18n);
  const originalLanguageLabel = inventoryLanguageLabel(values.defaultLanguage, i18n);
  const visibleTranslations = getVisibleInventoryTranslations(values);
  const availableTranslationLanguages = getAvailableInventoryTranslationLanguages(values);
  const finalPrimaryLabel = kind === 'need' ? t('inventory.actions.saveNeed') : t('inventory.actions.saveOffer');
  const finalImagesBody = kind === 'need' ? t('inventory.wizard.needImagesBody') : t('inventory.wizard.offerImagesBody');
  const finalCategoryOption = values.category ? findInventoryCategoryOption(values.category) : undefined;
  const finalCategoryLabel = values.category ? (finalCategoryOption ? t(finalCategoryOption.labelKey) : values.category) : t('inventory.labels.notSpecified');
  const finalLocationLabel = values.locationLabel.trim() || t('inventory.labels.notSpecified');
  const finalDescription = values.description.trim() || t('inventory.form.previewDescriptionFallback');
  const titleError = activeStepId === 'idea' && attemptedStepId === 'idea' && values.title.trim().length < INVENTORY_TITLE_MIN_LENGTH
    ? (kind === 'need' ? t('validation.needTitleTooShort') : t('validation.offerTitleTooShort'))
    : '';
  const descriptionError = activeStepId === 'idea' && attemptedStepId === 'idea' && values.description.trim().length < INVENTORY_DESCRIPTION_MIN_LENGTH
    ? (kind === 'need' ? t('validation.needDescriptionTooShort') : t('validation.offerDescriptionTooShort'))
    : '';

  const isFirstStep = activeStepId === steps[0]?.id;
  const isFinalStep = activeStepId === 'images';

  if (!auth.isAuthenticated && auth.hydrated) {
    return (
      <section className="mobile-page">
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
          <h3>{t('inventory.signedOut.formTitle', { items: kind === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase() })}</h3>
          <p>{t('inventory.signedOut.formBody')}</p>
          <Link href="/auth" className="button">{t('auth.actions.signIn')}</Link>
        </section>
      </section>
    );
  }

  return (
    <section className="mobile-page inventory-create-page">
      <WizardShell
        title={kind === 'need' ? t('inventory.wizard.createNeedTitle') : t('inventory.wizard.createOfferTitle')}
        backHref={formCancelHref}
        backLabel={t('common.actions.back')}
        steps={steps}
        activeStepId={activeStepId}
        stepLabel={t('inventory.wizard.stepLabel')}
        ofLabel={t('inventory.wizard.ofLabel')}
        className="wizard-shell--inventory-create"
        rightSlot={(
          <div className="inventory-create-menu">
            <button
              type="button"
              className="inventory-create-menu__trigger"
              aria-haspopup="menu"
              aria-expanded={wizardMenuOpen}
              aria-label={t('inventory.wizard.menuTitle')}
              onClick={() => setWizardMenuOpen((open) => !open)}
            >
              <span className="inventory-create-menu__trigger-dot" aria-hidden="true" />
            </button>
            {wizardMenuOpen ? (
              <div className="inventory-create-menu__panel" role="menu" aria-label={t('inventory.wizard.menuTitle')}>
                <Link role="menuitem" href={fullFormHref} onClick={() => setWizardMenuOpen(false)}>{t('inventory.wizard.openFullForm')}</Link>
                <button role="menuitem" type="button" onClick={resetWizardDraft}>{t('inventory.wizard.resetDraft')}</button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setWizardHelpOpen((open) => !open);
                    setWizardMenuOpen(false);
                  }}
                >
                  {wizardHelpOpen ? t('common.actions.hide') : t('inventory.wizard.helpTitle')}
                </button>
              </div>
            ) : null}
          </div>
        )}
        footer={(
          <WizardFooter
            primaryLabel={isFinalStep ? finalPrimaryLabel : t('common.actions.continue')}
            primaryLoading={saving}
            primaryLoadingLabel={t('common.states.saving')}
            primaryDisabled={uploading || !auth.hydrated || saving}
            onPrimary={isFinalStep ? () => void saveItem() : goNext}
            secondaryLabel={isFirstStep ? t('common.actions.cancel') : t('common.actions.back')}
            secondaryHref={isFirstStep ? formCancelHref : undefined}
            onSecondary={isFirstStep ? undefined : goBack}
            helperText={isFinalStep ? t('inventory.wizard.saveActiveHelper') : undefined}
          />
        )}
      >
        {inventoryWizardDraft.restored ? <p className="form-message">{t('inventory.wizard.draftRestoredTitle')} · {t('inventory.wizard.draftRestoredBody')}</p> : null}

        {wizardHelpOpen ? (
          <section className="mobile-card mobile-card--soft inventory-create-help-panel" role="note">
            <div>
              <span className="semantic-badge instruction">{t('inventory.wizard.menuTitle')}</span>
              <h3>{t('inventory.wizard.helpTitle')}</h3>
              <p>{kind === 'need' ? t('inventory.wizard.needHelpBody') : t('inventory.wizard.offerHelpBody')}</p>
            </div>
            <Link href={fullFormHref} className="button secondary compact">{t('inventory.wizard.openFullForm')}</Link>
          </section>
        ) : null}

        {activeStepId === 'idea' ? (
          <section className="mobile-card inventory-wizard-card inventory-wizard-card--idea">
            <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind, i18n)}</span>
            <label className="field-label">
              <span className="field-label__row"><span>{t('inventory.labels.title')}</span><small>{t('inventory.form.textCounter', { count: values.title.length, max: INVENTORY_TITLE_MAX_LENGTH })}</small></span>
              <input
                value={values.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder={kind === 'need' ? t('inventory.form.titleNeedExample') : t('inventory.form.titleOfferExample')}
                required
                minLength={INVENTORY_TITLE_MIN_LENGTH}
                maxLength={INVENTORY_TITLE_MAX_LENGTH}
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? 'inventory-idea-title-error' : undefined}
              />
            </label>
            {titleError ? <p id="inventory-idea-title-error" className="field-error" role="alert">{titleError}</p> : null}
            <label className="field-label">
              <span className="field-label__row"><span>{t('inventory.labels.description')}</span><small>{t('inventory.form.textCounter', { count: values.description.length, max: INVENTORY_DESCRIPTION_MAX_LENGTH })}</small></span>
              <textarea
                value={values.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder={kind === 'need' ? t('inventory.form.descriptionNeedMobile') : t('inventory.form.descriptionOfferMobile')}
                required
                minLength={INVENTORY_DESCRIPTION_MIN_LENGTH}
                maxLength={INVENTORY_DESCRIPTION_MAX_LENGTH}
                rows={4}
                aria-invalid={Boolean(descriptionError)}
                aria-describedby={descriptionError ? 'inventory-idea-description-error' : undefined}
              />
            </label>
            {descriptionError ? <p id="inventory-idea-description-error" className="field-error" role="alert">{descriptionError}</p> : null}
          </section>
        ) : null}

        {activeStepId === 'idea' ? (
          <section className="inventory-translation-compact">
            <button
              className="inventory-translation-toggle"
              type="button"
              aria-expanded={translationPanelOpen}
              onClick={() => setTranslationPanelOpen((open) => !open)}
            >
              <span>{translationPanelOpen ? t('inventory.wizard.hideManualTranslation') : t('inventory.wizard.showManualTranslation')}</span>
              <strong>{visibleTranslations.length ? t('inventory.wizard.translationPreparedShort') : t('inventory.form.languageTitle')}</strong>
            </button>

            {translationPanelOpen ? (
              <section className="mobile-card mobile-card--soft inventory-translation-panel inventory-translation-panel--compact">
                <div className="inventory-translation-panel__header">
                  <div className="inventory-form__helper-copy">
                    <strong>{t('inventory.form.languageTitle')}</strong>
                    <span>{t('inventory.form.languageBody')}</span>
                  </div>
                  <span className="inventory-language-summary">{t('inventory.form.originalContentLanguage', { language: originalLanguageLabel })}</span>
                </div>

                {visibleTranslations.map((translation) => {
                  const translationDraft = getInventoryTranslationDraft(values, translation.languageCode);
                  const translationLanguageLabel = inventoryLanguageLabel(translation.languageCode, i18n);
                  return (
                    <div className="inventory-translation-panel__fields" key={translation.languageCode}>
                      <div className="inventory-translation-panel__row">
                        <p className="eyebrow">{t('inventory.form.manualTranslationFor', { language: translationLanguageLabel })}</p>
                        <button type="button" className="button secondary compact" onClick={() => removeTranslationLanguage(translation.languageCode)}>{t('inventory.actions.removeTranslation')}</button>
                      </div>
                      <label className="field-label">
                        <span className="field-label__row"><span>{t('inventory.form.translationTitleLabel', { language: translationLanguageLabel })}</span><small>{t('inventory.labels.optional')}</small></span>
                        <input
                          value={translationDraft.title}
                          onChange={(event) => setValues((current) => setInventoryTranslationDraft(current, { ...getInventoryTranslationDraft(current, translation.languageCode), title: event.target.value }))}
                          placeholder={t('inventory.form.translationTitlePlaceholder')}
                          maxLength={INVENTORY_TITLE_MAX_LENGTH}
                        />
                      </label>
                      <label className="field-label">
                        <span className="field-label__row"><span>{t('inventory.form.translationDescriptionLabel', { language: translationLanguageLabel })}</span><small>{t('inventory.labels.optional')}</small></span>
                        <textarea
                          value={translationDraft.description}
                          onChange={(event) => setValues((current) => setInventoryTranslationDraft(current, { ...getInventoryTranslationDraft(current, translation.languageCode), description: event.target.value }))}
                          placeholder={t('inventory.form.translationDescriptionPlaceholder')}
                          maxLength={INVENTORY_DESCRIPTION_MAX_LENGTH}
                          rows={4}
                        />
                      </label>
                      <small>{t('inventory.form.translationHelp')}</small>
                    </div>
                  );
                })}

                {availableTranslationLanguages.length ? (
                  <div className="inventory-language-actions">
                    {translationPickerOpen ? (
                      <div className="inventory-language-picker">
                        <span>{t('inventory.form.chooseTranslationLanguage')}</span>
                        <div className="inventory-language-picker__buttons">
                          {availableTranslationLanguages.map((languageCode) => (
                            <button type="button" className="button secondary compact" key={languageCode} onClick={() => addTranslationLanguage(languageCode)}>
                              {inventoryLanguageLabel(languageCode, i18n)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="button secondary" onClick={() => setTranslationPickerOpen(true)}>{t('inventory.actions.addLanguage')}</button>
                    )}
                  </div>
                ) : (
                  <small className="inventory-language-complete">{t('inventory.form.allLanguagesAdded')}</small>
                )}
              </section>
            ) : null}
          </section>
        ) : null}

        {activeStepId === 'details' ? (
          <section className="mobile-card mobile-card--soft inventory-wizard-card inventory-wizard-card--details">
            <div className="inventory-details-primary">
              <label className="field-label">
                {t('inventory.labels.type')}
                <select value={values.itemType} onChange={(event) => updateField('itemType', event.target.value as InventoryFormValues['itemType'])}>
                  <option value="service">{itemTypeLabel('service', i18n)}</option>
                  <option value="goods">{itemTypeLabel('goods', i18n)}</option>
                  <option value="other">{itemTypeLabel('other', i18n)}</option>
                </select>
              </label>
              <label className="field-label">
                <span className="field-label__row"><span>{t('inventory.labels.category')}</span><small>{t('inventory.labels.optional')}</small></span>
                <select value={values.category} onChange={(event) => updateField('category', event.target.value)}>
                  <option value="">{t('inventory.labels.optional')}</option>
                  {values.category && !findInventoryCategoryOption(values.category) ? <option value={values.category}>{values.category}</option> : null}
                  {inventoryCategoryOptions.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
                </select>
              </label>
              <div className="inventory-details-primary__wide inventory-chain-field-grid">
                <InventoryPresetPicker
                  label={kind === 'need' ? t('inventory.chain.needDurationLabel') : t('inventory.chain.offerDurationLabel')}
                  hint={kind === 'need' ? t('inventory.chain.needDurationHint') : t('inventory.chain.offerDurationHint')}
                  value={selectedDurationPreset}
                  options={kind === 'need' ? needDurationPresetOptions : offerDurationPresetOptions}
                  optionalLabel={t('inventory.labels.optional')}
                  getLabel={(option) => durationPresetLabel(option, i18n)}
                  onChange={updateDurationPreset}
                />
              </div>
              <label className="field-label">
                {t('inventory.labels.mode')}
                <select value={values.mode} onChange={(event) => updateField('mode', event.target.value)} required>
                  <option value="remote">{modeLabel('remote', i18n)}</option>
                  <option value="local">{modeLabel('local', i18n)}</option>
                  <option value="hybrid">{modeLabel('hybrid', i18n)}</option>
                </select>
              </label>
              <label className="field-label">
                <span className="field-label__row"><span>{t('inventory.labels.locationLabel')}</span><small>{t('inventory.labels.optional')}</small></span>
                <input value={values.locationLabel} onChange={(event) => updateField('locationLabel', event.target.value)} placeholder={locationPlaceholder} maxLength={120} />
              </label>
            </div>

            <button
              className="inventory-details-toggle"
              type="button"
              aria-expanded={showOptionalDetails}
              onClick={() => setShowOptionalDetails((current) => !current)}
            >
              <span>{showOptionalDetails ? t('inventory.wizard.hideOptionalDetails') : t('inventory.wizard.showOptionalDetails')}</span>
              <strong>{finalDurationPresetLabel || (values.tags ? t('inventory.wizard.tagCount', { count: parseCsvList(values.tags).length }) : t('inventory.labels.optional'))}</strong>
            </button>

            {showOptionalDetails ? (
              <div className="inventory-details-optional">
                <label className="field-label">
                  <span className="field-label__row"><span>{t('inventory.labels.tags')}</span><small>{t('inventory.labels.optional')}</small></span>
                  <input value={values.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder={tagsPlaceholder} maxLength={160} />
                  <small>{t('inventory.form.separateWithCommas')}</small>
                </label>
                {kind === 'offer' ? (
                  <label className="field-label">
                    <span className="field-label__row"><span>{t('inventory.labels.includes')}</span><small>{t('inventory.labels.optional')}</small></span>
                    <textarea value={values.includes} onChange={(event) => updateField('includes', event.target.value)} placeholder={t('inventory.form.includesMobilePlaceholder')} rows={3} />
                    <small>{t('inventory.form.separateWithCommas')}</small>
                  </label>
                ) : null}
                <InventoryPreviewThemePicker value={values.previewTheme} disabled={saving || uploading} onChange={(nextTheme) => updateField('previewTheme', nextTheme)} />
              </div>
            ) : null}
          </section>
        ) : null}

        {activeStepId === 'images' ? (
          <section className="inventory-final-step">
            <section className="mobile-card inventory-save-summary-card inventory-wizard-card">
              <div className="inventory-save-summary-card__header">
                <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind, i18n)}</span>
                <button className="secondary compact" type="button" onClick={() => editStep('idea')}>{t('common.actions.edit')}</button>
              </div>
              <div>
                <p className="eyebrow">{t('common.states.review')}</p>
                <h3>{values.title.trim() || t('inventory.form.previewTitleFallback')}</h3>
                <p>{finalDescription}</p>
              </div>
              <dl className="inventory-save-summary-card__details">
                <div>
                  <dt>{t('inventory.labels.type')}</dt>
                  <dd>{itemTypeLabel(values.itemType, i18n)}</dd>
                </div>
                <div>
                  <dt>{t('inventory.labels.mode')}</dt>
                  <dd>{modeLabel(parseMode(values.mode) ?? 'remote', i18n)}</dd>
                </div>
                <div>
                  <dt>{t('inventory.labels.category')}</dt>
                  <dd>{finalCategoryLabel}</dd>
                </div>
                <div>
                  <dt>{kind === 'need' ? t('inventory.chain.needDurationLabel') : t('inventory.chain.offerDurationLabel')}</dt>
                  <dd>{finalDurationPresetLabel || t('inventory.labels.notSpecified')}</dd>
                </div>
                <div>
                  <dt>{t('inventory.labels.locationLabel')}</dt>
                  <dd>{finalLocationLabel}</dd>
                </div>
                <div>
                  <dt>{t('inventory.labels.images')}</dt>
                  <dd>{media.length ? t('inventory.form.selectedCount', { count: media.length, max: 5 }) : t('inventory.labels.noImagesSelected')}</dd>
                </div>
              </dl>
              <button className="inventory-save-summary-card__edit-details" type="button" onClick={() => editStep('details')}>
                <span>{t('common.actions.edit')} {t('inventory.labels.details').toLowerCase()}</span>
                <strong>{t('inventory.wizard.stepLabel')} 2</strong>
              </button>
            </section>

            <section className="mobile-card inventory-media-panel inventory-media-panel--final inventory-wizard-card">
              <div className="inventory-media-panel__header">
                <div>
                  <p className="eyebrow">{t('inventory.labels.images')}</p>
                  <h3>{media.length ? t('inventory.form.selectedCount', { count: media.length, max: 5 }) : kind === 'need' ? t('inventory.form.addNeedImages') : t('inventory.form.addOfferImages')}</h3>
                  <p>{finalImagesBody}</p>
                </div>
                <span className="semantic-badge muted">{t('inventory.form.imagePickerHint', { count: 5 })}</span>
              </div>
              <label className="image-upload-button image-upload-button--full">
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileChange} disabled={uploading || media.length >= 5} />
                {uploading ? t('media.states.uploading') : media.length >= 5 ? t('inventory.actions.imageLimitReached') : t('inventory.actions.uploadImages')}
              </label>
              {!media.length ? <p className="inventory-media-panel__empty">{t('inventory.labels.noImagesSelected')}</p> : null}
              <InventoryMediaOrderPanel
                media={media}
                disabled={saving || uploading}
                label={noun}
                onMove={moveMedia}
                onSetCover={setCoverMedia}
                onRemove={removeMedia}
              />
            </section>
          </section>
        ) : null}

        {message ? <p className="form-message form-message--success">{message}</p> : null}
        {error ? <p className="form-message form-message--error">{error}</p> : null}
        {!auth.hydrated ? <p className="form-message">{t('inventory.labels.checkingSession')}</p> : null}
      </WizardShell>
    </section>
  );
}
