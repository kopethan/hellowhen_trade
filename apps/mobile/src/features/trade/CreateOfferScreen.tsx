import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TradeExchangeMode } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { ImagePickerField } from './components/ImagePickerField';
import { InventoryPreview, InventoryTextField, ModePicker, modeLabel, optionalText, parseInventoryList } from './components/InventoryFormFields';
import { uploadSelectedImages, type SelectedLocalImage } from './mediaUpload';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateOffer'>;

export function CreateOfferScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [mode, setMode] = useState<TradeExchangeMode>('remote');
  const [locationLabel, setLocationLabel] = useState('');
  const [includesInput, setIncludesInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [images, setImages] = useState<SelectedLocalImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(() => [category.trim(), availability.trim(), modeLabel(mode), locationLabel.trim()].filter(Boolean).join(' · '), [availability, category, locationLabel, mode]);

  async function handleCreate() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (cleanTitle.length < 3) {
      setError('Add a clear offer title.');
      return;
    }
    if (cleanDescription.length < 10) {
      setError('Describe the offer with at least one useful detail.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const mediaIds = await uploadSelectedImages(images);
      await api.offers.create({
        title: cleanTitle,
        description: cleanDescription,
        category: optionalText(category),
        availability: optionalText(availability),
        mode,
        locationLabel: optionalText(locationLabel),
        includes: parseInventoryList(includesInput),
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
        <View style={styles.header}>
          <SemanticBadge label="Offer" tone="offer" />
          <AppText style={styles.title}>Save Offer</AppText>
          <AppText style={styles.subtitle}>Create a reusable service with its own images. You will pair it with a need when publishing a trade.</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title="Could not save" body={error} /> : null}

        <AppCard>
          <AppText style={styles.sectionTitle}>What can you offer?</AppText>
          <InventoryTextField label="Title" value={title} onChangeText={setTitle} placeholder="Product photography" disabled={submitting} />
          <InventoryTextField label="Description" value={description} onChangeText={setDescription} placeholder="Describe what you deliver, how it works, and any limits." multiline disabled={submitting} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Deck details</AppText>
          <InventoryTextField label="Category" value={category} onChangeText={setCategory} placeholder="Photography, copywriting, coaching..." disabled={submitting} />
          <InventoryTextField label="Availability" value={availability} onChangeText={setAvailability} placeholder="Weekend, this week, evenings..." disabled={submitting} />
          <ModePicker value={mode} onChange={setMode} disabled={submitting} />
          <InventoryTextField label="Location" hint="Optional" value={locationLabel} onChangeText={setLocationLabel} placeholder="Remote, local studio, pickup only..." disabled={submitting} />
          <InventoryTextField label="Includes" hint="Separate with commas" value={includesInput} onChangeText={setIncludesInput} placeholder="10 edited shots, 1 revision, delivery folder" disabled={submitting} />
          <InventoryTextField label="Tags" hint="Separate with commas" value={tagsInput} onChangeText={setTagsInput} placeholder="camera, edits, ecommerce" disabled={submitting} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Offer images</AppText>
          <ImagePickerField
            images={images}
            onChange={setImages}
            disabled={submitting}
            label="Sample images"
            hint="Add examples that help people trust the offer."
          />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Card preview</AppText>
          <InventoryPreview eyebrow="I offer" title={title.trim()} meta={meta} description={description.trim()} />
        </AppCard>

        <View style={styles.actions}>
          <Pressable disabled={submitting} onPress={handleCreate} style={({ pressed }) => [styles.primaryButton, submitting && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{submitting ? 'Saving...' : 'Save Offer'}</AppText>
          </Pressable>
          <Pressable disabled={submitting} onPress={() => navigation.goBack()} style={({ pressed }) => [styles.secondaryButton, submitting && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.secondaryButtonText}>Cancel</AppText>
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
