import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DiscoveryLanguage, TradeExchangeMode } from '@hellowhen/contracts';
import { INVENTORY_DESCRIPTION_MAX_LENGTH, INVENTORY_DESCRIPTION_MIN_LENGTH, INVENTORY_TITLE_MAX_LENGTH, INVENTORY_TITLE_MIN_LENGTH } from '@hellowhen/contracts/src/inventoryLimits';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { ImagePickerField } from './components/ImagePickerField';
import { buildManualTranslation, CategoryPicker, InventoryTextField, LanguagePicker, ManualTranslationFields, ModePicker, optionalText } from './components/InventoryFormFields';
import { uploadSelectedImages, type SelectedLocalImage } from './mediaUpload';
import { useTranslation } from '../../providers/MobileI18nProvider';
import type { OfferItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateOffer'>;
type CreateOfferResponse = { offer: OfferItem };

export function CreateOfferScreen({ route, navigation }: Props) {
  const { t, language } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState<DiscoveryLanguage>(language);
  const [translationTitle, setTranslationTitle] = useState('');
  const [translationDescription, setTranslationDescription] = useState('');
  const [mode, setMode] = useState<TradeExchangeMode>('remote');
  const [category, setCategory] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [images, setImages] = useState<SelectedLocalImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDefaultLanguageChange(nextLanguage: DiscoveryLanguage) {
    setDefaultLanguage(nextLanguage);
    setTranslationTitle('');
    setTranslationDescription('');
  }

  function validateForm() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (cleanTitle.length < INVENTORY_TITLE_MIN_LENGTH) return t('validation.offerTitleTooShort');
    if (cleanTitle.length > INVENTORY_TITLE_MAX_LENGTH) return t('validation.titleTooLong', { max: INVENTORY_TITLE_MAX_LENGTH });
    if (cleanDescription.length < INVENTORY_DESCRIPTION_MIN_LENGTH) return t('validation.offerDescriptionTooShort');
    if (cleanDescription.length > INVENTORY_DESCRIPTION_MAX_LENGTH) return t('validation.descriptionTooLong', { max: INVENTORY_DESCRIPTION_MAX_LENGTH });
    if ((translationTitle.trim() && !translationDescription.trim()) || (!translationTitle.trim() && translationDescription.trim())) return t('inventory.errors.translationIncomplete');
    if (translationTitle.trim() && translationTitle.trim().length < INVENTORY_TITLE_MIN_LENGTH) return t('inventory.errors.translationTitleTooShort');
    if (translationDescription.trim() && translationDescription.trim().length < INVENTORY_DESCRIPTION_MIN_LENGTH) return t('inventory.errors.translationDescriptionTooShort');
    return null;
  }

  async function handleCreate() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const mediaIds = await uploadSelectedImages(images);
      const response = await api.offers.create({
        title: cleanTitle,
        description: cleanDescription,
        defaultLanguage,
        translations: buildManualTranslation(defaultLanguage, translationTitle, translationDescription),
        itemType: 'service',
        category: optionalText(category),
        mode,
        locationLabel: optionalText(locationLabel),
        includes: [],
        tags: [],
        status: route.params?.returnTo ? 'active' : 'draft',
        mediaIds,
      }) as CreateOfferResponse;

      if (route.params?.returnTo === 'proposalDetail' && route.params.proposalId) {
        navigation.navigate('ProposalDetail', {
          proposalId: route.params.proposalId,
          selectedProposalSide: { side: 'offer', kind: 'offer', id: response.offer.id },
          selectedProposalNeedId: route.params.proposalNeedId,
          selectedProposalOfferId: response.offer.id,
        });
        return;
      }

      if (route.params?.returnTo === 'tradeProposal' && route.params.tradeId) {
        navigation.navigate('TradePrivateProposals', {
          tradeId: route.params.tradeId,
          title: route.params.tradeTitle,
          selectedProposalSide: { side: 'offer', kind: 'offer', id: response.offer.id },
          selectedProposalNeedId: route.params.proposalNeedId,
          selectedProposalOfferId: response.offer.id,
        });
        return;
      }

      if (route.params?.returnTo === 'createTrade') {
        navigation.navigate('CreateTrade', { selectedTradeSide: { side: 'offer', kind: 'offer', id: response.offer.id } });
        return;
      }

      navigation.goBack();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppHeader title={t('inventory.form.saveOfferTitle')} onBack={() => navigation.goBack()} />
        <View style={styles.header}>
          <SemanticBadge label={t('inventory.labels.offer')} tone="offer" />
          <AppText style={styles.title}>{t('inventory.form.saveOfferTitle')}</AppText>
          <AppText style={styles.subtitle}>{t('inventory.form.saveOfferBody')}</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title={t('inventory.errors.couldNotSave')} body={error} /> : null}

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.form.offerQuestion')}</AppText>
          <InventoryTextField label={t('inventory.labels.title')} value={title} onChangeText={setTitle} placeholder={t('inventory.form.titleOfferExample')} maxLength={INVENTORY_TITLE_MAX_LENGTH} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.description')} value={description} onChangeText={setDescription} placeholder={t('inventory.form.descriptionOfferMobile')} maxLength={INVENTORY_DESCRIPTION_MAX_LENGTH} multiline disabled={submitting} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.form.languageTitle')}</AppText>
          <AppText style={styles.sectionBody}>{t('inventory.form.languageBody')}</AppText>
          <LanguagePicker value={defaultLanguage} onChange={handleDefaultLanguageChange} disabled={submitting} />
          <ManualTranslationFields
            defaultLanguage={defaultLanguage}
            title={translationTitle}
            description={translationDescription}
            onChangeTitle={setTranslationTitle}
            onChangeDescription={setTranslationDescription}
            titleMaxLength={INVENTORY_TITLE_MAX_LENGTH}
            descriptionMaxLength={INVENTORY_DESCRIPTION_MAX_LENGTH}
            disabled={submitting}
          />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.form.simplifiedDetailsTitle')}</AppText>
          <AppText style={styles.sectionBody}>{t('inventory.form.simplifiedDetailsBody')}</AppText>
          <CategoryPicker value={category} onChange={setCategory} disabled={submitting} />
          <ModePicker value={mode} onChange={setMode} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.location')} hint={t('inventory.labels.optional')} value={locationLabel} onChangeText={setLocationLabel} placeholder={t('inventory.form.locationOfferPlaceholder')} disabled={submitting} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.form.offerImageSection')}</AppText>
          <ImagePickerField
            images={images}
            onChange={setImages}
            disabled={submitting}
            label={t('inventory.labels.sampleImages')}
            hint={t('inventory.form.offerImageHint')}
          />
        </AppCard>

        <View style={styles.actions}>
          <Pressable disabled={submitting} onPress={handleCreate} style={({ pressed }) => [styles.primaryButton, submitting && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{submitting ? t('common.states.saving') : t('inventory.actions.saveOffer')}</AppText>
          </Pressable>
          <Pressable disabled={submitting} onPress={() => navigation.goBack()} style={({ pressed }) => [styles.secondaryButton, submitting && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.secondaryButtonText}>{t('common.actions.cancel')}</AppText>
          </Pressable>
        </View>
      </ScrollView>
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
    backgroundColor: '#16A34A',
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
