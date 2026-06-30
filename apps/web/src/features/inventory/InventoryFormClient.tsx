'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import type { CreateNeedRequest, CreateOfferRequest, DiscoveryLanguage, InventoryItemType, MediaAssetDto, NeedDto, OfferDto, TradeExchangeMode, UpdateNeedRequest, UpdateOfferRequest } from '@hellowhen/contracts';
import { findInventoryCategoryOption, inventoryCategoryOptions } from '@hellowhen/shared';
import { INVENTORY_DESCRIPTION_MAX_LENGTH, INVENTORY_DESCRIPTION_MIN_LENGTH, INVENTORY_TITLE_MAX_LENGTH, INVENTORY_TITLE_MIN_LENGTH } from '@hellowhen/contracts/src/inventoryLimits';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { InventoryAiAssistPanel } from './InventoryAiAssistPanel';
import { InventoryMediaOrderPanel } from './InventoryMediaOrderPanel';
import { InventoryPreviewThemePicker } from './InventoryPreviewThemePicker';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import {
  emptyInventoryFormValues,
  getAvailableInventoryTranslationLanguages,
  getInventoryTranslationDraft,
  getVisibleInventoryTranslations,
  inventoryLanguageLabel,
  inventoryLanguageOptions,
  inventoryToFormValues,
  itemTypeLabel,
  kindLabel,
  normalizeInventoryItem,
  normalizeInventoryTranslationsForPayload,
  normalizeMediaUpload,
  removeInventoryTranslationDraft,
  parseCsvList,
  parseLineList,
  sideClassName,
  modeLabel,
  setInventoryOriginalLanguage,
  setInventoryTranslationDraft,
  sideLabel,
  toIsoDate,
  type InventoryFormValues,
  type InventoryItem,
  type InventoryKind,
} from './inventoryPresentation';

