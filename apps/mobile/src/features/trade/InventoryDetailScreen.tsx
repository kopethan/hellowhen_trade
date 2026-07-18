import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning';
import { AddToAgendaButton } from '../../components/AddToAgendaButton';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { SavedToggleButton } from '../../components/SavedToggleButton';
import {
  DetailBottomActionBar,
  DetailEmptyState,
  DetailHero,
  DetailImageGrid,
  DetailInfoList,
  DetailMetadataChips,
  DetailSection,
} from '../../components/detail';
import { InfoNotice, StatusBadge } from '../../components/SemanticUI';
import { ContentLanguageControls, shouldShowContentLanguageControls, useContentLanguageSelection } from '../../components/ContentLanguageControls';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { ImagePickerField } from './components/ImagePickerField';
import {
  CategoryPicker,
  categoryLabel,
  durationPresetLabel,
  itemTypeLabel,
  InventoryLanguagePanel,
} from './components/InventoryFormFields';
import {
  DangerButton,
  ExistingMediaManager,
  getOptionalString,
  InventoryModePicker,
  InventoryTextField,
  modeLabel,
  normalizeMode,
  optionalText,
  type InventoryMode,
} from './components/InventoryDetailFields';
import { formatUploadProgress, getFriendlyUploadErrorMessage, uploadSelectedImages, type SelectedImageUploadProgress, type SelectedLocalImage } from './mediaUpload';
import { resolveMediaUrl } from './mediaUrls';
import type {
  DiscoveryLanguage,
  InventoryItemType,
  MediaAssetDto,
} from '@hellowhen/contracts';
import {
  INVENTORY_DESCRIPTION_MAX_LENGTH,
  INVENTORY_DESCRIPTION_MIN_LENGTH,
  INVENTORY_TITLE_MAX_LENGTH,
  INVENTORY_TITLE_MIN_LENGTH,
} from '@hellowhen/contracts/src/inventoryLimits';
import { formatLocalizedDate } from '@hellowhen/i18n';
import { useLocalizedInventoryItem } from './inventoryDisplay';
import type { NeedItem, OfferItem } from './types';
import {
  buildInventoryTranslationsPayload,
  changeInventoryOriginalLanguage,
  inventoryTranslationDraftsEqual,
  inventoryTranslationDraftsFromItem,
  validateInventoryTranslationDrafts,
  type InventoryTranslationDraft,
  type InventoryTranslationValidationIssue,
} from './inventoryTranslations';

type InventoryKind = 'need' | 'offer';
type InventoryItem = (NeedItem | OfferItem) & Record<string, unknown>;
type InventoryResponse = {
  need?: NeedItem;
  offer?: OfferItem;
  archived?: boolean;
};
type TFunction = (
  key: string,
  values?: Record<string, string | number | boolean | null | undefined>,
) => string;

function statusLabel(status: string | null | undefined, t: TFunction) {
  const key = `inventory.statuses.${status ?? ''}`;
  const translated = t(key);
  if (!status || translated === key)
    return status ?? t('common.states.unknown');
  return translated;
}

function statusTone(
  status: string | null | undefined,
): 'success' | 'warning' | 'danger' | 'time' | 'muted' {
  if (status === 'active' || status === 'fulfilled' || status === 'accepted')
    return 'success';
  if (status === 'draft') return 'warning';
  if (status === 'expired') return 'time';
  if (status === 'closed') return 'muted';
  return 'muted';
}

function activeDetailImages(item: InventoryItem | null) {
  return (item?.media ?? [])
    .filter((media) => media.status === 'active')
    .map((media) => ({ id: media.id, uri: resolveMediaUrl(media.url) }));
}

function structuredInventoryTiming(item: InventoryItem | null, isNeed: boolean, t: TFunction) {
  if (!item) return { duration: '' };
  const duration = isNeed
    ? durationPresetLabel((item as NeedItem).estimatedDurationPreset, t)
    : durationPresetLabel((item as OfferItem).typicalDurationPreset, t);
  return { duration };
}

