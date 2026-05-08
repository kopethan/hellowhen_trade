import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TradeExchangeMode } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { ImagePickerField } from './components/ImagePickerField';
import { InventoryPreview, InventoryTextField, ModePicker, modeLabel, optionalText, parseInventoryList } from './components/InventoryFormFields';
import { uploadSelectedImages, type SelectedLocalImage } from './mediaUpload';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateNeed'>;

export function CreateNeedScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [timing, setTiming] = useState('');
  const [mode, setMode] = useState<TradeExchangeMode>('remote');
  const [locationLabel, setLocationLabel] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [images, setImages] = useState<SelectedLocalImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(() => [category.trim(), timing.trim(), modeLabel(mode), locationLabel.trim()].filter(Boolean).join(' · '), [category, locationLabel, mode, timing]);

  async function handleCreate() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (cleanTitle.length < 3) {
      setError('Add a clear need title.');
      return;
    }
    if (cleanDescription.length < 10) {
      setError('Describe the need with at least one useful detail.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const mediaIds = await uploadSelectedImages(images);
      await api.needs.create({
        title: cleanTitle,
        description: cleanDescription,
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
        <AppHeader title="Save Need" onBack={() => navigation.goBack()} />
        <View style={styles.header}>
          <SemanticBadge label="Need" tone="need" />
          <AppText style={styles.title}>Save Need</AppText>
          <AppText style={styles.subtitle}>Create a reusable request with its own images. You will choose it later when publishing a trade.</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title="Could not save" body={error} /> : null}

        <AppCard>
          <AppText style={styles.sectionTitle}>What do you need?</AppText>
          <InventoryTextField label="Title" value={title} onChangeText={setTitle} placeholder="Landing page design" disabled={submitting} />
          <InventoryTextField label="Description" value={description} onChangeText={setDescription} placeholder="Describe the result you want, useful details, and what done means." multiline disabled={submitting} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Deck details</AppText>
          <InventoryTextField label="Category" value={category} onChangeText={setCategory} placeholder="Design, writing, photography..." disabled={submitting} />
          <InventoryTextField label="Timing" value={timing} onChangeText={setTiming} placeholder="This week, weekend, today..." disabled={submitting} />
          <ModePicker value={mode} onChange={setMode} disabled={submitting} />
          <InventoryTextField label="Location" hint="Optional" value={locationLabel} onChangeText={setLocationLabel} placeholder="Remote, Paris, local pickup..." disabled={submitting} />
          <InventoryTextField label="Tags" hint="Separate with commas" value={tagsInput} onChangeText={setTagsInput} placeholder="brand, figma, urgent" disabled={submitting} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Need images</AppText>
          <ImagePickerField
            images={images}
            onChange={setImages}
            disabled={submitting}
            label="Reference images"
            hint="Add images that explain what you need."
          />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Card preview</AppText>
          <InventoryPreview eyebrow="I need" title={title.trim()} meta={meta} description={description.trim()} />
        </AppCard>

        <View style={styles.actions}>
          <Pressable disabled={submitting} onPress={handleCreate} style={({ pressed }) => [styles.primaryButton, submitting && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{submitting ? 'Saving...' : 'Save Need'}</AppText>
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
