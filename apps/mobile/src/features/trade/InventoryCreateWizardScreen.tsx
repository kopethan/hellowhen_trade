import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getNextWizardStepId, getPreviousWizardStepId, type WizardStepDefinition } from '@hellowhen/shared';
import type { DiscoveryLanguage, InventoryDurationPreset, PreviewCardTheme, TradeExchangeMode } from '@hellowhen/contracts';
import {
  INVENTORY_DESCRIPTION_MAX_LENGTH,
  INVENTORY_DESCRIPTION_MIN_LENGTH,
  INVENTORY_TITLE_MAX_LENGTH,
  INVENTORY_TITLE_MIN_LENGTH,
} from '@hellowhen/contracts/src/inventoryLimits';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning';
import { AppActionSheet, type AppActionSheetAction } from '../../components/AppActionSheet';
import { AppCard } from '../../components/AppCard';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { AppText } from '../../components/AppText';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { InfoNotice } from '../../components/SemanticUI';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { buildMobileWizardDraftKey, useMobileWizardDraft, WizardFooter, WizardShell } from './create';
import { ImagePickerField } from './components/ImagePickerField';
import {
  CategoryPicker,
  durationPresetLabel,
  durationPresetMinutes,
  DurationPresetPicker,
  InventoryLanguagePanel,
  InventoryTextField,
  ModePicker,
  categoryLabel,
  modeLabel,
  optionalText,
  parseInventoryList,
} from './components/InventoryFormFields';
import { InventoryAiAssistCard } from './components/InventoryAiAssistCard';
import { PreviewThemePickerCard } from './components/PreviewThemePickerCard';
import {
  formatUploadProgress,
  getFriendlyUploadErrorMessage,
  uploadSelectedImages,
  type SelectedImageUploadProgress,
  type SelectedLocalImage,
} from './mediaUpload';
import type { TradeCreateSideSelection } from './CreateTradeScreen';
import type { NeedItem, OfferItem } from './types';
import {
  buildInventoryTranslationsPayload,
  changeInventoryOriginalLanguage,
  hasInventoryTranslationDraftContent,
  normalizeInventoryTranslationDrafts,
  restoreLegacyInventoryTranslationDraft,
  upsertInventoryTranslationDraft,
  validateInventoryTranslationDrafts,
  type InventoryTranslationDraft,
  type InventoryTranslationValidationIssue,
} from './inventoryTranslations';

type InventoryWizardKind = 'need' | 'offer';
type InventoryWizardStepId = 'idea' | 'details' | 'images' | 'review';
type InventoryCreateRouteParams = RootStackParamList['CreateNeed'] | RootStackParamList['CreateOffer'];
type CreateNeedResponse = { need: NeedItem };
type CreateOfferResponse = { offer: OfferItem };

