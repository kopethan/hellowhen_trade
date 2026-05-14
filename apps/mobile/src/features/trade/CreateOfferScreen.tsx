import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InventoryItemType, TradeExchangeMode } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { ImagePickerField } from './components/ImagePickerField';
import { InventoryPreview, InventoryTextField, InventoryTypePicker, ModePicker, itemTypeLabel, modeLabel, optionalText, parseInventoryList } from './components/InventoryFormFields';
import { uploadSelectedImages, type SelectedLocalImage } from './mediaUpload';
import { useTranslation } from '../../providers/MobileI18nProvider';
import type { OfferItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateOffer'>;
type CreateOfferResponse = { offer: OfferItem };

export function CreateOfferScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState<InventoryItemType>('service');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [mode, setMode] = useState<TradeExchangeMode>('remote');
  const [locationLabel, setLocationLabel] = useState('');
  const [includesInput, setIncludesInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [images, setImages] = useState<SelectedLocalImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(() => [itemTypeLabel(itemType, t), category.trim(), availability.trim(), modeLabel(mode, t), locationLabel.trim()].filter(Boolean).join(' · '), [availability, category, itemType, locationLabel, mode, t]);

  async function handleCreate() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (cleanTitle.length < 3) {
      setError(t('validation.offerTitleTooShort'));
      return;
    }
    if (cleanDescription.length < 10) {
      setError(t('validation.offerDescriptionTooShort'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const mediaIds = await uploadSelectedImages(images);
      const response = await api.offers.create({
        title: cleanTitle,
        description: cleanDescription,
        itemType,
        category: optionalText(category),
        availability: optionalText(availability),
        mode,
        locationLabel: optionalText(locationLabel),
        includes: parseInventoryList(includesInput),
        tags: parseInventoryList(tagsInput),
        status: route.params?.returnTo ? 'active' : 'draft',
        mediaIds,
      }) as CreateOfferResponse;

      if (route.params?.returnTo === 'tradeProposal' && route.params.tradeId) {
        navigation.navigate('TradeDetail', {
          tradeId: route.params.tradeId,
          title: route.params.tradeTitle,
          selectedProposalSide: { side: 'offer', kind: 'offer', id: response.offer.id },
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
          <InventoryTextField label={t('inventory.labels.title')} value={title} onChangeText={setTitle} placeholder={t('inventory.form.titleOfferExample')} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.description')} value={description} onChangeText={setDescription} placeholder={t('inventory.form.descriptionOfferMobile')} multiline disabled={submitting} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.labels.deckDetails')}</AppText>
          <InventoryTypePicker value={itemType} onChange={setItemType} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.category')} value={category} onChangeText={setCategory} placeholder={t('inventory.form.categoryOfferPlaceholder')} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.availability')} value={availability} onChangeText={setAvailability} placeholder={t('inventory.form.availabilityMobilePlaceholder')} disabled={submitting} />
          <ModePicker value={mode} onChange={setMode} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.location')} hint={t('inventory.labels.optional')} value={locationLabel} onChangeText={setLocationLabel} placeholder={t('inventory.form.locationOfferPlaceholder')} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.includes')} hint={t('inventory.form.separateWithCommas')} value={includesInput} onChangeText={setIncludesInput} placeholder={t('inventory.form.includesMobilePlaceholder')} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.tags')} hint={t('inventory.form.separateWithCommas')} value={tagsInput} onChangeText={setTagsInput} placeholder={t('inventory.form.tagsOfferPlaceholder')} disabled={submitting} />
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

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.labels.cardPreview')}</AppText>
          <InventoryPreview eyebrow={t('inventory.side.offer')} title={title.trim()} meta={meta} description={description.trim()} />
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
