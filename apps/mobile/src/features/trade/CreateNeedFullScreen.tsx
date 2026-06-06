import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DiscoveryLanguage, PreviewCardTheme, TradeExchangeMode } from '@hellowhen/contracts';
import { INVENTORY_DESCRIPTION_MAX_LENGTH, INVENTORY_DESCRIPTION_MIN_LENGTH, INVENTORY_TITLE_MAX_LENGTH, INVENTORY_TITLE_MIN_LENGTH } from '@hellowhen/contracts/src/inventoryLimits';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning';
import { AppCard } from '../../components/AppCard';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { ImagePickerField } from './components/ImagePickerField';
import { AddTranslationButton, buildManualTranslation, CategoryPicker, InventoryTextField, ManualTranslationFields, ModePicker, optionalText, OriginalLanguageSummary } from './components/InventoryFormFields';
import { InventoryAiAssistCard } from './components/InventoryAiAssistCard';
import { PreviewThemePickerCard } from './components/PreviewThemePickerCard';
import { formatUploadProgress, getFriendlyUploadErrorMessage, uploadSelectedImages, type SelectedImageUploadProgress, type SelectedLocalImage } from './mediaUpload';
import { useTranslation } from '../../providers/MobileI18nProvider';
import type { NeedItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateNeedFull'>;
type CreateNeedResponse = { need: NeedItem };

function parseCommaTags(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

export function CreateNeedFullScreen({ route, navigation }: Props) {
  const { t, language } = useTranslation();
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
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<SelectedImageUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasDraft = useMemo(() => Boolean(
    title.trim() ||
    description.trim() ||
    translationTitle.trim() ||
    translationDescription.trim() ||
    category.trim() ||
    tags.trim() ||
    locationLabel.trim() ||
    previewTheme !== 'default' ||
    images.length > 0,
  ), [category, description, images.length, locationLabel, previewTheme, tags, title, translationDescription, translationTitle]);

  const unsavedChangesConfirm = useUnsavedChangesWarning({
    navigation,
    enabled: hasDraft && !submitting,
    title: t('inventory.form.unsavedTitle'),
    body: t('inventory.form.unsavedBody'),
    stayLabel: t('common.actions.cancel'),
    discardLabel: t('inventory.form.discardDraft'),
  });

  function validateForm() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (cleanTitle.length < INVENTORY_TITLE_MIN_LENGTH) return t('validation.needTitleTooShort');
    if (cleanTitle.length > INVENTORY_TITLE_MAX_LENGTH) return t('validation.titleTooLong', { max: INVENTORY_TITLE_MAX_LENGTH });
    if (cleanDescription.length < INVENTORY_DESCRIPTION_MIN_LENGTH) return t('validation.needDescriptionTooShort');
    if (cleanDescription.length > INVENTORY_DESCRIPTION_MAX_LENGTH) return t('validation.descriptionTooLong', { max: INVENTORY_DESCRIPTION_MAX_LENGTH });
    if ((translationTitle.trim() && !translationDescription.trim()) || (!translationTitle.trim() && translationDescription.trim())) return t('inventory.errors.translationIncomplete');
    if (translationTitle.trim() && translationTitle.trim().length < INVENTORY_TITLE_MIN_LENGTH) return t('inventory.errors.translationTitleTooShort');
    if (translationDescription.trim() && translationDescription.trim().length < INVENTORY_DESCRIPTION_MIN_LENGTH) return t('inventory.errors.translationDescriptionTooShort');
    return null;
  }

  const titleError = attemptedSubmit && title.trim().length < INVENTORY_TITLE_MIN_LENGTH ? t('validation.needTitleTooShort') : null;
  const descriptionError = attemptedSubmit && description.trim().length < INVENTORY_DESCRIPTION_MIN_LENGTH ? t('validation.needDescriptionTooShort') : null;
  const uploadProgressBody = formatUploadProgress(uploadProgress, t);

  function applyAiTranslation(_languageCode: DiscoveryLanguage, titleText: string, descriptionText: string) {
    setTranslationEnabled(true);
    setTranslationTitle(titleText);
    setTranslationDescription(descriptionText);
  }

  function applyAiCategoryTags(categoryText: string, tagList: string[]) {
    setCategory(categoryText);
    setTags(tagList.join(', '));
  }

  async function handleCreate() {
    if (submitting) return;
    setAttemptedSubmit(true);
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setUploadProgress(null);
    setError(null);

    try {
      const mediaIds = await uploadSelectedImages(images, { onProgress: setUploadProgress });
      const response = await api.needs.create({
        title: cleanTitle,
        description: cleanDescription,
        defaultLanguage,
        translations: translationEnabled ? buildManualTranslation(defaultLanguage, translationTitle, translationDescription) : [],
        itemType: 'service',
        category: optionalText(category),
        mode,
        locationLabel: optionalText(locationLabel),
        tags: parseCommaTags(tags),
        previewTheme,
        status: route.params?.returnTo ? 'active' : 'draft',
        mediaIds,
        coverMediaId: mediaIds[0],
      }) as CreateNeedResponse;

      if (route.params?.returnTo === 'proposalDetail' && route.params.proposalId) {
        navigation.navigate('ProposalDetail', {
          proposalId: route.params.proposalId,
          selectedProposalSide: { side: 'need', kind: 'need', id: response.need.id },
          selectedProposalNeedId: response.need.id,
          selectedProposalOfferId: route.params.proposalOfferId,
        });
        return;
      }

      if (route.params?.returnTo === 'tradeProposal' && route.params.tradeId) {
        navigation.navigate('TradePrivateProposals', {
          tradeId: route.params.tradeId,
          title: route.params.tradeTitle,
          selectedProposalSide: { side: 'need', kind: 'need', id: response.need.id },
          selectedProposalNeedId: response.need.id,
          selectedProposalOfferId: route.params.proposalOfferId,
        });
        return;
      }

      if (route.params?.returnTo === 'createTradeFull') {
        navigation.navigate('CreateTradeFull', { selectedTradeSide: { side: 'need', kind: 'need', id: response.need.id } });
        return;
      }

      if (route.params?.returnTo === 'createTrade') {
        navigation.navigate('CreateTrade', { selectedTradeSide: { side: 'need', kind: 'need', id: response.need.id } });
        return;
      }

      navigation.goBack();
    } catch (caughtError) {
      setError(getFriendlyUploadErrorMessage(caughtError, t));
    } finally {
      setUploadProgress(null);
      setSubmitting(false);
    }
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppHeader title={t('inventory.form.saveNeedTitle')} onBack={() => navigation.goBack()} />
        <View style={styles.header}>
          <SemanticBadge label={t('inventory.labels.need')} tone="need" />
          <AppText style={styles.title}>{t('inventory.form.saveNeedTitle')}</AppText>
          <AppText style={styles.subtitle}>{t('inventory.form.saveNeedBody')}</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title={t('inventory.errors.couldNotSave')} body={error} /> : null}
        {submitting && uploadProgressBody ? <InfoNotice tone="info" title={t('inventory.form.uploadProgressTitle')} body={uploadProgressBody} /> : null}

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.form.needQuestion')}</AppText>
          <InventoryTextField label={t('inventory.labels.title')} value={title} onChangeText={setTitle} placeholder={t('inventory.form.titleNeedExample')} maxLength={INVENTORY_TITLE_MAX_LENGTH} disabled={submitting} error={titleError} />
          <InventoryTextField label={t('inventory.labels.description')} value={description} onChangeText={setDescription} placeholder={t('inventory.form.descriptionNeedMobile')} maxLength={INVENTORY_DESCRIPTION_MAX_LENGTH} multiline disabled={submitting} error={descriptionError} />
        </AppCard>

        <InventoryAiAssistCard
          kind="need"
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

        <PreviewThemePickerCard value={previewTheme} onChange={setPreviewTheme} disabled={submitting} />

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.form.languageTitle')}</AppText>
          <AppText style={styles.sectionBody}>{t('inventory.form.languageBody')}</AppText>
          <OriginalLanguageSummary languageCode={defaultLanguage} />
          {translationEnabled ? (
            <ManualTranslationFields
              defaultLanguage={defaultLanguage}
              title={translationTitle}
              description={translationDescription}
              onChangeTitle={setTranslationTitle}
              onChangeDescription={setTranslationDescription}
              onRemove={() => { setTranslationEnabled(false); setTranslationTitle(''); setTranslationDescription(''); }}
              titleMaxLength={INVENTORY_TITLE_MAX_LENGTH}
              descriptionMaxLength={INVENTORY_DESCRIPTION_MAX_LENGTH}
              disabled={submitting}
            />
          ) : (
            <AddTranslationButton defaultLanguage={defaultLanguage} onAdd={() => setTranslationEnabled(true)} disabled={submitting} />
          )}
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.form.simplifiedDetailsTitle')}</AppText>
          <AppText style={styles.sectionBody}>{t('inventory.form.simplifiedDetailsBody')}</AppText>
          <CategoryPicker value={category} onChange={setCategory} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.tags')} hint={t('inventory.form.separateWithCommas')} value={tags} onChangeText={setTags} placeholder={t('inventory.form.tagsPlaceholder')} disabled={submitting} />
          <ModePicker value={mode} onChange={setMode} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.location')} hint={t('inventory.labels.optional')} value={locationLabel} onChangeText={setLocationLabel} placeholder={t('inventory.form.locationNeedPlaceholder')} disabled={submitting} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.form.needImageSection')}</AppText>
          <ImagePickerField
            images={images}
            onChange={setImages}
            disabled={submitting}
            enableOrderControls={betaFeatures.plusSubscriptionFeatures.customizationEnabled}
            label={t('inventory.labels.referenceImages')}
            hint={t('inventory.form.needImageHint')}
          />
        </AppCard>

        <View style={styles.actions}>
          <Pressable disabled={submitting} onPress={handleCreate} style={({ pressed }) => [styles.primaryButton, submitting && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{submitting ? (uploadProgress ? t('common.states.uploading') : t('common.states.saving')) : t('inventory.actions.saveNeed')}</AppText>
          </Pressable>
          <Pressable disabled={submitting} onPress={() => navigation.goBack()} style={({ pressed }) => [styles.secondaryButton, submitting && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.secondaryButtonText}>{t('common.actions.cancel')}</AppText>
          </Pressable>
        </View>
      </ScrollView>
      <AppConfirmSheet {...unsavedChangesConfirm} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
    gap: 14,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    color: '#64748B',
    lineHeight: 21,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  sectionBody: {
    color: '#64748B',
    lineHeight: 20,
    fontWeight: '700',
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.78,
  },
});
