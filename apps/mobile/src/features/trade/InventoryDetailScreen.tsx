import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { ImagePickerField } from './components/ImagePickerField';
import { InventoryTypePicker, itemTypeLabel } from './components/InventoryFormFields';
import {
  DangerButton,
  ExistingMediaManager,
  getOptionalString,
  getStringArray,
  InventoryModePicker,
  InventoryTextField,
  joinCsv,
  modeLabel,
  normalizeMode,
  optionalText,
  parseCsv,
  PrimaryButton,
  SecondaryButton,
  type InventoryMode,
} from './components/InventoryDetailFields';
import { uploadSelectedImages, type SelectedLocalImage } from './mediaUpload';
import type { InventoryItemType } from '@hellowhen/contracts';
import { formatLocalizedDate } from '@hellowhen/i18n';
import type { NeedItem, OfferItem } from './types';

type InventoryKind = 'need' | 'offer';
type InventoryItem = (NeedItem | OfferItem) & Record<string, unknown>;
type InventoryResponse = { need?: NeedItem; offer?: OfferItem; archived?: boolean };

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
  const { t, language } = useTranslation();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState<InventoryItemType>('service');
  const [category, setCategory] = useState('');
  const [timingOrAvailability, setTimingOrAvailability] = useState('');
  const [mode, setMode] = useState<InventoryMode>('remote');
  const [locationLabel, setLocationLabel] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [includesInput, setIncludesInput] = useState('');
  const [newImages, setNewImages] = useState<SelectedLocalImage[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNeed = kind === 'need';
  const label = isNeed ? t('inventory.labels.need') : t('inventory.labels.offer');
  const labelLower = isNeed ? t('inventory.labels.need').toLowerCase() : t('inventory.labels.offer').toLowerCase();
  const labelsLower = isNeed ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase();
  const tone = isNeed ? 'need' : 'offer';
  const titlePlaceholder = isNeed ? t('inventory.form.titleNeedExample') : t('inventory.form.titleOfferExample');
  const timingLabel = isNeed ? t('inventory.labels.timing') : t('inventory.labels.availability');
  const timingPlaceholder = isNeed ? t('inventory.form.timingMobilePlaceholder') : t('inventory.form.availabilityMobilePlaceholder');
  const locationPlaceholder = isNeed ? t('inventory.form.locationNeedPlaceholder') : t('inventory.form.locationOfferPlaceholder');
  const tagsPlaceholder = isNeed ? t('inventory.form.tagsNeedPlaceholder') : t('inventory.form.tagsOfferPlaceholder');

  const hydrateForm = useCallback((nextItem: InventoryItem) => {
    setItem(nextItem);
    setTitle(nextItem.title ?? '');
    setDescription(nextItem.description ?? '');
    setItemType((nextItem.itemType as InventoryItemType | undefined) ?? 'service');
    setCategory(getOptionalString(nextItem, 'category'));
    setTimingOrAvailability(isNeed ? getOptionalString(nextItem, 'timing') : getOptionalString(nextItem, 'availability'));
    setMode(normalizeMode(getOptionalString(nextItem, 'mode')));
    setLocationLabel(getOptionalString(nextItem, 'locationLabel'));
    setTagsInput(joinCsv(getStringArray(nextItem, 'tags')));
    setIncludesInput(joinCsv(getStringArray(nextItem, 'includes')));
    setNewImages([]);
  }, [isNeed]);

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = isNeed ? await api.needs.get(itemId) as InventoryResponse : await api.offers.get(itemId) as InventoryResponse;
      const nextItem = (isNeed ? result.need : result.offer) as InventoryItem | undefined;
      if (!nextItem) throw new Error(t('inventory.errors.apiMissingItem', { item: label }));
      hydrateForm(nextItem);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [hydrateForm, isNeed, itemId, label, t]);

  useEffect(() => { void loadItem(); }, [loadItem]);

  async function saveItem(nextStatus?: string) {
    if (title.trim().length < 3) {
      setError(isNeed ? t('validation.needTitleTooShort') : t('validation.offerTitleTooShort'));
      return;
    }
    if (description.trim().length < 10) {
      setError(isNeed ? t('validation.needDescriptionTooShort') : t('validation.offerDescriptionTooShort'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const mediaIds = await uploadSelectedImages(newImages);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        itemType,
        category: optionalText(category),
        mode,
        locationLabel: optionalText(locationLabel),
        tags: parseCsv(tagsInput),
        status: nextStatus ?? item?.status ?? 'draft',
        mediaIds,
        ...(isNeed ? { timing: optionalText(timingOrAvailability) } : { availability: optionalText(timingOrAvailability), includes: parseCsv(includesInput) }),
      } as never;
      const result = isNeed ? await api.needs.update(itemId, payload) as InventoryResponse : await api.offers.update(itemId, payload) as InventoryResponse;
      const nextItem = (isNeed ? result.need : result.offer) as InventoryItem | undefined;
      if (nextItem) hydrateForm(nextItem);
      setEditing(false);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
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
    Alert.alert(t('inventory.delete.deleteTitle', { item: labelLower }), t('inventory.delete.deleteNativeBody', { item: label, items: labelsLower }), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      { text: t('inventory.actions.delete'), style: 'destructive', onPress: () => { void deleteItem(); } },
    ]);
  }

  async function deleteItem() {
    setSaving(true);
    setError(null);
    try {
      const result = isNeed ? await api.needs.remove(itemId) as InventoryResponse | undefined : await api.offers.remove(itemId) as InventoryResponse | undefined;
      if (result?.archived) {
        const archived = (isNeed ? result.need : result.offer) as InventoryItem | undefined;
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

  const updatedAt = formatLocalizedDate(typeof item?.updatedAt === 'string' ? item.updatedAt : null, language, '');

  const meta = useMemo(
    () => [itemTypeLabel(itemType, t), category, timingOrAvailability, modeLabel(mode, t), locationLabel].filter(Boolean).join(' · '),
    [category, itemType, locationLabel, mode, t, timingOrAvailability],
  );

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadItem(); }} />}
      >
        <AppHeader title={editing ? (isNeed ? t('inventory.actions.editNeed') : t('inventory.actions.editOffer')) : label} onBack={() => navigation.goBack()} />
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <SemanticBadge label={label} tone={tone} />
            <AppText style={styles.title}>{item?.title ?? fallbackTitle ?? label}</AppText>
          </View>
        </View>

        {error ? <InfoNotice tone="warning" body={error} /> : null}
        {!item && !loading ? <InfoNotice tone="danger" title={t('inventory.errors.unavailable', { item: label })} body={t('inventory.errors.notFoundTitle', { item: labelLower })} /> : null}

        {item ? (
          <>
            <AppCard>
              <View style={styles.statusRow}>
                <StatusBadge status={item.status} size="sm" />
                <AppText style={styles.updatedText}>{updatedAt ? `${t('inventory.labels.updated')} ${updatedAt}` : t('inventory.labels.updated')}</AppText>
              </View>

              {editing ? (
                <View style={styles.form}>
                  <InventoryTextField label={t('inventory.labels.title')} value={title} onChangeText={setTitle} placeholder={titlePlaceholder} disabled={saving} />
                  <InventoryTextField label={t('inventory.labels.description')} value={description} onChangeText={setDescription} placeholder={t('inventory.form.describeThis', { item: labelLower })} multiline disabled={saving} />
                  <InventoryTypePicker value={itemType} onChange={setItemType} disabled={saving} />
                  <InventoryTextField label={t('inventory.labels.category')} value={category} onChangeText={setCategory} placeholder={isNeed ? t('inventory.form.categoryNeedPlaceholder') : t('inventory.form.categoryOfferPlaceholder')} disabled={saving} />
                  <InventoryTextField label={timingLabel} value={timingOrAvailability} onChangeText={setTimingOrAvailability} placeholder={timingPlaceholder} disabled={saving} />
                  <InventoryModePicker value={mode} onChange={setMode} disabled={saving} />
                  <InventoryTextField label={t('inventory.labels.location')} value={locationLabel} onChangeText={setLocationLabel} placeholder={locationPlaceholder} disabled={saving} />
                  {!isNeed ? <InventoryTextField label={t('inventory.labels.includes')} value={includesInput} onChangeText={setIncludesInput} placeholder={t('inventory.form.includesMobilePlaceholder')} disabled={saving} /> : null}
                  <InventoryTextField label={t('inventory.labels.tags')} value={tagsInput} onChangeText={setTagsInput} placeholder={tagsPlaceholder} disabled={saving} />
                </View>
              ) : (
                <View style={styles.readOnly}>
                  <AppText style={styles.readTitle}>{item.title}</AppText>
                  <AppText style={styles.readDescription}>{item.description}</AppText>
                  {meta ? <AppText style={styles.metaText}>{meta}</AppText> : null}
                </View>
              )}
            </AppCard>

            <AppCard>
              <AppText style={styles.sectionTitle}>{t('inventory.labels.images')}</AppText>
              <ExistingMediaManager media={item.media} disabled={saving} onRemove={removeImage} />
              {editing ? <ImagePickerField images={newImages} onChange={setNewImages} disabled={saving} /> : null}
            </AppCard>

            <View style={styles.actions}>
              {editing ? (
                <PrimaryButton label={saving ? t('common.states.saving') : t('inventory.actions.saveChanges')} disabled={saving} onPress={() => { void saveItem(); }} />
              ) : (
                <PrimaryButton label={isNeed ? t('inventory.actions.editNeed') : t('inventory.actions.editOffer')} disabled={saving} onPress={() => setEditing(true)} />
              )}
              {editing ? <SecondaryButton label={t('common.actions.cancel')} disabled={saving} onPress={() => { hydrateForm(item); setEditing(false); }} /> : null}
              {item.status !== 'active' ? (
                <SecondaryButton label={t('inventory.actions.markActive')} disabled={saving} onPress={() => { void saveItem('active'); }} />
              ) : (
                <SecondaryButton label={isNeed ? t('inventory.actions.closeNeed') : t('inventory.actions.closeOffer')} disabled={saving} onPress={() => { void saveItem('closed'); }} />
              )}
              <DangerButton label={isNeed ? t('inventory.actions.deleteNeed') : t('inventory.actions.deleteOffer')} disabled={saving} onPress={confirmDelete} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1, gap: 8 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  updatedText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  form: { gap: 14 },
  readOnly: { gap: 9 },
  readTitle: { color: '#0F172A', fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  readDescription: { color: '#475569', lineHeight: 21, fontWeight: '600' },
  metaText: { color: '#64748B', fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  actions: { gap: 10 },
});
