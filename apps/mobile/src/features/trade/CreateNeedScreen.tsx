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

type Props = NativeStackScreenProps<RootStackParamList, 'CreateNeed'>;

export function CreateNeedScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState<InventoryItemType>('service');
  const [category, setCategory] = useState('');
  const [timing, setTiming] = useState('');
  const [mode, setMode] = useState<TradeExchangeMode>('remote');
  const [locationLabel, setLocationLabel] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [images, setImages] = useState<SelectedLocalImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(() => [itemTypeLabel(itemType, t), category.trim(), timing.trim(), modeLabel(mode, t), locationLabel.trim()].filter(Boolean).join(' · '), [category, itemType, locationLabel, mode, t, timing]);

  async function handleCreate() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (cleanTitle.length < 3) {
      setError(t('validation.needTitleTooShort'));
      return;
    }
    if (cleanDescription.length < 10) {
      setError(t('validation.needDescriptionTooShort'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const mediaIds = await uploadSelectedImages(images);
      await api.needs.create({
        title: cleanTitle,
        description: cleanDescription,
        itemType,
        category: optionalText(category),
        timing: optionalText(timing),
        mode,
        locationLabel: optionalText(locationLabel),
        tags: parseInventoryList(tagsInput),
        status: 'draft',
        mediaIds,
      });
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
        <AppHeader title={t('inventory.form.saveNeedTitle')} onBack={() => navigation.goBack()} />
        <View style={styles.header}>
          <SemanticBadge label={t('inventory.labels.need')} tone="need" />
          <AppText style={styles.title}>{t('inventory.form.saveNeedTitle')}</AppText>
          <AppText style={styles.subtitle}>{t('inventory.form.saveNeedBody')}</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title={t('inventory.errors.couldNotSave')} body={error} /> : null}

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.form.needQuestion')}</AppText>
          <InventoryTextField label={t('inventory.labels.title')} value={title} onChangeText={setTitle} placeholder={t('inventory.form.titleNeedExample')} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.description')} value={description} onChangeText={setDescription} placeholder={t('inventory.form.descriptionNeedMobile')} multiline disabled={submitting} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.labels.deckDetails')}</AppText>
          <InventoryTypePicker value={itemType} onChange={setItemType} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.category')} value={category} onChangeText={setCategory} placeholder={t('inventory.form.categoryNeedPlaceholder')} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.timing')} value={timing} onChangeText={setTiming} placeholder={t('inventory.form.timingMobilePlaceholder')} disabled={submitting} />
          <ModePicker value={mode} onChange={setMode} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.location')} hint={t('inventory.labels.optional')} value={locationLabel} onChangeText={setLocationLabel} placeholder={t('inventory.form.locationNeedPlaceholder')} disabled={submitting} />
          <InventoryTextField label={t('inventory.labels.tags')} hint={t('inventory.form.separateWithCommas')} value={tagsInput} onChangeText={setTagsInput} placeholder={t('inventory.form.tagsNeedPlaceholder')} disabled={submitting} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.form.needImageSection')}</AppText>
          <ImagePickerField
            images={images}
            onChange={setImages}
            disabled={submitting}
            label={t('inventory.labels.referenceImages')}
            hint={t('inventory.form.needImageHint')}
          />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('inventory.labels.cardPreview')}</AppText>
          <InventoryPreview eyebrow={t('inventory.side.need')} title={title.trim()} meta={meta} description={description.trim()} />
        </AppCard>

        <View style={styles.actions}>
          <Pressable disabled={submitting} onPress={handleCreate} style={({ pressed }) => [styles.primaryButton, submitting && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{submitting ? t('common.states.saving') : t('inventory.actions.saveNeed')}</AppText>
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