type InventoryCreateRedirect = {
  pathname: string;
  selectedParam: 'needId' | 'offerId' | 'proposalNeedId' | 'proposalOfferId';
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

function formToNeedPayload(values: InventoryFormValues, mediaIds: string[], coverMediaId?: string): CreateNeedRequest | UpdateNeedRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    defaultLanguage: values.defaultLanguage,
    translations: normalizeInventoryTranslationsForPayload(values),
    status: values.status as NeedDto['status'],
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

function formToOfferPayload(values: InventoryFormValues, mediaIds: string[], coverMediaId?: string): CreateOfferRequest | UpdateOfferRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    defaultLanguage: values.defaultLanguage,
    translations: normalizeInventoryTranslationsForPayload(values),
    status: values.status as OfferDto['status'],
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

export function InventoryFormClient({ kind, itemId, mode, cancelHref, afterCreateRedirect }: InventoryFormClientProps) {
  const auth = useWebAuth();
  const router = useRouter();
  const { t, language } = useWebTranslation();
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
  const i18n = useMemo(() => ({ t, language }), [language, t]);
  const noun = kindLabel(kind, i18n);
  const lowerNoun = noun.toLowerCase();
  const isEditProtected = mode === 'edit' && Boolean(deleteImpact?.blocked);
  const originalLanguageLabel = inventoryLanguageLabel(values.defaultLanguage, i18n);
  const visibleTranslations = getVisibleInventoryTranslations(values);
  const availableTranslationLanguages = getAvailableInventoryTranslationLanguages(values);
  const [translationPickerOpen, setTranslationPickerOpen] = useState(false);

  useEffect(() => {
    if (mode !== 'create') return;
    setValues((current) => current.defaultLanguage === language ? current : { ...current, defaultLanguage: language });
  }, [language, mode]);

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
          setMedia(normalizeMediaOrder(item.media ?? []));
        }
      } catch {
        if (!mounted) return;
        const fallback = demoDataEnabled ? (kind === 'need' ? mockNeeds : mockOffers).find((item) => item.id === requestedItemId) ?? null : null;
        setValues(inventoryToFormValues(fallback));
        setMedia(normalizeMediaOrder(fallback?.media ?? []));
        setMessage(demoDataEnabled && fallback ? t('inventory.messages.usingDemoData') : t('inventory.messages.itemCouldNotLoad'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadItem();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated, demoDataEnabled, itemId, kind, mode, t]);

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
  const coverMediaId = useMemo(() => media.find((item) => item.isCover)?.id ?? media[0]?.id, [media]);

  function updateField<Key extends keyof InventoryFormValues>(field: Key, value: InventoryFormValues[Key]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function applyAiTranslation(languageCode: DiscoveryLanguage, titleText: string, descriptionText: string) {
    setValues((current) => setInventoryTranslationDraft(current, { languageCode, title: titleText, description: descriptionText }));
    setTranslationPickerOpen(false);
  }

  function applyAiCategoryTags(categoryText: string, tagList: string[]) {
    setValues((current) => ({ ...current, category: categoryText, tags: tagList.join(', ') }));
  }

  function updateOriginalLanguage(languageCode: InventoryFormValues['defaultLanguage']) {
    setValues((current) => setInventoryOriginalLanguage(current, languageCode));
    setTranslationPickerOpen(false);
  }

  function addTranslationLanguage(languageCode: InventoryFormValues['defaultLanguage']) {
    setValues((current) => setInventoryTranslationDraft(current, { languageCode, title: '', description: '' }));
    setTranslationPickerOpen(false);
  }

  function removeTranslationLanguage(languageCode: InventoryFormValues['defaultLanguage']) {
    setValues((current) => removeInventoryTranslationDraft(current, languageCode));
    setTranslationPickerOpen(false);
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

  function removeMedia(mediaId: string) {
    if (isEditProtected) return;
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

  function validateValues() {
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
    if (!parseMode(values.mode)) return t('validation.modeRequired');
    return '';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isEditProtected) {
      setError(t('inventory.errors.editProtected', { item: lowerNoun }));
      return;
    }
    const validationError = validateValues();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = kind === 'need' ? formToNeedPayload(values, mediaIds, coverMediaId) : formToOfferPayload(values, mediaIds, coverMediaId);
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
          <span className="semantic-badge instruction">{t('common.states.loading')}</span>
          <h3>{!auth.hydrated ? t('inventory.labels.checkingSession') : t('inventory.messages.loadingItems', { items: lowerNoun })}</h3>
        </section>
      </section>
    );
  }

  return (
    <section className="mobile-page">
      {!auth.isAuthenticated && auth.hydrated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
          <h3>{t('inventory.signedOut.formTitle', { items: kind === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase() })}</h3>
          <p>{t('inventory.signedOut.formBody')}</p>
          <Link href="/auth" className="button">{t('auth.actions.signIn')}</Link>
        </section>
      ) : null}

      <form className="inventory-form" onSubmit={handleSubmit}>
        {isEditProtected ? (
          <section className="notice-box warning inventory-delete-warning">
            <strong>{t('inventory.delete.lockedTitle', { item: lowerNoun })}</strong>
            <span>{t('inventory.delete.lockedBody', { item: lowerNoun })}</span>
            {deleteImpact?.activeTrades?.[0] ? <Link href={`/trades/${deleteImpact.activeTrades[0].id}`} className="button secondary">{t('inventory.delete.viewTrade')}</Link> : null}
          </section>
        ) : null}

        <fieldset className="inventory-form__editable" disabled={isEditProtected}>
        <section className="mobile-card inventory-form__hero">
          <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind, i18n)} · {originalLanguageLabel}</span>
          <label className="field-label">
            <span className="field-label__row"><span>{t('inventory.labels.title')}</span><small>{t('inventory.form.textCounter', { count: values.title.length, max: INVENTORY_TITLE_MAX_LENGTH })}</small></span>
            <input value={values.title} onChange={(event) => updateField('title', event.target.value)} placeholder={kind === 'need' ? t('inventory.form.titleNeedPlaceholder') : t('inventory.form.titleOfferPlaceholder')} required minLength={INVENTORY_TITLE_MIN_LENGTH} maxLength={INVENTORY_TITLE_MAX_LENGTH} />
          </label>
          <label className="field-label">
            <span className="field-label__row"><span>{t('inventory.labels.description')}</span><small>{t('inventory.form.textCounter', { count: values.description.length, max: INVENTORY_DESCRIPTION_MAX_LENGTH })}</small></span>
            <textarea value={values.description} onChange={(event) => updateField('description', event.target.value)} placeholder={kind === 'need' ? t('inventory.form.descriptionNeedPlaceholder') : t('inventory.form.descriptionOfferPlaceholder')} required minLength={INVENTORY_DESCRIPTION_MIN_LENGTH} maxLength={INVENTORY_DESCRIPTION_MAX_LENGTH} rows={5} />
          </label>
        </section>

        <InventoryAiAssistPanel
          kind={kind}
          title={values.title}
          description={values.description}
          defaultLanguage={values.defaultLanguage}
          category={values.category}
          tags={values.tags}
          disabled={isEditProtected || saving || uploading}
          onApplyTitle={(nextTitle) => updateField('title', nextTitle)}
          onApplyDescription={(nextDescription) => updateField('description', nextDescription)}
          onApplyTranslation={applyAiTranslation}
          onApplyCategoryTags={applyAiCategoryTags}
        />

        <InventoryPreviewThemePicker
          value={values.previewTheme}
          disabled={isEditProtected || saving || uploading}
          onChange={(nextTheme) => updateField('previewTheme', nextTheme)}
        />

        <section className="mobile-card mobile-card--soft inventory-translation-panel">
          <div className="inventory-translation-panel__header">
            <div className="inventory-form__helper-copy">
              <strong>{t('inventory.form.languageTitle')}</strong>
              <span>{t('inventory.form.languageBody')}</span>
            </div>
            <span className="inventory-language-summary">{t('inventory.form.originalContentLanguage', { language: inventoryLanguageLabel(values.defaultLanguage, i18n) })}</span>
          </div>

          <label className="field-label inventory-original-language-field">
            <span className="field-label__row"><span>{t('inventory.form.originalLanguageSelector')}</span><small>{t('inventory.labels.defaultLanguage')}</small></span>
            <select value={values.defaultLanguage} onChange={(event) => updateOriginalLanguage(event.target.value as InventoryFormValues['defaultLanguage'])}>
              {inventoryLanguageOptions.map((languageCode) => <option key={languageCode} value={languageCode}>{inventoryLanguageLabel(languageCode, i18n)}</option>)}
            </select>
            <small>{t('inventory.form.originalLanguageHelp')}</small>
          </label>

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

        <section className="mobile-card mobile-card--soft inventory-form__grid inventory-form__grid--simple">
          <div className="inventory-form__wide inventory-form__helper-copy">
            <strong>{t('inventory.form.simplifiedDetailsTitle')}</strong>
            <span>{t('inventory.form.simplifiedDetailsBody')}</span>
          </div>
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
        </section>

        <section className="mobile-card inventory-media-panel">
          <div>
            <p className="eyebrow">{t('inventory.labels.images')}</p>
            <h3>{media.length ? t('inventory.form.selectedCount', { count: media.length }) : kind === 'need' ? t('inventory.form.addNeedImages') : t('inventory.form.addOfferImages')}</h3>
            <p>{t('inventory.form.imagePanelBody')}</p>
          </div>
          <label className="image-upload-button">
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => uploadFiles(event.target.files)} disabled={isEditProtected || uploading || media.length >= 5} />
            {uploading ? t('media.states.uploading') : media.length >= 5 ? t('inventory.actions.imageLimitReached') : t('inventory.actions.uploadImages')}
          </label>
          <InventoryMediaOrderPanel
            media={media}
            disabled={isEditProtected || saving || uploading}
            label={noun}
            onMove={moveMedia}
            onSetCover={setCoverMedia}
            onRemove={removeMedia}
          />
        </section>

        </fieldset>

        {message ? <p className="form-message form-message--success">{message}</p> : null}
        {error ? <p className="form-message form-message--error">{error}</p> : null}

        <div className="sticky-form-actions">
          {mode === 'edit' ? <button type="button" className={deleteImpact?.blocked ? 'secondary warning-button' : 'secondary danger-button'} onClick={openDeleteDialog} disabled={saving}>{deleteImpact?.blocked ? t('inventory.labels.usedInTrade') : t('inventory.actions.delete')}</button> : <Link href={formCancelHref} className="button secondary">{t('common.actions.cancel')}</Link>}
          <button type="submit" disabled={saving || uploading || isEditProtected}>{saving ? t('common.states.saving') : mode === 'edit' ? `${t('common.actions.save')} ${noun}` : `${t('common.actions.create')} ${noun}`}</button>
        </div>
      </form>

      <ConfirmDialog
        open={deleteDialogOpen}
        eyebrow={deleteImpact?.blocked ? t('inventory.labels.protected') : t('inventory.actions.delete')}
        title={deleteImpact?.blocked ? t('inventory.delete.blockedTitle', { item: lowerNoun }) : t('inventory.delete.deleteTitle', { item: lowerNoun })}
        body={deleteImpact?.blocked
          ? t('inventory.delete.blockedBody', { item: lowerNoun })
          : deleteImpact?.linkedTradeCount
            ? t('inventory.delete.linkedBody', { item: lowerNoun })
            : t('inventory.delete.normalBody', { item: lowerNoun })}
        variant={deleteImpact?.blocked ? 'warning' : 'danger'}
        confirmLabel={deleteImpact?.blocked ? t('inventory.actions.ok') : t('inventory.actions.delete')}
        showCancel={!deleteImpact?.blocked}
        loading={saving}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={deleteImpact?.blocked ? () => setDeleteDialogOpen(false) : handleDelete}
      />
    </section>
  );
}
