'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CreateNeedRequest, CreateOfferRequest, MediaAssetDto, NeedDto, OfferDto, TradeExchangeMode } from '@hellowhen/contracts';
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
  emptyInventoryFormValues,
  getInventoryMetadata,
  itemTypeLabel,
  kindLabel,
  mediaSrc,
  modeLabel,
  normalizeInventoryItem,
  normalizeInventoryTranslationsForPayload,
  normalizeMediaUpload,
  parseCsvList,
  parseLineList,
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

type InventoryWizardStepId = 'idea' | 'details' | 'images' | 'review';
type InventoryWizardPersistedDraft = {
  activeStepId: InventoryWizardStepId;
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
    timing: values.timing.trim() || undefined,
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
    availability: values.availability.trim() || undefined,
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
  return '';
}

function validateDetails(values: InventoryFormValues, t: (key: string) => string) {
  if (!parseMode(values.mode)) return t('validation.modeRequired');
  return '';
}

function WizardReviewCard({ kind, values, media, i18n }: { kind: InventoryKind; values: InventoryFormValues; media: MediaAssetDto[]; i18n: InventoryI18n }) {
  const previewItem = useMemo(() => {
    const base = {
      id: 'preview',
      title: values.title.trim() || (kind === 'need' ? i18n.t?.('inventory.form.titleNeedExample') ?? 'Landing page design' : i18n.t?.('inventory.form.titleOfferExample') ?? 'Product photography'),
      description: values.description.trim(),
      status: 'active',
      itemType: values.itemType,
      category: values.category,
      mode: parseMode(values.mode),
      locationLabel: values.locationLabel,
      tags: parseCsvList(values.tags),
      expiresAt: null,
      defaultLanguage: values.defaultLanguage,
      translations: [],
      previewTheme: values.previewTheme,
      media,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: '',
    };
    return kind === 'need'
      ? ({ ...base, timing: values.timing } as unknown as NeedDto)
      : ({ ...base, availability: values.availability, includes: parseLineList(values.includes) } as unknown as OfferDto);
  }, [i18n, kind, media, values]);
  const metadata = getInventoryMetadata(previewItem, i18n);
  const image = media[0] ?? null;

  return (
    <article className={`inventory-wizard-review inventory-wizard-review--${sideClassName(kind)}`}>
      <div className="inventory-wizard-review__media" aria-hidden="true">
        {image ? <img src={mediaSrc(image)} alt="" /> : <span>{sideLabel(kind, i18n)}</span>}
      </div>
      <div className="inventory-wizard-review__body">
        <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind, i18n)}</span>
        <h3>{previewItem.title}</h3>
        {values.description.trim() ? <p>{values.description.trim()}</p> : null}
        {metadata ? <small>{metadata}</small> : null}
        {media.length ? <em>{i18n.t?.('inventory.wizard.imageCount', { count: media.length }) ?? `${media.length} images`}</em> : <em>{i18n.t?.('inventory.labels.noImagesSelected') ?? 'No images selected yet.'}</em>}
      </div>
    </article>
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
  const i18n = useMemo(() => ({ t, language }), [language, t]);
  const noun = kindLabel(kind, i18n);
  const lowerNoun = noun.toLowerCase();
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
    setValues({ ...emptyInventoryFormValues, ...(savedDraft.values ?? {}) });
    setMedia(Array.isArray(savedDraft.media) ? normalizeMediaOrder(savedDraft.media) : []);
    setActiveStepId(['idea', 'details', 'images', 'review'].includes(savedDraft.activeStepId) ? savedDraft.activeStepId : 'idea');
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
        || candidateValues.timing?.trim()
        || candidateValues.availability?.trim()
        || candidateValues.tags?.trim()
        || candidateValues.locationLabel?.trim()
        || candidateValues.includes?.trim()
        || candidateValues.expiresAt?.trim()
        || candidateValues.previewTheme !== 'default'
        || candidate.media?.length,
      );
    },
    onRestore: restoreDraft,
  });

  const steps = useMemo<WizardStepDefinition<InventoryWizardStepId>[]>(() => ([
    {
      id: 'idea',
      title: kind === 'need' ? t('inventory.wizard.needIdeaTitle') : t('inventory.wizard.offerIdeaTitle'),
      description: kind === 'need' ? t('inventory.wizard.needIdeaBody') : t('inventory.wizard.offerIdeaBody'),
      completed: !validateIdea(values, kind, t),
    },
    {
      id: 'details',
      title: t('inventory.wizard.detailsTitle'),
      description: t('inventory.wizard.detailsBody'),
      completed: !validateDetails(values, t),
    },
    {
      id: 'images',
      title: t('inventory.wizard.imagesTitle'),
      description: kind === 'need' ? t('inventory.wizard.needImagesBody') : t('inventory.wizard.offerImagesBody'),
      optional: true,
      completed: media.length > 0,
    },
    {
      id: 'review',
      title: t('inventory.wizard.reviewTitle'),
      description: t('inventory.wizard.reviewBody'),
    },
  ]), [kind, media.length, t, values]);

  useEffect(() => {
    setValues((current) => current.defaultLanguage === language ? current : { ...current, defaultLanguage: language });
  }, [language]);

  function updateField<Key extends keyof InventoryFormValues>(field: Key, value: InventoryFormValues[Key]) {
    setValues((current) => ({ ...current, [field]: value }));
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
    if (validationError) {
      setError(validationError);
      return;
    }
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
      setError(validationError);
      setActiveStepId(validationError === validateDetails(values, t) ? 'details' : 'idea');
      return;
    }
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

  const isFirstStep = activeStepId === steps[0]?.id;
  const isReviewStep = activeStepId === 'review';

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
    <section className="mobile-page">
      <WizardShell
        title={kind === 'need' ? t('inventory.wizard.createNeedTitle') : t('inventory.wizard.createOfferTitle')}
        subtitle={kind === 'need' ? t('inventory.wizard.createNeedBody') : t('inventory.wizard.createOfferBody')}
        backHref={formCancelHref}
        backLabel={t('common.actions.back')}
        steps={steps}
        activeStepId={activeStepId}
        stepLabel={t('inventory.wizard.stepLabel')}
        ofLabel={t('inventory.wizard.ofLabel')}
        rightSlot={<Link className="button secondary compact" href={fullFormHref}>{t('inventory.wizard.fullFormShort')}</Link>}
        footer={(
          <WizardFooter
            primaryLabel={isReviewStep ? `${t('common.actions.create')} ${noun}` : t('common.actions.continue')}
            primaryLoading={saving}
            primaryLoadingLabel={t('common.states.saving')}
            primaryDisabled={uploading || !auth.hydrated || saving}
            onPrimary={isReviewStep ? () => void saveItem() : goNext}
            secondaryLabel={isFirstStep ? t('common.actions.cancel') : t('common.actions.back')}
            secondaryHref={isFirstStep ? formCancelHref : undefined}
            onSecondary={isFirstStep ? undefined : goBack}
            tertiaryLabel={t('inventory.wizard.openFullForm')}
            tertiaryHref={fullFormHref}
            helperText={isReviewStep ? t('inventory.wizard.saveActiveHelper') : undefined}
          />
        )}
      >
        {inventoryWizardDraft.restored ? <p className="form-message">{t('inventory.wizard.draftRestoredTitle')} · {t('inventory.wizard.draftRestoredBody')}</p> : null}

        {activeStepId === 'idea' ? (
          <section className="mobile-card inventory-wizard-card">
            <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind, i18n)}</span>
            <label className="field-label">
              <span className="field-label__row"><span>{t('inventory.labels.title')}</span><small>{t('inventory.form.textCounter', { count: values.title.length, max: INVENTORY_TITLE_MAX_LENGTH })}</small></span>
              <input value={values.title} onChange={(event) => updateField('title', event.target.value)} placeholder={kind === 'need' ? t('inventory.form.titleNeedPlaceholder') : t('inventory.form.titleOfferPlaceholder')} required minLength={INVENTORY_TITLE_MIN_LENGTH} maxLength={INVENTORY_TITLE_MAX_LENGTH} />
            </label>
            <label className="field-label">
              <span className="field-label__row"><span>{t('inventory.labels.description')}</span><small>{t('inventory.form.textCounter', { count: values.description.length, max: INVENTORY_DESCRIPTION_MAX_LENGTH })}</small></span>
              <textarea value={values.description} onChange={(event) => updateField('description', event.target.value)} placeholder={kind === 'need' ? t('inventory.form.descriptionNeedPlaceholder') : t('inventory.form.descriptionOfferPlaceholder')} required minLength={INVENTORY_DESCRIPTION_MIN_LENGTH} maxLength={INVENTORY_DESCRIPTION_MAX_LENGTH} rows={6} />
            </label>
            <aside className="notice-box neutral inventory-wizard-advanced-note">
              <strong>{t('inventory.wizard.languageAdvancedTitle')}</strong>
              <span>{t('inventory.wizard.languageAdvancedBody')}</span>
              <Link href={fullFormHref}>{t('inventory.wizard.openFullForm')}</Link>
            </aside>
          </section>
        ) : null}

        {activeStepId === 'details' ? (
          <section className="mobile-card mobile-card--soft inventory-form__grid inventory-form__grid--simple inventory-wizard-card">
            <label className="field-label inventory-form__wide">
              {t('inventory.labels.type')}
              <select value={values.itemType} onChange={(event) => updateField('itemType', event.target.value as InventoryFormValues['itemType'])}>
                <option value="service">{itemTypeLabel('service', i18n)}</option>
                <option value="goods">{itemTypeLabel('goods', i18n)}</option>
                <option value="other">{itemTypeLabel('other', i18n)}</option>
              </select>
            </label>
            <label className="field-label inventory-form__wide">
              <span className="field-label__row"><span>{t('inventory.labels.category')}</span><small>{t('inventory.labels.optional')}</small></span>
              <select value={values.category} onChange={(event) => updateField('category', event.target.value)}>
                <option value="">{t('inventory.labels.optional')}</option>
                {values.category && !findInventoryCategoryOption(values.category) ? <option value={values.category}>{values.category}</option> : null}
                {inventoryCategoryOptions.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
              </select>
              <small>{t('inventory.form.categoryHelp')}</small>
            </label>
            <label className="field-label inventory-form__wide">
              {kind === 'need' ? t('inventory.labels.timing') : t('inventory.labels.availability')}
              <input
                value={kind === 'need' ? values.timing : values.availability}
                onChange={(event) => updateField(kind === 'need' ? 'timing' : 'availability', event.target.value)}
                placeholder={kind === 'need' ? t('inventory.form.timingPlaceholder') : t('inventory.form.availabilityPlaceholder')}
                maxLength={120}
              />
            </label>
            <label className="field-label inventory-form__wide">
              <span className="field-label__row"><span>{t('inventory.labels.tags')}</span><small>{t('inventory.labels.optional')}</small></span>
              <input value={values.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder={t('inventory.form.tagsPlaceholder')} maxLength={160} />
              <small>{t('inventory.form.separateWithCommas')}</small>
            </label>
            <label className="field-label">
              {t('inventory.labels.mode')}
              <select value={values.mode} onChange={(event) => updateField('mode', event.target.value)} required>
                <option value="remote">{modeLabel('remote', i18n)}</option>
                <option value="local">{modeLabel('local', i18n)}</option>
                <option value="hybrid">{modeLabel('hybrid', i18n)}</option>
              </select>
            </label>
            <label className="field-label">
              {t('inventory.labels.locationLabel')}
              <input value={values.locationLabel} onChange={(event) => updateField('locationLabel', event.target.value)} placeholder={t('inventory.form.locationPlaceholder')} maxLength={120} />
            </label>
            {kind === 'offer' ? (
              <label className="field-label inventory-form__wide">
                <span className="field-label__row"><span>{t('inventory.labels.includes')}</span><small>{t('inventory.labels.optional')}</small></span>
                <textarea value={values.includes} onChange={(event) => updateField('includes', event.target.value)} placeholder={t('inventory.form.includesPlaceholder')} rows={4} />
                <small>{t('inventory.form.separateWithCommas')}</small>
              </label>
            ) : null}
            <div className="inventory-form__wide">
              <InventoryPreviewThemePicker value={values.previewTheme} disabled={saving || uploading} onChange={(nextTheme) => updateField('previewTheme', nextTheme)} />
            </div>
          </section>
        ) : null}

        {activeStepId === 'images' ? (
          <section className="mobile-card inventory-media-panel inventory-wizard-card">
            <div>
              <p className="eyebrow">{t('inventory.labels.images')}</p>
              <h3>{media.length ? t('inventory.form.selectedCount', { count: media.length, max: 5 }) : kind === 'need' ? t('inventory.form.addNeedImages') : t('inventory.form.addOfferImages')}</h3>
              <p>{t('inventory.form.imagePanelBody')}</p>
            </div>
            <label className="image-upload-button">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileChange} disabled={uploading || media.length >= 5} />
              {uploading ? t('media.states.uploading') : media.length >= 5 ? t('inventory.actions.imageLimitReached') : t('inventory.actions.uploadImages')}
            </label>
            <InventoryMediaOrderPanel
              media={media}
              disabled={saving || uploading}
              label={noun}
              onMove={moveMedia}
              onSetCover={setCoverMedia}
              onRemove={removeMedia}
            />
          </section>
        ) : null}

        {activeStepId === 'review' ? (
          <section className="inventory-wizard-review-stack">
            <WizardReviewCard kind={kind} values={values} media={media} i18n={i18n} />
            <section className="notice-box neutral inventory-wizard-advanced-note">
              <strong>{t('inventory.wizard.reviewNoticeTitle')}</strong>
              <span>{t('inventory.wizard.reviewNoticeBody')}</span>
              <Link href={fullFormHref}>{t('inventory.wizard.openFullForm')}</Link>
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
