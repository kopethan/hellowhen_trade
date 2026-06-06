import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getNextWizardStepId, getPreviousWizardStepId, type WizardStepDefinition } from '@hellowhen/shared';
import type { DiscoveryLanguage, PreviewCardTheme, TradeExchangeMode } from '@hellowhen/contracts';
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
import { AppCard } from '../../components/AppCard';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useAuth } from '../../providers/AuthProvider';
import { buildMobileWizardDraftKey, useMobileWizardDraft, WizardFooter, WizardShell } from './create';
import { ImagePickerField } from './components/ImagePickerField';
import {
  CategoryPicker,
  InventoryTextField,
  buildManualTranslation,
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
  tags: string;
  mode: TradeExchangeMode;
  locationLabel: string;
  previewTheme: PreviewCardTheme;
  images: SelectedLocalImage[];
};

type InventoryWizardPersistedDraft = InventoryWizardDraft & {
  activeStepId: InventoryWizardStepId;
  translationTitle: string;
  translationDescription: string;
  translationEnabled: boolean;
};

const stepIds: InventoryWizardStepId[] = ['idea', 'details', 'images', 'review'];

function safeWizardText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasDraftContent(draft: InventoryWizardDraft, translationTitle: string, translationDescription: string) {
  return Boolean(
    safeWizardText(draft.title) ||
    safeWizardText(draft.description) ||
    safeWizardText(translationTitle) ||
    safeWizardText(translationDescription) ||
    safeWizardText(draft.category) ||
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

export function InventoryCreateWizardScreen({ kind, routeParams, navigation }: InventoryCreateWizardScreenProps) {
  const { t, language } = useTranslation();
  const auth = useAuth();
  const isNeed = kind === 'need';
  const [activeStepId, setActiveStepId] = useState<InventoryWizardStepId>('idea');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [defaultLanguage] = useState<DiscoveryLanguage>(language);
  const [translationTitle, setTranslationTitle] = useState('');
  const [translationDescription, setTranslationDescription] = useState('');
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [mode, setMode] = useState<TradeExchangeMode>('remote');
  const [previewTheme, setPreviewTheme] = useState<PreviewCardTheme>('default');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [images, setImages] = useState<SelectedLocalImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [attemptedStepId, setAttemptedStepId] = useState<InventoryWizardStepId | null>(null);
  const [uploadProgress, setUploadProgress] = useState<SelectedImageUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draft = useMemo<InventoryWizardDraft>(() => ({
    title,
    description,
    category,
    tags,
    mode,
    locationLabel,
    previewTheme,
    images,
  }), [category, description, images, locationLabel, mode, previewTheme, tags, title]);

  const persistedDraft = useMemo<InventoryWizardPersistedDraft>(() => ({
    ...draft,
    activeStepId,
    translationTitle,
    translationDescription,
    translationEnabled,
  }), [activeStepId, draft, translationDescription, translationEnabled, translationTitle]);

  const draftStorageKey = useMemo(() => buildMobileWizardDraftKey(kind === 'need' ? 'create-need' : 'create-offer', auth.user?.id), [auth.user?.id, kind]);

  const restoreDraft = useCallback((savedDraft: InventoryWizardPersistedDraft) => {
    setTitle(typeof savedDraft.title === 'string' ? savedDraft.title : '');
    setDescription(typeof savedDraft.description === 'string' ? savedDraft.description : '');
    setCategory(typeof savedDraft.category === 'string' ? savedDraft.category : '');
    setTags(typeof savedDraft.tags === 'string' ? savedDraft.tags : '');
    setMode(savedDraft.mode === 'local' || savedDraft.mode === 'hybrid' || savedDraft.mode === 'remote' ? savedDraft.mode : 'remote');
    setLocationLabel(typeof savedDraft.locationLabel === 'string' ? savedDraft.locationLabel : '');
    setPreviewTheme(['default', 'blue', 'green', 'purple', 'amber', 'rose'].includes(savedDraft.previewTheme) ? savedDraft.previewTheme : 'default');
    setImages(Array.isArray(savedDraft.images) ? savedDraft.images : []);
    setTranslationTitle(typeof savedDraft.translationTitle === 'string' ? savedDraft.translationTitle : '');
    setTranslationDescription(typeof savedDraft.translationDescription === 'string' ? savedDraft.translationDescription : '');
    setTranslationEnabled(Boolean(savedDraft.translationEnabled));
    setActiveStepId(stepIds.includes(savedDraft.activeStepId) ? savedDraft.activeStepId : 'idea');
  }, []);

  const inventoryWizardDraft = useMobileWizardDraft({
    storageKey: draftStorageKey,
    draft: persistedDraft,
    enabled: !submitting,
    hasContent: (candidate) => hasDraftContent(candidate, candidate.translationTitle, candidate.translationDescription),
    onRestore: restoreDraft,
  });

  const steps = useMemo<WizardStepDefinition<InventoryWizardStepId>[]>(() => [
    {
      id: 'idea',
      title: isNeed ? t('inventory.wizard.needIdeaTitle') : t('inventory.wizard.offerIdeaTitle'),
      description: isNeed ? t('inventory.wizard.needIdeaBody') : t('inventory.wizard.offerIdeaBody'),
      completed: title.trim().length >= INVENTORY_TITLE_MIN_LENGTH && description.trim().length >= INVENTORY_DESCRIPTION_MIN_LENGTH,
    },
    {
      id: 'details',
      title: t('inventory.wizard.detailsTitle'),
      description: t('inventory.wizard.detailsBody'),
      completed: Boolean(category.trim() || tags.trim() || locationLabel.trim() || mode !== 'remote' || previewTheme !== 'default'),
    },
    {
      id: 'images',
      title: t('inventory.wizard.imagesTitle'),
      description: isNeed ? t('inventory.wizard.needImagesBody') : t('inventory.wizard.offerImagesBody'),
      optional: true,
      completed: images.length > 0,
    },
    {
      id: 'review',
      title: t('inventory.wizard.reviewTitle'),
      description: t('inventory.wizard.reviewBody'),
    },
  ], [category, description, images.length, isNeed, locationLabel, mode, previewTheme, t, tags, title]);

  const hasDraft = hasDraftContent(draft, translationTitle, translationDescription);
  const uploadProgressBody = formatUploadProgress(uploadProgress, t);
  const activeStepIndex = getStepIndex(activeStepId);
  const shouldShowIdeaErrors = attemptedStepId === 'idea' || activeStepId === 'review';
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

  function validateIdeaStep() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (cleanTitle.length < INVENTORY_TITLE_MIN_LENGTH) return isNeed ? t('validation.needTitleTooShort') : t('validation.offerTitleTooShort');
    if (cleanTitle.length > INVENTORY_TITLE_MAX_LENGTH) return t('validation.titleTooLong', { max: INVENTORY_TITLE_MAX_LENGTH });
    if (cleanDescription.length < INVENTORY_DESCRIPTION_MIN_LENGTH) return isNeed ? t('validation.needDescriptionTooShort') : t('validation.offerDescriptionTooShort');
    if (cleanDescription.length > INVENTORY_DESCRIPTION_MAX_LENGTH) return t('validation.descriptionTooLong', { max: INVENTORY_DESCRIPTION_MAX_LENGTH });
    return null;
  }

  function validateBeforeStep(targetStepId: InventoryWizardStepId) {
    if (getStepIndex(targetStepId) > getStepIndex('idea')) return validateIdeaStep();
    return null;
  }

  function goToStep(targetStepId: InventoryWizardStepId) {
    if (submitting) return;
    const validationError = validateBeforeStep(targetStepId);
    if (validationError) {
      setAttemptedStepId('idea');
      setError(validationError);
      setActiveStepId('idea');
      return;
    }
    setError(null);
    setActiveStepId(targetStepId);
  }

  function handleNext() {
    const nextStepId = getNextWizardStepId(steps, activeStepId);
    if (!nextStepId || nextStepId === activeStepId) return;
    if (activeStepId === 'idea') {
      setAttemptedStepId('idea');
      const validationError = validateIdeaStep();
      if (validationError) {
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

  function applyAiTranslation(_languageCode: DiscoveryLanguage, titleText: string, descriptionText: string) {
    setTranslationEnabled(true);
    setTranslationTitle(titleText);
    setTranslationDescription(descriptionText);
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

  async function handleCreate() {
    if (submitting) return;
    setAttemptedStepId('idea');
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const validationError = validateIdeaStep();
    if (validationError) {
      setError(validationError);
      setActiveStepId('idea');
      return;
    }

    setSubmitting(true);
    setUploadProgress(null);
    setError(null);

    try {
      const mediaIds = await uploadSelectedImages(images, { onProgress: setUploadProgress });
      const basePayload = {
        title: cleanTitle,
        description: cleanDescription,
        defaultLanguage,
        translations: translationEnabled ? buildManualTranslation(defaultLanguage, translationTitle, translationDescription) : [],
        itemType: 'service' as const,
        category: optionalText(category),
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
        await inventoryWizardDraft.clearDraft();
        navigateAfterCreate(response.need.id);
      } else {
        const response = await api.offers.create({ ...basePayload, includes: [] }) as CreateOfferResponse;
        await inventoryWizardDraft.clearDraft();
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
    if (activeStepId === 'idea') {
      return (
        <>
          <AppCard>
            <View style={styles.sectionHeader}>
              <SemanticBadge label={isNeed ? t('inventory.labels.need') : t('inventory.labels.offer')} tone={isNeed ? 'need' : 'offer'} />
              <AppText style={styles.sectionBody}>{isNeed ? t('inventory.form.saveNeedBody') : t('inventory.form.saveOfferBody')}</AppText>
            </View>
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
        </>
      );
    }

    if (activeStepId === 'details') {
      return (
        <>
          <AppCard>
            <AppText style={styles.sectionTitle}>{t('inventory.form.simplifiedDetailsTitle')}</AppText>
            <AppText style={styles.sectionBody}>{t('inventory.form.simplifiedDetailsBody')}</AppText>
            <CategoryPicker value={category} onChange={setCategory} disabled={submitting} />
            <InventoryTextField label={t('inventory.labels.tags')} hint={t('inventory.form.separateWithCommas')} value={tags} onChangeText={setTags} placeholder={t('inventory.form.tagsPlaceholder')} disabled={submitting} />
            <ModePicker value={mode} onChange={setMode} disabled={submitting} />
            <InventoryTextField
              label={t('inventory.labels.location')}
              hint={t('inventory.labels.optional')}
              value={locationLabel}
              onChangeText={setLocationLabel}
              placeholder={isNeed ? t('inventory.form.locationNeedPlaceholder') : t('inventory.form.locationOfferPlaceholder')}
              disabled={submitting}
            />
          </AppCard>
          <PreviewThemePickerCard value={previewTheme} onChange={setPreviewTheme} disabled={submitting} />
          <AppCard>
            <AppText style={styles.sectionTitle}>{t('inventory.wizard.languageAdvancedTitle')}</AppText>
            <AppText style={styles.sectionBody}>{t('inventory.wizard.languageAdvancedBody')}</AppText>
            {translationEnabled ? <InfoNotice tone="success" title={t('inventory.wizard.translationPreparedTitle')} body={t('inventory.wizard.translationPreparedBody')} /> : null}
            <Pressable disabled={submitting} onPress={navigateToFullForm} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
              <AppText style={styles.linkButtonText}>{t('inventory.wizard.openFullForm')}</AppText>
            </Pressable>
          </AppCard>
        </>
      );
    }

    if (activeStepId === 'images') {
      return (
        <AppCard>
          <AppText style={styles.sectionTitle}>{isNeed ? t('inventory.form.needImageSection') : t('inventory.form.offerImageSection')}</AppText>
          <AppText style={styles.sectionBody}>{isNeed ? t('inventory.form.needImageHint') : t('inventory.form.offerImageHint')}</AppText>
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

    return (
      <>
        <AppCard>
          <View style={styles.reviewHeader}>
            <SemanticBadge label={isNeed ? t('inventory.labels.need') : t('inventory.labels.offer')} tone={isNeed ? 'need' : 'offer'} />
            <AppText style={styles.reviewTitle}>{title.trim() || t('inventory.form.previewTitleFallback')}</AppText>
          </View>
          <AppText style={styles.reviewDescription}>{description.trim() || t('inventory.form.previewDescriptionFallback')}</AppText>
          <View style={styles.metaWrap}>
            <View style={styles.metaChip}><AppText style={styles.metaChipText}>{modeLabel(mode, t)}</AppText></View>
            {category.trim() ? <View style={styles.metaChip}><AppText style={styles.metaChipText}>{categoryLabel(category, t)}</AppText></View> : null}
            {locationLabel.trim() ? <View style={styles.metaChip}><AppText style={styles.metaChipText}>{locationLabel.trim()}</AppText></View> : null}
            <View style={styles.metaChip}><AppText style={styles.metaChipText}>{t('inventory.wizard.imageCount', { count: images.length })}</AppText></View>
            {translationEnabled ? <View style={styles.metaChip}><AppText style={styles.metaChipText}>{t('inventory.wizard.translationPreparedShort')}</AppText></View> : null}
          </View>
        </AppCard>
        {parseInventoryList(tags).length > 0 ? (
          <AppCard>
            <AppText style={styles.sectionTitle}>{t('inventory.labels.tags')}</AppText>
            <View style={styles.metaWrap}>
              {parseInventoryList(tags).map((tag) => <View key={tag} style={styles.metaChip}><AppText style={styles.metaChipText}>#{tag}</AppText></View>)}
            </View>
          </AppCard>
        ) : null}
        <InfoNotice tone="info" title={t('inventory.wizard.reviewNoticeTitle')} body={t('inventory.wizard.reviewNoticeBody')} />
      </>
    );
  }

  const primaryLabel = activeStepId === 'review'
    ? (isNeed ? t('inventory.actions.saveNeed') : t('inventory.actions.saveOffer'))
    : t('common.actions.continue');
  const primaryLoadingLabel = uploadProgress ? t('common.states.uploading') : t('common.states.saving');
  const secondaryLabel = activeStepIndex > 0 ? t('common.actions.back') : t('common.actions.cancel');
  const onSecondary = activeStepIndex > 0 ? handlePrevious : () => navigation.goBack();

  return (
    <>
      <WizardShell
        title={isNeed ? t('inventory.wizard.createNeedTitle') : t('inventory.wizard.createOfferTitle')}
        subtitle={isNeed ? t('inventory.wizard.createNeedBody') : t('inventory.wizard.createOfferBody')}
        onBack={() => navigation.goBack()}
        steps={steps}
        activeStepId={activeStepId}
        stepLabel={t('inventory.wizard.stepLabel')}
        ofLabel={t('inventory.wizard.ofLabel')}
        rightSlot={(
          <Pressable disabled={submitting} onPress={navigateToFullForm} style={({ pressed }) => [styles.headerLink, pressed && styles.pressed]}>
            <AppText style={styles.headerLinkText}>{t('inventory.wizard.fullFormShort')}</AppText>
          </Pressable>
        )}
        footer={(
          <WizardFooter
            primaryLabel={primaryLabel}
            primaryLoading={submitting}
            primaryLoadingLabel={primaryLoadingLabel}
            onPrimary={activeStepId === 'review' ? handleCreate : handleNext}
            secondaryLabel={secondaryLabel}
            onSecondary={onSecondary}
            tertiaryLabel={activeStepId !== 'review' ? t('inventory.wizard.skipToReview') : t('inventory.wizard.openFullForm')}
            onTertiary={activeStepId !== 'review' ? () => goToStep('review') : navigateToFullForm}
            helperText={activeStepId === 'review' ? t('inventory.wizard.saveActiveHelper') : undefined}
          />
        )}
      >
        {inventoryWizardDraft.restored ? <InfoNotice tone="info" title={t('inventory.wizard.draftRestoredTitle')} body={t('inventory.wizard.draftRestoredBody')} /> : null}
        {error ? <InfoNotice tone="danger" title={t('inventory.errors.couldNotSave')} body={error} /> : null}
        {submitting && uploadProgressBody ? <InfoNotice tone="info" title={t('inventory.form.uploadProgressTitle')} body={uploadProgressBody} /> : null}
        {renderStep()}
      </WizardShell>
      <AppConfirmSheet {...unsavedChangesConfirm} />
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  sectionBody: { color: '#64748B', fontWeight: '700', lineHeight: 20 },
  reviewHeader: { gap: 10 },
  reviewTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, lineHeight: 31 },
  reviewDescription: { color: '#334155', fontWeight: '700', lineHeight: 21 },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: { borderRadius: 999, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 7 },
  metaChipText: { color: '#334155', fontSize: 12, fontWeight: '900' },
  headerLink: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  headerLinkText: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  linkButton: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 9 },
  linkButtonText: { color: '#2563EB', fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