type InventoryCreateWizardScreenProps = {
  kind: InventoryWizardKind;
  routeParams?: InventoryCreateRouteParams;
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

type InventoryWizardDraft = {
  title: string;
  description: string;
  category: string;
  durationPreset?: InventoryDurationPreset;
  tags: string;
  mode: TradeExchangeMode;
  locationLabel: string;
  previewTheme: PreviewCardTheme;
  images: SelectedLocalImage[];
};

type InventoryWizardPersistedDraft = InventoryWizardDraft & {
  activeStepId: InventoryWizardStepId;
  defaultLanguage?: DiscoveryLanguage;
  translations?: InventoryTranslationDraft[];
  translationTitle?: string;
  translationDescription?: string;
  translationEnabled?: boolean;
};

const stepIds: InventoryWizardStepId[] = ['idea', 'details', 'images'];

function safeWizardText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasDraftContent(draft: InventoryWizardDraft, translations: readonly InventoryTranslationDraft[]) {
  return Boolean(
    safeWizardText(draft.title) ||
    safeWizardText(draft.description) ||
    hasInventoryTranslationDraftContent(translations) ||
    safeWizardText(draft.category) ||
    Boolean(draft.durationPreset) ||
    safeWizardText(draft.tags) ||
    safeWizardText(draft.locationLabel) ||
    draft.previewTheme !== 'default' ||
    draft.images.length > 0,
  );
}

function getStepIndex(stepId: InventoryWizardStepId) {
  const index = stepIds.indexOf(stepId);
  return index >= 0 ? index : 0;
}

function isInventoryDurationPreset(value: unknown): value is InventoryDurationPreset {
  return value === 'min_15' || value === 'min_30' || value === 'hour_1' || value === 'hour_2' || value === 'half_day' || value === 'day_1' || value === 'flexible' || value === 'not_sure' || value === 'depends';
}

export function InventoryCreateWizardScreen({ kind, routeParams, navigation }: InventoryCreateWizardScreenProps) {
  const { t, language } = useTranslation();
  const theme = useThemeTokens();
  const auth = useAuth();
  const isNeed = kind === 'need';
  const [activeStepId, setActiveStepId] = useState<InventoryWizardStepId>('idea');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState<DiscoveryLanguage>(language);
  const [translations, setTranslations] = useState<InventoryTranslationDraft[]>([]);
  const [mode, setMode] = useState<TradeExchangeMode>('remote');
  const [previewTheme, setPreviewTheme] = useState<PreviewCardTheme>('default');
  const [category, setCategory] = useState('');
  const [durationPreset, setDurationPreset] = useState<InventoryDurationPreset | undefined>();
  const [tags, setTags] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [images, setImages] = useState<SelectedLocalImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [attemptedStepId, setAttemptedStepId] = useState<InventoryWizardStepId | null>(null);
  const [uploadProgress, setUploadProgress] = useState<SelectedImageUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuSheetVisible, setMenuSheetVisible] = useState(false);
  const [helpSheetVisible, setHelpSheetVisible] = useState(false);
  const [aiAssistExpanded, setAiAssistExpanded] = useState(false);
  const [translationPanelExpanded, setTranslationPanelExpanded] = useState(false);
  const [optionalDetailsExpanded, setOptionalDetailsExpanded] = useState(false);
  const [themePickerExpanded, setThemePickerExpanded] = useState(false);

  const draft = useMemo<InventoryWizardDraft>(() => ({
    title,
    description,
    category,
    durationPreset,
    tags,
    mode,
    locationLabel,
    previewTheme,
    images,
  }), [category, description, durationPreset, images, locationLabel, mode, previewTheme, tags, title]);

  const persistedDraft = useMemo<InventoryWizardPersistedDraft>(() => ({
    ...draft,
    activeStepId,
    defaultLanguage,
    translations,
  }), [activeStepId, defaultLanguage, draft, translations]);

  const draftStorageKey = useMemo(() => buildMobileWizardDraftKey(kind === 'need' ? 'create-need' : 'create-offer', auth.user?.id), [auth.user?.id, kind]);

  const restoreDraft = useCallback((savedDraft: InventoryWizardPersistedDraft) => {
    setTitle(typeof savedDraft.title === 'string' ? savedDraft.title : '');
    setDescription(typeof savedDraft.description === 'string' ? savedDraft.description : '');
    setCategory(typeof savedDraft.category === 'string' ? savedDraft.category : '');
    setDurationPreset(isInventoryDurationPreset(savedDraft.durationPreset) ? savedDraft.durationPreset : undefined);
    setTags(typeof savedDraft.tags === 'string' ? savedDraft.tags : '');
    setMode(savedDraft.mode === 'local' || savedDraft.mode === 'hybrid' || savedDraft.mode === 'remote' ? savedDraft.mode : 'remote');
    setLocationLabel(typeof savedDraft.locationLabel === 'string' ? savedDraft.locationLabel : '');
    setPreviewTheme(['default', 'blue', 'green', 'purple', 'amber', 'rose'].includes(savedDraft.previewTheme) ? savedDraft.previewTheme : 'default');
    setImages(Array.isArray(savedDraft.images) ? savedDraft.images : []);
    const restoredDefaultLanguage = savedDraft.defaultLanguage === 'fr' || savedDraft.defaultLanguage === 'es' ? savedDraft.defaultLanguage : language;
    setDefaultLanguage(restoredDefaultLanguage);
    const restoredTranslations = Array.isArray(savedDraft.translations)
      ? normalizeInventoryTranslationDrafts(savedDraft.translations, restoredDefaultLanguage)
      : restoreLegacyInventoryTranslationDraft(restoredDefaultLanguage, savedDraft.translationTitle, savedDraft.translationDescription, savedDraft.translationEnabled);
    setTranslations(restoredTranslations);
    setTranslationPanelExpanded(restoredTranslations.length > 0);
    setActiveStepId(stepIds.includes(savedDraft.activeStepId) ? savedDraft.activeStepId : (savedDraft.activeStepId === 'review' ? 'images' : 'idea'));
  }, [language]);

  const inventoryWizardDraft = useMobileWizardDraft({
    storageKey: draftStorageKey,
    draft: persistedDraft,
    enabled: !submitting,
    hasContent: (candidate) => {
      const candidateDefaultLanguage = candidate.defaultLanguage === 'fr' || candidate.defaultLanguage === 'es' ? candidate.defaultLanguage : language;
      const candidateTranslations = Array.isArray(candidate.translations)
        ? normalizeInventoryTranslationDrafts(candidate.translations, candidateDefaultLanguage)
        : restoreLegacyInventoryTranslationDraft(candidateDefaultLanguage, candidate.translationTitle, candidate.translationDescription, candidate.translationEnabled);
      return hasDraftContent(candidate, candidateTranslations) || Boolean(candidate.defaultLanguage && candidate.defaultLanguage !== language);
    },
    onRestore: restoreDraft,
  });

  const steps = useMemo<WizardStepDefinition<InventoryWizardStepId>[]>(() => [
    {
      id: 'idea',
      title: isNeed ? t('inventory.form.needQuestion') : t('inventory.form.offerQuestion'),
      completed: title.trim().length >= INVENTORY_TITLE_MIN_LENGTH && description.trim().length >= INVENTORY_DESCRIPTION_MIN_LENGTH,
    },
    {
      id: 'details',
      title: t('inventory.wizard.compactDetailsTitle'),
      completed: Boolean(category.trim() || durationPreset || tags.trim() || locationLabel.trim() || mode !== 'remote' || previewTheme !== 'default'),
    },
    {
      id: 'images',
      title: t('inventory.wizard.compactImagesTitle'),
      optional: true,
      completed: images.length > 0,
    },
  ], [category, description, durationPreset, images.length, isNeed, locationLabel, mode, previewTheme, t, tags, title]);

  const hasDraft = hasDraftContent(draft, translations);
  const uploadProgressBody = formatUploadProgress(uploadProgress, t);
  const activeStepIndex = getStepIndex(activeStepId);
  const shouldShowIdeaErrors = attemptedStepId === 'idea';
  const titleError = shouldShowIdeaErrors && title.trim().length < INVENTORY_TITLE_MIN_LENGTH
    ? (isNeed ? t('validation.needTitleTooShort') : t('validation.offerTitleTooShort'))
    : null;
  const descriptionError = shouldShowIdeaErrors && description.trim().length < INVENTORY_DESCRIPTION_MIN_LENGTH
    ? (isNeed ? t('validation.needDescriptionTooShort') : t('validation.offerDescriptionTooShort'))
    : null;

  const unsavedChangesConfirm = useUnsavedChangesWarning({
    navigation,
    enabled: hasDraft && !submitting,
    title: t('inventory.form.unsavedTitle'),
    body: t('inventory.form.unsavedBody'),
    stayLabel: t('common.actions.cancel'),
    discardLabel: t('inventory.form.discardDraft'),
  });

  function translationValidationMessage(issue: InventoryTranslationValidationIssue) {
    if (issue === 'incomplete') return t('inventory.errors.translationIncomplete');
    if (issue === 'title_too_short') return t('inventory.errors.translationTitleTooShort');
    if (issue === 'title_too_long') return t('validation.titleTooLong', { max: INVENTORY_TITLE_MAX_LENGTH });
    if (issue === 'description_too_short') return t('inventory.errors.translationDescriptionTooShort');
    return t('validation.descriptionTooLong', { max: INVENTORY_DESCRIPTION_MAX_LENGTH });
  }

  function hasTranslationFieldIssue() {
    return validateInventoryTranslationDrafts(defaultLanguage, translations) !== null;
  }

  function validateIdeaStep() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (cleanTitle.length < INVENTORY_TITLE_MIN_LENGTH) return isNeed ? t('validation.needTitleTooShort') : t('validation.offerTitleTooShort');
    if (cleanTitle.length > INVENTORY_TITLE_MAX_LENGTH) return t('validation.titleTooLong', { max: INVENTORY_TITLE_MAX_LENGTH });
    if (cleanDescription.length < INVENTORY_DESCRIPTION_MIN_LENGTH) return isNeed ? t('validation.needDescriptionTooShort') : t('validation.offerDescriptionTooShort');
    if (cleanDescription.length > INVENTORY_DESCRIPTION_MAX_LENGTH) return t('validation.descriptionTooLong', { max: INVENTORY_DESCRIPTION_MAX_LENGTH });
    const translationIssue = validateInventoryTranslationDrafts(defaultLanguage, translations);
    if (translationIssue) return translationValidationMessage(translationIssue);
    return null;
  }

  function handleNext() {
    const nextStepId = getNextWizardStepId(steps, activeStepId);
    if (!nextStepId || nextStepId === activeStepId) return;
    if (activeStepId === 'idea') {
      setAttemptedStepId('idea');
      const validationError = validateIdeaStep();
      if (validationError) {
        if (hasTranslationFieldIssue()) setTranslationPanelExpanded(true);
        setError(validationError);
        return;
      }
    }
    setError(null);
    setActiveStepId(nextStepId);
  }

  function handlePrevious() {
    const previousStepId = getPreviousWizardStepId(steps, activeStepId);
    if (!previousStepId || previousStepId === activeStepId) return;
    setError(null);
    setActiveStepId(previousStepId);
  }

  function changeDefaultLanguage(nextLanguage: DiscoveryLanguage) {
    const nextDraft = changeInventoryOriginalLanguage({ defaultLanguage, title, description, translations }, nextLanguage);
    setDefaultLanguage(nextDraft.defaultLanguage);
    setTitle(nextDraft.title);
    setDescription(nextDraft.description);
    setTranslations(nextDraft.translations);
  }

  function applyAiTranslation(languageCode: DiscoveryLanguage, titleText: string, descriptionText: string) {
    setTranslationPanelExpanded(true);
    if (languageCode === defaultLanguage) {
      setTitle(titleText);
      setDescription(descriptionText);
      return;
    }
    setTranslations((current) => upsertInventoryTranslationDraft(current, defaultLanguage, { languageCode, title: titleText, description: descriptionText }));
  }

  function applyAiCategoryTags(categoryText: string, tagList: string[]) {
    setCategory(categoryText);
    setTags(tagList.join(', '));
  }

  function navigateToFullForm() {
    const params = routeParams ? { ...routeParams } : undefined;
    if (kind === 'need') {
      if (params) navigation.navigate('CreateNeedFull', params);
      else navigation.navigate('CreateNeedFull');
      return;
    }
    if (params) navigation.navigate('CreateOfferFull', params);
    else navigation.navigate('CreateOfferFull');
  }

  async function resetWizardDraft() {
    setMenuSheetVisible(false);
    setHelpSheetVisible(false);
    setError(null);
    setAttemptedStepId(null);
    setActiveStepId('idea');
    setTitle('');
    setDescription('');
    setTranslations([]);
    setTranslationPanelExpanded(false);
    setMode('remote');
    setPreviewTheme('default');
    setCategory('');
    setDurationPreset(undefined);
    setTags('');
    setLocationLabel('');
    setImages([]);
    setAiAssistExpanded(false);
    setOptionalDetailsExpanded(false);
    setThemePickerExpanded(false);
    await inventoryWizardDraft.clearDraft();
  }

  function buildCreatedSideSelection(id: string): TradeCreateSideSelection {
    return isNeed ? { side: 'need', kind: 'need', id } : { side: 'offer', kind: 'offer', id };
  }

  function navigateAfterCreate(id: string) {
    const selectedProposalSide = buildCreatedSideSelection(id);

    if (routeParams?.returnTo === 'proposalDetail' && routeParams.proposalId) {
      navigation.navigate('ProposalDetail', {
        proposalId: routeParams.proposalId,
        selectedProposalSide,
        selectedProposalNeedId: isNeed ? id : routeParams.proposalNeedId,
        selectedProposalOfferId: isNeed ? routeParams.proposalOfferId : id,
      });
      return;
    }

    if (routeParams?.returnTo === 'tradeProposal' && routeParams.tradeId) {
      navigation.navigate('TradePrivateProposals', {
        tradeId: routeParams.tradeId,
        title: routeParams.tradeTitle,
        selectedProposalSide,
        selectedProposalNeedId: isNeed ? id : routeParams.proposalNeedId,
        selectedProposalOfferId: isNeed ? routeParams.proposalOfferId : id,
      });
      return;
    }

    if (routeParams?.returnTo === 'createTradeFull') {
      navigation.navigate('CreateTradeFull', { selectedTradeSide: selectedProposalSide });
      return;
    }

    if (routeParams?.returnTo === 'createTrade') {
      navigation.navigate('CreateTrade', { selectedTradeSide: selectedProposalSide });
      return;
    }

    navigation.goBack();
  }


  function renderCompactToggle({
    title: rowTitle,
    body,
    icon,
    expanded,
    onPress,
    disabled,
  }: {
    title: string;
    body?: string;
    icon: MobileIconName;
    expanded: boolean;
    onPress: () => void;
    disabled?: boolean;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled }}
        disabled={disabled}
        onPress={onPress}
                      style={({ pressed }) => [
          styles.compactToggle,
          { backgroundColor: theme.color.surface, borderColor: theme.color.border },
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.compactToggleIcon}>
          <MobileIcon name={icon} size={17} color={theme.color.muted} />
        </View>
        <View style={styles.compactToggleCopy}>
          <AppText style={[styles.compactToggleTitle, { color: theme.color.text }]}>{rowTitle}</AppText>
          {body ? <AppText style={[styles.compactToggleBody, { color: theme.color.muted }]} numberOfLines={1}>{body}</AppText> : null}
        </View>
        <MobileIcon name="chevron-right" size={17} color={theme.color.muted} />
      </Pressable>
    );
  }

  async function handleCreate() {
    if (submitting) return;
    setAttemptedStepId('idea');
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const validationError = validateIdeaStep();
    if (validationError) {
      if (hasTranslationFieldIssue()) setTranslationPanelExpanded(true);
      setError(validationError);
      setActiveStepId('idea');
      return;
    }

    setSubmitting(true);
    setUploadProgress(null);
    setError(null);

    try {
      const mediaIds = await uploadSelectedImages(images, { onProgress: setUploadProgress });
      const cleanDurationMinutes = durationPresetMinutes(durationPreset);
      const basePayload = {
        title: cleanTitle,
        description: cleanDescription,
        defaultLanguage,
        translations: buildInventoryTranslationsPayload(defaultLanguage, translations),
        itemType: 'service' as const,
        category: optionalText(category),
        ...(isNeed
          ? { estimatedDurationPreset: durationPreset, estimatedDurationMinutes: cleanDurationMinutes }
          : { typicalDurationPreset: durationPreset, typicalDurationMinutes: cleanDurationMinutes }),
        mode,
        locationLabel: optionalText(locationLabel),
        tags: parseInventoryList(tags),
        previewTheme,
        status: 'active' as const,
        mediaIds,
        coverMediaId: mediaIds[0],
      };

      if (isNeed) {
        const response = await api.needs.create(basePayload) as CreateNeedResponse;
        await resetWizardDraft();
        navigateAfterCreate(response.need.id);
      } else {
        const response = await api.offers.create({ ...basePayload, includes: [] }) as CreateOfferResponse;
        await resetWizardDraft();
        navigateAfterCreate(response.offer.id);
      }
    } catch (caughtError) {
      setError(getFriendlyUploadErrorMessage(caughtError, t));
    } finally {
      setUploadProgress(null);
      setSubmitting(false);
    }
  }

  function renderStep() {
    const durationLabel = durationPresetLabel(durationPreset, t);
    const previewMeta = [categoryLabel(category, t), durationLabel, modeLabel(mode, t), locationLabel.trim()].filter(Boolean).join(' · ');
    const tagList = parseInventoryList(tags);

    if (activeStepId === 'idea') {
      return (
        <>
          <AppCard style={styles.compactCard}>
            <InventoryTextField
              label={t('inventory.labels.title')}
              value={title}
              onChangeText={setTitle}
              placeholder={isNeed ? t('inventory.form.titleNeedExample') : t('inventory.form.titleOfferExample')}
              maxLength={INVENTORY_TITLE_MAX_LENGTH}
              disabled={submitting}
              error={titleError}
            />
            <InventoryTextField
              label={t('inventory.labels.description')}
              value={description}
              onChangeText={setDescription}
              placeholder={isNeed ? t('inventory.form.descriptionNeedMobile') : t('inventory.form.descriptionOfferMobile')}
              maxLength={INVENTORY_DESCRIPTION_MAX_LENGTH}
              multiline
              disabled={submitting}
              error={descriptionError}
            />
          </AppCard>
          <InventoryLanguagePanel
            defaultLanguage={defaultLanguage}
            translations={translations}
            onChangeDefaultLanguage={changeDefaultLanguage}
            onChangeTranslations={setTranslations}
            expanded={translationPanelExpanded}
            onToggle={() => setTranslationPanelExpanded((value) => !value)}
            titleMaxLength={INVENTORY_TITLE_MAX_LENGTH}
            descriptionMaxLength={INVENTORY_DESCRIPTION_MAX_LENGTH}
            disabled={submitting}
          />
          {betaFeatures.plusSubscriptionFeatures.aiAssistEnabled ? (
            <>
              {renderCompactToggle({
                title: aiAssistExpanded ? t('inventory.wizard.hideAiAssist') : t('inventory.wizard.showAiAssist'),
                body: t('inventory.wizard.aiAssistBody'),
                icon: 'help',
                expanded: aiAssistExpanded,
                onPress: () => setAiAssistExpanded((value) => !value),
                disabled: submitting,
              })}
              {aiAssistExpanded ? (
                <InventoryAiAssistCard
                  kind={kind}
                  title={title}
                  description={description}
                  defaultLanguage={defaultLanguage}
                  category={category}
                  tags={tags}
                  disabled={submitting}
                  onApplyTitle={setTitle}
                  onApplyDescription={setDescription}
                  onApplyTranslation={applyAiTranslation}
                  onApplyCategoryTags={applyAiCategoryTags}
                />
              ) : null}
            </>
          ) : null}
        </>
      );
    }

    if (activeStepId === 'details') {
      return (
        <>
          <AppCard style={styles.compactCard}>
            <CategoryPicker value={category} onChange={setCategory} disabled={submitting} />
            <ModePicker value={mode} onChange={setMode} disabled={submitting} />
            <DurationPresetPicker kind={kind} value={durationPreset} onChange={setDurationPreset} disabled={submitting} />
          </AppCard>
          {renderCompactToggle({
            title: optionalDetailsExpanded ? t('inventory.wizard.hideOptionalDetails') : t('inventory.wizard.showOptionalDetails'),
            body: [
              durationPreset ? durationPresetLabel(durationPreset, t) : null,
              tags.trim() || t('inventory.labels.tags'),
              locationLabel.trim() || t('inventory.labels.location'),
              betaFeatures.plusSubscriptionFeatures.customizationEnabled ? (previewTheme === 'default' ? t('inventory.wizard.defaultCardTheme') : previewTheme) : null,
            ].filter(Boolean).join(' · '),
            icon: 'activity',
            expanded: optionalDetailsExpanded,
            onPress: () => setOptionalDetailsExpanded((value) => !value),
            disabled: submitting,
          })}
          {optionalDetailsExpanded ? (
            <>
              <AppCard style={styles.compactCard}>
                <InventoryTextField label={t('inventory.labels.tags')} hint={t('inventory.form.separateWithCommas')} value={tags} onChangeText={setTags} placeholder={isNeed ? t('inventory.form.tagsNeedPlaceholder') : t('inventory.form.tagsOfferPlaceholder')} disabled={submitting} />
                <InventoryTextField
                  label={t('inventory.labels.location')}
                  hint={t('inventory.labels.optional')}
                  value={locationLabel}
                  onChangeText={setLocationLabel}
                  placeholder={isNeed ? t('inventory.form.locationNeedPlaceholder') : t('inventory.form.locationOfferPlaceholder')}
                  disabled={submitting}
                />
              </AppCard>
              {betaFeatures.plusSubscriptionFeatures.customizationEnabled ? (
                <>
                  {renderCompactToggle({
                    title: themePickerExpanded ? t('inventory.wizard.hideCardTheme') : t('inventory.wizard.showCardTheme'),
                    body: previewTheme === 'default' ? t('inventory.wizard.defaultCardTheme') : previewTheme,
                    icon: 'settings',
                    expanded: themePickerExpanded,
                    onPress: () => setThemePickerExpanded((value) => !value),
                    disabled: submitting,
                  })}
                  {themePickerExpanded ? <PreviewThemePickerCard value={previewTheme} onChange={setPreviewTheme} disabled={submitting} /> : null}
                </>
              ) : null}
            </>
          ) : null}
          {hasInventoryTranslationDraftContent(translations) ? <InfoNotice tone="success" title={t('inventory.wizard.translationPreparedTitle')} body={t('inventory.wizard.translationPreparedBody')} /> : null}
        </>
      );
    }

    if (activeStepId === 'images') {
      return (
        <AppCard style={styles.compactCard}>
          <ImagePickerField
            images={images}
            onChange={setImages}
            disabled={submitting}
            enableOrderControls={betaFeatures.plusSubscriptionFeatures.customizationEnabled}
            label={isNeed ? t('inventory.labels.referenceImages') : t('inventory.labels.sampleImages')}
            hint={isNeed ? t('inventory.form.needImageHint') : t('inventory.form.offerImageHint')}
          />
        </AppCard>
      );
    }

    const coverImage = images[0];

    return (
      <>
        <AppCard style={styles.reviewCard}>
          {coverImage ? (
            <View style={styles.reviewCoverWrap}>
              <Image source={{ uri: coverImage.uri }} style={styles.reviewCover} resizeMode="cover" />
              <View style={[styles.reviewCoverBadge, { backgroundColor: theme.color.inverseBackground }]}>
                <AppText style={styles.reviewCoverBadgeText}>{t('inventory.wizard.imageCount', { count: images.length })}</AppText>
              </View>
            </View>
          ) : (
            <View style={[styles.reviewCoverFallback, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
              <MobileIcon name="image" size={26} color={theme.color.muted} />
            </View>
          )}
          <View style={styles.reviewCopy}>
            <View style={styles.reviewEyebrowRow}>
              <View style={[styles.reviewKindChip, { backgroundColor: theme.color.subtleSurface }]}>
                <AppText style={[styles.reviewKindText, { color: theme.color.muted }]}>{isNeed ? t('inventory.labels.need') : t('inventory.labels.offer')}</AppText>
              </View>
              {hasInventoryTranslationDraftContent(translations) ? (
                <View style={[styles.reviewKindChip, { backgroundColor: theme.color.subtleSurface }]}>
                  <AppText style={[styles.reviewKindText, { color: theme.color.muted }]}>{t('inventory.wizard.translationPreparedShort')}</AppText>
                </View>
              ) : null}
            </View>
            <AppText style={[styles.reviewTitle, { color: theme.color.text }]} numberOfLines={2}>{title.trim() || t('inventory.form.previewTitleFallback')}</AppText>
            <AppText style={[styles.reviewMeta, { color: theme.color.muted }]} numberOfLines={2}>{previewMeta || t('inventory.form.previewMetaFallback')}</AppText>
            <AppText style={[styles.reviewDescription, { color: theme.color.muted }]} numberOfLines={4}>{description.trim() || t('inventory.form.previewDescriptionFallback')}</AppText>
          </View>
        </AppCard>
        <View style={styles.reviewSummaryRow}>
          <View style={[styles.metaChip, { backgroundColor: theme.color.subtleSurface }]}><AppText style={[styles.metaChipText, { color: theme.color.muted }]}>{modeLabel(mode, t)}</AppText></View>
          <View style={[styles.metaChip, { backgroundColor: theme.color.subtleSurface }]}><AppText style={[styles.metaChipText, { color: theme.color.muted }]}>{t('inventory.wizard.imageCount', { count: images.length })}</AppText></View>
          {tagList.length > 0 ? <View style={[styles.metaChip, { backgroundColor: theme.color.subtleSurface }]}><AppText style={[styles.metaChipText, { color: theme.color.muted }]}>{t('inventory.wizard.tagCount', { count: tagList.length })}</AppText></View> : null}
        </View>
      </>
    );
  }

  const primaryLabel = activeStepId === 'images'
    ? (isNeed ? t('inventory.actions.saveNeed') : t('inventory.actions.saveOffer'))
    : t('common.actions.continue');
  const primaryLoadingLabel = uploadProgress ? t('common.states.uploading') : t('common.states.saving');
  const secondaryLabel = activeStepIndex > 0 ? t('common.actions.back') : t('common.actions.cancel');
  const onSecondary = activeStepIndex > 0 ? handlePrevious : () => navigation.goBack();

  const menuActions: AppActionSheetAction[] = [
    {
      key: 'full-form',
      label: t('inventory.wizard.openFullForm'),
      icon: 'edit',
      onPress: () => {
        setMenuSheetVisible(false);
        navigateToFullForm();
      },
    },
    {
      key: 'reset-draft',
      label: t('inventory.wizard.resetDraft'),
      icon: 'refresh',
      tone: 'danger',
      disabled: submitting || !hasDraft,
      onPress: () => { void resetWizardDraft(); },
    },
    {
      key: 'help',
      label: t('inventory.wizard.helpTitle'),
      icon: 'help',
      onPress: () => {
        setMenuSheetVisible(false);
        setHelpSheetVisible(true);
      },
    },
  ];

  const headerMenuButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('inventory.wizard.menuTitle')}
      disabled={submitting}
      hitSlop={10}
      onPress={() => setMenuSheetVisible(true)}
      style={({ pressed }) => [
        styles.headerMenuButton,
        { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border },
        pressed && styles.pressed,
        submitting && styles.disabled,
      ]}
    >
      <MobileIcon name="more" size={19} color={theme.color.muted} />
    </Pressable>
  );

  return (
    <>
      <WizardShell
        title={isNeed ? t('inventory.wizard.createNeedTitle') : t('inventory.wizard.createOfferTitle')}
        onBack={() => navigation.goBack()}
        steps={steps}
        activeStepId={activeStepId}
        stepLabel={t('inventory.wizard.stepLabel')}
        ofLabel={t('inventory.wizard.ofLabel')}
        rightSlot={headerMenuButton}
        footer={(
          <WizardFooter
            primaryLabel={primaryLabel}
            primaryLoading={submitting}
            primaryLoadingLabel={primaryLoadingLabel}
            onPrimary={activeStepId === 'images' ? handleCreate : handleNext}
            secondaryLabel={secondaryLabel}
            onSecondary={onSecondary}
          />
        )}
      >
        {inventoryWizardDraft.restored ? <InfoNotice tone="info" title={t('inventory.wizard.draftRestoredTitle')} body={t('inventory.wizard.draftRestoredBody')} /> : null}
        {error ? <InfoNotice tone="danger" title={t('inventory.errors.couldNotSave')} body={error} /> : null}
        {submitting && uploadProgressBody ? <InfoNotice tone="info" title={t('inventory.form.uploadProgressTitle')} body={uploadProgressBody} /> : null}
        {renderStep()}
      </WizardShell>
      <AppConfirmSheet {...unsavedChangesConfirm} />
      <AppActionSheet
        visible={menuSheetVisible}
        title={t('inventory.wizard.menuTitle')}
        body={t('inventory.wizard.menuBody')}
        actions={menuActions}
        cancelLabel={t('common.actions.cancel')}
        onClose={() => setMenuSheetVisible(false)}
      />
      <AppActionSheet
        visible={helpSheetVisible}
        title={t('inventory.wizard.helpTitle')}
        body={isNeed ? t('inventory.wizard.needHelpBody') : t('inventory.wizard.offerHelpBody')}
        actions={[]}
        cancelLabel={t('common.actions.close')}
        onClose={() => setHelpSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  compactCard: { gap: 14 },
  compactToggle: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  compactToggleIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  compactToggleCopy: { flex: 1, gap: 2 },
  compactToggleTitle: { fontSize: 14, fontWeight: '900' },
  compactToggleBody: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  reviewCard: { gap: 0, overflow: 'hidden', padding: 0 },
  reviewCoverWrap: { position: 'relative' },
  reviewCover: { width: '100%', height: 172 },
  reviewCoverBadge: { position: 'absolute', right: 10, top: 10, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  reviewCoverBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  reviewCoverFallback: { height: 112, borderBottomWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reviewCopy: { gap: 7, padding: 16 },
  reviewEyebrowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reviewKindChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  reviewKindText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  reviewTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  reviewMeta: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  reviewDescription: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  reviewSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  metaChipText: { fontSize: 12, fontWeight: '900' },
  headerMenuButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
});