function detailChips({
  itemType,
  category,
  timingOrAvailability,
  mode,
  locationLabel,
  t,
  tone,
}: {
  itemType: InventoryItemType;
  category: string;
  timingOrAvailability: string;
  mode: InventoryMode;
  locationLabel: string;
  t: TFunction;
  tone: 'need' | 'offer';
}) {
  return [
    itemTypeLabel(itemType, t),
    categoryLabel(category, t),
    timingOrAvailability,
    modeLabel(mode, t),
    locationLabel,
  ]
    .filter(Boolean)
    .map((label) => ({ label, tone }));
}


function normalizeMediaOrder(items: MediaAssetDto[]): MediaAssetDto[] {
  const active = items.filter((item) => item.status !== 'removed');
  const hasCover = active.some((item) => item.isCover);
  return active.map((item, index) => ({
    ...item,
    sortOrder: index,
    isCover: hasCover ? Boolean(item.isCover) : index === 0,
  }));
}

export function InventoryDetailScreen({
  kind,
  itemId,
  fallbackTitle,
  navigation,
}: {
  kind: InventoryKind;
  itemId: string;
  fallbackTitle?: string;
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t, language } = useTranslation();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [defaultLanguage, setDefaultLanguage] =
    useState<DiscoveryLanguage>(language);
  const [translations, setTranslations] = useState<InventoryTranslationDraft[]>([]);
  const [itemType, setItemType] = useState<InventoryItemType>('service');
  const [category, setCategory] = useState('');
  const [timingOrAvailability, setTimingOrAvailability] = useState('');
  const [mode, setMode] = useState<InventoryMode>('remote');
  const [locationLabel, setLocationLabel] = useState('');
  const [existingMedia, setExistingMedia] = useState<MediaAssetDto[]>([]);
  const [newImages, setNewImages] = useState<SelectedLocalImage[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<SelectedImageUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [languagePanelExpanded, setLanguagePanelExpanded] = useState(false);

  const isNeed = kind === 'need';
  const label = isNeed
    ? t('inventory.labels.need')
    : t('inventory.labels.offer');
  const labelLower = isNeed
    ? t('inventory.labels.need').toLowerCase()
    : t('inventory.labels.offer').toLowerCase();
  const labelsLower = isNeed
    ? t('inventory.labels.needs').toLowerCase()
    : t('inventory.labels.offers').toLowerCase();
  const tone = isNeed ? 'need' : 'offer';
  const titlePlaceholder = isNeed
    ? t('inventory.form.titleNeedExample')
    : t('inventory.form.titleOfferExample');
  const locationPlaceholder = isNeed
    ? t('inventory.form.locationNeedPlaceholder')
    : t('inventory.form.locationOfferPlaceholder');

  const hasUnsavedEditing = useMemo(() => {
    if (!editing || !item) return false;
    const itemTimingOrAvailability = isNeed
      ? getOptionalString(item, 'timing')
      : getOptionalString(item, 'availability');
    const itemDefaultLanguage =
      (item.defaultLanguage as DiscoveryLanguage | undefined) ?? language;
    const itemTranslations = inventoryTranslationDraftsFromItem(item.translations, itemDefaultLanguage);

    return Boolean(
      title !== (item.title ?? '') ||
        description !== (item.description ?? '') ||
        defaultLanguage !== itemDefaultLanguage ||
        !inventoryTranslationDraftsEqual(translations, itemTranslations, defaultLanguage) ||
        itemType !== ((item.itemType as InventoryItemType | undefined) ?? 'service') ||
        category !== getOptionalString(item, 'category') ||
        timingOrAvailability !== itemTimingOrAvailability ||
        mode !== normalizeMode(getOptionalString(item, 'mode')) ||
        locationLabel !== getOptionalString(item, 'locationLabel') ||
        existingMedia.map((media) => media.id).join(',') !== (item.media ?? []).filter((media) => media.status !== 'removed').map((media) => media.id).join(',') ||
        existingMedia.find((media) => media.isCover)?.id !== (item.media ?? []).find((media) => media.isCover)?.id ||
        newImages.length > 0,
    );
  }, [category, defaultLanguage, description, editing, isNeed, item, itemType, language, locationLabel, mode, newImages.length, timingOrAvailability, title, translations]);

  const unsavedChangesConfirm = useUnsavedChangesWarning({
    navigation,
    enabled: hasUnsavedEditing && !saving,
    title: t('inventory.form.unsavedTitle'),
    body: t('inventory.form.unsavedBody'),
    stayLabel: t('common.actions.cancel'),
    discardLabel: t('inventory.form.discardDraft'),
  });

  function changeDefaultLanguage(nextLanguage: DiscoveryLanguage) {
    const nextDraft = changeInventoryOriginalLanguage({ defaultLanguage, title, description, translations }, nextLanguage);
    setDefaultLanguage(nextDraft.defaultLanguage);
    setTitle(nextDraft.title);
    setDescription(nextDraft.description);
    setTranslations(nextDraft.translations);
  }

  const hydrateForm = useCallback(
    (nextItem: InventoryItem) => {
      setItem(nextItem);
      setTitle(nextItem.title ?? '');
      setDescription(nextItem.description ?? '');
      const nextDefaultLanguage =
        (nextItem.defaultLanguage as DiscoveryLanguage | undefined) ?? language;
      setDefaultLanguage(nextDefaultLanguage);
      setTranslations(inventoryTranslationDraftsFromItem(nextItem.translations, nextDefaultLanguage));
      setItemType(
        (nextItem.itemType as InventoryItemType | undefined) ?? 'service',
      );
      setCategory(getOptionalString(nextItem, 'category'));
      setTimingOrAvailability(
        isNeed
          ? getOptionalString(nextItem, 'timing')
          : getOptionalString(nextItem, 'availability'),
      );
      setMode(normalizeMode(getOptionalString(nextItem, 'mode')));
      setLocationLabel(getOptionalString(nextItem, 'locationLabel'));
      setExistingMedia(normalizeMediaOrder(nextItem.media ?? []));
      setNewImages([]);
      setLanguagePanelExpanded(false);
    },
    [isNeed, language],
  );

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = isNeed
        ? ((await api.needs.get(itemId)) as InventoryResponse)
        : ((await api.offers.get(itemId)) as InventoryResponse);
      const nextItem = (isNeed ? result.need : result.offer) as
        | InventoryItem
        | undefined;
      if (!nextItem)
        throw new Error(t('inventory.errors.apiMissingItem', { item: label }));
      hydrateForm(nextItem);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [hydrateForm, isNeed, itemId, label, t]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  function translationValidationMessage(issue: InventoryTranslationValidationIssue) {
    if (issue === 'incomplete') return t('inventory.errors.translationIncomplete');
    if (issue === 'title_too_short') return t('inventory.errors.translationTitleTooShort');
    if (issue === 'title_too_long') return t('validation.titleTooLong', { max: INVENTORY_TITLE_MAX_LENGTH });
    if (issue === 'description_too_short') return t('inventory.errors.translationDescriptionTooShort');
    return t('validation.descriptionTooLong', { max: INVENTORY_DESCRIPTION_MAX_LENGTH });
  }

  async function saveItem(nextStatus?: string) {
    if (title.trim().length < INVENTORY_TITLE_MIN_LENGTH) {
      setError(
        isNeed
          ? t('validation.needTitleTooShort')
          : t('validation.offerTitleTooShort'),
      );
      return;
    }
    if (title.trim().length > INVENTORY_TITLE_MAX_LENGTH) {
      setError(
        t('validation.titleTooLong', { max: INVENTORY_TITLE_MAX_LENGTH }),
      );
      return;
    }
    if (description.trim().length < INVENTORY_DESCRIPTION_MIN_LENGTH) {
      setError(
        isNeed
          ? t('validation.needDescriptionTooShort')
          : t('validation.offerDescriptionTooShort'),
      );
      return;
    }
    if (description.trim().length > INVENTORY_DESCRIPTION_MAX_LENGTH) {
      setError(
        t('validation.descriptionTooLong', {
          max: INVENTORY_DESCRIPTION_MAX_LENGTH,
        }),
      );
      return;
    }
    const translationIssue = validateInventoryTranslationDrafts(defaultLanguage, translations);
    if (translationIssue) {
      setLanguagePanelExpanded(true);
      setError(translationValidationMessage(translationIssue));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      setUploadProgress(null);
      const uploadedMediaIds = await uploadSelectedImages(newImages, { onProgress: setUploadProgress });
      const existingMediaIds = existingMedia.filter((media) => media.status !== 'removed').map((media) => media.id);
      const mediaIds = [...existingMediaIds, ...uploadedMediaIds].slice(0, 5);
      const coverMediaId = existingMedia.find((media) => media.isCover)?.id ?? mediaIds[0];
      const payload = {
        title: title.trim(),
        description: description.trim(),
        defaultLanguage,
        translations: buildInventoryTranslationsPayload(defaultLanguage, translations),
        category: optionalText(category),
        mode,
        locationLabel: optionalText(locationLabel),
        status: nextStatus ?? item?.status ?? 'draft',
        mediaIds,
        coverMediaId,
      } as never;
      const result = isNeed
        ? ((await api.needs.update(itemId, payload)) as InventoryResponse)
        : ((await api.offers.update(itemId, payload)) as InventoryResponse);
      const nextItem = (isNeed ? result.need : result.offer) as
        | InventoryItem
        | undefined;
      if (nextItem) hydrateForm(nextItem);
      setEditing(false);
    } catch (caughtError) {
      setError(getFriendlyUploadErrorMessage(caughtError, t));
    } finally {
      setUploadProgress(null);
      setSaving(false);
    }
  }

  function moveExistingImage(mediaId: string, direction: 'up' | 'down') {
    setExistingMedia((current) => {
      const index = current.findIndex((media) => media.id === mediaId);
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

  function setExistingCover(mediaId: string) {
    setExistingMedia((current) => {
      const index = current.findIndex((media) => media.id === mediaId);
      if (index < 0) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.unshift(item);
      return normalizeMediaOrder(next.map((media) => ({ ...media, isCover: media.id === mediaId })));
    });
  }

  async function removeImage(mediaId: string) {
    setSaving(true);
    setError(null);
    try {
      await api.media.remove(mediaId);
      await loadItem();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    setDeleteConfirmVisible(true);
  }

  function handleConfirmDelete() {
    setDeleteConfirmVisible(false);
    void deleteItem();
  }

  async function deleteItem() {
    setSaving(true);
    setError(null);
    try {
      const result = isNeed
        ? ((await api.needs.remove(itemId)) as InventoryResponse | undefined)
        : ((await api.offers.remove(itemId)) as InventoryResponse | undefined);
      if (result?.archived) {
        const archived = (isNeed ? result.need : result.offer) as
          | InventoryItem
          | undefined;
        if (archived) hydrateForm(archived);
        setEditing(false);
        setError(t('inventory.errors.archivedInstead', { item: labelLower }));
      } else {
        navigation.goBack();
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  function useInTrade() {
    const selectedTradeSide = isNeed
      ? { side: 'need' as const, kind: 'need' as const, id: itemId }
      : { side: 'offer' as const, kind: 'offer' as const, id: itemId };
    navigation.navigate('CreateTrade', { selectedTradeSide });
  }

  const updatedAt = formatLocalizedDate(
    typeof item?.updatedAt === 'string' ? item.updatedAt : null,
    language,
    '',
  );
  const detailImages = useMemo(() => activeDetailImages(item), [item]);
  const structuredTiming = useMemo(() => structuredInventoryTiming(item, isNeed, t), [isNeed, item, t]);
  const chips = useMemo(
    () =>
      detailChips({
        itemType,
        category,
        timingOrAvailability: structuredTiming.duration,
        mode,
        locationLabel,
        t,
        tone,
      }),
    [category, itemType, locationLabel, mode, structuredTiming.duration, t, tone],
  );
  const displayItem = useLocalizedInventoryItem(item);
  const languageSelection = useContentLanguageSelection({
    displayLanguage: !editing ? displayItem?.displayLanguage : null,
    fallbackTitle: displayItem?.title ?? item?.title ?? fallbackTitle ?? label,
    fallbackDescription: displayItem?.description ?? item?.description ?? '',
  });
  const showDisplayLanguageControls = !editing && shouldShowContentLanguageControls(
    displayItem?.displayLanguage,
    displayItem?.displayLanguage?.options,
  );
  const status = typeof item?.status === 'string' ? item.status : 'draft';
  const isActive = status === 'active';
  const ownerId = typeof item?.ownerId === 'string' ? item.ownerId : null;
  const isOwner = Boolean(ownerId && auth.user?.id === ownerId);
  const detailInfoRows: React.ComponentProps<typeof DetailInfoList>['rows'] = [
    {
      label: t('inventory.labels.status'),
      value: statusLabel(status, t),
      tone: statusTone(status),
    },
    {
      label: t('inventory.labels.type'),
      value: itemTypeLabel(itemType, t),
      tone,
    },
    {
      label: t('inventory.labels.category'),
      value: categoryLabel(category, t) || t('inventory.labels.notSpecified'),
      tone: 'muted' as const,
    },
    ...(structuredTiming.duration
      ? [{
          label: isNeed
            ? t('inventory.chain.needDurationLabel')
            : t('inventory.chain.offerDurationLabel'),
          value: structuredTiming.duration,
          tone: 'time' as const,
        }]
      : []),
    {
      label: t('inventory.labels.mode'),
      value: modeLabel(mode, t),
      tone: 'proposal' as const,
    },
    {
      label: t('inventory.labels.location'),
      value: locationLabel || t('inventory.labels.notSpecified'),
      tone: 'muted' as const,
    },
    {
      label: t('inventory.labels.updated'),
      value: updatedAt || t('inventory.labels.notSpecified'),
      tone: 'muted' as const,
    },
  ];

  return (
    <AppFixedHeaderScreen
      header={
        <AppHeader
          title={
            editing
              ? isNeed
                ? t('inventory.actions.editNeed')
                : t('inventory.actions.editOffer')
              : label
          }
          onBack={() => navigation.goBack()}
          rightSlot={item && !editing ? <SavedToggleButton itemType={kind} itemId={itemId} showLabel={false} hidden={isOwner} /> : undefined}
        />
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              void loadItem();
            }}
          />
        }
      >
        {error ? <InfoNotice tone="warning" body={error} /> : null}
        {saving && formatUploadProgress(uploadProgress, t) ? <InfoNotice tone="info" title={t('inventory.form.uploadProgressTitle')} body={formatUploadProgress(uploadProgress, t) ?? ''} /> : null}

        {!item && loading ? (
          <DetailEmptyState
            icon={tone}
            title={t('common.states.loading')}
            body={fallbackTitle ?? label}
            style={styles.stateBlock}
          />
        ) : null}

        {!item && !loading ? (
          <DetailEmptyState
            icon={tone}
            title={t('inventory.errors.unavailable', { item: label })}
            body={t('inventory.errors.notFoundTitle', { item: labelLower })}
            actionLabel={t('common.actions.tryAgain')}
            onAction={() => {
              void loadItem();
            }}
            style={styles.stateBlock}
          />
        ) : null}

        {item ? (
          <>
            <DetailHero
              eyebrow={`${label} · ${statusLabel(status, t)}`}
              title={editing ? title || item.title : languageSelection.title}
              subtitle={!editing ? languageSelection.description : undefined}
              meta={
                updatedAt
                  ? `${t('inventory.labels.updated')} ${updatedAt}`
                  : undefined
              }
            >
              <DetailMetadataChips
                compact
                chips={[
                  { label: statusLabel(status, t), tone: statusTone(status) },
                  ...chips,
                ]}
              />
              {!editing ? (
                <View style={styles.heroActionRow}>
                  <AddToAgendaButton sourceType={kind} sourceId={item.id} itemType={kind} title={languageSelection.title} note={languageSelection.description} style={styles.heroAgendaButton} />
                </View>
              ) : null}
            </DetailHero>

            {showDisplayLanguageControls ? (
              <DetailSection compact>
                <ContentLanguageControls
                  displayLanguage={displayItem?.displayLanguage}
                  selectedLanguage={languageSelection.selectedLanguage}
                  onSelectLanguage={languageSelection.setSelectedLanguage}
                />
              </DetailSection>
            ) : null}

            {editing ? (
              <>
                <DetailSection
                  eyebrow={label}
                  title={
                    isNeed
                      ? t('inventory.form.needQuestion')
                      : t('inventory.form.offerQuestion')
                  }
                  description={t('inventory.form.describeThis', {
                    item: labelLower,
                  })}
                >
                  <View style={styles.form}>
                    <InventoryTextField
                      label={t('inventory.labels.title')}
                      value={title}
                      onChangeText={setTitle}
                      placeholder={titlePlaceholder}
                      maxLength={INVENTORY_TITLE_MAX_LENGTH}
                      disabled={saving}
                    />
                    <InventoryTextField
                      label={t('inventory.labels.description')}
                      value={description}
                      onChangeText={setDescription}
                      placeholder={t('inventory.form.describeThis', {
                        item: labelLower,
                      })}
                      maxLength={INVENTORY_DESCRIPTION_MAX_LENGTH}
                      multiline
                      disabled={saving}
                    />
                  </View>
                </DetailSection>

                <DetailSection compact>
                  <InventoryLanguagePanel
                    defaultLanguage={defaultLanguage}
                    translations={translations}
                    onChangeDefaultLanguage={changeDefaultLanguage}
                    onChangeTranslations={setTranslations}
                    expanded={languagePanelExpanded}
                    onToggle={() => setLanguagePanelExpanded((value) => !value)}
                    titleMaxLength={INVENTORY_TITLE_MAX_LENGTH}
                    descriptionMaxLength={INVENTORY_DESCRIPTION_MAX_LENGTH}
                    disabled={saving}
                  />
                </DetailSection>

                <DetailSection
                  eyebrow={t('inventory.labels.details')}
                  title={t('inventory.form.simplifiedDetailsTitle')}
                  description={t('inventory.form.simplifiedDetailsBody')}
                >
                  <View style={styles.form}>
                    <CategoryPicker
                      value={category}
                      onChange={setCategory}
                      disabled={saving}
                    />
                    <InventoryModePicker
                      value={mode}
                      onChange={setMode}
                      disabled={saving}
                    />
                    <InventoryTextField
                      label={t('inventory.labels.location')}
                      value={locationLabel}
                      onChangeText={setLocationLabel}
                      placeholder={locationPlaceholder}
                      disabled={saving}
                    />
                  </View>
                </DetailSection>

                <DetailSection
                  eyebrow={t('inventory.labels.images')}
                  title={
                    isNeed
                      ? t('inventory.form.needImageSection')
                      : t('inventory.form.offerImageSection')
                  }
                  description={
                    isNeed
                      ? t('inventory.form.needImageHint')
                      : t('inventory.form.offerImageHint')
                  }
                >
                  <ExistingMediaManager
                    media={existingMedia}
                    disabled={saving}
                    enableOrderControls={betaFeatures.plusSubscriptionFeatures.customizationEnabled}
                    onMove={moveExistingImage}
                    onSetCover={setExistingCover}
                    onRemove={removeImage}
                  />
                  <ImagePickerField
                    images={newImages}
                    onChange={setNewImages}
                    disabled={saving}
                    enableOrderControls={betaFeatures.plusSubscriptionFeatures.customizationEnabled}
                  />
                </DetailSection>

                <DetailBottomActionBar
                  primary={{
                    label: saving
                      ? uploadProgress
                        ? t('common.states.uploading')
                        : t('common.states.saving')
                      : t('inventory.actions.saveChanges'),
                    loading: saving,
                    disabled: saving,
                    onPress: () => {
                      void saveItem();
                    },
                  }}
                  secondary={[
                    {
                      label: t('common.actions.cancel'),
                      disabled: saving,
                      onPress: () => {
                        hydrateForm(item);
                        setLanguagePanelExpanded(false);
                        setEditing(false);
                      },
                    },
                  ]}
                  style={styles.inlineActionBar}
                />
              </>
            ) : (
              <>
                <DetailSection
                  eyebrow={label}
                  title={
                    isNeed
                      ? t('inventory.side.need')
                      : t('inventory.side.offer')
                  }
                  description={languageSelection.description}
                >
                  <DetailMetadataChips compact chips={chips} />
                </DetailSection>

                <DetailSection
                  eyebrow={t('inventory.labels.images')}
                  title={
                    isNeed
                      ? t('inventory.labels.referenceImages')
                      : t('inventory.labels.sampleImages')
                  }
                >
                  {detailImages.length > 0 ? (
                    <DetailImageGrid images={detailImages} />
                  ) : (
                    <DetailEmptyState
                      icon={tone}
                      title={t('inventory.labels.noImages')}
                      body={t('inventory.empty.noImagesYetBody')}
                      style={styles.imageEmptyState}
                    />
                  )}
                </DetailSection>

                <DetailSection
                  eyebrow={t('inventory.labels.details')}
                  title={t('inventory.labels.information')}
                >
                  <DetailInfoList rows={detailInfoRows} />
                  <View style={styles.statusInlineRow}>
                    <StatusBadge status={status} size="sm" />
                    <AppText
                      style={[
                        styles.statusInlineText,
                        { color: theme.color.muted },
                      ]}
                    >
                      {updatedAt
                        ? `${t('inventory.labels.updated')} ${updatedAt}`
                        : t('inventory.labels.updated')}
                    </AppText>
                  </View>
                </DetailSection>

                <DetailBottomActionBar
                  layout="primaryBelow"
                  primary={{
                    label: t('inventory.actions.useInTrade'),
                    disabled: !isActive || saving,
                    onPress: useInTrade,
                  }}
                  secondary={[
                    {
                      label: isNeed
                        ? t('inventory.actions.editNeed')
                        : t('inventory.actions.editOffer'),
                      disabled: saving,
                      icon: 'edit',
                      onPress: () => {
                        setLanguagePanelExpanded(false);
                        setEditing(true);
                      },
                    },
                    item.status !== 'active'
                      ? {
                          label: t('inventory.actions.markActive'),
                          disabled: saving,
                          onPress: () => {
                            void saveItem('active');
                          },
                        }
                      : {
                          label: isNeed
                            ? t('inventory.actions.closeNeed')
                            : t('inventory.actions.closeOffer'),
                          disabled: saving,
                          onPress: () => {
                            void saveItem('closed');
                          },
                        },
                  ]}
                  helper={
                    !isActive
                      ? t('inventory.delete.lockedBody', { item: labelLower })
                      : undefined
                  }
                  style={styles.inlineActionBar}
                />
              </>
            )}

            <DetailSection
              compact
              eyebrow={t('inventory.actions.delete')}
              title={
                isNeed
                  ? t('inventory.actions.deleteNeed')
                  : t('inventory.actions.deleteOffer')
              }
              description={t('inventory.delete.normalBody', {
                item: labelLower,
              })}
            >
              <DangerButton
                label={
                  isNeed
                    ? t('inventory.actions.deleteNeed')
                    : t('inventory.actions.deleteOffer')
                }
                disabled={saving}
                onPress={confirmDelete}
              />
            </DetailSection>
          </>
        ) : null}
      </ScrollView>
      <AppConfirmSheet {...unsavedChangesConfirm} />
      <AppConfirmSheet
        visible={deleteConfirmVisible}
        title={t('inventory.delete.deleteTitle', { item: labelLower })}
        body={t('inventory.delete.deleteNativeBody', { item: label, items: labelsLower })}
        cancelLabel={t('common.actions.cancel')}
        confirmLabel={t('inventory.actions.delete')}
        tone="danger"
        confirmDisabled={saving}
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={handleConfirmDelete}
      />
    </AppFixedHeaderScreen>
  );
}

const styles = StyleSheet.create({
  heroActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  heroAgendaButton: { alignSelf: 'flex-start' },
  content: { paddingBottom: 44, gap: 2 },
  form: { gap: 14 },
  imageEmptyState: { marginTop: 0 },
  inlineActionBar: { marginTop: 4, paddingHorizontal: 0 },
  stateBlock: { marginTop: 24 },
  statusInlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusInlineText: { flex: 1, fontSize: 12, fontWeight: '800' },
});
